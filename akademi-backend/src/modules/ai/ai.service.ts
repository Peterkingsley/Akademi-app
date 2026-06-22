import { PlayableLesson } from "./ai.types";
import { combinedTeachingPrompt } from "./teaching.prompts";
import { ReplyMode, Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { assembleSystemPrompt, whiteboardMathSystemPrompt } from './ai.prompts';
import { getAICacheKey, getCachedAIResponse, setCachedAIResponse, checkDailyLimit } from './ai.cache';
import { aiProvider } from './ai.provider';
import { OrchestratedAIResponse } from '../../shared/utils/ai-orchestrator';

function formatConversation(messages: Array<{ role: string; content: string; created_at: Date }>) {
  return messages
    .map((message) => `${message.role === 'STUDENT' ? 'Student' : 'Akademi'}: ${message.content}`)
    .join('\n\n');
}

const COMMUNITY_STOP_WORDS = new Set([
  'about', 'again', 'answer', 'because', 'before', 'being', 'could', 'course',
  'does', 'explain', 'from', 'have', 'into', 'just', 'know', 'learn', 'like',
  'make', 'more', 'question', 'school', 'should', 'show', 'student', 'tell',
  'that', 'their', 'them', 'then', 'there', 'these', 'they', 'thing', 'this',
  'topic', 'understand', 'what', 'when', 'where', 'which', 'with', 'would',
]);

function tokenizeForRelevance(value: unknown): string[] {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !COMMUNITY_STOP_WORDS.has(token));
}

function getPatternText(pattern: any): string {
  const payload = pattern.question_pattern || {};
  const tags = Array.isArray(payload.tags) ? payload.tags.join(' ') : '';
  return [
    pattern.university,
    pattern.faculty,
    pattern.department,
    payload.title,
    payload.story,
    payload.context_type,
    tags,
  ].filter(Boolean).join(' ');
}

function filterRelevantCommunityPatterns(patterns: any[], studentMessage: string, conversationHistory: string) {
  if (!patterns || patterns.length === 0) return [];

  const queryTokens = new Set(tokenizeForRelevance(`${studentMessage} ${conversationHistory.slice(-1200)}`));
  return patterns
    .map((pattern) => {
      const patternText = getPatternText(pattern);
      const patternTokens = tokenizeForRelevance(patternText);
      const score = patternTokens.filter((token) => queryTokens.has(token)).length;
      return { pattern, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.pattern);
}

export class AIService {
  private boardImperativeNotePattern = /^(set up|calculate|solve|find|differentiate|integrate|simplify|use|plug|rearrange|evaluate|apply)/i;

  private cleanBoardCopy(text: string) {
    return text.replace(/[*#]/g, '').trim();
  }

  private normalizeLatexExpression(latex: string) {
    return latex.replace(/\\\[/g, '').replace(/\\\]/g, '').trim();
  }

  private extractStandaloneMath(text: string) {
    const mathMatch = text.match(/\\\[([\s\S]*?)\\\]/);
    if (mathMatch) {
      return {
        cleanedText: text.replace(mathMatch[0], '').trim(),
        extractedMath: mathMatch[1].trim(),
      };
    }
    return { cleanedText: text, extractedMath: '' };
  }

  private expandWideBoardSteps(steps: any[]) {
    return steps;
  }

  private shouldSuppressBoardNote(note: string, text: string) {
    if (!note) return true;

    const normalizedNote = note.trim();
    if (!normalizedNote) return true;
    if (this.boardImperativeNotePattern.test(normalizedNote)) return true;

    const normalizedText = text.trim().toLowerCase();
    const noteComparable = normalizedNote.toLowerCase();
    if (normalizedText && (normalizedText.includes(noteComparable) || noteComparable.includes(normalizedText))) {
      return true;
    }

    return false;
  }

  private normalizeBoardStep(step: { id: string; type: string; text: string; math: string; note: string }) {
    const textExtraction = this.extractStandaloneMath(step.text);
    const noteExtraction = this.extractStandaloneMath(step.note);
    const existingMath = this.normalizeLatexExpression(step.math);
    const fallbackMathParts = [
      existingMath,
      ...(existingMath ? [] : [textExtraction.extractedMath, noteExtraction.extractedMath]),
    ].filter(Boolean);

    const uniqueMath = [...new Set(fallbackMathParts)];
    const text = this.cleanBoardCopy(textExtraction.cleanedText || step.text.trim());
    const rawNote = this.cleanBoardCopy(noteExtraction.cleanedText || step.note.trim());
    const note = this.shouldSuppressBoardNote(rawNote, text) ? '' : rawNote;

    const shortenedText = text.length > 180
      ? text.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').trim()
      : text;
    const shortenedNote = note.length > 140
      ? note.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').trim()
      : note;

    return {
      ...step,
      text: shortenedText,
      math: uniqueMath.join(' \\ '),
      note: shortenedNote,
    };
  }

  private isBoardEligibleQuestion(studentMessage: string, session: { session_type: string; course_code?: string | null }) {
    if (session.session_type !== 'ASSIGNMENT') return false;

    const text = studentMessage.toLowerCase();
    const mathSignals = [
      'solve', 'calculate', 'ratio', 'simplify', 'differentiate', 'derivative',
      'dy/dx', 'dydx', 'differentiate', 'integrate', 'integration', 'limit',
      'find x', 'solve for x', 'quadratic', 'factorize', 'logarithm',
      'trigonometry', 'sin', 'cos', 'tan', 'equation', 'simultaneous',
      'matrix', 'probability', 'mean', 'median', 'fraction', 'percentage',
      'velocity', 'acceleration', 'force', 'kinetic energy', 'mole', 'molar',
      'stoichiometry', 'balance this reaction',
    ];

    const symbolSignals = /[\d]+\s*[\+\-\*\/=]|[÷×√π∫Σ]|\bdy\/dx\b|\bdx\b|\bx\^|\bx²|\bx³/.test(studentMessage);
    const keywordSignal = mathSignals.some((signal) => text.includes(signal));
    const courseSignal = /mth|mat|phy|chm|sta/i.test(session.course_code || '');

    return symbolSignals || keywordSignal || courseSignal;
  }

  private extractJsonObject(raw: string) {
    const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }

    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return raw.slice(firstBrace, lastBrace + 1);
    }

    return raw.trim();
  }

  private parseWhiteboardPayload(raw: string) {
    try {
      const parsed = JSON.parse(this.extractJsonObject(raw));
      const steps = Array.isArray(parsed?.steps) ? parsed.steps : [];
      if (typeof parsed?.final_answer !== 'string' || steps.length === 0) {
        return null;
      }

      const normalizedSteps = steps
        .map((step: any, index: number) => ({
          id: typeof step?.id === 'string' ? step.id : `step-${index + 1}`,
          type: ['write', 'highlight', 'answer'].includes(step?.type) ? step.type : 'write',
          text: String(step?.text || '').trim(),
          math: String(step?.math || '').trim(),
          note: String(step?.note || '').trim(),
        }))
        .map((step: { id: string; type: string; text: string; math: string; note: string }) => this.normalizeBoardStep(step))
        .filter((step: { text: string; math: string }) => step.text.length > 0 || step.math.length > 0);

      const expandedSteps = this.expandWideBoardSteps(normalizedSteps);

      if (expandedSteps.length === 0) return null;

      return {
        title: String(parsed?.title || 'Board walkthrough'),
        board_style: 'digital-whiteboard',
        steps: expandedSteps,
        final_answer: parsed.final_answer.trim(),
        final_answer_math: this.normalizeLatexExpression(String(parsed?.final_answer_math || parsed?.final_answer || '').trim()),
        summary: String(parsed?.summary || '').trim(),
      };
    } catch {
      return null;
    }
  }

  private async buildWhiteboardPayload(studentMessage: string, answer: string) {
    try {
      const raw = await aiProvider.generateResponse(
        `Question: ${studentMessage}

Reference solution:
${answer}

Create a board replay plan for this solution.`,
        {
          systemPrompt: whiteboardMathSystemPrompt,
          maxTokens: 900,
        }
      );

      return this.parseWhiteboardPayload(raw);
    } catch (error) {
      console.error('Whiteboard payload generation failed:', error);
      return null;
    }
  }

  async getOrchestratedResponse(
    userId: string,
    sessionId: string,
    studentMessage: string,
    replyMode: ReplyMode,
    hasActivePaidFeature: boolean
  ): Promise<OrchestratedAIResponse> {
    await checkDailyLimit(userId, hasActivePaidFeature);

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        material: {
          select: {
            id: true,
            title: true,
            course_code: true,
            content: true,
            reader_structure: true,
          },
        },
        messages: {
          orderBy: { created_at: 'asc' },
          select: {
            role: true,
            content: true,
            created_at: true,
          },
        },
      },
    });
    if (!session) throw new Error('Session not found');

    const learningProfile = await prisma.learningProfile.findUnique({
      where: { user_id: userId },
    });

    const communityPatterns = await prisma.communityPattern.findMany({
      where: {
        OR: [
          {
            university: session.university,
            faculty: 'ALL',
            department: 'ALL',
            course_code: null,
            question_pattern: { path: ['is_active'], equals: true },
          },
          {
            department: session.department,
            course_code: session.course_code || undefined,
          },
        ],
      },
      orderBy: { updated_at: 'desc' },
      take: 8,
    });

    const disciplineDocument = await prisma.disciplineDocument.findFirst({
      where: {
        department: session.department,
        is_active: true,
      },
      orderBy: { version: 'desc' },
    });

    const effectiveReplyMode = replyMode === ReplyMode.SOCRATIC ? ReplyMode.STUDY : replyMode;
    const recentMessages = session.messages.slice(-12);
    const conversationHistory = formatConversation(recentMessages);
    const relevantCommunityPatterns = filterRelevantCommunityPatterns(
      communityPatterns,
      studentMessage,
      conversationHistory
    );
    const isFollowUp = session.messages.length > 1;
    const prompt = isFollowUp
      ? `Continue this existing learning conversation.

Recent conversation:
${conversationHistory}

Latest student reply:
${studentMessage}

Important:
- Treat the latest student reply as a response to Akademi's previous question.
- Do not restart the explanation unless the student asks to restart.
- If the previous Akademi message asked a question, evaluate the student's answer first.
- If the student says they do not know or seem confused, explain the missing idea directly before asking anything else.
- Do not trap the student in repeated questions. Move the explanation forward.`
      : studentMessage;

    const cacheKey = getAICacheKey(
      session.course_code || 'GENERAL',
      studentMessage,
      effectiveReplyMode,
      disciplineDocument?.version || 1
    );

    const cachedResponse = isFollowUp ? null : await getCachedAIResponse(cacheKey);
    if (cachedResponse) return { content: cachedResponse };

    const systemPrompt = assembleSystemPrompt(
      disciplineDocument,
      learningProfile,
      relevantCommunityPatterns,
      effectiveReplyMode,
      session.material
        ? {
            title: session.material.title,
            course_code: session.material.course_code,
            content: session.material.content,
            reader_structure: session.material.reader_structure,
          }
        : null,
      session.session_type,
    );

    const aiResponseText = await aiProvider.generateResponse(prompt, {
      systemPrompt,
      maxTokens: 1000,
    });

    const whiteboardPayload = this.isBoardEligibleQuestion(studentMessage, session)
      ? await this.buildWhiteboardPayload(studentMessage, aiResponseText)
      : null;

    if (!isFollowUp) {
      await setCachedAIResponse(cacheKey, aiResponseText);
    }

    return {
      content: aiResponseText,
      metadata: whiteboardPayload
        ? {
            whiteboard: {
              available: true,
              subject_family: 'quantitative',
              payload: whiteboardPayload,
            },
          }
        : undefined,
    };
  }

  async generateTeachingLesson(
    userId: string,
    sessionId: string,
    studentMessage: string,
    materialContext?: string
  ): Promise<any> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        material: true,
        messages: {
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!session) throw new Error('Session not found');

    const prompt = `
      Context: ${materialContext || session.material?.content || 'No specific material content provided.'}
      Student Message: ${studentMessage}
      Conversation History: ${session.messages.map(m => m.role + ': ' + m.content).join('\n')}
    `;

    const response = await aiProvider.generateResponse(prompt, {
      systemPrompt: combinedTeachingPrompt,
      maxTokens: 2000,
    });

    const parsedLesson = JSON.parse(this.extractJsonObject(response));
    const segments = Array.isArray(parsedLesson?.segments) ? parsedLesson.segments : [];

    if (segments.length === 0) {
      throw new Error('AI failed to generate a structured lesson. Please try again.');
    }

    const createdSegments = [];

    for (const [index, segmentData] of segments.entries()) {
      const captionChunks = Array.isArray(segmentData?.caption_chunks) ? segmentData.caption_chunks : [];
      const visualCues = Array.isArray(segmentData?.visual_cues) ? segmentData.visual_cues : [];

      const segment = await prisma.lessonSegment.create({
        data: {
          session_id: sessionId,
          concept_title: String(segmentData?.concept_title || 'Untitled Concept'),
          script: String(segmentData?.script || ''),
          order: index,
          estimated_duration_ms: captionChunks.reduce((acc: number, c: any) => acc + (Number(c?.duration_ms) || 0), 0),
        },
      });

      const createdCues = [];
      for (const cueData of visualCues) {
        const cue = await prisma.visualCue.create({
          data: {
            segment_id: segment.id,
            visual_type: String(cueData?.visual_type || 'title_board'),
            render_mode: String(cueData?.render_mode || 'bullet_card'),
            start_ms: Number(cueData?.start_ms) || 0,
            end_ms: Number(cueData?.end_ms) || 10000,
            payload: (cueData?.payload || {}) as Prisma.InputJsonValue,
          },
        });
        createdCues.push(cue);
      }

      createdSegments.push({
        ...segment,
        visual_cues: createdCues,
      });
    }

    return createdSegments;
  }
}

export const aiService = new AIService();

import { ReplyMode } from '@prisma/client';
import prisma from '../../config/db';
import { assembleSystemPrompt, whiteboardMathSystemPrompt } from './ai.prompts';
import { combinedTeachingPrompt } from './teaching.prompts';
import { getAICacheKey, getCachedAIResponse, setCachedAIResponse, checkDailyLimit } from './ai.cache';
import { aiProvider } from './ai.provider';
import { tutorOrchestrator } from './tutor-orchestrator';
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
  if (queryTokens.size === 0) return patterns.filter((pattern) => (pattern.question_pattern || {}).type !== 'school_story').slice(0, 3);

  const scored = patterns.map((pattern) => {
    const payload = pattern.question_pattern || {};
    const textTokens = new Set(tokenizeForRelevance(getPatternText(pattern)));
    let score = 0;

    queryTokens.forEach((token) => {
      if (textTokens.has(token)) score += 1;
    });

    if (payload.type !== 'school_story') score += 1;
    if (payload.type === 'school_story' && score > 0) score += 1;

    return { pattern, score };
  });

  return scored
    .filter(({ pattern, score }) => {
      const payload = pattern.question_pattern || {};
      return payload.type === 'school_story' ? score >= 2 : score > 0;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ pattern }) => pattern);
}

export class AIService {
  private readonly boardImperativeNotePattern =
    /^(define|set up|calculate|explain|find|simplify|differentiate|integrate|apply|substitute|rearrange|evaluate|state|show)\b/i;

  private splitEquationChain(math: string) {
    const compact = math.replace(/\s+/g, ' ').trim();
    if (!compact) return [];

    const multilineParts = compact
      .split(/\s*\\\\\s*/)
      .map((part) => part.trim())
      .filter(Boolean);

    const splitPartOnEquals = (value: string) => {
      const segments = value.split(/\s=\s/g).map((segment) => segment.trim()).filter(Boolean);
      if (segments.length <= 2) return [value.trim()];

      const chained: string[] = [];
      for (let index = 0; index < segments.length - 1; index += 1) {
        chained.push(`${segments[index]} = ${segments[index + 1]}`);
      }
      return chained;
    };

    return multilineParts.flatMap(splitPartOnEquals).filter(Boolean);
  }

  private expandWideBoardSteps(steps: Array<{ id: string; type: string; text: string; math: string; note: string }>) {
    const expanded: Array<{ id: string; type: string; text: string; math: string; note: string }> = [];

    steps.forEach((step) => {
      const mathSegments = this.splitEquationChain(step.math);
      const shouldSplit = mathSegments.length > 1 || step.math.length > 110;

      if (!step.math || !shouldSplit) {
        expanded.push(step);
        return;
      }

      const segments = mathSegments.length > 0 ? mathSegments : [step.math];
      segments.forEach((segment, index) => {
        expanded.push({
          ...step,
          id: `${step.id}-${index + 1}`,
          text: index === 0 ? step.text : index === segments.length - 1 ? 'Continue the simplification.' : 'Next transformation.',
          math: segment,
          note: index === segments.length - 1 ? step.note : '',
        });
      });
    });

    return expanded.slice(0, 16);
  }

  private normalizeLatexExpression(value: string) {
    if (!value) return '';

    let normalized = value.trim();

    normalized = normalized
      .replace(/\$\$?/g, '')
      .replace(/\\\((.*?)\\\)/g, '$1')
      .replace(/\\\[(.*?)\\\]/g, '$1')
      .replace(/\bdy\/dx\b/gi, '\\frac{dy}{dx}')
      .replace(/\bd\/dx\b/gi, '\\frac{d}{dx}')
      .replace(/\bsqrt\s*\(([^)]+)\)/gi, '\\sqrt{$1}')
      .replace(/\*/g, ' \\cdot ')
      .replace(/÷/g, '\\div')
      .replace(/×/g, '\\cdot')
      .replace(/\s+/g, ' ')
      .trim();

    normalized = normalized
      .replace(/\bwhere\b[\s\S]*$/i, '')
      .replace(/\bhere\b[\s\S]*$/i, '')
      .replace(/\bbecause\b[\s\S]*$/i, '')
      .replace(/,\s*[A-Za-z][A-Za-z\s,'-]*$/g, '')
      .trim();

    normalized = normalized.replace(/([A-Za-z0-9\)\}])\^([A-Za-z0-9])/g, '$1^{$2}');

    return normalized;
  }

  private looksLikeStandaloneMath(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return false;

    const letterWords = trimmed.match(/[A-Za-z]{3,}/g) || [];
    const symbolMatches = trimmed.match(/[=^\\+\-*/()[\]{}]|dy\/dx|d\/dx|sqrt/gi) || [];

    return symbolMatches.length >= 2 && letterWords.length <= 2;
  }

  private extractStandaloneMath(value: string) {
    if (!value) return { cleanedText: '', extractedMath: '' };

    const trimmed = value.trim();
    const explicitDisplayMatch = trimmed.match(/^\\\[(.*)\\\]$/s);
    const explicitInlineMatch = trimmed.match(/^\\\((.*)\\\)$/s);
    const explicitMatch = explicitDisplayMatch || explicitInlineMatch;

    if (explicitMatch?.[1]) {
      const normalized = this.normalizeLatexExpression(explicitMatch[1]);
      return { cleanedText: '', extractedMath: normalized };
    }

    if (this.looksLikeStandaloneMath(trimmed)) {
      return {
        cleanedText: '',
        extractedMath: this.normalizeLatexExpression(trimmed),
      };
    }

    return {
      cleanedText: trimmed.replace(/\s+/g, ' ').trim(),
      extractedMath: '',
    };
  }

  private cleanBoardCopy(value: string) {
    return value
      .replace(/\s+,/g, ',')
      .replace(/\s+\./g, '.')
      .replace(/\s+:/g, ':')
      .replace(/\(\s+\)/g, '()')
      .replace(/\s{2,}/g, ' ')
      .trim();
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
      math: uniqueMath.join(' \\\\ '),
      note: shortenedNote,
    };
  }

  private isBoardEligibleQuestion(studentMessage: string, session: { session_type: string; course_code?: string | null }) {
    if (session.session_type !== 'ASSIGNMENT') return false;

    const text = studentMessage.toLowerCase();
    const mathSignals = [
      'solve',
      'calculate',
      'ratio',
      'simplify',
      'differentiate',
      'derivative',
      'dy/dx',
      'dydx',
      'differentiate',
      'integrate',
      'integration',
      'limit',
      'find x',
      'solve for x',
      'quadratic',
      'factorize',
      'logarithm',
      'trigonometry',
      'sin',
      'cos',
      'tan',
      'equation',
      'simultaneous',
      'matrix',
      'probability',
      'mean',
      'median',
      'fraction',
      'percentage',
      'velocity',
      'acceleration',
      'force',
      'kinetic energy',
      'mole',
      'molar',
      'stoichiometry',
      'balance this reaction',
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

  private parseTeachingPayload(raw: string) {
    try {
      const parsed = JSON.parse(this.extractJsonObject(raw));
      const segments = Array.isArray(parsed?.segments) ? parsed.segments : [];
      return segments
        .map((segment: any, index: number) => {
          const chunks = Array.isArray(segment?.caption_chunks) ? segment.caption_chunks : [];
          const visualCues = Array.isArray(segment?.visual_cues) ? segment.visual_cues : [];
          const script = String(segment?.script || chunks.map((chunk: any) => chunk?.text).filter(Boolean).join(' ')).trim();
          const estimatedDurationMs = chunks.reduce(
            (total: number, chunk: any) => total + Math.max(Number(chunk?.duration_ms) || 0, 0),
            0,
          );

          if (!script) return null;

          return {
            concept_title: String(segment?.concept_title || `Lesson part ${index + 1}`).trim(),
            script,
            caption_chunks: chunks
              .map((chunk: any, chunkIndex: number) => ({
                id: typeof chunk?.id === 'string' ? chunk.id : `chunk-${index + 1}-${chunkIndex + 1}`,
                text: String(chunk?.text || '').trim(),
                duration_ms: Math.max(Number(chunk?.duration_ms) || 0, 0),
              }))
              .filter((chunk: { text: string }) => chunk.text.length > 0)
              .slice(0, 24),
            order: index + 1,
            estimated_duration_ms: estimatedDurationMs || Math.max(script.split(/\s+/).length * 350, 15000),
            visual_cues: visualCues
              .map((cue: any) => ({
                visual_type: String(cue?.visual_type || 'bullet_card'),
                render_mode: String(cue?.render_mode || 'bullet_card'),
                start_ms: Math.max(Number(cue?.start_ms) || 0, 0),
                end_ms: Math.max(Number(cue?.end_ms) || 0, Number(cue?.start_ms) || 0, 5000),
                payload: cue?.payload && typeof cue.payload === 'object'
                  ? cue.payload
                  : {
                      title: String(segment?.concept_title || `Lesson part ${index + 1}`),
                      bullets: [script.slice(0, 180)],
                    },
              }))
              .slice(0, 6),
          };
        })
        .filter(Boolean)
        .slice(0, 10) as Array<{
          concept_title: string;
          script: string;
          caption_chunks: Array<{
            id: string;
            text: string;
            duration_ms: number;
          }>;
          order: number;
          estimated_duration_ms: number;
          visual_cues: Array<{
            visual_type: string;
            render_mode: string;
            start_ms: number;
            end_ms: number;
            payload: Record<string, unknown>;
          }>;
        }>;
    } catch {
      return [];
    }
  }

  async generateTeachingLesson(
    userId: string,
    sessionId: string,
    studentMessage: string,
    materialContext?: string,
  ) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        material: {
          select: {
            title: true,
            course_code: true,
            content: true,
            reader_structure: true,
          },
        },
        messages: {
          orderBy: { created_at: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            created_at: true,
          },
        },
      },
    });

    if (!session) throw new Error('Session not found');
    if (session.user_id !== userId) throw new Error('You do not have access to this session');

    const latestAiMessage = [...session.messages].reverse().find((message) => message.role === 'AI');
    const materialExcerpt = [
      materialContext,
      session.material?.content,
      studentMessage,
    ]
      .filter(Boolean)
      .join('\n\n')
      .replace(/\s+/g, ' ')
      .slice(0, 9000);

    const raw = await aiProvider.generateResponse(
      `Create a playable teaching lesson for this AI Tutor session.

Session topic: ${session.topic || session.material?.title || 'AI Tutor lesson'}
Course code: ${session.course_code || session.material?.course_code || 'General'}

Recent AI teaching message:
${latestAiMessage?.content || studentMessage}

Material context:
${materialExcerpt}`,
      {
        systemPrompt: combinedTeachingPrompt,
        maxTokens: 2500,
      },
    );

    let segments = this.parseTeachingPayload(raw);

    if (segments.length === 0) {
      const fallbackScript = studentMessage.trim() || latestAiMessage?.content || 'Let us start by breaking this material into its first teachable idea.';
      segments = [{
        concept_title: session.material?.title || session.topic || 'Tutor lesson',
        script: fallbackScript,
        caption_chunks: [{
          id: 'chunk-1-1',
          text: fallbackScript,
          duration_ms: Math.max(fallbackScript.split(/\s+/).length * 350, 15000),
        }],
        order: 1,
        estimated_duration_ms: Math.max(fallbackScript.split(/\s+/).length * 350, 15000),
        visual_cues: [{
          visual_type: 'bullet_card',
          render_mode: 'bullet_card',
          start_ms: 0,
          end_ms: 12000,
          payload: {
            title: session.material?.title || session.topic || 'Tutor lesson',
            bullets: [fallbackScript.slice(0, 180)],
          },
        }],
      }];
    }

    const existingSegments = await prisma.lessonSegment.findMany({
      where: { session_id: sessionId },
      select: { id: true },
    });
    const existingSegmentIds = existingSegments.map((segment) => segment.id);

    if (existingSegmentIds.length > 0) {
      await prisma.visualCue.deleteMany({
        where: { segment_id: { in: existingSegmentIds } },
      });
      await prisma.lessonSegment.deleteMany({
        where: { id: { in: existingSegmentIds } },
      });
    }

    for (const segment of segments) {
      await prisma.lessonSegment.create({
        data: {
          session_id: sessionId,
          message_id: latestAiMessage?.id || null,
          concept_title: segment.concept_title,
          script: segment.script,
          caption_chunks: segment.caption_chunks as any,
          order: segment.order,
          estimated_duration_ms: segment.estimated_duration_ms,
          visual_cues: {
            create: segment.visual_cues.map((cue) => ({
              visual_type: cue.visual_type,
              render_mode: cue.render_mode,
              start_ms: cue.start_ms,
              end_ms: cue.end_ms,
              payload: cue.payload as any,
            })),
          },
        },
      });
    }

    return prisma.lessonSegment.findMany({
      where: { session_id: sessionId },
      orderBy: { order: 'asc' },
      include: { visual_cues: true },
    });
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
    // 1. Check daily limit
    await checkDailyLimit(userId, hasActivePaidFeature);

    // 2. Fetch session and context
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
    const adaptiveTurn = await tutorOrchestrator.prepareTurn(userId, session, studentMessage);
    const prompt = isFollowUp
      ? `Continue this existing learning conversation.

Recent conversation:
${conversationHistory}

Latest student reply:
${studentMessage}

${adaptiveTurn?.promptContext || ''}

Important:
- Treat the latest student reply as a response to Akademi's previous question.
- Do not restart the explanation unless the student asks to restart.
- If the previous Akademi message asked a question, evaluate the student's answer first.
- If the student says they do not know or seem confused, explain the missing idea directly before asking anything else.
- Do not trap the student in repeated questions. Move the explanation forward.`
      : adaptiveTurn?.promptContext
        ? `${studentMessage}

${adaptiveTurn.promptContext}`
        : studentMessage;

    // 3. Cache check. Multi-turn sessions must include conversation context, so do not reuse a standalone answer.
    const cacheKey = getAICacheKey(
      session.course_code || 'GENERAL',
      studentMessage,
      effectiveReplyMode,
      disciplineDocument?.version || 1
    );

    const cachedResponse = isFollowUp || session.session_type === 'TUTOR' ? null : await getCachedAIResponse(cacheKey);
    if (cachedResponse) return { content: cachedResponse };

    // 4. Assemble system prompt
    const systemPrompt = [
      assembleSystemPrompt(
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
      ),
      adaptiveTurn?.promptContext || '',
    ].filter(Boolean).join('\n\n---\n\n');

    // 5. Call AI Provider (Claude with Gemini fallback)
    const aiResponseText = await aiProvider.generateResponse(prompt, {
      systemPrompt,
      maxTokens: 1000,
    });

    const whiteboardPayload = this.isBoardEligibleQuestion(studentMessage, session)
      ? await this.buildWhiteboardPayload(studentMessage, aiResponseText)
      : null;

    // 6. Cache response
    if (!isFollowUp && session.session_type !== 'TUTOR') {
      await setCachedAIResponse(cacheKey, aiResponseText);
    }

    return {
      content: aiResponseText,
      metadata: {
        ...(adaptiveTurn?.metadata || {}),
        ...(whiteboardPayload
          ? {
              whiteboard: {
                available: true,
                subject_family: 'quantitative',
                payload: whiteboardPayload,
              },
            }
          : {}),
      },
    };
  }
}

export const aiService = new AIService();

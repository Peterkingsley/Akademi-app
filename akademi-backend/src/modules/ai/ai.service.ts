import { ReplyMode } from '@prisma/client';
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

  private extractLatexCandidates(value: string) {
    if (!value) return { cleanedText: '', extractedMath: [] as string[] };

    let working = value;
    const extractedMath: string[] = [];

    const pullMatch = (regex: RegExp, formatter?: (match: RegExpExecArray) => string) => {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(working)) !== null) {
        const raw = formatter ? formatter(match) : (match[1] || match[0]);
        const normalized = this.normalizeLatexExpression(raw);
        if (normalized) extractedMath.push(normalized);
      }
      working = working.replace(regex, ' ');
    };

    pullMatch(/\$([^$]+)\$/g);
    pullMatch(/\\\((.+?)\\\)/g);

    const sentences = working
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    const keptSentences: string[] = [];

    sentences.forEach((sentence) => {
      if (this.looksLikeStandaloneMath(sentence)) {
        const normalized = this.normalizeLatexExpression(sentence);
        if (normalized) {
          extractedMath.push(normalized);
          return;
        }
      }
      keptSentences.push(sentence);
    });

    const uniqueMath = [...new Set(extractedMath.filter(Boolean))];

    return {
      cleanedText: keptSentences.join(' ').replace(/\s+/g, ' ').trim(),
      extractedMath: uniqueMath,
    };
  }

  private normalizeBoardStep(step: { id: string; type: string; text: string; math: string; note: string }) {
    const textExtraction = this.extractLatexCandidates(step.text);
    const noteExtraction = this.extractLatexCandidates(step.note);
    const existingMath = this.normalizeLatexExpression(step.math);
    const combinedMathParts = [
      existingMath,
      ...(existingMath ? [] : textExtraction.extractedMath),
      ...(existingMath ? [] : noteExtraction.extractedMath),
    ].filter(Boolean);

    const uniqueMath = [...new Set(combinedMathParts)];
    const text = textExtraction.cleanedText || step.text.trim();
    const note = noteExtraction.cleanedText || step.note.trim();

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

    // 3. Cache check. Multi-turn sessions must include conversation context, so do not reuse a standalone answer.
    const cacheKey = getAICacheKey(
      session.course_code || 'GENERAL',
      studentMessage,
      effectiveReplyMode,
      disciplineDocument?.version || 1
    );

    const cachedResponse = isFollowUp ? null : await getCachedAIResponse(cacheKey);
    if (cachedResponse) return { content: cachedResponse };

    // 4. Assemble system prompt
    const systemPrompt = assembleSystemPrompt(
      disciplineDocument,
      learningProfile,
      relevantCommunityPatterns,
      effectiveReplyMode
    );

    // 5. Call AI Provider (Claude with Gemini fallback)
    const aiResponseText = await aiProvider.generateResponse(prompt, {
      systemPrompt,
      maxTokens: 1000,
    });

    const whiteboardPayload = this.isBoardEligibleQuestion(studentMessage, session)
      ? await this.buildWhiteboardPayload(studentMessage, aiResponseText)
      : null;

    // 6. Cache response
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
}

export const aiService = new AIService();

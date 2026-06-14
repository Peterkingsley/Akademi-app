import { ReplyMode } from '@prisma/client';
import prisma from '../../config/db';
import { assembleSystemPrompt } from './ai.prompts';
import { getAICacheKey, getCachedAIResponse, setCachedAIResponse, checkDailyLimit } from './ai.cache';
import { aiProvider } from './ai.provider';

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
  async getOrchestratedResponse(
    userId: string,
    sessionId: string,
    studentMessage: string,
    replyMode: ReplyMode,
    hasActivePaidFeature: boolean
  ): Promise<string> {
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
    if (cachedResponse) return cachedResponse;

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

    // 6. Cache response
    if (!isFollowUp) {
      await setCachedAIResponse(cacheKey, aiResponseText);
    }

    return aiResponseText;
  }
}

export const aiService = new AIService();

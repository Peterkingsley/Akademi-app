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
        department: session.department,
        course_code: session.course_code || undefined,
      },
    });

    const disciplineDocument = await prisma.disciplineDocument.findFirst({
      where: {
        department: session.department,
        course_code: session.course_code || undefined,
        is_active: true,
      },
      orderBy: { version: 'desc' },
    });

    const effectiveReplyMode = replyMode === ReplyMode.SOCRATIC ? ReplyMode.STUDY : replyMode;
    const recentMessages = session.messages.slice(-12);
    const conversationHistory = formatConversation(recentMessages);
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
      communityPatterns,
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

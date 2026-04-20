import { ReplyMode } from '@prisma/client';
import prisma from '../../config/db';
import { assembleSystemPrompt } from './ai.prompts';
import { getAICacheKey, getCachedAIResponse, setCachedAIResponse, checkDailyLimit } from './ai.cache';
import { aiProvider } from './ai.provider';

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
    });
    if (!session) throw new Error('Session not found');

    const learningProfile = await prisma.learningProfile.findUnique({
      where: { user_id: userId },
    });

    const communityPatterns = await prisma.communityPattern.findMany({
      where: {
        department: session.department,
        course_code: session.course_code,
      },
    });

    const disciplineDocument = await prisma.disciplineDocument.findFirst({
      where: {
        department: session.department,
        course_code: session.course_code,
        is_active: true,
      },
      orderBy: { version: 'desc' },
    });

    // 3. Cache check
    const cacheKey = getAICacheKey(
      session.course_code,
      studentMessage,
      replyMode,
      disciplineDocument?.version || 1
    );

    const cachedResponse = await getCachedAIResponse(cacheKey);
    if (cachedResponse) return cachedResponse;

    // 4. Assemble system prompt
    const systemPrompt = assembleSystemPrompt(
      disciplineDocument,
      learningProfile,
      communityPatterns,
      replyMode
    );

    // 5. Call AI Provider (Claude with Gemini fallback)
    const aiResponseText = await aiProvider.generateResponse(studentMessage, {
      systemPrompt,
      maxTokens: 1000,
    });

    // 6. Cache response
    await setCachedAIResponse(cacheKey, aiResponseText);

    return aiResponseText;
  }
}

export const aiService = new AIService();

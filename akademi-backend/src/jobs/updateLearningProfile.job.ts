import prisma from '../config/db';
import { VocabularyLevel, ReplyMode } from '@prisma/client';
import { aiProvider } from '../modules/ai/ai.provider';

export async function updateLearningProfileJob(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { messages: true },
  });
  if (!session) throw new Error('Session not found');

  const learningProfile = await prisma.learningProfile.findUnique({
    where: { user_id: session.user_id },
  });

  const prompt = `Analyze the following session messages to update the student's learning profile.
  Messages: ${JSON.stringify(session.messages)}
  Current Profile: ${JSON.stringify(learningProfile)}
  Output JSON format: { subject_strengths: any, subject_weaknesses: any, vocabulary_level: 'BASIC'|'INTERMEDIATE'|'ADVANCED', preferred_reply_mode: 'DIRECT'|'STUDY'|'QUESTION'|'WRONGLY', question_patterns: any, community_pattern: any }`;

  const aiOutput = await aiProvider.generateResponse(prompt, {
    systemPrompt: 'Analyze student learning patterns. Return ONLY valid JSON.',
    maxTokens: 1000,
  });

  const analysis = JSON.parse(aiOutput);

  // Update learning profile
  await prisma.learningProfile.update({
    where: { user_id: session.user_id },
    data: {
      subject_strengths: analysis.subject_strengths,
      subject_weaknesses: analysis.subject_weaknesses,
      vocabulary_level: analysis.vocabulary_level as VocabularyLevel,
      preferred_reply_mode: analysis.preferred_reply_mode as ReplyMode,
      question_patterns: analysis.question_patterns,
      session_count: { increment: 1 },
      last_active: new Date(),
    },
  });

  // Update community patterns
  if (analysis.community_pattern) {
    // In real app, hash the pattern to find existing. Using simplified logic here.
    const patternKey = `${session.university}-${session.department}-${session.course_code}`;
    await prisma.communityPattern.upsert({
      where: {
        id: patternKey,
      },
      update: { frequency: { increment: 1 } },
      create: {
        id: patternKey,
        university: session.university,
        faculty: 'Unknown',
        department: session.department,
        course_code: session.course_code,
        question_pattern: analysis.community_pattern,
      },
    });
  }
}

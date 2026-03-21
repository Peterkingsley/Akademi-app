import prisma from '../config/db';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';
import { VocabularyLevel, ReplyMode } from '@prisma/client';

const anthropic = new Anthropic({ apiKey: config.claudeApiKey });

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

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: "Analyze student learning patterns.",
    messages: [{ role: 'user', content: prompt }]
  });

  const analysis = JSON.parse((response.content[0] as any).text);

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
    await prisma.communityPattern.upsert({
      where: {
        id: 'some-unique-id-logic', // In real app, hash the pattern to find existing
        // For simplicity using create if not exists logic below
      },
      update: { frequency: { increment: 1 } },
      create: {
        university: session.university,
        faculty: 'Unknown', // Should fetch from user
        department: session.department,
        course_code: session.course_code,
        question_pattern: analysis.community_pattern,
      },
    });
  }
}

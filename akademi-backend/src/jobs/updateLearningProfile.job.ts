import prisma from '../config/db';
import { VocabularyLevel, ReplyMode } from '@prisma/client';
import { aiProvider } from '../modules/ai/ai.provider';

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Learning profile analysis was not valid JSON');
    return JSON.parse(match[0]);
  }
}

function clampMastery(value: unknown) {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return 0;
  return Math.max(0, Math.min(1, numberValue));
}

export async function updateLearningProfileJob(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { messages: true },
  });
  if (!session) throw new Error('Session not found');

  const learningProfile = await prisma.learningProfile.findUnique({
    where: { user_id: session.user_id },
  });

  const prompt = `Analyze the following Akademi learning session and update the student's learning intelligence.

Messages: ${JSON.stringify(session.messages)}
Current Profile: ${JSON.stringify(learningProfile)}
Session Context: ${JSON.stringify({
    university: session.university,
    department: session.department,
    course_code: session.course_code,
    session_type: session.session_type,
  })}

Return ONLY valid JSON with this exact shape:
{
  "subject_strengths": {
    "mastery": { "Topic name": 0.0 },
    "mastered_topics": ["..."]
  },
  "subject_weaknesses": {
    "struggles_with": ["..."],
    "weak_topics": ["..."]
  },
  "vocabulary_level": "BASIC" | "INTERMEDIATE" | "ADVANCED",
  "preferred_reply_mode": "DIRECT" | "STUDY" | "QUESTION" | "WRONGLY" | "SOCRATIC",
  "question_patterns": {
    "knowledge_gaps": ["..."],
    "learning_objective": "...",
    "confusion_score": 0.0,
    "misconceptions": ["..."],
    "follow_up_question": "...",
    "recommended_next_topics": ["..."],
    "high_exam_probability": ["..."],
    "study_plan_tomorrow": ["30 mins ...", "20 mins ..."]
  },
  "community_pattern": {
    "topic": "...",
    "common_gap": "...",
    "common_misconception": "...",
    "exam_probability_signal": "low" | "medium" | "high"
  }
}

Rules:
- confusion_score must be 0 to 1.
- mastery values must be 0 to 1.
- infer knowledge gaps from repeated uncertainty, wrong assumptions, and prerequisite jumps.
- if the student asks "I don't understand" or similar, increase confusion_score.
- produce concise arrays; do not invent too many topics.`;

  const aiOutput = await aiProvider.generateResponse(prompt, {
    systemPrompt: 'Analyze student learning patterns. Return ONLY valid JSON.',
    maxTokens: 1000,
  });

  const analysis = safeJsonParse(aiOutput);

  const normalizedStrengths = {
    ...(analysis.subject_strengths || {}),
    mastery: Object.fromEntries(
      Object.entries(analysis.subject_strengths?.mastery || {}).map(([topic, value]) => [topic, clampMastery(value)])
    ),
  };

  const normalizedPatterns = {
    ...(analysis.question_patterns || {}),
    confusion_score: clampMastery(analysis.question_patterns?.confusion_score),
  };

  // Update learning profile
  await prisma.learningProfile.upsert({
    where: { user_id: session.user_id },
    update: {
      subject_strengths: normalizedStrengths,
      subject_weaknesses: analysis.subject_weaknesses || {},
      vocabulary_level: analysis.vocabulary_level as VocabularyLevel,
      preferred_reply_mode: analysis.preferred_reply_mode as ReplyMode,
      question_patterns: normalizedPatterns,
      session_count: { increment: 1 },
      last_active: new Date(),
    },
    create: {
      user_id: session.user_id,
      subject_strengths: normalizedStrengths,
      subject_weaknesses: analysis.subject_weaknesses || {},
      vocabulary_level: analysis.vocabulary_level as VocabularyLevel,
      preferred_reply_mode: analysis.preferred_reply_mode as ReplyMode,
      question_patterns: normalizedPatterns,
      session_count: 1,
      last_active: new Date(),
    },
  });

  // Update community patterns
  if (analysis.community_pattern) {
    // Handle optional course code in pattern key
    const courseCode = session.course_code || 'GENERAL';
    const patternKey = `${session.university}-${session.department}-${courseCode}`;

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
        course_code: session.course_code || 'GENERAL',
        question_pattern: analysis.community_pattern,
      },
    });
  }
}

import prisma from '../config/db';
import { ReplyMode, VocabularyLevel } from '@prisma/client';
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

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function clamp01(value: unknown, fallback = 0.5) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.min(1, numberValue));
}

function smooth(previous: unknown, estimate: unknown, weight: number) {
  const prior = clamp01(previous, 0.5);
  const next = clamp01(estimate, prior);
  return Number((prior * (1 - weight) + next * weight).toFixed(3));
}

function evidenceWeight(value: unknown) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'high') return 0.35;
  if (normalized === 'low') return 0.15;
  return 0.25;
}

function normalizeVocabulary(value: unknown, fallback: VocabularyLevel) {
  const normalized = String(value || '').toUpperCase();
  return (Object.values(VocabularyLevel) as string[]).includes(normalized)
    ? normalized as VocabularyLevel
    : fallback;
}

function normalizeReplyMode(value: unknown, fallback: ReplyMode | null) {
  const normalized = String(value || '').toUpperCase();
  return (Object.values(ReplyMode) as string[]).includes(normalized)
    ? normalized as ReplyMode
    : fallback;
}

function average(values: number[], fallback = 0.5) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function mergeMisconceptions(existing: any[], observations: any[]) {
  const now = new Date().toISOString();
  const map = new Map<string, any>();
  existing.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const key = `${String(item.topic || '').toLowerCase()}::${String(item.misconception || '').toLowerCase()}`;
    if (key !== '::') map.set(key, item);
  });

  observations.forEach((observation) => {
    const misconception = String(observation?.misconception || '').trim();
    if (!misconception) return;
    const topic = String(observation?.topic || 'General').trim();
    const key = `${topic.toLowerCase()}::${misconception.toLowerCase()}`;
    const previous = map.get(key);
    const resolved = observation?.misconception_resolved === true;
    map.set(key, {
      topic,
      misconception,
      first_seen: previous?.first_seen || now,
      last_seen: now,
      times_observed: resolved ? Number(previous?.times_observed || 1) : Number(previous?.times_observed || 0) + 1,
      resolved,
    });
  });

  return [...map.values()].slice(-30);
}

export async function updateLearningProfileJob(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { created_at: 'asc' } } },
  });
  if (!session) throw new Error('Session not found');

  const learningProfile = await prisma.learningProfile.findUnique({
    where: { user_id: session.user_id },
  });

  const prompt = `Analyze this Akademi learning session as evidence, not as a fresh personality test.
Do not let one isolated mistake erase prior mastery. Distinguish mastery, confidence, and confusion for each topic.

Messages: ${JSON.stringify(session.messages).slice(0, 18000)}
Current Profile: ${JSON.stringify(learningProfile).slice(0, 9000)}
Session Context: ${JSON.stringify({
    university: session.university,
    department: session.department,
    course_code: session.course_code,
    session_type: session.session_type,
  })}

Return ONLY valid JSON:
{
  "topic_observations": [
    {
      "topic": "specific concept",
      "mastery_estimate": 0.0,
      "confidence_estimate": 0.0,
      "confusion_estimate": 0.0,
      "evidence_strength": "low|medium|high",
      "evidence": "one short observable reason",
      "misconception": "specific wrong belief or empty",
      "misconception_resolved": false
    }
  ],
  "vocabulary_level": "BASIC|INTERMEDIATE|ADVANCED",
  "preferred_reply_mode": "DIRECT|STUDY|QUESTION|WRONGLY|SOCRATIC",
  "preferred_teaching_strategy": "short strategy name or empty",
  "preferred_pace": "slow|normal|fast",
  "knowledge_gaps": ["..."],
  "recommended_next_topics": ["..."],
  "support_flags": {"calculation": false, "visual": false, "confidence": false},
  "community_pattern": {
    "topic": "...",
    "common_gap": "...",
    "common_misconception": "...",
    "exam_probability_signal": "low|medium|high"
  }
}

Rules:
- At most 8 topic observations.
- Estimates are 0 to 1 and must reflect evidence in the actual messages.
- Correct without hints is stronger mastery evidence than correct after hints.
- A wrong answer caused by a narrow misconception should not imply low mastery of the whole subject.
- Low confidence with correct reasoning is not low mastery.
- Repeated confident errors are strong misconception evidence.
- "I don't know" is confusion evidence but weaker mastery evidence than an attempted, reasoned error.
- Do not invent topics that were not meaningfully present in the session.`;

  const aiOutput = await aiProvider.generateResponse(prompt, {
    systemPrompt: 'Extract conservative, topic-level learning evidence. Return ONLY valid JSON.',
    maxTokens: 1200,
    temperature: 0,
  });
  const analysis = safeJsonParse(aiOutput);

  const existingStrengths = asRecord(learningProfile?.subject_strengths);
  const existingWeaknesses = asRecord(learningProfile?.subject_weaknesses);
  const existingPatterns = asRecord(learningProfile?.question_patterns);
  const existingTopicStates = asRecord(existingPatterns.topic_states);
  const existingMastery = asRecord(existingStrengths.mastery);
  const observations = Array.isArray(analysis.topic_observations) ? analysis.topic_observations.slice(0, 8) : [];

  const topicStates: Record<string, any> = { ...existingTopicStates };
  const mastery: Record<string, number> = Object.fromEntries(
    Object.entries(existingMastery).map(([topic, value]) => [topic, clamp01(value)]),
  );

  observations.forEach((observation: any) => {
    const topic = String(observation?.topic || '').trim();
    if (!topic) return;
    const previous = asRecord(topicStates[topic]);
    const weight = evidenceWeight(observation?.evidence_strength);
    const previousMastery = previous.mastery ?? mastery[topic] ?? 0.5;
    const nextState = {
      mastery: smooth(previousMastery, observation?.mastery_estimate, weight),
      confidence: smooth(previous.confidence, observation?.confidence_estimate, weight),
      confusion: smooth(previous.confusion, observation?.confusion_estimate, weight),
      evidence_count: Number(previous.evidence_count || 0) + 1,
      last_evidence: String(observation?.evidence || '').slice(0, 300),
      last_updated: new Date().toISOString(),
    };
    topicStates[topic] = nextState;
    mastery[topic] = nextState.mastery;
  });

  const topicEntries = Object.entries(topicStates);
  const masteredTopics = topicEntries.filter(([, state]: any) => clamp01(state?.mastery) >= 0.8).map(([topic]) => topic);
  const weakTopics = topicEntries.filter(([, state]: any) => clamp01(state?.mastery) <= 0.4).map(([topic]) => topic);
  const strugglesWith = topicEntries.filter(([, state]: any) => clamp01(state?.confusion) >= 0.65).map(([topic]) => topic);
  const confidenceValues = topicEntries.map(([, state]: any) => clamp01(state?.confidence));
  const confusionValues = topicEntries.map(([, state]: any) => clamp01(state?.confusion));
  const globalConfusion = Number(average(confusionValues, clamp01(existingPatterns.confusion_score, 0.35)).toFixed(3));

  const existingMisconceptionRecords = Array.isArray(existingPatterns.misconception_records)
    ? existingPatterns.misconception_records
    : [];
  const misconceptionRecords = mergeMisconceptions(existingMisconceptionRecords, observations);
  const unresolvedMisconceptions = misconceptionRecords
    .filter((item) => !item.resolved)
    .map((item) => `${item.topic}: ${item.misconception}`)
    .slice(-15);

  const knowledgeGaps = [...new Set([
    ...(Array.isArray(existingPatterns.knowledge_gaps) ? existingPatterns.knowledge_gaps.map(String) : []),
    ...(Array.isArray(analysis.knowledge_gaps) ? analysis.knowledge_gaps.map(String) : []),
    ...weakTopics,
  ])].slice(-20);

  const normalizedStrengths = {
    ...existingStrengths,
    mastery,
    mastered_topics: masteredTopics,
  };
  const normalizedWeaknesses = {
    ...existingWeaknesses,
    weak_topics: weakTopics,
    struggles_with: strugglesWith,
  };
  const normalizedPatterns = {
    ...existingPatterns,
    topic_states: topicStates,
    knowledge_gaps: knowledgeGaps,
    confusion_score: globalConfusion,
    misconceptions: unresolvedMisconceptions,
    misconception_records: misconceptionRecords,
    recommended_next_topics: Array.isArray(analysis.recommended_next_topics)
      ? analysis.recommended_next_topics.map(String).slice(0, 8)
      : existingPatterns.recommended_next_topics || [],
  };

  const vocabulary = normalizeVocabulary(analysis.vocabulary_level, learningProfile?.vocabulary_level || VocabularyLevel.BASIC);
  const preferredReplyMode = normalizeReplyMode(analysis.preferred_reply_mode, learningProfile?.preferred_reply_mode || null);
  const supportFlags = asRecord(analysis.support_flags);
  const derivedConfidenceSupport = average(confidenceValues, 0.55) < 0.4;
  const now = new Date();

  await prisma.learningProfile.upsert({
    where: { user_id: session.user_id },
    update: {
      subject_strengths: normalizedStrengths,
      subject_weaknesses: normalizedWeaknesses,
      vocabulary_level: vocabulary,
      preferred_reply_mode: preferredReplyMode,
      preferred_teaching_strategy: String(analysis.preferred_teaching_strategy || '').trim() || learningProfile?.preferred_teaching_strategy || null,
      preferred_pace: String(analysis.preferred_pace || '').trim() || learningProfile?.preferred_pace || null,
      question_patterns: normalizedPatterns,
      calculation_support_needed: supportFlags.calculation === true,
      visual_support_needed: supportFlags.visual === true,
      confidence_support_needed: supportFlags.confidence === true || derivedConfidenceSupport,
      session_count: { increment: 1 },
      last_profile_update_at: now,
      last_active: now,
    },
    create: {
      user_id: session.user_id,
      subject_strengths: normalizedStrengths,
      subject_weaknesses: normalizedWeaknesses,
      vocabulary_level: vocabulary,
      preferred_reply_mode: preferredReplyMode,
      preferred_teaching_strategy: String(analysis.preferred_teaching_strategy || '').trim() || null,
      preferred_pace: String(analysis.preferred_pace || '').trim() || null,
      question_patterns: normalizedPatterns,
      calculation_support_needed: supportFlags.calculation === true,
      visual_support_needed: supportFlags.visual === true,
      confidence_support_needed: supportFlags.confidence === true || derivedConfidenceSupport,
      session_count: 1,
      last_profile_update_at: now,
      last_active: now,
    },
  });

  if (analysis.community_pattern) {
    const courseCode = session.course_code || 'GENERAL';
    const patternKey = `${session.university}-${session.department}-${courseCode}`;
    await prisma.communityPattern.upsert({
      where: { id: patternKey },
      update: {
        frequency: { increment: 1 },
        question_pattern: analysis.community_pattern,
      },
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

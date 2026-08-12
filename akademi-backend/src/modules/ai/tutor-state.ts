import { ReplyMode } from '@prisma/client';
import { generateAdaptiveResponse } from './adaptive-model-router';

export type TutorDepth = 'FOUNDATION' | 'GUIDED' | 'STANDARD' | 'ADVANCED';
export type TutorIntent = 'learn' | 'solve' | 'verify' | 'repair' | 'practice' | 'exam_cram';
export type TutorStrategy =
  | 'answer'
  | 'explain'
  | 'guided_solve'
  | 'hint'
  | 'worked_example'
  | 'misconception_repair'
  | 'verification'
  | 'practice'
  | 'review_prerequisite';
export type TutorTaskType = 'conceptual' | 'calculation' | 'essay' | 'verification' | 'practice';

export interface TutorStudentState {
  mastery: number;
  confidence: number;
  confusion: number;
}

export interface TutorState {
  intent: TutorIntent;
  taskType: TutorTaskType;
  depth: TutorDepth;
  strategy: TutorStrategy;
  studentState: TutorStudentState;
  prerequisite?: string;
  focusConcepts: string[];
  compressConcepts: string[];
  needsVisual: boolean;
  needsCalculation: boolean;
  needsVerification: boolean;
  complexity: 1 | 2 | 3 | 4 | 5;
  reason: string;
  source: 'heuristic' | 'semantic';
}

interface TutorPlannerInput {
  studentMessage: string;
  replyMode: ReplyMode;
  standalone: boolean;
  learningProfile: any;
  latestIntelligence?: any | null;
  conversationHistory?: string;
  calculationSignal?: boolean;
  essaySignal?: boolean;
}

const clamp01 = (value: unknown, fallback = 0.5) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.min(1, numberValue));
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function average(values: number[], fallback = 0.5) {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function simpleTokens(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function readTopicStates(learningProfile: any) {
  const patterns = asRecord(learningProfile?.question_patterns);
  return asRecord(patterns.topic_states);
}

function findRelevantTopicName(studentMessage: string, learningProfile: any) {
  const topicStates = readTopicStates(learningProfile);
  const masteryMap = asRecord(learningProfile?.subject_strengths).mastery;
  const allTopics = [...new Set([...Object.keys(topicStates), ...Object.keys(asRecord(masteryMap))])];
  if (!allTopics.length) return null;

  const messageTokens = new Set(simpleTokens(studentMessage));
  let best: { topic: string; score: number } | null = null;
  allTopics.forEach((topic) => {
    const topicTokens = simpleTokens(topic);
    const overlap = topicTokens.filter((token) => messageTokens.has(token)).length;
    const phraseBonus = studentMessage.toLowerCase().includes(topic.toLowerCase()) ? 2 : 0;
    const score = overlap + phraseBonus;
    if (score > 0 && (!best || score > best.score)) best = { topic, score };
  });
  return best?.topic || null;
}

function deriveStudentState(
  learningProfile: any,
  latestIntelligence: any | null | undefined,
  studentMessage: string,
): { state: TutorStudentState; relevantTopic: string | null } {
  const strengths = asRecord(learningProfile?.subject_strengths);
  const masteryMap = asRecord(strengths.mastery);
  const topicStates = readTopicStates(learningProfile);
  const relevantTopic = findRelevantTopicName(studentMessage, learningProfile);
  const relevantState = relevantTopic ? asRecord(topicStates[relevantTopic]) : {};

  if (relevantTopic) {
    return {
      relevantTopic,
      state: {
        mastery: clamp01(relevantState.mastery ?? masteryMap[relevantTopic], 0.5),
        confidence: clamp01(relevantState.confidence, learningProfile?.confidence_support_needed ? 0.35 : 0.55),
        confusion: clamp01(relevantState.confusion, 0.35),
      },
    };
  }

  const masteryValues = [
    ...Object.values(masteryMap).map((value) => clamp01(value)),
    ...Object.values(topicStates).map((state: any) => clamp01(state?.mastery)),
  ];
  const confidenceValues = Object.values(topicStates).map((state: any) => clamp01(state?.confidence));
  const confusionValues = Object.values(topicStates).map((state: any) => clamp01(state?.confusion));
  const patterns = asRecord(learningProfile?.question_patterns);

  const intelligenceMastery = latestIntelligence?.mastery_score == null
    ? null
    : clamp01(Number(latestIntelligence.mastery_score) / 100);
  const intelligenceConfidence = latestIntelligence?.confidence == null
    ? null
    : clamp01(Number(latestIntelligence.confidence) / 100);
  const intelligenceConfusion = latestIntelligence?.hidden_confusion_risk == null
    ? null
    : clamp01(Number(latestIntelligence.hidden_confusion_risk) / 100);

  return {
    relevantTopic: null,
    state: {
      mastery: intelligenceMastery ?? average(masteryValues, 0.5),
      confidence: intelligenceConfidence ?? average(confidenceValues, learningProfile?.confidence_support_needed ? 0.35 : 0.55),
      confusion: intelligenceConfusion ?? average(confusionValues, clamp01(patterns.confusion_score, 0.35)),
    },
  };
}

function explicitDepthRequest(message: string): TutorDepth | null {
  const text = message.toLowerCase();
  if (/explain (it )?(like|as if).*(beginner|new|first time)|from (the )?beginning|from scratch|i know nothing/.test(text)) {
    return 'FOUNDATION';
  }
  if (/skip (the )?(basics|basic steps)|advanced explanation|be concise|just the important steps|i already know/.test(text)) {
    return 'ADVANCED';
  }
  return null;
}

export function determineTutorDepth(
  message: string,
  studentState: TutorStudentState,
  learningProfile: any,
  standalone: boolean,
): TutorDepth {
  const explicit = explicitDepthRequest(message);
  if (explicit) return explicit;

  if (studentState.confusion >= 0.72 || studentState.mastery <= 0.28) return 'FOUNDATION';
  if (studentState.confusion >= 0.5 || studentState.mastery < 0.48) return 'GUIDED';

  const vocabulary = String(learningProfile?.vocabulary_level || '').toUpperCase();
  if (studentState.mastery >= 0.8 && studentState.confusion <= 0.28 && vocabulary === 'ADVANCED') {
    return 'ADVANCED';
  }

  if (standalone && studentState.mastery < 0.75) return 'GUIDED';
  return 'STANDARD';
}

function inferIntent(message: string): TutorIntent {
  const text = message.toLowerCase();
  if (/exam|test|deadline|due tonight|due tomorrow|cram/.test(text)) return 'exam_cram';
  if (/is this (right|correct)|check my|am i right|verify|confirm my/.test(text)) return 'verify';
  if (/i thought|shouldn't|isn't it|i was taught|i learnt|i learned|correct me if/.test(text)) return 'repair';
  if (/practice|quiz me|give me (a|some) question|test me/.test(text)) return 'practice';
  if (/solve|calculate|find|differentiate|integrate|simplify|evaluate/.test(text)) return 'solve';
  return 'learn';
}

function inferStrategy(intent: TutorIntent, mode: ReplyMode, studentState: TutorStudentState): TutorStrategy {
  if (intent === 'verify') return 'verification';
  if (intent === 'repair') return 'misconception_repair';
  if (intent === 'practice') return 'practice';
  if (studentState.confusion >= 0.75) return 'review_prerequisite';
  if (mode === ReplyMode.QUESTION) return studentState.confusion >= 0.58 ? 'worked_example' : 'guided_solve';
  if (mode === ReplyMode.DIRECT) return intent === 'solve' ? 'worked_example' : 'answer';
  if (intent === 'solve') return 'worked_example';
  return 'explain';
}

function inferComplexity(message: string, calculationSignal: boolean, essaySignal: boolean) {
  let score = 1;
  const text = message.toLowerCase();
  if (message.length > 220) score += 1;
  if (calculationSignal || essaySignal) score += 1;
  if (/prove|derive|critically|compare|multi-part|\([a-f]\)|question \d/.test(text)) score += 1;
  if ((message.match(/[=+\-*/^]/g) || []).length >= 4) score += 1;
  return Math.max(1, Math.min(5, score)) as 1 | 2 | 3 | 4 | 5;
}

export function buildBaselineTutorState(input: TutorPlannerInput): TutorState {
  const derived = deriveStudentState(input.learningProfile, input.latestIntelligence, input.studentMessage);
  const studentState = derived.state;
  const intent = inferIntent(input.studentMessage);
  const taskType: TutorTaskType = input.essaySignal
    ? 'essay'
    : input.calculationSignal
      ? 'calculation'
      : intent === 'verify'
        ? 'verification'
        : intent === 'practice'
          ? 'practice'
          : 'conceptual';
  const depth = determineTutorDepth(input.studentMessage, studentState, input.learningProfile, input.standalone);
  const complexity = inferComplexity(input.studentMessage, !!input.calculationSignal, !!input.essaySignal);

  return {
    intent,
    taskType,
    depth,
    strategy: inferStrategy(intent, input.replyMode, studentState),
    studentState,
    focusConcepts: derived.relevantTopic ? [derived.relevantTopic] : [],
    compressConcepts: [],
    needsVisual: /graph|plot|sketch|diagram|visual|draw/.test(input.studentMessage.toLowerCase()),
    needsCalculation: !!input.calculationSignal,
    needsVerification: intent === 'verify' || !!input.calculationSignal || complexity >= 4,
    complexity,
    reason: derived.relevantTopic
      ? `Deterministic baseline using the learner's saved state for ${derived.relevantTopic}.`
      : 'Deterministic baseline from learner state, mode, and question signals.',
    source: 'heuristic',
  };
}

function shouldUseSemanticPlanner(input: TutorPlannerInput, baseline: TutorState) {
  if (baseline.complexity >= 3) return true;
  if (baseline.intent === 'repair' || baseline.studentState.confusion >= 0.55) return true;
  if (input.conversationHistory && input.conversationHistory.length > 500) return true;
  if (/why|i don't understand|confused|stuck|where did|how did/.test(input.studentMessage.toLowerCase())) return true;
  return false;
}

function parseJsonObject(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || raw;
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');
  if (first < 0 || last <= first) return null;
  try {
    return JSON.parse(candidate.slice(first, last + 1));
  } catch {
    return null;
  }
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const normalized = String(value || '').toLowerCase();
  return allowed.find((item) => item.toLowerCase() === normalized) || fallback;
}

export async function planTutorState(input: TutorPlannerInput): Promise<TutorState> {
  const baseline = buildBaselineTutorState(input);
  if (!shouldUseSemanticPlanner(input, baseline)) return baseline;

  const plannerPrompt = `Classify this tutoring turn. Do not solve the question. Return only compact JSON.

Student message: ${input.studentMessage}
Reply mode: ${input.replyMode}
Standalone answer: ${input.standalone}
Baseline state: ${JSON.stringify(baseline)}
Recent conversation: ${(input.conversationHistory || '').slice(-1800)}
Learning profile: ${JSON.stringify({
    vocabulary_level: input.learningProfile?.vocabulary_level,
    subject_strengths: input.learningProfile?.subject_strengths,
    subject_weaknesses: input.learningProfile?.subject_weaknesses,
    question_patterns: input.learningProfile?.question_patterns,
  }).slice(0, 4000)}

Return this shape:
{
  "intent": "learn|solve|verify|repair|practice|exam_cram",
  "taskType": "conceptual|calculation|essay|verification|practice",
  "depth": "FOUNDATION|GUIDED|STANDARD|ADVANCED",
  "strategy": "answer|explain|guided_solve|hint|worked_example|misconception_repair|verification|practice|review_prerequisite",
  "prerequisite": "short prerequisite or empty",
  "focusConcepts": ["up to 3"],
  "compressConcepts": ["up to 3 already-mastered/basic concepts"],
  "needsVisual": true,
  "needsCalculation": false,
  "needsVerification": false,
  "complexity": 1,
  "confidence": 0.0,
  "confusion": 0.0,
  "mastery": 0.0,
  "reason": "one short sentence"
}

Rules: respect explicit requests to explain from scratch or skip basics; do not lower depth merely because the course is advanced; distinguish confidence from mastery; use FOUNDATION only when evidence says the learner needs it.`;

  try {
    const raw = await generateAdaptiveResponse(plannerPrompt, {
      systemPrompt: 'You are Akademi Tutor Router. Diagnose the learning turn semantically and return only valid JSON.',
      maxTokens: 260,
      temperature: 0,
      complexity: baseline.complexity,
      purpose: 'planner',
    });
    const parsed = parseJsonObject(raw);
    if (!parsed) return baseline;

    const depth = explicitDepthRequest(input.studentMessage)
      || normalizeEnum(parsed.depth, ['FOUNDATION', 'GUIDED', 'STANDARD', 'ADVANCED'] as const, baseline.depth);

    return {
      intent: normalizeEnum(parsed.intent, ['learn', 'solve', 'verify', 'repair', 'practice', 'exam_cram'] as const, baseline.intent),
      taskType: normalizeEnum(parsed.taskType, ['conceptual', 'calculation', 'essay', 'verification', 'practice'] as const, baseline.taskType),
      depth,
      strategy: normalizeEnum(parsed.strategy, [
        'answer', 'explain', 'guided_solve', 'hint', 'worked_example', 'misconception_repair',
        'verification', 'practice', 'review_prerequisite',
      ] as const, baseline.strategy),
      studentState: {
        mastery: clamp01(parsed.mastery, baseline.studentState.mastery),
        confidence: clamp01(parsed.confidence, baseline.studentState.confidence),
        confusion: clamp01(parsed.confusion, baseline.studentState.confusion),
      },
      prerequisite: String(parsed.prerequisite || '').trim() || baseline.prerequisite,
      focusConcepts: Array.isArray(parsed.focusConcepts)
        ? parsed.focusConcepts.map(String).filter(Boolean).slice(0, 3)
        : baseline.focusConcepts,
      compressConcepts: Array.isArray(parsed.compressConcepts)
        ? parsed.compressConcepts.map(String).filter(Boolean).slice(0, 3)
        : baseline.compressConcepts,
      needsVisual: typeof parsed.needsVisual === 'boolean' ? parsed.needsVisual : baseline.needsVisual,
      needsCalculation: typeof parsed.needsCalculation === 'boolean' ? parsed.needsCalculation : baseline.needsCalculation,
      needsVerification: typeof parsed.needsVerification === 'boolean' ? parsed.needsVerification : baseline.needsVerification,
      complexity: Math.max(1, Math.min(5, Number(parsed.complexity) || baseline.complexity)) as 1 | 2 | 3 | 4 | 5,
      reason: String(parsed.reason || baseline.reason).slice(0, 240),
      source: 'semantic',
    };
  } catch (error) {
    console.warn('tutor_state_semantic_planner_failed', { error });
    return baseline;
  }
}

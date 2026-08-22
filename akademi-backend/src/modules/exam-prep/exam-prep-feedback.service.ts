import { aiProvider } from '../ai/ai.provider';
import {
  ExamPrepTeachingFeedback,
  FeedbackGenerationInput,
  OptionTeachingFeedback,
  ReasoningAssessment,
  TeachingExplanation,
} from './exam-prep.types';

const MAX_SOURCE_CONTEXT_CHARS = 8_000;

const FEEDBACK_JSON_SCHEMA = {
  name: 'guided_exam_prep_feedback',
  schema: {
    type: 'object',
    properties: {
      reasoningAssessment: {
        type: 'object',
        properties: {
          qualityScore: { type: 'integer', minimum: 0, maximum: 100 },
          summary: { type: 'string' },
          whatYouGotRight: { type: 'array', items: { type: 'string' } },
          whatYouMissed: { type: 'array', items: { type: 'string' } },
          misconception: { type: 'string', nullable: true },
        },
        required: ['qualityScore', 'summary', 'whatYouGotRight', 'whatYouMissed', 'misconception'],
      },
      teachingExplanation: {
        type: 'object',
        properties: {
          whyCorrect: { type: 'string' },
          keyConcept: { type: 'string' },
          conciseLesson: { type: 'string' },
        },
        required: ['whyCorrect', 'keyConcept', 'conciseLesson'],
      },
      optionBreakdown: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            option: { type: 'string' },
            whyItFitsOrDoesNotFit: { type: 'string' },
            whatItRepresents: { type: 'string' },
            whenItWouldBeCorrect: { type: 'string', nullable: true },
          },
          required: ['option', 'whyItFitsOrDoesNotFit', 'whatItRepresents', 'whenItWouldBeCorrect'],
        },
      },
      takeaway: { type: 'string' },
    },
    required: ['reasoningAssessment', 'teachingExplanation', 'optionBreakdown', 'takeaway'],
  },
} as const;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Feedback field ${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return null;
  return requiredString(value, field);
}

function stringList(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new Error(`Feedback field ${field} must be an array`);
  return value.map((item, index) => requiredString(item, `${field}[${index}]`)).slice(0, 8);
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const cleaned = raw.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error('Feedback model did not return valid JSON');
  }
}

export function validatePersonalizedFeedback(
  raw: Record<string, unknown>,
  input: FeedbackGenerationInput,
): ExamPrepTeachingFeedback {
  const reasoningRaw = raw.reasoningAssessment as Record<string, unknown> | null;
  const teachingRaw = raw.teachingExplanation as Record<string, unknown> | null;
  if (!reasoningRaw || typeof reasoningRaw !== 'object' || Array.isArray(reasoningRaw)) {
    throw new Error('Feedback reasoningAssessment is missing');
  }
  if (!teachingRaw || typeof teachingRaw !== 'object' || Array.isArray(teachingRaw)) {
    throw new Error('Feedback teachingExplanation is missing');
  }

  const qualityScore = Number(reasoningRaw.qualityScore);
  if (!Number.isInteger(qualityScore) || qualityScore < 0 || qualityScore > 100) {
    throw new Error('Feedback reasoning quality score must be an integer from 0 to 100');
  }

  const reasoningAssessment: ReasoningAssessment = {
    qualityScore,
    summary: requiredString(reasoningRaw.summary, 'reasoningAssessment.summary'),
    whatYouGotRight: stringList(reasoningRaw.whatYouGotRight, 'reasoningAssessment.whatYouGotRight'),
    whatYouMissed: stringList(reasoningRaw.whatYouMissed, 'reasoningAssessment.whatYouMissed'),
    misconception: optionalString(reasoningRaw.misconception, 'reasoningAssessment.misconception'),
  };
  const teachingExplanation: TeachingExplanation = {
    whyCorrect: requiredString(teachingRaw.whyCorrect, 'teachingExplanation.whyCorrect'),
    keyConcept: requiredString(teachingRaw.keyConcept, 'teachingExplanation.keyConcept'),
    conciseLesson: requiredString(teachingRaw.conciseLesson, 'teachingExplanation.conciseLesson'),
  };

  if (!Array.isArray(raw.optionBreakdown) || raw.optionBreakdown.length !== input.options.length) {
    throw new Error('Feedback must contain exactly one entry for every option');
  }
  const rawByOption = new Map<string, Record<string, unknown>>();
  raw.optionBreakdown.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Feedback optionBreakdown[${index}] is invalid`);
    }
    const typedEntry = entry as Record<string, unknown>;
    const option = requiredString(typedEntry.option, `optionBreakdown[${index}].option`);
    const key = normalize(option);
    if (rawByOption.has(key)) throw new Error('Feedback contains a duplicate option entry');
    rawByOption.set(key, typedEntry);
  });

  const optionBreakdown: OptionTeachingFeedback[] = input.options.map((option) => {
    const entry = rawByOption.get(normalize(option));
    if (!entry) throw new Error(`Feedback is missing the actual option: ${option}`);
    return {
      option,
      // The model never controls which option is correct.
      isCorrect: normalize(option) === normalize(input.canonicalCorrectAnswer),
      whyItFitsOrDoesNotFit: requiredString(entry.whyItFitsOrDoesNotFit, `optionBreakdown.${option}.whyItFitsOrDoesNotFit`),
      whatItRepresents: requiredString(entry.whatItRepresents, `optionBreakdown.${option}.whatItRepresents`),
      whenItWouldBeCorrect: optionalString(entry.whenItWouldBeCorrect, `optionBreakdown.${option}.whenItWouldBeCorrect`),
    };
  });

  return {
    isCorrect: input.backendDeterminedIsCorrect,
    selectedAnswer: input.studentSelectedAnswer,
    correctAnswer: input.canonicalCorrectAnswer,
    verdict: input.backendDeterminedIsCorrect ? 'CORRECT' : 'INCORRECT',
    reasoningAssessment,
    teachingExplanation,
    optionBreakdown,
    takeaway: requiredString(raw.takeaway, 'takeaway'),
    personalized: true,
  };
}

export function buildFallbackFeedback(input: FeedbackGenerationInput): ExamPrepTeachingFeedback {
  const canonicalLesson = input.canonicalExplanation?.trim() || input.approachGuide.trim();
  return {
    isCorrect: input.backendDeterminedIsCorrect,
    selectedAnswer: input.studentSelectedAnswer,
    correctAnswer: input.canonicalCorrectAnswer,
    verdict: input.backendDeterminedIsCorrect ? 'CORRECT' : 'INCORRECT',
    reasoningAssessment: {
      qualityScore: null,
      summary: 'Your answer was scored, but personalized reasoning feedback is temporarily unavailable.',
      whatYouGotRight: [],
      whatYouMissed: [],
      misconception: null,
    },
    teachingExplanation: {
      whyCorrect: canonicalLesson,
      keyConcept: input.approachGuide.trim() || canonicalLesson,
      conciseLesson: canonicalLesson,
    },
    optionBreakdown: input.options.map((option) => {
      const isCorrect = normalize(option) === normalize(input.canonicalCorrectAnswer);
      return {
        option,
        isCorrect,
        whyItFitsOrDoesNotFit: isCorrect
          ? canonicalLesson
          : `${canonicalLesson} This option does not match the canonical answer for this question.`,
        whatItRepresents: isCorrect
          ? 'The concept required by the question.'
          : 'An alternative that should be checked against the rule or principle in the explanation.',
        whenItWouldBeCorrect: null,
      };
    }),
    takeaway: input.approachGuide.trim() || canonicalLesson,
    personalized: false,
  };
}

export class ExamPrepFeedbackService {
  async generate(input: FeedbackGenerationInput): Promise<ExamPrepTeachingFeedback> {
    const fallback = buildFallbackFeedback(input);
    try {
      const sourceContext = input.relevantSourceContext?.trim().slice(0, MAX_SOURCE_CONTEXT_CHARS) || 'No additional source excerpt is available.';
      const prompt = JSON.stringify({
        questionText: input.questionText,
        options: input.options,
        canonicalCorrectAnswer: input.canonicalCorrectAnswer,
        canonicalExplanation: input.canonicalExplanation,
        approachGuide: input.approachGuide,
        studentSelectedAnswer: input.studentSelectedAnswer,
        backendDeterminedIsCorrect: input.backendDeterminedIsCorrect,
        studentReasoning: input.studentReasoning,
        sourceContext,
        materialTitle: input.materialTitle,
        courseCode: input.courseCode,
      });

      const raw = await aiProvider.generateResponse(prompt, {
        systemPrompt: `You are Akademi's exam-prep instructor. Teach a university student through one multiple-choice question.

The supplied canonicalCorrectAnswer and backendDeterminedIsCorrect are immutable source-of-truth values. Never change, dispute, or independently rescore them. Evaluate the student's written reasoning independently from answer correctness. A correct selection can still have weak or fundamentally wrong reasoning, and you must say so clearly.

Ground the response only in the question, options, canonical explanation, approach guide, and source context. Do not invent facts, formulas, lecturer preferences, exam provenance, or historical claims. Explain the correct answer concisely. Explain every option, the misconception or meaning it represents, and why it fits or does not fit here. State another valid condition only when academically supported; otherwise return null for whenItWouldBeCorrect. Do not manufacture praise or weaknesses. Keep each section focused and return only the required JSON.`,
        maxTokens: 3_000,
        temperature: 0.1,
        jsonSchema: FEEDBACK_JSON_SCHEMA,
      });
      return validatePersonalizedFeedback(parseJsonObject(raw), input);
    } catch (error) {
      console.error('Guided Exam Prep feedback fell back to canonical teaching:', error);
      return fallback;
    }
  }
}

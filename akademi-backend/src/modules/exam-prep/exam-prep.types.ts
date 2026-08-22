import { Difficulty, QuestionType } from '@prisma/client';

export const GUIDED_EXAM_PREP_MODE = 'guided-question-study' as const;
export const GUIDED_EXAM_PREP_VERSION = 1 as const;
export const GUIDED_EXAM_PREP_QUESTION_COUNT = Math.min(
  Math.max(Number(process.env.GUIDED_EXAM_PREP_QUESTION_COUNT) || 10, 5),
  20,
);

export type GuidedMaterialStatus = 'READY' | 'BUILDING' | 'UNAVAILABLE';

export interface ExamPrepMaterialItem {
  id: string;
  title: string;
  courseCode: string | null;
  questionCount: number;
  status: GuidedMaterialStatus;
}

export interface GuidedExamPrepQuestion {
  id: string;
  text: string;
  options: string[];
  difficulty: Difficulty;
  questionType: QuestionType;
}

export interface ReasoningAssessment {
  qualityScore: number | null;
  summary: string;
  whatYouGotRight: string[];
  whatYouMissed: string[];
  misconception: string | null;
}

export interface TeachingExplanation {
  whyCorrect: string;
  keyConcept: string;
  conciseLesson: string;
}

export interface OptionTeachingFeedback {
  option: string;
  isCorrect: boolean;
  whyItFitsOrDoesNotFit: string;
  whatItRepresents: string;
  whenItWouldBeCorrect: string | null;
}

export interface ExamPrepTeachingFeedback {
  isCorrect: boolean;
  selectedAnswer: string;
  correctAnswer: string;
  verdict: 'CORRECT' | 'INCORRECT';
  reasoningAssessment: ReasoningAssessment;
  teachingExplanation: TeachingExplanation;
  optionBreakdown: OptionTeachingFeedback[];
  takeaway: string;
  personalized: boolean;
}

export interface GuidedExamPrepProgress {
  current: number;
  total: number;
  completed: number;
  correct: number;
}

export interface GuidedExamPrepSession {
  id: string;
  material: {
    id: string;
    title: string;
    courseCode: string | null;
  };
  currentIndex: number;
  totalQuestions: number;
  completedCount: number;
  currentQuestion: GuidedExamPrepQuestion | null;
  currentAttempt: {
    id: string;
    reasoning: string;
    feedback: ExamPrepTeachingFeedback;
  } | null;
  progress: GuidedExamPrepProgress;
  isComplete: boolean;
}

export interface ExamPrepSessionSummary {
  sessionId: string;
  material: {
    id: string;
    title: string;
    courseCode: string | null;
  };
  questionsStudied: number;
  correctAnswers: number;
  percentage: number;
  averageReasoningQuality: number | null;
  needsReview: string[];
  completedAt: string | null;
}

export interface GuidedSessionMetadata {
  mode: typeof GUIDED_EXAM_PREP_MODE;
  version: typeof GUIDED_EXAM_PREP_VERSION;
  entitlementFeature: 'EXAM_PREP';
  questionIds: string[];
  currentIndex: number;
}

export interface FeedbackGenerationInput {
  questionText: string;
  options: string[];
  canonicalCorrectAnswer: string;
  canonicalExplanation: string | null;
  approachGuide: string;
  studentSelectedAnswer: string;
  backendDeterminedIsCorrect: boolean;
  studentReasoning: string;
  relevantSourceContext: string | null;
  materialTitle: string;
  courseCode: string | null;
}

export class ExamPrepError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ExamPrepError';
  }
}

// Legacy plan/mock contracts remain exported for existing callers while the primary product
// moves to guided question study.
export interface CreatePlanRequest {
  course_code: string;
  exam_date: string;
  assessment_type?: 'TEST' | 'EXAM';
  duration_minutes?: number;
  objective_question_count?: number;
  theory_question_count?: number;
}

export interface ProgressUpdateRequest {
  taskId: string;
  completed: boolean;
}

export interface SubmitMockRequest {
  answers: { questionId: string; answer: string }[];
}

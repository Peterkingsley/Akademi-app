import { Difficulty, QuestionType } from '@prisma/client';
import { ExamPrepTeachingFeedback } from '../exam-prep/exam-prep.types';

export interface DemoExamPrepConfig {
  materialIds: string[];
  questionLimit: number;
  sessionTtlSeconds: number;
  questionPoolSize: number;
}

export interface DemoMaterialItem {
  id: string;
  title: string;
  courseCode: string | null;
  questionCount: number;
  status: 'READY';
}

export interface DemoQuestion {
  id: string;
  text: string;
  options: string[];
  difficulty: Difficulty;
  questionType: QuestionType;
}

export interface DemoAttemptState {
  questionId: string;
  selectedAnswer: string;
  reasoning: string;
  feedback: ExamPrepTeachingFeedback;
  correctionMessage: string | null;
}

export interface DemoSessionState {
  id: string;
  material: { id: string; title: string; courseCode: string | null };
  mainQuestionIds: string[];
  candidateQuestionIds: string[];
  currentMainIndex: number;
  currentQuestionId: string;
  attempts: Record<string, DemoAttemptState>;
  activeRetry: {
    parentQuestionId: string;
    rootQuestionId: string;
    depth: number;
  } | null;
  evaluatedCount: number;
  createdAt: string;
  expiresAt: string;
  isComplete: boolean;
}

export interface DemoSessionResponse {
  id: string;
  material: DemoSessionState['material'];
  currentQuestion: DemoQuestion | null;
  currentAttempt: DemoAttemptState | null;
  progress: { current: number; total: number; completed: number };
  isRetry: boolean;
  retryDepth: number;
  isComplete: boolean;
  expiresAt: string;
  limit: number;
}

export class DemoExamPrepError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'DemoExamPrepError';
  }
}

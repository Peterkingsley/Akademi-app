import { Difficulty } from '@prisma/client';

export interface QuestionFilter {
  course_code?: string;
  department?: string;
  difficulty?: Difficulty;
  level?: number;
}

export interface AttemptRequest {
  answer: string;
}

export interface AttemptResponse {
  is_correct: boolean;
  feedback: string;
}

import { ReplyMode, Difficulty, VocabularyLevel } from '@prisma/client';

export interface AIContext {
  learningProfile: any;
  communityPatterns: any[];
  disciplineDocument: any | null;
  replyMode: ReplyMode;
}

export interface GeneratedQuestion {
  question_text: string;
  approach_guide: string;
  difficulty: Difficulty;
}

export interface SessionSummary {
  summary: string;
  key_points: string[];
  next_steps: string[];
}

export interface LearningProfileUpdate {
  subject_strengths?: any;
  subject_weaknesses?: any;
  vocabulary_level?: VocabularyLevel;
  preferred_reply_mode?: ReplyMode;
  question_patterns?: any;
}

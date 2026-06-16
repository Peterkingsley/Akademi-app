import { CompetitionFormat, CompetitionParticipantStatus, CompetitionStatus, CompetitionVisibility } from '@prisma/client';

export interface CreateCompetitionRequest {
  title?: string;
  visibility?: CompetitionVisibility;
  format?: CompetitionFormat;
  shared_course_code?: string;
  host_course_code?: string;
  question_count?: number;
  question_timer_sec?: number;
  max_participants?: number;
}

export interface JoinCompetitionRequest {
  code: string;
  course_code?: string;
}

export interface UpdateParticipantStatusRequest {
  status: CompetitionParticipantStatus;
}

export interface CompetitionSummary {
  matchesPlayed: number;
  wins: number;
  liveMatches: number;
  averageScore: number;
  winRate: number;
}

export interface CompetitionRoomView {
  id: string;
  code: string;
  title: string;
  visibility: CompetitionVisibility;
  format: CompetitionFormat;
  status: CompetitionStatus;
  shared_course_code: string | null;
  question_count: number;
  question_timer_sec: number;
  max_participants: number;
  created_at: Date;
  starts_at: Date | null;
  ended_at: Date | null;
  host: {
    id: string;
    name: string;
  };
  participants: Array<{
    id: string;
    user_id: string;
    name: string;
    course_code: string | null;
    score: number;
    correct_answers: number;
    wrong_answers: number;
    status: CompetitionParticipantStatus;
    ready_at: Date | null;
    joined_at: Date;
  }>;
}

export interface CompetitionQuestionView {
  id: string;
  text: string;
  options: string[];
  difficulty: string;
  index: number;
  total: number;
  expires_at: string;
}

export interface CompetitionScoreboardEntry {
  user_id: string;
  name: string;
  score: number;
  correct_answers: number;
  wrong_answers: number;
  hasAnsweredCurrent: boolean;
}

export interface CompetitionMatchState {
  roomId: string;
  status: CompetitionStatus;
  question: CompetitionQuestionView | null;
  scoreboard: CompetitionScoreboardEntry[];
  winner_user_id?: string | null;
  finished?: boolean;
}

export interface CompetitionLeaderboardEntry {
  user_id: string;
  name: string;
  totalScore: number;
  wins: number;
  matchesPlayed: number;
  winRate: number;
}

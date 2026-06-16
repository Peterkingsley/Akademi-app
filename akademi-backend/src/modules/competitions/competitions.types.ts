import { CompetitionFormat, CompetitionParticipantStatus, CompetitionStatus, CompetitionVisibility, TournamentEntryStatus, TournamentStatus } from '@prisma/client';

export type TournamentAudienceScopeValue = 'EVERYONE' | 'UNIVERSITY' | 'FACULTY' | 'DEPARTMENT';

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

export interface CreateTournamentRequest {
  title: string;
  description?: string;
  format?: CompetitionFormat;
  shared_course_code?: string;
  question_count?: number;
  question_timer_sec?: number;
  max_participants?: number;
  prize_summary?: string;
  scheduled_at: string;
  registration_closes_at?: string;
  late_join_cutoff_at?: string;
  check_in_opens_at?: string;
  check_in_closes_at?: string;
  campaign_banner_url?: string;
  campaign_accent_color?: string;
  campaign_cta_label?: string;
  campaign_cta_url?: string;
  campaign_preheader?: string;
  audience_scope?: TournamentAudienceScopeValue;
  audience_university?: string;
  audience_faculty?: string;
  audience_department?: string;
}

export interface TournamentView {
  id: string;
  title: string;
  description: string | null;
  status: TournamentStatus;
  format: CompetitionFormat;
  shared_course_code: string | null;
  question_count: number;
  question_timer_sec: number;
  max_participants: number | null;
  prize_summary: string | null;
  scheduled_at: Date;
  registration_closes_at: Date | null;
  late_join_cutoff_at: Date | null;
  check_in_opens_at: Date | null;
  check_in_closes_at: Date | null;
  published_at: Date | null;
  campaign_banner_url: string | null;
  campaign_accent_color: string | null;
  campaign_cta_label: string | null;
  campaign_cta_url: string | null;
  campaign_preheader: string | null;
  audience_scope: TournamentAudienceScopeValue;
  audience_university: string | null;
  audience_faculty: string | null;
  audience_department: string | null;
  entry_count: number;
  registered_count?: number;
  checked_in_count?: number;
  standby_count?: number;
  room_id?: string | null;
  joined?: boolean;
  entry_status?: TournamentEntryStatus | null;
}

export interface AdminCompetitionRoomView {
  id: string;
  code: string;
  title: string;
  visibility: CompetitionVisibility;
  format: CompetitionFormat;
  status: CompetitionStatus;
  shared_course_code: string | null;
  created_at: Date;
  starts_at: Date | null;
  ended_at: Date | null;
  host: {
    id: string;
    name: string;
  };
  participant_count: number;
  ready_count: number;
  finished_count: number;
  winner_name: string | null;
  tournament: {
    id: string;
    title: string;
  } | null;
}

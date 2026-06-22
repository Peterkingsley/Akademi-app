import {
  CompetitionFormat,
  CompetitionParticipantStatus,
  CompetitionStatus,
  CompetitionVisibility,
  TournamentCampaignType,
  TournamentEntryStatus,
  TournamentInterestType,
  TournamentPredictionStatus,
  TournamentStageStatus,
  TournamentStatus,
} from '@prisma/client';

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
  campaign_type?: TournamentCampaignType;
  format?: CompetitionFormat;
  shared_course_code?: string;
  source_material_ids?: string[];
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
  prediction_enabled?: boolean;
  prediction_prize_summary?: string;
  prediction_winner_count?: number;
  prediction_closes_at?: string;
  share_template?: string;
  audience_scope?: TournamentAudienceScopeValue;
  audience_university?: string;
  audience_faculty?: string;
  audience_department?: string;
  stages?: CreateTournamentStageRequest[];
}

export interface CreateTournamentStageRequest {
  name: string;
  stage_order?: number;
  starts_at: string;
  duration_minutes: number;
  question_timer_style?: 'TOTAL_STAGE' | 'PER_QUESTION' | 'HYBRID';
  question_count: number;
  question_timer_sec?: number;
  question_source?: string;
  difficulty_level?: string;
  qualification_count?: number;
  minimum_participants?: number;
  fallback_rule?: string;
  result_visibility?: 'FULL_RANKING' | 'TOP_RANKING' | 'QUALIFIERS_ONLY' | 'QUALIFIERS';
}

export interface TournamentStageView {
  id: string;
  name: string;
  stage_order: number;
  status: TournamentStageStatus;
  starts_at: Date;
  duration_minutes: number;
  question_timer_style: string;
  question_count: number;
  question_timer_sec: number | null;
  question_source: string | null;
  difficulty_level: string | null;
  qualification_count: number | null;
  minimum_participants: number | null;
  fallback_rule: string | null;
  result_visibility: string;
  room_id?: string | null;
  participant_count?: number;
  qualified_count?: number;
}

export interface TournamentView {
  id: string;
  title: string;
  description: string | null;
  status: TournamentStatus;
  campaign_type: TournamentCampaignType;
  format: CompetitionFormat;
  shared_course_code: string | null;
  source_material_ids: string[];
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
  prediction_enabled: boolean;
  prediction_prize_summary: string | null;
  prediction_winner_count: number | null;
  prediction_closes_at: Date | null;
  share_template: string | null;
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
  share_token?: string | null;
  stages?: TournamentStageView[];
  interest_type?: TournamentInterestType | null;
  prediction_status?: TournamentPredictionStatus | null;
  predicted_user_id?: string | null;
  cheer_count?: number;
}

export interface TournamentArenaView {
  tournament: TournamentView;
  current_stage: TournamentStageView | null;
  stage_tracker: TournamentStageView[];
  leaderboard: Array<{
    user_id: string;
    display_name: string;
    score: number;
    correct_answers: number;
    average_response_ms: number | null;
    rank: number | null;
    qualified: boolean;
    love_count: number;
    prediction_count: number;
  }>;
  stats: {
    participants: number;
    spectators: number;
    total_loves: number;
    predictions: number;
  };
}

export interface TournamentMaterialOption {
  id: string;
  title: string;
  course_code: string | null;
  university: string;
  faculty: string;
  department: string;
  level: number | null;
  semester: number | null;
  created_at: Date;
}

export interface TournamentAudienceOptions {
  faculties: string[];
  departments: string[];
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

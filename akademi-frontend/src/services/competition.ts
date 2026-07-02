import api from "./api";

export type CompetitionVisibility = "PRIVATE" | "PUBLIC" | "TOURNAMENT";
export type CompetitionFormat = "SHARED_COURSE" | "DUAL_COURSE";
export type CompetitionParticipantStatus = "INVITED" | "JOINED" | "READY" | "ELIMINATED" | "LEFT";
export type CompetitionStatus = "WAITING" | "LIVE" | "FINISHED" | "CANCELLED";

export interface CompetitionParticipant {
  id: string;
  user_id: string;
  name: string;
  course_code: string | null;
  score: number;
  correct_answers: number;
  wrong_answers: number;
  status: CompetitionParticipantStatus;
  ready_at: string | null;
  joined_at: string;
}

export interface CompetitionRoom {
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
  created_at: string;
  starts_at: string | null;
  ended_at: string | null;
  host: {
    id: string;
    name: string;
  };
  participants: CompetitionParticipant[];
}

export interface CompetitionSummary {
  matchesPlayed: number;
  wins: number;
  liveMatches: number;
  averageScore: number;
  winRate: number;
}

export interface CompetitionQuestion {
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

export interface CompetitionLeaderboardEntry {
  user_id: string;
  name: string;
  totalScore: number;
  wins: number;
  matchesPlayed: number;
  winRate: number;
}

export type TournamentStatus = "DRAFT" | "PUBLISHED" | "LIVE" | "COMPLETED" | "CANCELLED";
export type TournamentEntryStatus = "REGISTERED" | "CHECKED_IN" | "ELIMINATED" | "WINNER";
export type TournamentCampaignType = "SIMPLE" | "MULTI_STAGE";
export type TournamentStageStatus = "SCHEDULED" | "CHECK_IN" | "LIVE" | "COMPLETED" | "CANCELLED";
export type TournamentInterestType = "PARTICIPANT" | "SPECTATOR";
export type TournamentPredictionStatus = "OPEN" | "LOCKED" | "CORRECT" | "INCORRECT" | "WINNER";

export interface TournamentStage {
  id: string;
  name: string;
  stage_order: number;
  status: TournamentStageStatus;
  starts_at: string;
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

export interface Tournament {
  id: string;
  title: string;
  description: string | null;
  status: TournamentStatus;
  campaign_type: TournamentCampaignType;
  format: CompetitionFormat;
  shared_course_code: string | null;
  question_count: number;
  question_timer_sec: number;
  max_participants: number | null;
  prize_summary: string | null;
  scheduled_at: string;
  registration_closes_at: string | null;
  late_join_cutoff_at: string | null;
  check_in_opens_at: string | null;
  check_in_closes_at: string | null;
  published_at: string | null;
  campaign_banner_url: string | null;
  campaign_accent_color: string | null;
  campaign_cta_label: string | null;
  campaign_cta_url: string | null;
  campaign_preheader: string | null;
  prediction_enabled: boolean;
  prediction_prize_summary: string | null;
  prediction_winner_count: number | null;
  prediction_closes_at: string | null;
  share_template: string | null;
  audience_scope: "EVERYONE" | "UNIVERSITY" | "FACULTY" | "DEPARTMENT";
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
  stages?: TournamentStage[];
  interest_type?: TournamentInterestType | null;
  prediction_status?: TournamentPredictionStatus | null;
  predicted_user_id?: string | null;
  cheer_count?: number;
}

export interface TournamentArena {
  tournament: Tournament;
  current_stage: TournamentStage | null;
  stage_tracker: TournamentStage[];
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

export const competitionService = {
  async createRoom(payload: {
    title?: string;
    visibility?: CompetitionVisibility;
    format?: CompetitionFormat;
    shared_course_code?: string;
    host_course_code?: string;
    question_count?: number;
    question_timer_sec?: number;
    max_participants?: number;
  }) {
    const { data } = await api.post<CompetitionRoom>("/competitions", payload);
    return data;
  },

  async joinRoom(code: string, course_code?: string) {
    const { data } = await api.post<CompetitionRoom>("/competitions/join", { code, course_code });
    return data;
  },

  async getMyRooms() {
    const { data } = await api.get<CompetitionRoom[]>("/competitions/mine");
    return data;
  },

  async getPublicRooms() {
    const { data } = await api.get<CompetitionRoom[]>("/competitions/public");
    return data;
  },

  async getRoom(roomId: string) {
    const { data } = await api.get<CompetitionRoom>(`/competitions/${roomId}`);
    return data;
  },

  async updateStatus(roomId: string, status: CompetitionParticipantStatus) {
    const { data } = await api.patch<CompetitionRoom>(`/competitions/${roomId}/status`, { status });
    return data;
  },

  async getSummary() {
    const { data } = await api.get<CompetitionSummary>("/competitions/summary");
    return data;
  },

  async getLeaderboard() {
    const { data } = await api.get<CompetitionLeaderboardEntry[]>("/competitions/leaderboard");
    return data;
  },

  async getTournaments() {
    const { data } = await api.get<Tournament[]>("/competitions/tournaments");
    return data;
  },

  async getTournament(tournamentId: string) {
    const { data } = await api.get<Tournament>(`/competitions/tournaments/${tournamentId}`);
    return data;
  },

  async getTournamentArena(tournamentId: string) {
    const { data } = await api.get<TournamentArena>(`/competitions/tournaments/${tournamentId}/arena`);
    return data;
  },

  async joinTournament(tournamentId: string) {
    const { data } = await api.post<Tournament>(`/competitions/tournaments/${tournamentId}/join`);
    return data;
  },

  async checkInTournament(tournamentId: string) {
    const { data } = await api.post<Tournament>(`/competitions/tournaments/${tournamentId}/check-in`);
    return data;
  },

  async registerTournamentInterest(tournamentId: string, interest_type: TournamentInterestType, supporting_user_id?: string) {
    const { data } = await api.post<Tournament>(`/competitions/tournaments/${tournamentId}/interest`, {
      interest_type,
      supporting_user_id,
    });
    return data;
  },

  async submitTournamentPrediction(tournamentId: string, predicted_user_id: string, stage_id?: string) {
    const { data } = await api.post<TournamentArena>(`/competitions/tournaments/${tournamentId}/predictions`, {
      predicted_user_id,
      stage_id,
    });
    return data;
  },

  async sendTournamentCheer(tournamentId: string, participant_user_id: string, stage_id?: string) {
    const { data } = await api.post<TournamentArena>(`/competitions/tournaments/${tournamentId}/cheers`, {
      participant_user_id,
      stage_id,
    });
    return data;
  },
};

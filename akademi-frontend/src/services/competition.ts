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

export interface Tournament {
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
  scheduled_at: string;
  registration_closes_at: string | null;
  published_at: string | null;
  entry_count: number;
  room_id?: string | null;
  joined?: boolean;
  entry_status?: TournamentEntryStatus | null;
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

  async joinTournament(tournamentId: string) {
    const { data } = await api.post<Tournament>(`/competitions/tournaments/${tournamentId}/join`);
    return data;
  },
};

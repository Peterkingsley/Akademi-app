import api from "./api";

export interface Session {
  id: string;
  sessionType: "TUTOR" | "SOLVE" | "SOCRATIC";
  courseCode: string;
  topic: string;
  duration?: number;
  createdAt: string;
  status: "ACTIVE" | "COMPLETED";
}

export interface SessionSummary {
  id: string;
  topicsCovered: string[];
  conceptsMastered: { name: string; mastery: number }[];
  areasToRevisit: { name: string; reason: string }[];
  bestQuestion?: string;
  aiInsight?: string;
  rating?: number;
  feedback?: string;
}

export interface LearningProfile {
  id: string;
  streak: number;
  weakAreas: { topic: string; subject: string }[];
  recentPerformance: any;
}

export const sessionService = {
  createSession: async (data: {
    sessionType: string;
    courseCode: string;
    topic: string;
    duration?: number;
  }) => {
    const response = await api.post<Session>("/sessions", data);
    return response.data;
  },

  getSessionSummary: async (sessionId: string) => {
    const response = await api.get<SessionSummary>(`/sessions/${sessionId}/summary`);
    return response.data;
  },

  endSession: async (sessionId: string) => {
    const response = await api.patch(`/sessions/${sessionId}/end`);
    return response.data;
  },

  getLearningProfile: async () => {
    const response = await api.get<LearningProfile>("/users/me/learning-profile");
    return response.data;
  },

  getRecentSessions: async (limit: number = 5) => {
    const response = await api.get<Session[]>(`/users/me/sessions?limit=${limit}`);
    return response.data;
  },

  rateSession: async (sessionId: string, rating: number, feedback?: string) => {
    const response = await api.patch(`/sessions/${sessionId}/rate`, {
      rating,
      feedback,
    });
    return response.data;
  },
};

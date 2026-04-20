import api from "./api";

export interface Session {
  id: string;
  user_id: string;
  session_type: "ASSIGNMENT" | "STUDY" | "TUTOR" | "EXAM_PREP";
  reply_mode?: "DIRECT" | "STUDY" | "QUESTION" | "WRONGLY";
  course_code: string;
  university: string;
  department: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  topic?: string;
  duration?: number;
}

export interface SessionSummary {
  id: string;
  summary: string;
  key_points: string[];
  next_steps: string[];
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
    session_type: string;
    course_code: string;
    reply_mode?: string;
    topic?: string;
    duration?: number;
    metadata?: any;
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

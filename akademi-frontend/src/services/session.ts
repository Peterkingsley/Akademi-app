import api from "./api";

export interface Session {
  id: string;
  user_id: string;
  session_type: "ASSIGNMENT" | "STUDY" | "TUTOR" | "EXAM_PREP";
  reply_mode?: "DIRECT" | "STUDY" | "QUESTION" | "WRONGLY";
  course_code: string;
  material_id?: string | null;
  university: string;
  department: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  topic?: string;
  duration?: number;
  material?: {
    id: string;
    title: string;
    course_code?: string | null;
    verification_status?: string;
  } | null;
}

export interface Message {
  id: string;
  session_id: string;
  user_id: string;
  role: "STUDENT" | "AI";
  content: string;
  metadata?: {
    whiteboard?: {
      available?: boolean;
      subject_family?: string;
      payload?: {
        title: string;
        board_style: "digital-whiteboard";
        steps: Array<{
          id: string;
          type: "write" | "highlight" | "answer";
          text: string;
          math?: string;
          note: string;
        }>;
        final_answer: string;
        final_answer_math?: string;
        summary?: string;
      };
    };
  };
  reply_mode?: string;
  created_at: string;
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

export interface TutorVisualAssetStatus {
  id: string;
  topic: string;
  concept: string;
  visualType: string;
  renderMode: string;
  payload?: any;
  imageUrl?: string | null;
  imageStatus?: string | null;
  imageError?: string | null;
  generatedAt?: string | null;
}

export const sessionService = {
  createSession: async (data: {
    session_type: string;
    course_code: string;
    reply_mode?: string;
    topic?: string;
    duration?: number;
    material_id?: string;
    metadata?: any;
  }) => {
    const response = await api.post<Session>("/sessions", data);
    return response.data;
  },

  getSessionSummary: async (sessionId: string) => {
    const response = await api.get<SessionSummary>(`/sessions/${sessionId}/summary`);
    return response.data;
  },

  getSession: async (sessionId: string) => {
    const response = await api.get<Session & { messages?: Message[] }>(`/sessions/${sessionId}`);
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

  listMessages: async (sessionId: string) => {
    const response = await api.get<Message[]>(`/sessions/${sessionId}/messages`);
    return response.data;
  },

  getTutorVisualAssetStatus: async (visualAssetId: string) => {
    const response = await api.get<TutorVisualAssetStatus>(`/sessions/visual-assets/${visualAssetId}/status`);
    return response.data;
  },

  sendMessage: async (
    sessionId: string,
    data: {
      content: string;
      reply_mode?: "DIRECT" | "STUDY" | "QUESTION" | "WRONGLY";
    }
  ) => {
    const response = await api.post<Message>(`/sessions/${sessionId}/messages`, data, {
      timeout: 90000,
    });
    return response.data;
  },
  getPlayableLesson: async (sessionId: string) => {
    const response = await api.get(`/sessions/${sessionId}/teaching`, {
      timeout: 90000,
    });
    return response.data;
  },

  generateTeaching: async (sessionId: string, studentMessage: string, materialContext?: string) => {
    const response = await api.post(`/sessions/${sessionId}/teaching`, {
      studentMessage,
      materialContext,
    }, {
      timeout: 90000,
    });
    return response.data;
  },
};

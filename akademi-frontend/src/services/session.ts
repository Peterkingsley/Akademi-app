import api from "./api";

export interface Session {
  id: string;
  user_id: string;
  session_type: "ASSIGNMENT" | "STUDY" | "EXAM_PREP";
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
    study_companion?: StudyCompanionState | null;
  };
  reply_mode?: string;
  created_at: string;
}

export interface TranscriptionResult {
  transcript: string;
  fileName?: string;
}

export interface StudyRoadmapSection {
  key: string;
  title: string;
  content: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "NEEDS_REVIEW" | "MASTERED";
  pageStart: number;
  pageEnd: number;
}

export interface StudyCompanionState {
  phase:
    | "MATERIAL_SELECTION_REQUIRED"
    | "MATERIAL_SELECTED"
    | "ROADMAP_GENERATED"
    | "TEACHING_PASS_1_BIG_PICTURE"
    | "TEACHING_PASS_2_DETAILS"
    | "TEACHING_PASS_3_CONNECTIONS"
    | "TEACHBACK_1_REQUESTED"
    | "TEACHBACK_1_EVALUATION"
    | "GAP_RETEACH"
    | "TEACHBACK_2_REQUESTED"
    | "TEACHBACK_2_EVALUATION"
    | "MEMORY_DUMP_REQUESTED"
    | "MEMORY_DUMP_EVALUATION"
    | "MASTERY_PASSED"
    | "MASTERY_FAILED"
    | "SECTION_COMPLETED"
    | "NEXT_SECTION_READY"
    | "SESSION_COMPLETED";
  currentSectionIndex: number;
  lastCompletedIndex: number;
  lastMasteryScore: number | null;
  masteryThreshold: number;
  roadmap: StudyRoadmapSection[];
  progress: {
    completedSections: number;
    totalSections: number;
    masteredSections: number;
  };
  refreshQuestion: string | null;
  pendingPrompt: string | null;
  materialId: string;
  courseCode: string;
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

  getCompanionState: async (sessionId: string) => {
    const response = await api.get<StudyCompanionState | null>(`/sessions/${sessionId}/companion`);
    return response.data;
  },

  startCompanion: async (
    sessionId: string,
    data: {
      mode: "continue" | "specific" | "beginning" | "roadmap";
      section_title?: string;
    }
  ) => {
    const response = await api.post<Message>(`/sessions/${sessionId}/companion/start`, data, {
      timeout: 90000,
    });
    return response.data;
  },

  sendCompanionMessage: async (sessionId: string, content: string) => {
    const response = await api.post<Message>(
      `/sessions/${sessionId}/companion/message`,
      { content },
      { timeout: 90000 },
    );
    return response.data;
  },

  sendPhotoMessage: async (sessionId: string, uri: string, name = "solution.jpg") => {
    const formData = new FormData();
    formData.append("photo", {
      uri,
      name,
      type: "image/jpeg",
    } as any);

    const response = await api.post<{ extractedText: string; message: Message }>(
      `/sessions/${sessionId}/messages/photo`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 90000,
      },
    );
    return response.data;
  },
};

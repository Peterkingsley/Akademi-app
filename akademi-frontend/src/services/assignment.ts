import api from "./api";

export interface SessionResponse {
  id: string;
  sessionType: string;
  replyMode: string;
  courseCode: string;
}

export const createAssignmentSession = async (replyMode: "DIRECT" | "STUDY" | "QUESTION" | "WRONGLY", courseCode: string) => {
  const { data } = await api.post<SessionResponse>("/sessions", {
    sessionType: "ASSIGNMENT",
    replyMode,
    courseCode,
  });
  return data;
};

export const submitQuestion = async (sessionId: string, content: string) => {
  const { data } = await api.post(`/sessions/${sessionId}/messages`, {
    content,
  });
  return data;
};

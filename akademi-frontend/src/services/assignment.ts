import api from "./api";

export interface SessionResponse {
  id: string;
  session_type: string;
  reply_mode: string;
  course_code: string;
}

export const createAssignmentSession = async (reply_mode: "DIRECT" | "STUDY" | "QUESTION" | "WRONGLY", course_code: string) => {
  const { data } = await api.post<SessionResponse>("/sessions", {
    session_type: "ASSIGNMENT",
    reply_mode,
    course_code,
  });
  return data;
};

export const submitQuestion = async (sessionId: string, content: string) => {
  const { data } = await api.post(`/sessions/${sessionId}/messages`, {
    content,
  });
  return data;
};

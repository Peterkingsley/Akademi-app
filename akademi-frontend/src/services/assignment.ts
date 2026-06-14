import api from "./api";

export interface SessionResponse {
  id: string;
  session_type: string;
  reply_mode: string;
  course_code?: string | null;
}

export const createAssignmentSession = async (
  reply_mode: "DIRECT" | "STUDY" | "QUESTION" | "WRONGLY" | "SOCRATIC",
  course_code?: string | null
) => {
  const { data } = await api.post<SessionResponse>("/sessions", {
    session_type: "ASSIGNMENT",
    reply_mode,
    course_code: course_code || null,
  });
  return data;
};

export const submitQuestion = async (sessionId: string, content: string) => {
  const { data } = await api.post(`/sessions/${sessionId}/messages`, {
    content,
  });
  return data;
};

export const submitPhotoQuestion = async (
  sessionId: string,
  photoUri: string,
  reply_mode: "DIRECT" | "STUDY" | "QUESTION" | "WRONGLY" | "SOCRATIC"
) => {
  const filename = photoUri.split("/").pop() || `assignment-${Date.now()}.jpg`;
  const extension = filename.split(".").pop()?.toLowerCase();
  const mimeType = extension === "png" ? "image/png" : "image/jpeg";
  const formData = new FormData();

  formData.append("photo", {
    uri: photoUri,
    name: filename,
    type: mimeType,
  } as any);
  formData.append("reply_mode", reply_mode);

  const { data } = await api.post(`/sessions/${sessionId}/messages/photo`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data;
};

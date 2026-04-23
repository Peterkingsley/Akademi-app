import api from "./api";

export interface Material {
  id: string;
  title: string;
  course_code: string;
  university: string;
  faculty: string;
  department: string;
  level: number;
  file_type: "PDF" | "IMAGE" | "DOC";
  verification_status: "PENDING" | "VERIFIED" | "FLAGGED" | "TAKEN_DOWN";
  file_ref: string;
  content?: string;
  updated_at: string;
  rating?: number;
  isBookmarked?: boolean;
}

export interface PracticeQuestion {
  id: string;
  question_text: string;
  approach_guide: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

export const materialService = {
  getMaterials: async (params: {
    university?: string;
    department?: string;
    course_code?: string;
  }) => {
    const { data } = await api.get<Material[]>("/materials", { params });
    return data;
  },

  getMyUploads: async () => {
    const { data } = await api.get<Material[]>("/users/me/uploads");
    return data;
  },

  uploadMaterial: async (materialData: {
    title: string;
    course_code: string;
    university: string;
    faculty: string;
    department: string;
    level: number;
    file_type: string;
  }) => {
    const { data } = await api.post<{ materialId: string; presignedUrl: string }>(
      "/materials/upload",
      materialData
    );
    return data;
  },

  confirmUpload: async (id: string) => {
    const { data } = await api.post(`/materials/${id}/confirm`);
    return data;
  },

  getMaterialDetails: async (id: string) => {
    const { data } = await api.get<Material>(`/materials/${id}`);
    return data;
  },

  getMaterialQuestions: async (id: string) => {
    const { data } = await api.get<PracticeQuestion[]>(`/materials/${id}/questions`);
    return data;
  },
};

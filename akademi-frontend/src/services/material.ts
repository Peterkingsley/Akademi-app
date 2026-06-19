import api from "./api";

export interface Material {
  id: string;
  title: string;
  course_code?: string | null;
  university: string;
  faculty: string;
  department: string;
  level: number;
  semester?: number | null;
  semester_start?: string | null;
  semester_end?: string | null;
  academic_year?: string | null;
  file_type: "PDF" | "IMAGE" | "DOC";
  verification_status: "PENDING" | "VERIFIED" | "FLAGGED" | "TAKEN_DOWN";
  file_ref: string;
  content?: string;
  reader_structure?: {
    version: number;
    generated_at: string;
    pages: Array<{
      id: string;
      chapterTitle: string;
      pageTitle: string;
      content: string;
      pageNumber: number;
      pageCountInChapter: number;
      blocks?: Array<{
        id: string;
        type: "text" | "image";
        text?: string;
        src?: string;
        alt?: string;
        caption?: string;
        description?: string;
      }>;
    }>;
  } | null;
  diagnostics?: {
    fileType: "PDF" | "IMAGE" | "DOC" | null;
    pageCount: number;
    imageBlockCount: number;
    hasFigureLanguage: boolean;
    warnings: Array<{
      code: string;
      message: string;
      detail?: string;
    }>;
  };
  processingNotice?: {
    status: "queued" | "degraded";
    message: string;
  };
  created_at?: string;
  updated_at?: string;
  rating?: number;
  isBookmarked?: boolean;
}

export interface PracticeQuestion {
  id: string;
  question_text: string;
  approach_guide: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  options?: string[];
  correct_answer?: string | null;
  explanation?: string | null;
}

export const materialService = {
  getMaterials: async (params: {
    university?: string;
    department?: string;
    course_code?: string;
    semester?: number;
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
    semester?: number | null;
    semester_start?: string | null;
    semester_end?: string | null;
    academic_year?: string | null;
    file_type: string;
    file_name: string;
    file_size: number;
    mime_type: string;
  }) => {
    const { data } = await api.post<{ materialId: string; presignedUrl: string }>(
      "/materials/upload",
      materialData
    );
    return data;
  },

  confirmUpload: async (id: string) => {
    const { data } = await api.post<Material>(`/materials/${id}/confirm`);
    return data;
  },

  getMaterialDetails: async (id: string) => {
    const { data } = await api.get<Material>(`/materials/${id}`);
    return data;
  },

  getMaterialQuestions: async (id: string, limit?: number) => {
    const { data } = await api.get<PracticeQuestion[]>(`/materials/${id}/questions`, {
      params: limit ? { limit } : undefined,
    });
    return data;
  },

  submitMaterialQuestionAttempts: async (
    id: string,
    answers: Array<{ questionId: string; answer?: string | null }>,
  ) => {
    const { data } = await api.post<{ created: number }>(`/materials/${id}/questions/attempts`, {
      answers,
    });
    return data;
  },
};

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_KEY = 'akademi_offline_materials';

export const offlineService = {
  getOfflineMaterials: async (): Promise<Material[]> => {
    const stored = await AsyncStorage.getItem(OFFLINE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  downloadMaterial: async (material: Material) => {
    const { data } = await api.get(`/materials/${material.id}/download`);
    const fileUri = FileSystem.documentDirectory + material.id + (material.file_type === 'PDF' ? '.pdf' : material.file_type === 'IMAGE' ? '.jpg' : '.doc');

    const downloadRes = await FileSystem.downloadAsync(data.url, fileUri);

    if (downloadRes.status === 200) {
      const offline = await offlineService.getOfflineMaterials();
      const updated = [...offline.filter(m => m.id !== material.id), { ...material, file_ref: fileUri }];
      await AsyncStorage.setItem(OFFLINE_KEY, JSON.stringify(updated));
      return fileUri;
    }
    throw new Error('Download failed');
  },

  deleteOfflineMaterial: async (id: string) => {
    const offline = await offlineService.getOfflineMaterials();
    const material = offline.find(m => m.id === id);
    if (material && material.file_ref.startsWith('file://')) {
      await FileSystem.deleteAsync(material.file_ref, { idempotent: true });
    }
    const updated = offline.filter(m => m.id !== id);
    await AsyncStorage.setItem(OFFLINE_KEY, JSON.stringify(updated));
  },

  isDownloaded: async (id: string) => {
    const offline = await offlineService.getOfflineMaterials();
    return offline.some(m => m.id === id);
  }
};

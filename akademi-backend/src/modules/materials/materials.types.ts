import { FileType, VerificationStatus } from '@prisma/client';

export interface MaterialFilter {
  university?: string;
  faculty?: string;
  department?: string;
  course_code?: string | null;
  level?: number;
  semester?: number;
}

export interface UploadMaterialRequest {
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
  file_type: FileType;
}

export interface UploadMaterialResponse {
  materialId: string;
  presignedUrl: string;
}

export interface ReportMaterialRequest {
  reason: string;
  description?: string;
}

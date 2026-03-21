import { FileType, VerificationStatus } from '@prisma/client';

export interface MaterialFilter {
  university?: string;
  faculty?: string;
  department?: string;
  course_code?: string;
  level?: number;
}

export interface UploadMaterialRequest {
  title: string;
  course_code: string;
  university: string;
  faculty: string;
  department: string;
  level: number;
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

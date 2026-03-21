export type FileCategory = 'PDF' | 'IMAGE' | 'DOC' | 'PROFILE_PHOTO';

export interface FileRule {
  maxChunkSize: number;
  maxTotalSize: number;
}

export const FILE_RULES: Record<FileCategory, FileRule> = {
  PDF: { maxChunkSize: 50 * 1024 * 1024, maxTotalSize: 200 * 1024 * 1024 },
  IMAGE: { maxChunkSize: 10 * 1024 * 1024, maxTotalSize: 10 * 1024 * 1024 },
  DOC: { maxChunkSize: 20 * 1024 * 1024, maxTotalSize: 100 * 1024 * 1024 },
  PROFILE_PHOTO: { maxChunkSize: 5 * 1024 * 1024, maxTotalSize: 5 * 1024 * 1024 },
};

export const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const BLOCKED_TYPES = ['application/zip', 'application/x-executable'];

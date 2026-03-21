import { FILE_RULES, ALLOWED_TYPES, BLOCKED_TYPES, FileCategory } from './r2.types';

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

export function validateFile(
  contentType: string,
  size: number,
  category: FileCategory,
) {
  if (BLOCKED_TYPES.includes(contentType)) {
    throw new FileValidationError(`File type ${contentType} is blocked.`);
  }

  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new FileValidationError(`File type ${contentType} is not allowed.`);
  }

  const rule = FILE_RULES[category];
  if (!rule) {
    throw new FileValidationError(`No rules defined for category ${category}.`);
  }

  if (size > rule.maxTotalSize) {
    throw new FileValidationError(
      `File size ${size} exceeds the maximum allowed size of ${rule.maxTotalSize} for category ${category}.`,
    );
  }

  return true;
}

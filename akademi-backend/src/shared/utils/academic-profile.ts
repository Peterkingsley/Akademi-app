export type AcademicProfileFields = {
  university?: string | null;
  faculty?: string | null;
  department?: string | null;
  level?: number | null;
};

export type CompleteAcademicProfile<T extends AcademicProfileFields = AcademicProfileFields> = T & {
  university: string;
  faculty: string;
  department: string;
  level: number;
};

export const isAcademicProfileComplete = <T extends AcademicProfileFields>(
  profile: T,
): profile is CompleteAcademicProfile<T> =>
  typeof profile.university === 'string' &&
  profile.university.trim().length > 0 &&
  typeof profile.faculty === 'string' &&
  profile.faculty.trim().length > 0 &&
  typeof profile.department === 'string' &&
  profile.department.trim().length > 0 &&
  typeof profile.level === 'number' &&
  Number.isInteger(profile.level) &&
  profile.level > 0;

export const normalizePhoneNumber = (value: string): string | null => {
  const compact = value.trim().replace(/[\s().-]/g, '');
  if (!compact) return null;

  if (/^0\d{10}$/.test(compact)) {
    return `+234${compact.slice(1)}`;
  }

  if (/^234\d{10}$/.test(compact)) {
    return `+${compact}`;
  }

  if (/^\+\d{7,15}$/.test(compact)) {
    return compact;
  }

  return null;
};

export type AcademicProfileFields = {
  university?: string | null;
  faculty?: string | null;
  department?: string | null;
  level?: number | null;
};

export const isAcademicProfileComplete = (profile: AcademicProfileFields): boolean =>
  Boolean(
    profile.university?.trim() &&
      profile.faculty?.trim() &&
      profile.department?.trim() &&
      Number.isInteger(profile.level) &&
      (profile.level || 0) > 0,
  );

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

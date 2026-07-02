import fs from 'fs';
import path from 'path';
import prisma from '../../config/db';

const PLACEHOLDER_FACULTIES = new Set([
  'General Studies',
  'Technical and Vocational Studies',
  'Education',
]);

const PLACEHOLDER_DEPARTMENTS = new Set([
  'General Studies',
  'General Technical Studies',
  'General Education',
]);

type MasterInstitution = {
  institution: string;
  faculties?: Array<{
    faculty_name?: string;
    courses?: Array<{ course_name?: string }>;
  }>;
};

type ReviewCandidate = {
  name: string;
  approved?: boolean;
  type?: string;
};

export type UniversityCoverageItem = {
  id: string;
  name: string;
  location: string | null;
  sourceCategory: 'master' | 'imported' | 'unknown';
  schoolType: string;
  facultyCount: number;
  departmentCount: number;
  placeholderFacultyCount: number;
  placeholderDepartmentCount: number;
  hasPlaceholderFaculty: boolean;
  hasPlaceholderDepartment: boolean;
  status:
    | 'complete'
    | 'placeholder_only'
    | 'missing_departments'
    | 'missing_faculties'
    | 'needs_department_enrichment'
    | 'manual_review_required';
  recommendedAction: string;
};

function normalizeInstitutionName(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(formerly|former|affl|affiliated|affliated|campus|main campus|open|degree awarding|deg)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|of|and|for|in|at|a|to)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function detectSchoolType(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes('polytechnic')) return 'polytechnic';
  if (normalized.includes('college of education')) return 'college_of_education';
  return 'university';
}

function buildStatus(item: {
  departmentCount: number;
  facultyCount: number;
  placeholderDepartmentCount: number;
  placeholderFacultyCount: number;
}) {
  if (item.departmentCount === 0) {
    return {
      status: 'missing_departments' as const,
      recommendedAction: 'Add real departments and faculty mappings.',
    };
  }

  if (item.facultyCount === 0) {
    return {
      status: 'missing_faculties' as const,
      recommendedAction: 'Add real faculty groupings for this school.',
    };
  }

  if (item.placeholderDepartmentCount === item.departmentCount) {
    return {
      status: 'placeholder_only' as const,
      recommendedAction: 'Replace placeholder department data with real school structure.',
    };
  }

  if (
    item.placeholderDepartmentCount > 0 ||
    item.placeholderFacultyCount > 0 ||
    item.departmentCount <= 1 ||
    item.facultyCount <= 1
  ) {
    return {
      status: 'needs_department_enrichment' as const,
      recommendedAction: 'Enrich missing departments or faculties and review for completeness.',
    };
  }

  if (item.departmentCount < 3) {
    return {
      status: 'manual_review_required' as const,
      recommendedAction: 'Review this school manually to confirm it is complete.',
    };
  }

  return {
    status: 'complete' as const,
    recommendedAction: 'No action needed.',
  };
}

export async function getUniversityCoverageAudit() {
  const masterPath = path.resolve(process.cwd(), 'prisma/data/nigerian_tertiary_master.json');
  const reviewPath = path.resolve(process.cwd(), 'prisma/data/tertiary-import-review-2026-06-11.json');

  const masterInstitutions = readJsonFile<MasterInstitution[]>(masterPath, []);
  const reviewFile = readJsonFile<{ candidates?: ReviewCandidate[] }>(reviewPath, { candidates: [] });

  const masterNames = new Set(masterInstitutions.map((item) => normalizeInstitutionName(item.institution)).filter(Boolean));
  const importedNames = new Set(
    (reviewFile.candidates || [])
      .filter((candidate) => candidate?.approved && candidate?.name)
      .map((candidate) => normalizeInstitutionName(candidate.name))
      .filter(Boolean)
  );

  const universities = await prisma.university.findMany({
    include: {
      departments: true,
    },
    orderBy: { name: 'asc' },
  });

  const items: UniversityCoverageItem[] = universities.map((university) => {
    const departmentNames = university.departments.map((department) => department.name.trim()).filter(Boolean);
    const facultyNames = university.departments.map((department) => department.faculty.trim()).filter(Boolean);

    const uniqueDepartments = Array.from(new Set(departmentNames));
    const uniqueFaculties = Array.from(new Set(facultyNames));
    const placeholderDepartmentCount = uniqueDepartments.filter((name) => PLACEHOLDER_DEPARTMENTS.has(name)).length;
    const placeholderFacultyCount = uniqueFaculties.filter((name) => PLACEHOLDER_FACULTIES.has(name)).length;
    const normalizedName = normalizeInstitutionName(university.name);

    const sourceCategory: UniversityCoverageItem['sourceCategory'] = masterNames.has(normalizedName)
      ? 'master'
      : importedNames.has(normalizedName)
        ? 'imported'
        : 'unknown';

    const next = {
      id: university.id,
      name: university.name,
      location: university.location,
      sourceCategory,
      schoolType: detectSchoolType(university.name),
      facultyCount: uniqueFaculties.length,
      departmentCount: uniqueDepartments.length,
      placeholderFacultyCount,
      placeholderDepartmentCount,
      hasPlaceholderFaculty: placeholderFacultyCount > 0,
      hasPlaceholderDepartment: placeholderDepartmentCount > 0,
      ...buildStatus({
        departmentCount: uniqueDepartments.length,
        facultyCount: uniqueFaculties.length,
        placeholderDepartmentCount,
        placeholderFacultyCount,
      }),
    };

    return next;
  });

  const summary = {
    totalSchools: items.length,
    completeSchools: items.filter((item) => item.status === 'complete').length,
    placeholderOnlySchools: items.filter((item) => item.status === 'placeholder_only').length,
    missingDepartments: items.filter((item) => item.status === 'missing_departments').length,
    missingFaculties: items.filter((item) => item.status === 'missing_faculties').length,
    needsEnrichment: items.filter((item) => item.status === 'needs_department_enrichment').length,
    manualReviewRequired: items.filter((item) => item.status === 'manual_review_required').length,
    importedSchools: items.filter((item) => item.sourceCategory === 'imported').length,
    masterSchools: items.filter((item) => item.sourceCategory === 'master').length,
    unknownSourceSchools: items.filter((item) => item.sourceCategory === 'unknown').length,
  };

  return {
    summary,
    items,
  };
}

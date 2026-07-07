import prisma from '../../config/db';

/**
 * Read-only lookup: resolves a user-facing university/department name pair to a real
 * Department id, or null if either side has no matching catalog row. Never creates rows —
 * use `upsertDepartment` for write paths (upload, backfill).
 */
export async function resolveDepartmentId(
  universityName: string,
  departmentName: string,
): Promise<string | null> {
  const university = await prisma.university.findFirst({
    where: { name: universityName },
    select: { id: true },
  });
  if (!university) return null;

  const department = await prisma.department.findFirst({
    where: { university_id: university.id, name: departmentName },
    select: { id: true },
  });
  return department?.id ?? null;
}

/**
 * Write path: finds or creates the University + Department rows for the given names.
 */
export async function upsertDepartment(params: {
  universityName: string;
  departmentName: string;
  faculty: string;
}): Promise<{ id: string }> {
  const university = await prisma.university.upsert({
    where: { name: params.universityName },
    update: {},
    create: { name: params.universityName, location: 'Nigeria' },
    select: { id: true },
  });

  return prisma.department.upsert({
    where: {
      name_university_id: {
        name: params.departmentName,
        university_id: university.id,
      },
    },
    update: { faculty: params.faculty },
    create: {
      name: params.departmentName,
      faculty: params.faculty,
      university_id: university.id,
    },
    select: { id: true },
  });
}

/**
 * Read-only lookup of a Course row by (code, department). `Course` is uniquely keyed on
 * [code, department_id] with no level in the key, so this is always unambiguous.
 */
export async function findCourseId(departmentId: string, code: string): Promise<string | null> {
  const normalizedCode = code.trim().toUpperCase();
  const course = await prisma.course.findUnique({
    where: { code_department_id: { code: normalizedCode, department_id: departmentId } },
    select: { id: true },
  });
  return course?.id ?? null;
}

/**
 * Write path: finds or creates the Course catalog row for (code, department), updating
 * level/semester to the latest-seen values on conflict.
 */
export async function findOrCreateCourse(params: {
  departmentId: string;
  code: string;
  level: number;
  semester?: number | null;
  name?: string;
  source?: string;
}): Promise<{ id: string; level: number; semester: number }> {
  const normalizedCode = params.code.trim().toUpperCase();
  const semester = params.semester || 1;

  return prisma.course.upsert({
    where: { code_department_id: { code: normalizedCode, department_id: params.departmentId } },
    update: { level: params.level, semester },
    create: {
      code: normalizedCode,
      name: params.name || normalizedCode,
      level: params.level,
      semester,
      source: params.source || 'system',
      department_id: params.departmentId,
    },
    select: { id: true, level: true, semester: true },
  });
}

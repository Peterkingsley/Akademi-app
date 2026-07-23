import prisma from '../../config/db';
import { systemQueue, JOB_NAMES } from '../../config/queue';

export type EnsureTextbookGenerationResult = 'queued' | 'skipped';

// Shared by ensureTextbookGenerationQueued (decides whether to enqueue) and
// decomposeCurriculumJob's own internal re-check (decides whether to bail out of a job that's
// already running) — one existence check, not two independently-maintained copies of it.
// "Any row", not "a current one" — see ensureTextbookGenerationQueued's comment for why.
//
// Two-tier: a SCHOOL_SPECIFIC outline for the requesting university is authoritative when it
// exists (that school's own 30% pick), since it's a strictly more specific match than the
// NATIONAL_CORE fallback. universityId is optional — omit it (or pass null) to only ever check
// the national tier, e.g. for callers that don't have a specific student's school in hand.
export async function hasExistingTextbookOutline(courseCode: string, universityId?: string | null): Promise<boolean> {
  const code = courseCode.trim().toUpperCase();

  if (universityId) {
    const schoolSpecific = await prisma.generatedTextbookOutline.findFirst({
      where: { course_code: code, scope_type: 'SCHOOL_SPECIFIC', university_id: universityId },
      select: { id: true },
    });
    if (schoolSpecific) return true;
  }

  const national = await prisma.generatedTextbookOutline.findFirst({
    where: { course_code: code, scope_type: 'NATIONAL_CORE' },
    select: { id: true },
  });
  return Boolean(national);
}

// Generation is national per course code by default, not per school: the first student anywhere
// to take a course code kicks off generation once; every other school's students reuse the same
// outline — UNLESS that school has its own SCHOOL_SPECIFIC CCMAS document (its 30% pick), in
// which case that takes priority for that school's students specifically (see
// hasExistingTextbookOutline / decomposeCurriculumJob's identical two-tier document lookup).
// This single check-and-enqueue is the one place that decision gets made — the live
// StudentCourse-creation hook and the backfill script (backfill-textbook-generation.ts) both
// call this directly rather than each re-implementing the existence check.
//
// The existence check is deliberately "any outline row for this course code (in the relevant
// tier)", not "a CURRENT one" — decomposeCurriculumJob creates the outline row well before it's
// generated and flipped to is_current (that only happens once every section publishes). Guarding
// on is_current alone would leave a real window, between "outline row created" and "outline
// marked current", where a second call for the same course code would see nothing current yet
// and enqueue a duplicate decomposition — the queue's own payload-dedup only protects the single
// in-flight DECOMPOSE_CURRICULUM job, not the whole generate-then-publish pipeline it kicks off.
// Checking for any row closes that window and is what actually makes this safe to call
// repeatedly (e.g. re-running the backfill script, or two students enrolling in the same code
// close together). Phase C's CCMAS-version regeneration path intentionally bypasses this
// function (it explicitly wants a new outline for a course code that already has one) rather
// than relying on it.
export async function ensureTextbookGenerationQueued(
  courseCode: string,
  universityId?: string | null,
): Promise<EnsureTextbookGenerationResult> {
  const code = courseCode.trim().toUpperCase();

  if (await hasExistingTextbookOutline(code, universityId)) return 'skipped';

  systemQueue
    .add(JOB_NAMES.DECOMPOSE_CURRICULUM, { courseCode: code, universityId: universityId || undefined })
    .catch((error: unknown) => {
      console.error('[textbooks] failed to enqueue curriculum decomposition', { code, universityId, error });
    });

  return 'queued';
}

// Bypasses the hasExistingTextbookOutline check to manually force a regeneration of an
// already-published or previously-failed outline.
export async function forceRegenerateTextbookOutline(
  courseCode: string,
  universityId?: string | null,
): Promise<EnsureTextbookGenerationResult> {
  const code = courseCode.trim().toUpperCase();

  systemQueue
    .add(JOB_NAMES.DECOMPOSE_CURRICULUM, { courseCode: code, universityId: universityId || undefined })
    .catch((error: unknown) => {
      console.error('[textbooks] failed to force-enqueue curriculum decomposition', { code, universityId, error });
    });

  return 'queued';
}

// Fire-and-forget by design — callers must not await this in a way that blocks a student-facing
// response (registration/login/profile-update). universityId is the requesting student's own
// school — passed once for the whole batch since a StudentCourse-creation event always belongs
// to one student at one school.
export async function triggerTextbookGenerationForCourseCodes(
  courseCodes: Array<string | null | undefined>,
  universityId?: string | null,
): Promise<void> {
  const uniqueCodes = Array.from(
    new Set(
      courseCodes
        .map((code) => code?.trim().toUpperCase())
        .filter((code): code is string => Boolean(code)),
    ),
  );

  for (const code of uniqueCodes) {
    try {
      await ensureTextbookGenerationQueued(code, universityId);
    } catch (error) {
      console.error('[textbooks] failed to check for existing outline', { code, universityId, error });
    }
  }
}

// Auto-enrolls a student in every active, relevant CCMAS course code for their department/level,
// bypassing the need for manual text entry at signup/profile-update, and triggers generation.
// Safely skips course codes the student is already enrolled in.
export async function autoEnrollStudentInDepartmentCourses(
  userId: string,
  universityId: string | null,
  faculty: string,
  departmentName: string,
  level: number
): Promise<void> {
  // 1. Find all active course-scoped CCMAS documents for this department + level.
  // We respect the exact same two-tier scope rules that outline generation uses:
  // a school's own 30% specific pick is authoritative, but the 70% national core is the baseline.
  // Note: we can just fetch all matching ones, and then resolve duplicates by course code
  // using the two-tier priority.
  const documents = await prisma.disciplineDocument.findMany({
    where: {
      faculty,
      department: departmentName,
      source_type: 'CCMAS',
      is_active: true,
      level,
      course_code: { not: null },
      OR: [
        { scope_type: 'NATIONAL_CORE' },
        { scope_type: 'SCHOOL_SPECIFIC', university_id: universityId },
      ],
    },
    select: { course_code: true, scope_type: true },
  });

  if (documents.length === 0) return;

  // Deduplicate: prioritize SCHOOL_SPECIFIC over NATIONAL_CORE if both exist for the same code.
  const prioritizedCourseCodes = new Map<string, string>(); // course_code -> scope_type
  for (const doc of documents) {
    if (!doc.course_code) continue;
    const code = doc.course_code.toUpperCase();
    const existingScope = prioritizedCourseCodes.get(code);
    if (!existingScope || doc.scope_type === 'SCHOOL_SPECIFIC') {
      prioritizedCourseCodes.set(code, doc.scope_type);
    }
  }

  const courseCodesToEnroll = Array.from(prioritizedCourseCodes.keys());

  // 2. Identify which of these the student is NOT already enrolled in
  const existingEnrollments = await prisma.studentCourse.findMany({
    where: {
      user_id: userId,
      code: { in: courseCodesToEnroll },
    },
    select: { code: true, level: true, semester: true },
  });

  const existingEnrollmentKeys = new Set(
    existingEnrollments.map((sc) => sc.code.toUpperCase())
  );

  const missingCodes = courseCodesToEnroll.filter(
    (code) => !existingEnrollmentKeys.has(code)
  );

  if (missingCodes.length === 0) return;

  // 3. Look up the department row to attach these to
  const departmentRow = await prisma.department.findFirst({
    where: {
      name: departmentName,
      faculty: faculty,
      university: universityId ? { id: universityId } : undefined,
    },
    select: { id: true },
  });

  if (!departmentRow) {
    console.warn(
      `[auto-enroll] department row not found for ${departmentName} / ${faculty} (university: ${universityId})`
    );
    return;
  }

  // 4. Enroll them
  // We use placeholder semester/dates (e.g., semester 1, current year) for auto-enrollments,
  // since CCMAS docs don't dictate exact semester schedules globally. The student can adjust later.
  const now = new Date();
  const nextMonth = new Date();
  nextMonth.setMonth(now.getMonth() + 4);

  await prisma.studentCourse.createMany({
    data: missingCodes.map((code) => ({
      user_id: userId,
      department_id: departmentRow.id,
      code,
      name: null,
      level,
      semester: 1, // default
      semester_start: now,
      semester_end: nextMonth,
      source: 'ccmas_auto',
    })),
    skipDuplicates: true,
  });

  // 5. Trigger generation
  // Uses the existing batch trigger which is fire-and-forget.
  await triggerTextbookGenerationForCourseCodes(missingCodes, universityId);
}


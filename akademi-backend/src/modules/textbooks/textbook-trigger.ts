import prisma from '../../config/db';
import { systemQueue, JOB_NAMES } from '../../config/queue';

export type EnsureTextbookGenerationResult = 'queued' | 'skipped';

// Shared by ensureTextbookGenerationQueued (decides whether to enqueue) and
// decomposeCurriculumJob's own internal re-check (decides whether to bail out of a job that's
// already running) — one existence check, not two independently-maintained copies of it.
// "Any row", not "a current one" — see ensureTextbookGenerationQueued's comment for why.
export async function hasExistingTextbookOutline(courseCode: string): Promise<boolean> {
  const existing = await prisma.generatedTextbookOutline.findFirst({
    where: { course_code: courseCode.trim().toUpperCase() },
    select: { id: true },
  });
  return Boolean(existing);
}

// Generation is national per course code, not per school: the first student anywhere to take a
// course code kicks off generation once; every other school's students reuse the same outline.
// This single check-and-enqueue is the one place that decision gets made — the live
// StudentCourse-creation hook and the backfill script (backfill-textbook-generation.ts) both
// call this directly rather than each re-implementing the existence check.
//
// The existence check is deliberately "any outline row for this course code", not "a CURRENT
// one" — decomposeCurriculumJob creates the outline row well before it's generated and flipped
// to is_current (that only happens once every section publishes). Guarding on is_current alone
// would leave a real window, between "outline row created" and "outline marked current", where a
// second call for the same course code would see nothing current yet and enqueue a duplicate
// decomposition — the queue's own payload-dedup only protects the single in-flight
// DECOMPOSE_CURRICULUM job, not the whole generate-then-publish pipeline it kicks off. Checking
// for any row closes that window and is what actually makes this safe to call repeatedly (e.g.
// re-running the backfill script, or two students enrolling in the same code close together).
// Phase C's CCMAS-version regeneration path intentionally bypasses this function (it explicitly
// wants a new outline for a course code that already has one) rather than relying on it.
export async function ensureTextbookGenerationQueued(courseCode: string): Promise<EnsureTextbookGenerationResult> {
  const code = courseCode.trim().toUpperCase();

  if (await hasExistingTextbookOutline(code)) return 'skipped';

  systemQueue.add(JOB_NAMES.DECOMPOSE_CURRICULUM, { courseCode: code }).catch((error: unknown) => {
    console.error('[textbooks] failed to enqueue curriculum decomposition', { code, error });
  });

  return 'queued';
}

// Fire-and-forget by design — callers must not await this in a way that blocks a student-facing
// response (registration/login/profile-update).
export async function triggerTextbookGenerationForCourseCodes(courseCodes: Array<string | null | undefined>): Promise<void> {
  const uniqueCodes = Array.from(
    new Set(
      courseCodes
        .map((code) => code?.trim().toUpperCase())
        .filter((code): code is string => Boolean(code)),
    ),
  );

  for (const code of uniqueCodes) {
    try {
      await ensureTextbookGenerationQueued(code);
    } catch (error) {
      console.error('[textbooks] failed to check for existing outline', { code, error });
    }
  }
}

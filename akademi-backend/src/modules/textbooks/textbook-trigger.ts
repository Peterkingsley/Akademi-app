import prisma from '../../config/db';
import { systemQueue, JOB_NAMES } from '../../config/queue';

// Generation is national per course code, not per school: the first student anywhere to take a
// course code kicks off generation once; every other school's students reuse the same outline.
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
      const existing = await prisma.generatedTextbookOutline.findFirst({
        where: { course_code: code, is_current: true },
        select: { id: true },
      });
      if (existing) continue;

      systemQueue.add(JOB_NAMES.DECOMPOSE_CURRICULUM, { courseCode: code }).catch((error: unknown) => {
        console.error('[textbooks] failed to enqueue curriculum decomposition', { code, error });
      });
    } catch (error) {
      console.error('[textbooks] failed to check for existing outline', { code, error });
    }
  }
}

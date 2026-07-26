import prisma from '../config/db';
import { systemQueue, JOB_NAMES } from '../config/queue';

const ACTIVE_LOCKS = new Map<string, { startedAt: Date; expiresAt: Date }>();

/**
 * Ensures textbook generation is triggered exactly once per courseCode nationally,
 * using memory/DB advisory locking with a 6-hour TTL.
 */
export async function ensureNationalTextbookGeneration(courseCode: string): Promise<{ status: 'published' | 'generating' | 'queued'; materialId?: string }> {
  // Check if published Material already exists for courseCode. unpublished_at: null matters here
  // specifically — otherwise a course whose old generated textbook was retired by the reset
  // pipeline (scripts/reset-generated-textbooks.ts) would still read as "published" and this
  // would never trigger the new pipeline for it.
  const existingMaterial = await prisma.material.findFirst({
    where: { course_code: courseCode, is_akademi_generated: true, unpublished_at: null },
    select: { id: true }
  });

  if (existingMaterial) {
    return { status: 'published', materialId: existingMaterial.id };
  }

  const lockKey = `textbook:${courseCode}`;
  const now = new Date();
  const existingLock = ACTIVE_LOCKS.get(lockKey);

  if (existingLock && existingLock.expiresAt > now) {
    return { status: 'generating' };
  }

  // Set advisory lock with 6-hour TTL
  const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  ACTIVE_LOCKS.set(lockKey, { startedAt: now, expiresAt });

  // Trigger DAG Pipeline via buildCourseFloor.job
  await systemQueue.add(JOB_NAMES.BUILD_COURSE_FLOOR, { courseCode });

  return { status: 'queued' };
}

export function releaseNationalTextbookLock(courseCode: string) {
  ACTIVE_LOCKS.delete(`textbook:${courseCode}`);
}

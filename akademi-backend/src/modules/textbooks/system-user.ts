import prisma from '../../config/db';

// Akademi Generated Textbooks are authored by the platform itself, not a real student — every
// Material still requires a valid uploaded_by User FK, so this is a dedicated, idempotently
// provisioned service account rather than a schema nullability change.
const SYSTEM_USER_EMAIL = 'system+textbooks@akademi.internal';

let cachedSystemUserId: string | null = null;

export async function getOrCreateSystemUser(): Promise<{ id: string }> {
  if (cachedSystemUserId) return { id: cachedSystemUserId };

  const existing = await prisma.user.findUnique({ where: { email: SYSTEM_USER_EMAIL } });
  if (existing) {
    cachedSystemUserId = existing.id;
    return { id: existing.id };
  }

  try {
    const created = await prisma.user.create({
      data: {
        name: 'Akademi Textbooks',
        email: SYSTEM_USER_EMAIL,
        university: 'AKADEMI_NATIONAL',
        faculty: 'N/A',
        department: 'N/A',
        level: 0,
        is_verified: true,
      },
    });

    cachedSystemUserId = created.id;
    return { id: created.id };
  } catch (error: any) {
    // Unique constraint on email: another job created it concurrently between the check above
    // and this create. Re-fetch rather than treating it as a real failure.
    if (error?.code === 'P2002') {
      const raceWinner = await prisma.user.findUnique({ where: { email: SYSTEM_USER_EMAIL } });
      if (raceWinner) {
        cachedSystemUserId = raceWinner.id;
        return { id: raceWinner.id };
      }
    }
    throw error;
  }
}

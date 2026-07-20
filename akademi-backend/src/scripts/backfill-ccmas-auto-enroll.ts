import prisma from '../config/db';
import { autoEnrollStudentInDepartmentCourses } from '../modules/textbooks/textbook-trigger';

const BATCH_SIZE = 8;
const DELAY_BETWEEN_BATCHES_MS = 5000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function backfillCCMASAutoEnroll() {
  console.log('Fetching all users with academic profiles...');
  const users = await prisma.user.findMany({
    where: {
      is_deleted: false,
      university: { not: '' },
      faculty: { not: '' },
      department: { not: '' },
      level: { not: 0 },
    },
    select: {
      id: true,
      university: true,
      faculty: true,
      department: true,
      level: true,
    },
  });

  console.log(`Found ${users.length} users with academic profiles to process.`);

  // Cache university resolutions to avoid redundant DB queries
  const universityIdCache = new Map<string, string | null>();

  let processedCount = 0;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (u) => {
        let uniId = universityIdCache.get(u.university);
        if (uniId === undefined) {
          const uni = await prisma.university.findUnique({
            where: { name: u.university },
            select: { id: true },
          });
          uniId = uni?.id || null;
          universityIdCache.set(u.university, uniId);
        }

        await autoEnrollStudentInDepartmentCourses(
          u.id,
          uniId,
          u.faculty,
          u.department,
          u.level
        );
      })
    );

    processedCount += batch.length;
    console.log(`Processed ${processedCount}/${users.length} users...`);

    if (i + BATCH_SIZE < users.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  console.log('Backfill complete!');
}

async function main() {
  console.log('Starting one-time catch-up backfill for CCMAS auto-enrollments...');
  await backfillCCMASAutoEnroll();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

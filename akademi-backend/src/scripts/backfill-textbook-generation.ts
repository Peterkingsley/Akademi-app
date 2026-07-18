// One-time (or occasional-reconciliation) backfill: the live StudentCourse-creation hook only
// fires textbook generation for NEW enrollments, so students who enrolled before the Akademi
// Generated Textbooks feature existed never trigger it for their course codes. This script
// closes that gap by walking every distinct course code that already has at least one enrolled
// student and running the same check-and-enqueue path the live hook uses.
//
// This is a DELIBERATE, MANUALLY-TRIGGERED action (`npm run backfill:textbook-generation`) — it
// is NOT wired into app boot or deploy, and should not be. Run it once the base feature is
// confirmed working correctly on new enrollments, not automatically.
//
// Safe to re-run: ensureTextbookGenerationQueued() always checks for an existing outline before
// enqueueing, so running this script again (e.g. as periodic reconciliation after a bulk course
// import) will not double-enqueue course codes that already have an outline in flight or current.

import prisma from '../config/db';
import { ensureTextbookGenerationQueued } from '../modules/textbooks/textbook-trigger';

const BATCH_SIZE = 8;
const DELAY_BETWEEN_BATCHES_MS = 5000;

type Summary = { total: number; queued: number; skipped: number; failed: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getDistinctCourseCodes(): Promise<string[]> {
  const rows = await prisma.studentCourse.findMany({
    distinct: ['code'],
    select: { code: true },
  });
  return rows.map((row) => row.code).filter(Boolean);
}

async function backfillTextbookGeneration(): Promise<Summary> {
  const codes = await getDistinctCourseCodes();
  const summary: Summary = { total: codes.length, queued: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const batch = codes.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(batch.map((code) => ensureTextbookGenerationQueued(code)));

    for (let j = 0; j < results.length; j += 1) {
      const result = results[j];
      const code = batch[j];
      if (result.status === 'fulfilled') {
        if (result.value === 'queued') summary.queued += 1;
        else summary.skipped += 1;
      } else {
        summary.failed += 1;
        console.error(`[backfill-textbook-generation] failed for course code ${code}:`, result.reason);
      }
    }

    console.log(
      `[backfill-textbook-generation] processed ${Math.min(i + BATCH_SIZE, codes.length)}/${codes.length} course codes...`,
    );

    if (i + BATCH_SIZE < codes.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  return summary;
}

async function main() {
  console.log('Backfilling Akademi Generated Textbooks for existing StudentCourse enrollments...');
  const summary = await backfillTextbookGeneration();
  console.log('\nSummary:');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

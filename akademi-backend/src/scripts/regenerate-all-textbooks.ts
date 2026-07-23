// One-time or occasional batch script: forcefully regenerates every textbook
// outline that is currently live (`is_current: true`), bypassing the
// existence check. Use this when the underlying model or prompt has
// improved significantly and you want to bring the entire library up to
// the new standard without dropping any courses.
//
// Older versions remain live and serving students until their respective
// new versions finish generating, passing audits, and get published,
// causing a zero-downtime swap.

import prisma from '../config/db';
import { forceRegenerateTextbookOutline } from '../modules/textbooks/textbook-trigger';

const BATCH_SIZE = 8;
const DELAY_BETWEEN_BATCHES_MS = 5000;

type Summary = { total: number; queued: number; failed: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function regenerateAllTextbooks(): Promise<Summary> {
  // We only target currently active outlines to avoid regenerating historical/superseded versions.
  const activeOutlines = await prisma.generatedTextbookOutline.findMany({
    where: { is_current: true },
    select: { course_code: true, university_id: true },
  });

  const summary: Summary = { total: activeOutlines.length, queued: 0, failed: 0 };

  for (let i = 0; i < activeOutlines.length; i += BATCH_SIZE) {
    const batch = activeOutlines.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((outline) => forceRegenerateTextbookOutline(outline.course_code, outline.university_id))
    );

    for (let j = 0; j < results.length; j += 1) {
      const result = results[j];
      const outline = batch[j];
      if (result.status === 'fulfilled') {
        summary.queued += 1;
      } else {
        summary.failed += 1;
        console.error(
          `[regenerate-all-textbooks] failed for course code ${outline.course_code} (uni: ${outline.university_id}):`,
          result.reason
        );
      }
    }

    console.log(
      `[regenerate-all-textbooks] processed ${Math.min(i + BATCH_SIZE, activeOutlines.length)}/${activeOutlines.length} outlines...`
    );

    if (i + BATCH_SIZE < activeOutlines.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  return summary;
}

async function main() {
  console.log('Force-regenerating all currently active Akademi Textbooks...');
  const summary = await regenerateAllTextbooks();
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

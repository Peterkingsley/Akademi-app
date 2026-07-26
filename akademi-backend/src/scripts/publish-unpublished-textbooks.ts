// One-off, manually-triggered script: force-publishes every GeneratedTextbookOutline that has no
// Material yet, using whatever section content currently exists — including sections that never
// passed their quality audit. This deliberately bypasses auditTextbookOutlineJob's normal gate
// (which would only publish once every leaf is GENERATED/ADMIN_QUEUED and quality-passed); here
// we want to see the current state of the legacy pipeline's output as-is, warts included, before
// it gets reset. Not wired into any automated flow — run by hand, once.

import prisma from '../config/db';
import { publishGeneratedTextbook } from '../jobs/auditTextbookOutline.job';

async function main() {
  const unpublished = await prisma.generatedTextbookOutline.findMany({
    where: { material_id: null },
    select: { id: true, course_code: true },
    orderBy: { course_code: 'asc' },
  });

  console.log(`${unpublished.length} unpublished outlines to force-publish as-is.\n`);

  const results: Array<{ courseCode: string; status: 'published' | 'failed'; error?: string }> = [];

  for (const outline of unpublished) {
    try {
      await publishGeneratedTextbook(outline.id);
      results.push({ courseCode: outline.course_code, status: 'published' });
      console.log(`[publish-unpublished] ${outline.course_code}: published.`);
    } catch (error) {
      results.push({
        courseCode: outline.course_code,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`[publish-unpublished] ${outline.course_code}: FAILED —`, error);
    }
  }

  console.log('\nSummary:');
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

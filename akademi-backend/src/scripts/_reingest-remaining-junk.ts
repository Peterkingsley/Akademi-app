import prisma from '../config/db';
import { ingestMaterialJob } from '../jobs/ingestMaterial.job';

const TARGET_IDS = [
  '58de638d-e182-4916-858a-b3927dd9b731', // GST 112 - CHAPTER3 S2
  'b3f14011-8738-479b-8e19-e06560d61463', // GST 112 - CHAPTER1
  '6dc03a79-e61d-457d-a009-336d62f6ab98', // GST 112 - CMT-COMMUNICATION TECHNIQUES MATERIAL
  'a153dba4-6ee2-4ecd-aea4-06bb8880a6f3', // GST - THE EVOLUTION OF NIGERIA
  '517b4407-de91-473d-b90f-9795cf9a5034', // MTH 102 - MTH 102 LECTURE 1 CONT.
  'f6b789e3-4d50-498e-aff2-952d7af1b019', // PHY 108 - 300 PHYSICS FORMULAS
];

async function main() {
  const before = await prisma.material.findMany({
    where: { id: { in: TARGET_IDS } },
    select: { id: true, title: true, course_code: true, content: true, processing_status: true },
  });

  console.log(`Re-ingesting ${before.length} materials...\n`);

  const results: Array<Record<string, unknown>> = [];

  for (const m of before) {
    const beforeLen = m.content?.trim().length || 0;
    console.log(`--- [${m.course_code}] "${m.title}" (id=${m.id}) ---`);
    console.log(`  before: ${beforeLen} chars, status=${m.processing_status}`);

    await prisma.material.update({ where: { id: m.id }, data: { processing_status: 'UPLOADED' as any } });

    try {
      await ingestMaterialJob(m.id);
      const after = await prisma.material.findUnique({
        where: { id: m.id },
        select: { content: true, reader_structure: true, processing_status: true },
      });
      const afterLen = after?.content?.trim().length || 0;
      const method = (after?.reader_structure as any)?.extraction_method || '(none)';
      console.log(`  after:  ${afterLen} chars, status=${after?.processing_status}, extraction_method=${method}`);
      console.log(`  preview: ${JSON.stringify(after?.content?.slice(0, 200))}`);
      results.push({
        id: m.id,
        title: m.title,
        course_code: m.course_code,
        beforeLen,
        afterLen,
        recovered: afterLen > beforeLen && afterLen > 0,
        extraction_method: method,
        status: after?.processing_status,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  FAILED: ${message}`);
      results.push({ id: m.id, title: m.title, course_code: m.course_code, beforeLen, afterLen: 0, recovered: false, error: message });
    }
    console.log('');
  }

  console.log('\n=== Summary ===');
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

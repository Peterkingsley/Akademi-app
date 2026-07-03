import prisma from '../config/db';
import { VerificationStatus } from '@prisma/client';
import { generateQuestionsJob, QUESTION_BUFFER_TARGET } from '../jobs/generateQuestions.job';

const BATCH_SIZE = 50;

async function main() {
  let cursor: string | undefined;
  let processed = 0;
  let toppedUp = 0;
  let alreadyFull = 0;
  let failed = 0;

  for (;;) {
    const materials = await prisma.material.findMany({
      where: { verification_status: VerificationStatus.VERIFIED },
      select: { id: true, title: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (materials.length === 0) break;

    for (const material of materials) {
      processed += 1;
      const currentCount = await prisma.question.count({ where: { material_id: material.id } });
      const shortfall = QUESTION_BUFFER_TARGET - currentCount;

      if (shortfall <= 0) {
        alreadyFull += 1;
        continue;
      }

      console.log(`[${processed}] ${material.title} (${material.id}): ${currentCount}/${QUESTION_BUFFER_TARGET}, generating ${shortfall} more...`);
      try {
        const created = await generateQuestionsJob(material.id, { count: shortfall });
        console.log(`  created ${created}`);
        toppedUp += 1;
      } catch (error) {
        failed += 1;
        console.error(`  failed:`, error instanceof Error ? error.message : error);
      }
    }

    cursor = materials[materials.length - 1].id;
    if (materials.length < BATCH_SIZE) break;
  }

  console.log('\nSummary:');
  console.log(JSON.stringify({ processed, toppedUp, alreadyFull, failed }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

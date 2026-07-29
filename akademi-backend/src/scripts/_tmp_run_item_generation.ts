import prisma from '../config/db';
import { modelTopicKnowledgeJob } from '../jobs/modelTopicKnowledge.job';
import { synthesizeItemModelsJob, instantiateAndVerifyItemsJob } from '../jobs/synthesizeItems.job';

const COURSE_CODE = 'MTH 102';

async function main() {
  // Phase 1: backfill memberExamples — the existing archetype rows predate that field, so they
  // must be rebuilt. Full re-run, same as the archetype-layer pipeline always costs.
  const existing = await prisma.knowledgeModel.findFirst({ where: { courseCode: COURSE_CODE, scope: 'COURSE' } });
  const hasMemberExamples = existing ? await prisma.archetype.findFirst({ where: { modelId: existing.id }, select: { memberExamples: true } }) : null;

  if (!existing || !hasMemberExamples?.memberExamples) {
    if (existing) {
      console.log(`=== Phase 1: deleting stale KnowledgeModel ${existing.id} (no memberExamples) and re-running archetype extraction ===`);
      await prisma.knowledgeModel.delete({ where: { id: existing.id } });
    } else {
      console.log('=== Phase 1: no existing KnowledgeModel, running archetype extraction ===');
    }
    const result = await modelTopicKnowledgeJob({ courseCode: COURSE_CODE });
    console.log('Phase 1 result:', JSON.stringify(result, null, 2));
    if (result.status === 'FAILED') {
      console.error('Archetype extraction failed the density gate or otherwise — aborting.');
      process.exit(1);
    }
  } else {
    console.log('=== Phase 1: KnowledgeModel already has memberExamples — skipping backfill ===');
  }

  console.log('\n=== Phase 2: ItemModel synthesis ===');
  const synthResult = await synthesizeItemModelsJob(COURSE_CODE);
  console.log('Phase 2 result:', JSON.stringify(synthResult, null, 2));

  console.log('\n=== Phase 3: Item instantiation + verification ===');
  const instResult = await instantiateAndVerifyItemsJob(COURSE_CODE);
  console.log('Phase 3 result:', JSON.stringify(instResult, null, 2));

  console.log('\n=== FINAL SUMMARY ===');
  console.log(JSON.stringify({ synthResult, instResult }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

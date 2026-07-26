import prisma from '../config/db';
import { systemQueue, JOB_NAMES } from '../config/queue';
import { runGateAValidation } from './modelTopicKnowledge.job';

export async function validateModelGateAJob(modelId: string, attempt: number = 1): Promise<void> {
  const passed = await runGateAValidation(modelId, attempt);

  if (passed) {
    const model = await prisma.knowledgeModel.findUnique({ where: { id: modelId } });
    if (model) {
      // Trigger section writing once model is READY
      await systemQueue.add(JOB_NAMES.GENERATE_TEXTBOOK_SECTION, { nodeId: model.topicId });
    }
    return;
  }

  // Targeted Rerun Scoping based on latest ValidationFinding checkId
  const latestRun = await prisma.validationRun.findFirst({
    where: { modelId, gate: 'A' },
    orderBy: { runAt: 'desc' },
    include: { findings: true }
  });

  if (!latestRun) return;

  const hardFindings = latestRun.findings.filter(f => f.severity === 'HARD');
  if (hardFindings.length === 0) return; // Only soft findings -> allowed to publish with logged findings

  const checkIds = new Set(hardFindings.map(f => f.checkId));

  // Targeted Scope Rerun mapping:
  // A9, A10, A11, A12, A13, A15, A16, A17, A18, A19 -> Rerun Phase 3 (Item model synthesis)
  // A1, A6 -> Rerun Phase 1 (KC extraction)
  // A2, A3, A7 -> Rerun Phase 1 (Solve tracing / Archetype enumeration)
  // A4, A20 -> Rerun Phase 2 (Prerequisite closure)

  const model = await prisma.knowledgeModel.findUnique({ where: { id: modelId } });
  if (!model) return;

  if (attempt >= 2) {
    console.warn(`[validate-model-gate-a] Model ${modelId} exhausted retries (${attempt}); queued for admin review.`);
    await prisma.knowledgeModel.update({ where: { id: modelId }, data: { status: 'FAILED' } });
    return;
  }

  if ([...checkIds].some(c => ['A9', 'A10', 'A11', 'A12', 'A13', 'A15', 'A16', 'A17', 'A18', 'A19'].includes(c))) {
    console.log(`[validate-model-gate-a] Retrying Phase 3 for model ${modelId} (Attempt ${attempt + 1})`);
    await systemQueue.add(JOB_NAMES.MODEL_TOPIC_PHASE_3, { nodeId: model.topicId, attempt: attempt + 1 });
  } else {
    console.log(`[validate-model-gate-a] Retrying Phase 1 for model ${modelId} (Attempt ${attempt + 1})`);
    await systemQueue.add(JOB_NAMES.MODEL_TOPIC_PHASE_1, { nodeId: model.topicId, attempt: attempt + 1 });
  }
}

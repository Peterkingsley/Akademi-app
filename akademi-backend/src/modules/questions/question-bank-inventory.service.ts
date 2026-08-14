import prisma from '../../config/db';
import { JOB_NAMES, systemQueue } from '../../config/queue';

export const QUESTION_BANK_LOW_WATER = Math.max(Number(process.env.QUESTION_BANK_LOW_WATER || 20), 5);
export const QUESTION_BANK_CRITICAL_WATER = Math.max(Number(process.env.QUESTION_BANK_CRITICAL_WATER || 10), 1);
export const QUESTION_BANK_REFILL_BATCH = Math.max(Number(process.env.QUESTION_BANK_REFILL_BATCH || 10), 5);
export const QUESTION_BANK_MAX_SIZE = Math.max(Number(process.env.QUESTION_BANK_MAX_SIZE || 300), 30);
const REFILL_COOLDOWN_MS = Math.max(Number(process.env.QUESTION_BANK_REFILL_COOLDOWN_MS || 60_000), 10_000);
const MAX_BATCHES_PER_HOUR = Math.max(Number(process.env.QUESTION_BANK_MAX_BATCHES_PER_HOUR || 6), 1);

export async function getUserQuestionInventory(materialId: string, userId: string) {
  const [total, attempted] = await Promise.all([
    prisma.question.count({ where: { material_id: materialId } }),
    prisma.questionAttempt.findMany({
      where: { user_id: userId, question: { material_id: materialId } },
      select: { question_id: true },
      distinct: ['question_id'],
    }),
  ]);
  return { total, attempted: attempted.length, unseen: Math.max(total - attempted.length, 0) };
}

export async function queueQuestionBankRefillIfNeeded(materialId: string, userId: string) {
  const inventory = await getUserQuestionInventory(materialId, userId);
  if (inventory.unseen >= QUESTION_BANK_LOW_WATER) return { ...inventory, queued: false, reason: 'healthy' };

  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: {
      question_generation_status: true,
      question_bank_refill_cooldown_until: true,
      question_bank_hour_window_started_at: true,
      question_bank_hour_batch_count: true,
    },
  });
  if (!material) return { ...inventory, queued: false, reason: 'material_missing' };

  const now = new Date();
  if (inventory.total >= QUESTION_BANK_MAX_SIZE) {
    await prisma.material.update({
      where: { id: materialId },
      data: { question_bank_inventory_status: 'EXHAUSTED' },
    });
    return { ...inventory, queued: false, reason: 'ceiling_reached' };
  }
  if (material.question_generation_status === 'GENERATING') {
    return { ...inventory, queued: false, reason: 'already_generating' };
  }
  if (material.question_bank_refill_cooldown_until && material.question_bank_refill_cooldown_until > now) {
    return { ...inventory, queued: false, reason: 'cooldown' };
  }

  const currentWindow = material.question_bank_hour_window_started_at;
  const windowExpired = !currentWindow || now.getTime() - currentWindow.getTime() >= 60 * 60_000;
  const windowBatchCount = windowExpired ? 0 : material.question_bank_hour_batch_count;
  if (windowBatchCount >= MAX_BATCHES_PER_HOUR) {
    await prisma.material.update({ where: { id: materialId }, data: { question_bank_inventory_status: 'LOW' } });
    return { ...inventory, queued: false, reason: 'hourly_limit' };
  }

  const claim = await prisma.material.updateMany({
    where: {
      id: materialId,
      OR: [
        { question_bank_refill_cooldown_until: null },
        { question_bank_refill_cooldown_until: { lte: now } },
      ],
    },
    data: {
      question_bank_inventory_status: 'REFILLING',
      question_generation_status: 'PENDING',
      question_bank_refill_cooldown_until: new Date(now.getTime() + REFILL_COOLDOWN_MS),
      question_bank_hour_window_started_at: windowExpired ? now : currentWindow,
      question_bank_hour_batch_count: windowExpired ? 1 : { increment: 1 },
    },
  });
  if (claim.count === 0) return { ...inventory, queued: false, reason: 'claim_lost' };

  const critical = inventory.unseen < QUESTION_BANK_CRITICAL_WATER;
  await systemQueue.add(JOB_NAMES.GENERATE_QUESTIONS, {
    materialId,
    requestedCount: Math.min(QUESTION_BANK_REFILL_BATCH, QUESTION_BANK_MAX_SIZE - inventory.total),
    priority: critical ? 100 : 10,
    reason: critical ? 'critical_user_inventory' : 'low_user_inventory',
  });
  return { ...inventory, queued: true, reason: critical ? 'critical' : 'low' };
}

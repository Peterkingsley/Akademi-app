import { FileType, VerificationStatus } from '@prisma/client';
import prisma from '../../config/db';
import { systemQueue, JOB_NAMES, getQueueHealth } from '../../config/queue';

const RETRY_INTERVAL_MS = Math.max(Number(process.env.MATERIAL_RETRY_INTERVAL_MS || 30000), 10000);
const RETRY_BATCH_SIZE = Math.max(Number(process.env.MATERIAL_RETRY_BATCH_SIZE || 3), 1);
const RETRY_MAX_QUEUE_DEPTH = Math.max(Number(process.env.MATERIAL_RETRY_MAX_QUEUE_DEPTH || 6), 1);

let retryTimer: NodeJS.Timeout | null = null;
let retrySweepRunning = false;

export function computeMaterialRetryAt(attempts: number) {
  const normalizedAttempts = Math.max(attempts, 1);
  const delayMs = Math.min(30_000 * 2 ** (normalizedAttempts - 1), 15 * 60_000);
  return new Date(Date.now() + delayMs);
}

export async function queueMaterialIngestion(materialId: string, hasChunks: boolean) {
  const jobName = hasChunks ? JOB_NAMES.ASSEMBLE_CHUNKS : JOB_NAMES.INGEST_MATERIAL;
  await systemQueue.add(jobName, { materialId });
}

async function retryEligiblePdfMaterials() {
  if (retrySweepRunning) return;

  const queueHealth = getQueueHealth();
  if (queueHealth.activeBackgroundJobs + queueHealth.queuedBackgroundJobs >= RETRY_MAX_QUEUE_DEPTH) {
    return;
  }

  retrySweepRunning = true;

  try {
    const now = new Date();
    const availableSlots = Math.max(
      RETRY_BATCH_SIZE - (queueHealth.activeBackgroundJobs + queueHealth.queuedBackgroundJobs),
      0,
    );

    if (availableSlots === 0) return;

    const materials = await prisma.material.findMany({
      where: {
        file_type: FileType.PDF,
        verification_status: VerificationStatus.PENDING,
        OR: [
          { processing_status: 'QUEUED' as any },
          {
            processing_status: 'FAILED' as any,
            next_retry_at: { lte: now },
          },
        ],
      },
      orderBy: [
        { next_retry_at: 'asc' },
        { created_at: 'asc' },
      ],
      take: availableSlots,
      select: {
        id: true,
        upload_chunks: {
          select: { id: true },
          take: 1,
        },
      },
    });

    for (const material of materials) {
      await queueMaterialIngestion(material.id, material.upload_chunks.length > 0);
    }
  } catch (error) {
    console.error('Material retry sweep failed:', error);
  } finally {
    retrySweepRunning = false;
  }
}

export function startMaterialRetryScheduler() {
  if (retryTimer) return;

  void retryEligiblePdfMaterials();
  retryTimer = setInterval(() => {
    void retryEligiblePdfMaterials();
  }, RETRY_INTERVAL_MS);
}

export function stopMaterialRetryScheduler() {
  if (!retryTimer) return;
  clearInterval(retryTimer);
  retryTimer = null;
}

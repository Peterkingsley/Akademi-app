// Minimal queue facade.
//
// For MVP, material jobs run inline from the API process so uploads and admin
// approvals produce extracted content and CBT questions without a worker.

export const JOB_NAMES = {
  UPDATE_LEARNING_PROFILE: 'UPDATE_LEARNING_PROFILE',
  GENERATE_SESSION_SUMMARY: 'GENERATE_SESSION_SUMMARY',
  INGEST_MATERIAL: 'INGEST_MATERIAL',
  GENERATE_QUESTIONS: 'GENERATE_QUESTIONS',
  ASSEMBLE_CHUNKS: 'ASSEMBLE_CHUNKS',
  ACTIVATE_TOURNAMENTS: 'ACTIVATE_TOURNAMENTS',
} as const;

type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

type JobPayload = {
  materialId?: string;
  sessionId?: string;
};

type QueueStatus = 'online' | 'degraded';

type QueueHealth = {
  mode: 'inline';
  status: QueueStatus;
  processing: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
};

const queueHealth: QueueHealth = {
  mode: 'inline',
  status: 'online',
  processing: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastError: null,
};

const markQueueRun = () => {
  queueHealth.processing = true;
  queueHealth.lastRunAt = new Date().toISOString();
};

const markQueueSuccess = () => {
  queueHealth.processing = false;
  queueHealth.status = 'online';
  queueHealth.lastSuccessAt = new Date().toISOString();
  queueHealth.lastError = null;
};

const markQueueFailure = (error: unknown) => {
  queueHealth.processing = false;
  queueHealth.status = 'degraded';
  queueHealth.lastFailureAt = new Date().toISOString();
  queueHealth.lastError = error instanceof Error ? error.message : String(error);
};

async function runInlineJob(name: JobName, payload: JobPayload) {
  switch (name) {
    case JOB_NAMES.INGEST_MATERIAL: {
      if (!payload.materialId) throw new Error('INGEST_MATERIAL requires materialId');
      const { ingestMaterialJob } = await import('../jobs/ingestMaterial.job');
      await ingestMaterialJob(payload.materialId);
      return;
    }
    case JOB_NAMES.ASSEMBLE_CHUNKS: {
      if (!payload.materialId) throw new Error('ASSEMBLE_CHUNKS requires materialId');
      const { assembleChunksJob } = await import('../jobs/assembleChunks.job');
      await assembleChunksJob(payload.materialId);
      return;
    }
    case JOB_NAMES.GENERATE_QUESTIONS: {
      if (!payload.materialId) throw new Error('GENERATE_QUESTIONS requires materialId');
      const { generateQuestionsJob } = await import('../jobs/generateQuestions.job');
      await generateQuestionsJob(payload.materialId);
      return;
    }
    case JOB_NAMES.ACTIVATE_TOURNAMENTS: {
      const { activateTournamentsJob } = await import('../jobs/activateTournaments.job');
      await activateTournamentsJob();
      return;
    }
    default:
      return;
  }
}

// `any` to keep compile-time compatibility with Bull/BullMQ-style call sites
// without forcing the dependency for MVP.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const systemQueue: any = {
  async add(name: JobName, payload: JobPayload) {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.log('[queue:inline] add', name, payload);
    }
    markQueueRun();
    try {
      await runInlineJob(name, payload);
      markQueueSuccess();
    } catch (error) {
      markQueueFailure(error);
      throw error;
    }
  },
  async getWaiting() {
    return [];
  },
  async getActive() {
    return [];
  },
  async getCompleted() {
    return [];
  },
  async getFailed() {
    return [];
  },
  async getDelayed() {
    return [];
  },
  async getJob(_jobId: string) {
    return null;
  },
};

export const getQueueHealth = () => ({ ...queueHealth });

export const shutdownQueue = async () => {
  queueHealth.processing = false;
};

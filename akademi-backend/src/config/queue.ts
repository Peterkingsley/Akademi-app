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
} as const;

type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

type JobPayload = {
  materialId?: string;
  sessionId?: string;
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
    await runInlineJob(name, payload);
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

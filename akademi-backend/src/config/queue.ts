// Minimal queue facade.
//
// In production this should be backed by a real job queue (e.g. BullMQ) and a
// worker process. For MVP builds and environments where the worker isn't
// running, we keep this as a no-op to avoid hard crashes during API use.

export const JOB_NAMES = {
  UPDATE_LEARNING_PROFILE: 'UPDATE_LEARNING_PROFILE',
  GENERATE_SESSION_SUMMARY: 'GENERATE_SESSION_SUMMARY',
  INGEST_MATERIAL: 'INGEST_MATERIAL',
  GENERATE_QUESTIONS: 'GENERATE_QUESTIONS',
  ASSEMBLE_CHUNKS: 'ASSEMBLE_CHUNKS',
} as const;

type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

// `any` to keep compile-time compatibility with Bull/BullMQ-style call sites
// without forcing the dependency for MVP.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const systemQueue: any = {
  async add(name: JobName, payload: unknown) {
    // Intentionally a no-op. Keep the call sites stable.
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.log('[queue:no-op] add', name, payload);
    }
    return;
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

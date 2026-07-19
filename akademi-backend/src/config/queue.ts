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
  POST_ASSESSMENT_INTELLIGENCE: 'POST_ASSESSMENT_INTELLIGENCE',
  DECOMPOSE_CURRICULUM: 'DECOMPOSE_CURRICULUM',
  GENERATE_TEXTBOOK_SECTION: 'GENERATE_TEXTBOOK_SECTION',
  FETCH_TEXTBOOK_DIAGRAM: 'FETCH_TEXTBOOK_DIAGRAM',
  AUDIT_TEXTBOOK_OUTLINE: 'AUDIT_TEXTBOOK_OUTLINE',
} as const;

type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

type JobPayload = {
  materialId?: string;
  sessionId?: string;
  companionStateId?: string;
  userId?: string;
  courseCode?: string;
  sectionIndex?: number;
  sectionTitle?: string;
  masteryScore?: number;
  masteryStatus?: 'PASSED' | 'FAILED';
  failedConcepts?: string[];
  teachingDecisionSnapshot?: Record<string, unknown>;
  calculationContextSnapshot?: string;
  diagramContextSnapshot?: string;
  nodeId?: string;
  sectionId?: string;
  outlineId?: string;
  universityId?: string;
};

type QueueStatus = 'online' | 'degraded';

type QueueHealth = {
  mode: 'inline';
  status: QueueStatus;
  processing: boolean;
  activeBackgroundJobs: number;
  queuedBackgroundJobs: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
};

const queueHealth: QueueHealth = {
  mode: 'inline',
  status: 'online',
  processing: false,
  activeBackgroundJobs: 0,
  queuedBackgroundJobs: 0,
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

const BACKGROUND_JOB_NAMES = new Set<JobName>([
  JOB_NAMES.INGEST_MATERIAL,
  JOB_NAMES.ASSEMBLE_CHUNKS,
  JOB_NAMES.POST_ASSESSMENT_INTELLIGENCE,
  JOB_NAMES.DECOMPOSE_CURRICULUM,
  JOB_NAMES.GENERATE_TEXTBOOK_SECTION,
  JOB_NAMES.FETCH_TEXTBOOK_DIAGRAM,
  JOB_NAMES.AUDIT_TEXTBOOK_OUTLINE,
]);

const MAX_BACKGROUND_JOBS = Math.max(Number(process.env.INLINE_BACKGROUND_JOB_CONCURRENCY || 1), 1);
const backgroundJobQueue: Array<{ name: JobName; payload: JobPayload; key: string }> = [];
const backgroundJobKeys = new Set<string>();
let activeBackgroundJobs = 0;

const getBackgroundJobKey = (name: JobName, payload: JobPayload) => {
  return `${name}:${JSON.stringify(payload)}`;
};

const refreshBackgroundQueueHealth = () => {
  queueHealth.activeBackgroundJobs = activeBackgroundJobs;
  queueHealth.queuedBackgroundJobs = backgroundJobQueue.length;
  queueHealth.processing = activeBackgroundJobs > 0 || backgroundJobQueue.length > 0;
};

const drainBackgroundJobs = () => {
  refreshBackgroundQueueHealth();

  while (activeBackgroundJobs < MAX_BACKGROUND_JOBS && backgroundJobQueue.length > 0) {
    const job = backgroundJobQueue.shift()!;
    activeBackgroundJobs += 1;
    refreshBackgroundQueueHealth();
    markQueueRun();

    void runInlineJob(job.name, job.payload)
      .then(markQueueSuccess)
      .catch((error) => {
        markQueueFailure(error);
        // eslint-disable-next-line no-console
        console.error('[queue:inline] background job failed', { name: job.name, payload: job.payload, error });
      })
      .finally(() => {
        activeBackgroundJobs = Math.max(activeBackgroundJobs - 1, 0);
        backgroundJobKeys.delete(job.key);
        refreshBackgroundQueueHealth();
        setImmediate(drainBackgroundJobs);
      });
  }
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
    case JOB_NAMES.DECOMPOSE_CURRICULUM: {
      if (!payload.courseCode) throw new Error('DECOMPOSE_CURRICULUM requires courseCode');
      const { decomposeCurriculumJob } = await import('../jobs/decomposeCurriculum.job');
      await decomposeCurriculumJob(payload.courseCode, payload.universityId);
      return;
    }
    case JOB_NAMES.GENERATE_TEXTBOOK_SECTION: {
      if (!payload.nodeId) throw new Error('GENERATE_TEXTBOOK_SECTION requires nodeId');
      const { generateTextbookSectionJob } = await import('../jobs/generateTextbookSection.job');
      await generateTextbookSectionJob(payload.nodeId);
      return;
    }
    case JOB_NAMES.FETCH_TEXTBOOK_DIAGRAM: {
      if (!payload.sectionId) throw new Error('FETCH_TEXTBOOK_DIAGRAM requires sectionId');
      const { fetchTextbookDiagramJob } = await import('../jobs/fetchTextbookDiagram.job');
      await fetchTextbookDiagramJob(payload.sectionId);
      return;
    }
    case JOB_NAMES.AUDIT_TEXTBOOK_OUTLINE: {
      if (!payload.outlineId) throw new Error('AUDIT_TEXTBOOK_OUTLINE requires outlineId');
      const { auditTextbookOutlineJob } = await import('../jobs/auditTextbookOutline.job');
      await auditTextbookOutlineJob(payload.outlineId);
      return;
    }
    case JOB_NAMES.ACTIVATE_TOURNAMENTS: {
      const { activateTournamentsJob } = await import('../jobs/activateTournaments.job');
      await activateTournamentsJob();
      return;
    }
    case JOB_NAMES.POST_ASSESSMENT_INTELLIGENCE: {
      if (!payload.sessionId || !payload.companionStateId || !payload.userId || !payload.materialId || !payload.courseCode || payload.sectionIndex === undefined || !payload.sectionTitle) {
        throw new Error('POST_ASSESSMENT_INTELLIGENCE requires session, companion, user, material, course, and section fields');
      }
      const { postAssessmentIntelligenceJob } = await import('../jobs/postAssessmentIntelligence.job');
      await postAssessmentIntelligenceJob({
        sessionId: payload.sessionId,
        companionStateId: payload.companionStateId,
        userId: payload.userId,
        materialId: payload.materialId,
        courseCode: payload.courseCode,
        sectionIndex: payload.sectionIndex,
        sectionTitle: payload.sectionTitle,
        masteryScore: Number(payload.masteryScore || 0),
        masteryStatus: payload.masteryStatus === 'FAILED' ? 'FAILED' : 'PASSED',
        failedConcepts: Array.isArray(payload.failedConcepts) ? payload.failedConcepts : [],
        teachingDecisionSnapshot: payload.teachingDecisionSnapshot,
        calculationContextSnapshot: payload.calculationContextSnapshot,
        diagramContextSnapshot: payload.diagramContextSnapshot,
      });
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

    if (BACKGROUND_JOB_NAMES.has(name)) {
      const key = getBackgroundJobKey(name, payload);
      if (backgroundJobKeys.has(key)) {
        if (process.env.NODE_ENV !== 'test') {
          // eslint-disable-next-line no-console
          console.log('[queue:inline] deduped background job', { name, payload });
        }
        return;
      }

      backgroundJobKeys.add(key);
      backgroundJobQueue.push({ name, payload, key });
      refreshBackgroundQueueHealth();
      setImmediate(() => {
        drainBackgroundJobs();
      });
      return;
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
  backgroundJobQueue.length = 0;
  backgroundJobKeys.clear();
  activeBackgroundJobs = 0;
  refreshBackgroundQueueHealth();
  queueHealth.processing = false;
};

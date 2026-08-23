import crypto from 'crypto';
import { Difficulty, Prisma, QuestionType, VerificationStatus } from '@prisma/client';
import prisma from '../../config/db';
import redisClient, { getRedisHealth } from '../../config/redis';
import { semanticSimilarity } from '../../jobs/generateQuestions.job';
import { buildFallbackFeedback, ExamPrepFeedbackService } from '../exam-prep/exam-prep-feedback.service';
import { ExamPrepTeachingFeedback } from '../exam-prep/exam-prep.types';
import {
  normalizeExamPrepAnswer,
  resolveCanonicalAnswer,
  sanitizeGuidedExamPrepQuestion,
} from '../exam-prep/exam-prep.service';
import {
  DemoAttemptState,
  DemoExamPrepConfig,
  DemoExamPrepError,
  DemoMaterialItem,
  DemoSessionResponse,
  DemoSessionState,
} from './demo-exam-prep.types';

type DemoQuestionRecord = {
  id: string;
  material_id: string;
  question_text: string;
  options: Prisma.JsonValue;
  correct_answer: string | null;
  explanation: string | null;
  approach_guide: string;
  difficulty: Difficulty;
  question_type: QuestionType;
  source_page_start: number | null;
  source_page_end: number | null;
};

const SESSION_PREFIX = 'demo:exam-prep:session:';
const LOCK_PREFIX = 'demo:exam-prep:submit-lock:';
const fallbackSessions = new Map<string, DemoSessionState>();
const fallbackLocks = new Set<string>();
const MAX_FALLBACK_SESSIONS = 1_000;
const DEMO_FEEDBACK_DEADLINE_MS = 25_000;

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Math.min(maximum, Math.max(minimum, Number.isFinite(parsed) ? parsed : fallback));
}

export function getDemoExamPrepConfig(): DemoExamPrepConfig {
  return {
    materialIds: (process.env.DEMO_EXAM_PREP_MATERIAL_IDS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    questionLimit: boundedInteger(process.env.DEMO_EXAM_PREP_QUESTION_LIMIT, 3, 1, 5),
    sessionTtlSeconds: boundedInteger(process.env.DEMO_EXAM_PREP_SESSION_TTL_SECONDS, 45 * 60, 30 * 60, 60 * 60),
    questionPoolSize: boundedInteger(process.env.DEMO_EXAM_PREP_QUESTION_POOL_SIZE, 12, 5, 30),
  };
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function isUsableQuestion(question: Pick<DemoQuestionRecord, 'options' | 'correct_answer'>) {
  const options = Array.isArray(question.options)
    ? question.options.map((option) => String(option).trim()).filter(Boolean)
    : [];
  return options.length === 4 &&
    new Set(options.map(normalizeExamPrepAnswer)).size === 4 &&
    Boolean(resolveCanonicalAnswer(options, question.correct_answer));
}

function deleteExpiredFallbackSessions() {
  const now = Date.now();
  for (const [key, session] of fallbackSessions.entries()) {
    if (new Date(session.expiresAt).getTime() <= now) fallbackSessions.delete(key);
  }
}

function sessionKey(id: string) {
  return `${SESSION_PREFIX}${id}`;
}

export class DemoExamPrepService {
  constructor(
    private readonly feedbackService = new ExamPrepFeedbackService(),
    private readonly feedbackDeadlineMs = DEMO_FEEDBACK_DEADLINE_MS,
  ) {}

  private async generateFeedback(
    input: Parameters<ExamPrepFeedbackService['generate']>[0],
  ): Promise<ExamPrepTeachingFeedback> {
    let deadline: ReturnType<typeof setTimeout> | null = null;
    const canonicalFallback = new Promise<ExamPrepTeachingFeedback>((resolve) => {
      deadline = setTimeout(() => {
        console.warn('Public Exam Prep feedback exceeded its deadline; returning canonical feedback.');
        resolve(buildFallbackFeedback(input));
      }, this.feedbackDeadlineMs);
    });
    try {
      return await Promise.race([
        this.feedbackService.generate(input),
        canonicalFallback,
      ]);
    } finally {
      if (deadline) clearTimeout(deadline);
    }
  }

  private async saveSession(state: DemoSessionState) {
    const config = getDemoExamPrepConfig();
    state.expiresAt = new Date(Date.now() + config.sessionTtlSeconds * 1000).toISOString();
    fallbackSessions.set(state.id, state);
    if (fallbackSessions.size > MAX_FALLBACK_SESSIONS) {
      const oldestId = fallbackSessions.keys().next().value;
      if (oldestId) fallbackSessions.delete(oldestId);
    }
    await redisClient.setEx(sessionKey(state.id), config.sessionTtlSeconds, JSON.stringify(state));
  }

  private async deleteSession(id: string) {
    fallbackSessions.delete(id);
    await redisClient.del(sessionKey(id));
  }

  private async loadSession(id: string) {
    if (!id || id.length > 100) {
      throw new DemoExamPrepError('This demo session has ended. Start another demo.', 410, 'DEMO_SESSION_EXPIRED');
    }
    deleteExpiredFallbackSessions();
    const stored = await redisClient.get(sessionKey(id));
    let state: DemoSessionState | null = null;
    try {
      state = stored ? JSON.parse(stored) as DemoSessionState : fallbackSessions.get(id) || null;
    } catch {
      state = null;
    }
    if (!state || new Date(state.expiresAt).getTime() <= Date.now()) {
      await this.deleteSession(id);
      throw new DemoExamPrepError('This demo session has ended. Start another demo.', 410, 'DEMO_SESSION_EXPIRED');
    }
    return state;
  }

  private async approvedMaterial(materialId: string) {
    const { materialIds } = getDemoExamPrepConfig();
    if (!materialIds.includes(materialId)) {
      throw new DemoExamPrepError('This material is not available in the public demo.', 404, 'DEMO_MATERIAL_NOT_FOUND');
    }
    const material = await prisma.material.findFirst({
      where: {
        id: materialId,
        verification_status: VerificationStatus.VERIFIED,
        unpublished_at: null,
        is_akademi_generated: true,
      },
      select: {
        id: true,
        title: true,
        course_code: true,
        content: true,
        reader_structure: true,
      },
    });
    if (!material) {
      throw new DemoExamPrepError('This material is not available in the public demo.', 404, 'DEMO_MATERIAL_NOT_FOUND');
    }
    return material;
  }

  private questionSelect() {
    return {
      id: true,
      material_id: true,
      question_text: true,
      options: true,
      correct_answer: true,
      explanation: true,
      approach_guide: true,
      difficulty: true,
      question_type: true,
      source_page_start: true,
      source_page_end: true,
    } as const;
  }

  private async loadQuestionPool(materialId: string) {
    const questions = await prisma.question.findMany({
      where: { material_id: materialId },
      select: this.questionSelect(),
      orderBy: { generated_at: 'desc' },
      take: 100,
    });
    return questions.filter(isUsableQuestion) as DemoQuestionRecord[];
  }

  async listMaterials(): Promise<DemoMaterialItem[]> {
    const config = getDemoExamPrepConfig();
    if (config.materialIds.length === 0) return [];
    const materials = await prisma.material.findMany({
      where: {
        id: { in: config.materialIds },
        verification_status: VerificationStatus.VERIFIED,
        unpublished_at: null,
        is_akademi_generated: true,
      },
      select: { id: true, title: true, course_code: true },
    });
    if (materials.length === 0) return [];
    const questions = await prisma.question.findMany({
      where: { material_id: { in: materials.map((material) => material.id) } },
      select: { material_id: true, options: true, correct_answer: true },
    });
    const counts = new Map<string, number>();
    for (const question of questions) {
      if (isUsableQuestion(question as Pick<DemoQuestionRecord, 'options' | 'correct_answer'>)) {
        counts.set(question.material_id, (counts.get(question.material_id) || 0) + 1);
      }
    }
    return materials
      .filter((material) => (counts.get(material.id) || 0) >= config.questionLimit)
      .sort((left, right) => config.materialIds.indexOf(left.id) - config.materialIds.indexOf(right.id))
      .map((material) => ({
        id: material.id,
        title: material.title,
        courseCode: material.course_code,
        questionCount: counts.get(material.id) || 0,
        status: 'READY' as const,
      }));
  }

  async startSession(materialId: string): Promise<DemoSessionResponse> {
    const normalizedMaterialId = typeof materialId === 'string' ? materialId.trim() : '';
    if (!normalizedMaterialId) {
      throw new DemoExamPrepError('Choose a material to start.', 400, 'DEMO_MATERIAL_REQUIRED');
    }
    const material = await this.approvedMaterial(normalizedMaterialId);
    const config = getDemoExamPrepConfig();
    const pool = shuffle(await this.loadQuestionPool(material.id)).slice(0, config.questionPoolSize);
    if (pool.length < config.questionLimit) {
      throw new DemoExamPrepError('This material does not have enough public demo questions right now.', 409, 'DEMO_QUESTIONS_UNAVAILABLE');
    }
    const mainQuestionIds = pool.slice(0, config.questionLimit).map((question) => question.id);
    const state: DemoSessionState = {
      id: crypto.randomUUID(),
      material: { id: material.id, title: material.title, courseCode: material.course_code },
      mainQuestionIds,
      candidateQuestionIds: pool.slice(config.questionLimit).map((question) => question.id),
      currentMainIndex: 0,
      currentQuestionId: mainQuestionIds[0],
      attempts: {},
      activeRetry: null,
      evaluatedCount: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      isComplete: false,
    };
    await this.saveSession(state);
    return this.toResponse(state);
  }

  private async currentQuestion(state: DemoSessionState, includeAnswers = false) {
    const question = await prisma.question.findFirst({
      where: { id: state.currentQuestionId, material_id: state.material.id },
      select: includeAnswers ? this.questionSelect() : {
        id: true,
        material_id: true,
        question_text: true,
        options: true,
        difficulty: true,
        question_type: true,
      },
    });
    if (!question) {
      throw new DemoExamPrepError('This question is no longer available. Start another demo.', 409, 'DEMO_QUESTION_UNAVAILABLE');
    }
    return question;
  }

  private async toResponse(state: DemoSessionState): Promise<DemoSessionResponse> {
    const config = getDemoExamPrepConfig();
    const question = state.isComplete ? null : await this.currentQuestion(state);
    return {
      id: state.id,
      material: state.material,
      currentQuestion: question ? sanitizeGuidedExamPrepQuestion(question) : null,
      currentAttempt: state.attempts[state.currentQuestionId] || null,
      progress: {
        current: Math.min(state.evaluatedCount + 1, config.questionLimit),
        total: config.questionLimit,
        completed: state.evaluatedCount,
      },
      isRetry: Boolean(state.activeRetry),
      retryDepth: state.activeRetry?.depth || 0,
      isComplete: state.isComplete,
      expiresAt: state.expiresAt,
      limit: config.questionLimit,
    };
  }

  async getSession(sessionId: string) {
    return this.toResponse(await this.loadSession(sessionId));
  }

  private submissionResponse(state: DemoSessionState, attempt: DemoAttemptState) {
    const total = getDemoExamPrepConfig().questionLimit;
    return {
      ...attempt,
      progress: {
        current: Math.min(state.evaluatedCount + 1, total),
        total,
        completed: state.evaluatedCount,
      },
      isComplete: state.isComplete,
    };
  }

  private relevantSourceContext(
    material: { content: string | null; reader_structure: Prisma.JsonValue | null },
    question: { source_page_start: number | null; source_page_end: number | null },
  ) {
    const reader = material.reader_structure && typeof material.reader_structure === 'object' && !Array.isArray(material.reader_structure)
      ? material.reader_structure as Record<string, unknown>
      : null;
    const pages = Array.isArray(reader?.pages) ? reader.pages : [];
    if (question.source_page_start != null && pages.length > 0) {
      const end = question.source_page_end ?? question.source_page_start;
      const pageContext = pages
        .filter((page) => {
          const number = Number((page as Record<string, unknown>)?.pageNumber);
          return number >= question.source_page_start! && number <= end;
        })
        .map((page) => String((page as Record<string, unknown>)?.content || '').trim())
        .filter(Boolean)
        .join('\n\n')
        .trim();
      if (pageContext) return pageContext.slice(0, 8_000);
    }
    return material.content?.trim().slice(0, 8_000) || null;
  }

  async submit(
    sessionId: string,
    questionId: string,
    body: { selectedAnswer?: unknown; reasoning?: unknown },
  ) {
    const selectedAnswer = typeof body?.selectedAnswer === 'string' ? body.selectedAnswer.trim() : '';
    const reasoning = typeof body?.reasoning === 'string' ? body.reasoning.trim() : '';
    if (reasoning.length < 5 || reasoning.length > 2_000) {
      throw new DemoExamPrepError('Explain your reasoning in 5 to 2,000 characters.', 400, 'DEMO_INVALID_REASONING');
    }

    let state = await this.loadSession(sessionId);
    if (state.attempts[questionId]) return this.submissionResponse(state, state.attempts[questionId]);
    if (state.isComplete || state.evaluatedCount >= getDemoExamPrepConfig().questionLimit) {
      throw new DemoExamPrepError('This demo is complete. Start another material to keep practising.', 409, 'DEMO_COMPLETE');
    }
    if (state.currentQuestionId !== questionId) {
      throw new DemoExamPrepError('This question is not active in your demo.', 409, 'DEMO_QUESTION_NOT_CURRENT');
    }

    const lockKey = `${LOCK_PREFIX}${sessionId}:${questionId}`;
    const acquired = await redisClient.set(lockKey, '1', { EX: 30, NX: true });
    if (!acquired) {
      const redisHealth = getRedisHealth();
      if ((redisHealth.enabled && redisHealth.state === 'connected') || fallbackLocks.has(lockKey)) {
        state = await this.loadSession(sessionId);
        if (state.attempts[questionId]) return this.submissionResponse(state, state.attempts[questionId]);
        throw new DemoExamPrepError('Akademi is already checking this reasoning. Try again in a moment.', 409, 'DEMO_SUBMISSION_IN_PROGRESS');
      }
      fallbackLocks.add(lockKey);
    }

    try {
      const material = await this.approvedMaterial(state.material.id);
      const question = await this.currentQuestion(state, true) as DemoQuestionRecord;
      const options = Array.isArray(question.options) ? question.options.map(String) : [];
      const matchedSelection = options.find((option) => normalizeExamPrepAnswer(option) === normalizeExamPrepAnswer(selectedAnswer));
      if (!matchedSelection) {
        throw new DemoExamPrepError('Choose one of the available answers.', 400, 'DEMO_INVALID_OPTION');
      }
      const canonicalCorrectAnswer = resolveCanonicalAnswer(options, question.correct_answer);
      if (!canonicalCorrectAnswer) {
        throw new DemoExamPrepError('This question is unavailable right now.', 409, 'DEMO_INVALID_ANSWER_KEY');
      }
      const isCorrect = normalizeExamPrepAnswer(matchedSelection) === normalizeExamPrepAnswer(canonicalCorrectAnswer);
      const feedbackInput = {
        questionText: question.question_text,
        options,
        canonicalCorrectAnswer,
        canonicalExplanation: question.explanation,
        approachGuide: question.approach_guide,
        studentSelectedAnswer: matchedSelection,
        backendDeterminedIsCorrect: isCorrect,
        studentReasoning: reasoning,
        relevantSourceContext: this.relevantSourceContext(material, question),
        materialTitle: material.title,
        courseCode: material.course_code,
        requiresCalculationTeaching: question.question_type === QuestionType.CALCULATION,
      };
      const feedback = await this.generateFeedback(feedbackInput);
      const correctionMessage = state.activeRetry && feedback.isCorrect &&
        (feedback.reasoningAssessment.qualityScore === null || feedback.reasoningAssessment.qualityScore >= 60)
        ? 'You corrected it.'
        : null;
      const attempt: DemoAttemptState = {
        questionId,
        selectedAnswer: matchedSelection,
        reasoning,
        feedback,
        correctionMessage,
      };
      state.attempts[questionId] = attempt;
      state.evaluatedCount += 1;
      state.isComplete = state.evaluatedCount >= getDemoExamPrepConfig().questionLimit;
      await this.saveSession(state);
      return this.submissionResponse(state, attempt);
    } finally {
      fallbackLocks.delete(lockKey);
      await redisClient.del(lockKey);
    }
  }

  private remedialScore(source: DemoQuestionRecord, candidate: DemoQuestionRecord, conceptFocus: string) {
    const sameType = source.question_type === candidate.question_type;
    const sameDifficulty = source.difficulty === candidate.difficulty;
    const sourceEnd = source.source_page_end ?? source.source_page_start;
    const candidateEnd = candidate.source_page_end ?? candidate.source_page_start;
    const overlaps = source.source_page_start !== null && candidate.source_page_start !== null &&
      sourceEnd !== null && candidateEnd !== null &&
      source.source_page_start <= candidateEnd && candidate.source_page_start <= sourceEnd;
    const tier = (overlaps ? 4 : 0) + (sameType ? 3 : 0) + (sameDifficulty ? 2 : 0);
    const semantic = semanticSimilarity(
      `${source.question_text} ${source.approach_guide} ${conceptFocus}`,
      `${candidate.question_text} ${candidate.approach_guide}`,
    );
    return tier * 1_000 + semantic * 100;
  }

  async retry(sessionId: string, sourceQuestionId: string) {
    const state = await this.loadSession(sessionId);
    if (state.isComplete) {
      throw new DemoExamPrepError('This demo is complete. Start another material to keep practising.', 409, 'DEMO_COMPLETE');
    }
    if (state.currentQuestionId !== sourceQuestionId) {
      if (state.activeRetry?.parentQuestionId === sourceQuestionId) return this.toResponse(state);
      throw new DemoExamPrepError('This question is not active in your demo.', 409, 'DEMO_QUESTION_NOT_CURRENT');
    }
    const sourceAttempt = state.attempts[sourceQuestionId];
    if (!sourceAttempt) {
      throw new DemoExamPrepError('Check your reasoning before asking for another question.', 409, 'DEMO_QUESTION_NOT_SUBMITTED');
    }
    const source = await prisma.question.findFirst({
      where: { id: sourceQuestionId, material_id: state.material.id },
      select: this.questionSelect(),
    }) as DemoQuestionRecord | null;
    if (!source) {
      throw new DemoExamPrepError('This question is unavailable right now.', 409, 'DEMO_QUESTION_UNAVAILABLE');
    }
    const excluded = new Set([...Object.keys(state.attempts), ...state.mainQuestionIds, sourceQuestionId]);
    const candidates = (await prisma.question.findMany({
      where: {
        id: { in: state.candidateQuestionIds.filter((id) => !excluded.has(id)) },
        material_id: state.material.id,
      },
      select: this.questionSelect(),
    })).filter(isUsableQuestion) as DemoQuestionRecord[];
    const conceptFocus = [
      sourceAttempt.feedback.teachingExplanation.keyConcept,
      sourceAttempt.feedback.reasoningAssessment.misconception,
      sourceAttempt.feedback.takeaway,
    ].filter(Boolean).join(' ');
    const candidate = candidates
      .map((question) => ({ question, score: this.remedialScore(source, question, conceptFocus) }))
      .sort((left, right) => right.score - left.score || left.question.id.localeCompare(right.question.id))[0]?.question;
    if (!candidate) {
      throw new DemoExamPrepError(
        'Another grounded question on this concept is not available. Continue to the next question.',
        409,
        'DEMO_RETRY_UNAVAILABLE',
      );
    }
    state.currentQuestionId = candidate.id;
    state.activeRetry = {
      parentQuestionId: sourceQuestionId,
      rootQuestionId: state.activeRetry?.rootQuestionId || sourceQuestionId,
      depth: (state.activeRetry?.depth || 0) + 1,
    };
    await this.saveSession(state);
    return this.toResponse(state);
  }

  async next(sessionId: string, completedQuestionId: string) {
    const state = await this.loadSession(sessionId);
    if (state.isComplete) return this.toResponse(state);
    if (state.currentQuestionId !== completedQuestionId) {
      if (state.attempts[completedQuestionId]) return this.toResponse(state);
      throw new DemoExamPrepError('This question is not active in your demo.', 409, 'DEMO_QUESTION_NOT_CURRENT');
    }
    if (!state.attempts[completedQuestionId]) {
      throw new DemoExamPrepError('Check your reasoning before continuing.', 409, 'DEMO_QUESTION_NOT_SUBMITTED');
    }
    state.currentMainIndex += 1;
    state.activeRetry = null;
    const nextQuestionId = state.mainQuestionIds[state.currentMainIndex];
    if (!nextQuestionId) {
      state.isComplete = true;
    } else {
      state.currentQuestionId = nextQuestionId;
    }
    await this.saveSession(state);
    return this.toResponse(state);
  }
}

export const demoExamPrepService = new DemoExamPrepService();

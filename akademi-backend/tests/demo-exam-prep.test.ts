import { Difficulty, QuestionType, VerificationStatus } from '@prisma/client';
import prisma from '../src/config/db';
import { buildFallbackFeedback } from '../src/modules/exam-prep/exam-prep-feedback.service';
import { DemoExamPrepService } from '../src/modules/demo-exam-prep/demo-exam-prep.service';

const material = {
  id: 'public-material',
  title: 'Akademi Mechanics',
  course_code: 'PHY 101',
  content: 'Force equals mass multiplied by acceleration. Negative signs preserve direction.',
  reader_structure: null,
  verification_status: VerificationStatus.VERIFIED,
  unpublished_at: null,
  is_akademi_generated: true,
};

const questions = Array.from({ length: 7 }, (_, index) => ({
  id: `question-${index + 1}`,
  material_id: material.id,
  question_text: `A body in example ${index + 1} tests force and acceleration. What is the correct result?`,
  options: [`Result ${index + 1}A`, `Result ${index + 1}B`, `Result ${index + 1}C`, `Result ${index + 1}D`],
  correct_answer: 'B',
  explanation: 'Apply force equals mass times acceleration using the values in the verified material.',
  approach_guide: 'Use Newton second law and keep the direction sign consistent.',
  difficulty: Difficulty.MEDIUM,
  question_type: QuestionType.APPLICATION,
  source_page_start: index < 4 ? 3 : 7,
  source_page_end: index < 4 ? 4 : 8,
  generated_at: new Date(),
}));

function questionById(id: string) {
  const question = questions.find((item) => item.id === id);
  if (!question) throw new Error(`Unknown test question ${id}`);
  return question;
}

function correctAnswer(questionId: string) {
  return questionById(questionId).options[1];
}

function arrangeCatalog() {
  const materialFindMany = jest.spyOn(prisma.material, 'findMany').mockResolvedValue([
    { id: material.id, title: material.title, course_code: material.course_code },
  ] as any);
  const materialFindFirst = (jest.spyOn(prisma.material, 'findFirst') as any).mockImplementation(async (args: any) =>
    args.where.id === material.id ? material as any : null,
  );
  const questionFindMany = (jest.spyOn(prisma.question, 'findMany') as any).mockImplementation(async (args: any) => {
    const allowedIds = args.where?.id?.in as string[] | undefined;
    if (allowedIds) return questions.filter((question) => allowedIds.includes(question.id)) as any;
    return questions as any;
  });
  (jest.spyOn(prisma.question, 'findFirst') as any).mockImplementation(async (args: any) =>
    questions.find((question) => question.id === args.where.id && question.material_id === args.where.material_id) as any || null,
  );
  const generate = jest.fn(async (input) => buildFallbackFeedback(input));
  return {
    service: new DemoExamPrepService({ generate } as any),
    generate,
    materialFindMany,
    materialFindFirst,
    questionFindMany,
  };
}

describe('public guided Exam Prep demo', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    process.env.DEMO_EXAM_PREP_MATERIAL_IDS = material.id;
    process.env.DEMO_EXAM_PREP_QUESTION_LIMIT = '3';
    process.env.DEMO_EXAM_PREP_SESSION_TTL_SECONDS = '2700';
    process.env.DEMO_EXAM_PREP_QUESTION_POOL_SIZE = '7';
  });

  afterAll(() => jest.useRealTimers());

  it('lists only the explicitly allowlisted verified Akademi material', async () => {
    const { service, materialFindMany } = arrangeCatalog();
    const result = await service.listMaterials();

    expect(result).toEqual([expect.objectContaining({ id: material.id, courseCode: 'PHY 101', status: 'READY' })]);
    expect(materialFindMany.mock.calls[0][0]?.where).toMatchObject({
      id: { in: [material.id] },
      verification_status: VerificationStatus.VERIFIED,
      unpublished_at: null,
      is_akademi_generated: true,
    });
  });

  it('rejects a material id that is not in the public allowlist without querying it', async () => {
    const { service, materialFindFirst } = arrangeCatalog();
    await expect(service.startSession('private-material')).rejects.toMatchObject({
      statusCode: 404,
      code: 'DEMO_MATERIAL_NOT_FOUND',
    });
    expect(materialFindFirst).not.toHaveBeenCalled();
  });

  it('creates an opaque anonymous session with a sanitized first question', async () => {
    const { service } = arrangeCatalog();
    const session = await service.startSession(material.id);

    expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.currentQuestion?.options).toHaveLength(4);
    expect(session.limit).toBe(3);
    expect(JSON.stringify(session)).not.toMatch(/correct_answer|correctAnswer|explanation|approach_guide|reader_structure|content/);
  });

  it('submits answer and reasoning to the real feedback contract using grounded material context', async () => {
    const { service, generate } = arrangeCatalog();
    const session = await service.startSession(material.id);
    const questionId = session.currentQuestion!.id;
    const attempt = await service.submit(session.id, questionId, {
      selectedAnswer: correctAnswer(questionId),
      reasoning: 'I used force equals mass times acceleration and kept the direction sign.',
    });

    expect(attempt.feedback).toMatchObject({ isCorrect: true, verdict: 'CORRECT' });
    expect(attempt.feedback.teachingExplanation.whyCorrect).toBeTruthy();
    expect(attempt.feedback.takeaway).toBeTruthy();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][0]).toMatchObject({
      relevantSourceContext: material.content,
      materialTitle: material.title,
      backendDeterminedIsCorrect: true,
    });
  });

  it('returns an existing evaluation idempotently without consuming another feedback call', async () => {
    const { service, generate } = arrangeCatalog();
    const session = await service.startSession(material.id);
    const questionId = session.currentQuestion!.id;
    const body = { selectedAnswer: correctAnswer(questionId), reasoning: 'Newton second law determines the result here.' };
    const first = await service.submit(session.id, questionId, body);
    const second = await service.submit(session.id, questionId, body);

    expect(second).toEqual(first);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('branches to a different unused same-material retry question without advancing normal progress', async () => {
    const { service } = arrangeCatalog();
    const session = await service.startSession(material.id);
    const sourceQuestionId = session.currentQuestion!.id;
    await service.submit(session.id, sourceQuestionId, {
      selectedAnswer: correctAnswer(sourceQuestionId),
      reasoning: 'The governing concept is force equals mass times acceleration.',
    });

    const retry = await service.retry(session.id, sourceQuestionId);
    expect(retry.isRetry).toBe(true);
    expect(retry.currentQuestion?.id).not.toBe(sourceQuestionId);
    expect(retry.currentQuestion?.id).not.toBe(session.currentQuestion?.id);
    expect(retry.progress.completed).toBe(1);
    const repeated = await service.retry(session.id, sourceQuestionId);
    expect(repeated.currentQuestion?.id).toBe(retry.currentQuestion?.id);
  });

  it('continues to the next normal question when the learner declines a retry', async () => {
    const { service } = arrangeCatalog();
    const session = await service.startSession(material.id);
    const firstQuestionId = session.currentQuestion!.id;
    await service.submit(session.id, firstQuestionId, {
      selectedAnswer: correctAnswer(firstQuestionId),
      reasoning: 'The values fit the stored mechanics rule from this material.',
    });

    const next = await service.next(session.id, firstQuestionId);
    expect(next.isRetry).toBe(false);
    expect(next.currentQuestion?.id).not.toBe(firstQuestionId);
    expect(next.progress.completed).toBe(1);
  });

  it('enforces the configured three-evaluation limit including any path through the session', async () => {
    const { service } = arrangeCatalog();
    let session = await service.startSession(material.id);

    for (let index = 0; index < 3; index += 1) {
      const questionId = session.currentQuestion!.id;
      await service.submit(session.id, questionId, {
        selectedAnswer: correctAnswer(questionId),
        reasoning: 'I applied the same verified mechanics relationship carefully.',
      });
      if (index < 2) session = await service.next(session.id, questionId);
    }

    const complete = await service.getSession(session.id);
    expect(complete.isComplete).toBe(true);
    expect(complete.progress.completed).toBe(3);
    expect(complete.currentQuestion).toBeNull();
    await expect(service.retry(session.id, session.currentQuestion!.id)).rejects.toMatchObject({ code: 'DEMO_COMPLETE' });
  });

  it('expires anonymous sessions and refuses to continue them', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-22T12:00:00Z'));
    process.env.DEMO_EXAM_PREP_SESSION_TTL_SECONDS = '1800';
    const { service } = arrangeCatalog();
    const session = await service.startSession(material.id);

    jest.setSystemTime(new Date('2026-08-22T12:31:00Z'));
    await expect(service.getSession(session.id)).rejects.toMatchObject({
      statusCode: 410,
      code: 'DEMO_SESSION_EXPIRED',
    });
  });

  it('validates every question reference against the current anonymous session', async () => {
    const { service } = arrangeCatalog();
    const session = await service.startSession(material.id);
    await expect(service.submit(session.id, 'question-outside-session', {
      selectedAnswer: 'anything',
      reasoning: 'This reference should never be accepted by the public layer.',
    })).rejects.toMatchObject({ code: 'DEMO_QUESTION_NOT_CURRENT' });
  });
});

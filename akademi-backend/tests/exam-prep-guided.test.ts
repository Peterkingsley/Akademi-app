import { Difficulty, QuestionType } from '@prisma/client';
import prisma from '../src/config/db';
import { aiProvider } from '../src/modules/ai/ai.provider';
import {
  buildFallbackFeedback,
  ExamPrepFeedbackService,
  validatePersonalizedFeedback,
} from '../src/modules/exam-prep/exam-prep-feedback.service';
import {
  ExamPrepService,
  resolveCanonicalAnswer,
  sanitizeGuidedExamPrepQuestion,
} from '../src/modules/exam-prep/exam-prep.service';
import { FeedbackGenerationInput } from '../src/modules/exam-prep/exam-prep.types';
import { checkFeatureAccess } from '../src/shared/utils/feature-access';
import { MaterialsService } from '../src/modules/materials/materials.service';
import { usageService } from '../src/modules/usage/usage.service';

jest.mock('../src/modules/ai/ai.provider', () => ({
  aiProvider: { generateResponse: jest.fn() },
}));
jest.mock('../src/shared/utils/feature-access', () => ({ checkFeatureAccess: jest.fn() }));
jest.mock('../src/modules/usage/usage.service', () => ({
  usageService: { assertAvailable: jest.fn(), consume: jest.fn() },
}));

const input: FeedbackGenerationInput = {
  questionText: 'Which law links force, mass, and acceleration?',
  options: ['Newton first law', 'Newton second law', 'Newton third law', 'Hooke law'],
  canonicalCorrectAnswer: 'Newton second law',
  canonicalExplanation: 'Newton second law gives F = ma.',
  approachGuide: 'Identify the law represented by F = ma.',
  studentSelectedAnswer: 'Newton second law',
  backendDeterminedIsCorrect: true,
  studentReasoning: 'I guessed because the second option looked familiar.',
  relevantSourceContext: 'Newton second law states that force equals mass times acceleration.',
  materialTitle: 'Mechanics notes',
  courseCode: 'PHY101',
};

const weakReasoningModelOutput = {
  reasoningAssessment: {
    qualityScore: 12,
    summary: 'The selection is correct, but the explanation does not identify the governing relationship.',
    whatYouGotRight: [],
    whatYouMissed: ['You did not connect force, mass, and acceleration through F = ma.'],
    misconception: 'Familiarity with an option is not conceptual evidence.',
  },
  teachingExplanation: {
    whyCorrect: 'Newton second law states F = ma, directly linking the three quantities in the stem.',
    keyConcept: 'Net force produces acceleration in proportion to mass.',
    conciseLesson: 'Use F = ma when force, mass, and acceleration are connected.',
  },
  optionBreakdown: input.options.map((option) => ({
    option,
    whyItFitsOrDoesNotFit: option === input.canonicalCorrectAnswer ? 'It directly supplies F = ma.' : 'It describes a different relationship.',
    whatItRepresents: option,
    whenItWouldBeCorrect: null,
  })),
  takeaway: 'Force, mass, and acceleration point to F = ma.',
};

describe('guided Exam Prep answer security and normalization', () => {
  it('resolves current full-text and legacy letter answer keys', () => {
    expect(resolveCanonicalAnswer(input.options, 'Newton second law')).toBe('Newton second law');
    expect(resolveCanonicalAnswer(input.options, 'B')).toBe('Newton second law');
    expect(resolveCanonicalAnswer(input.options, 'B.')).toBe('Newton second law');
  });

  it('returns a pre-submission DTO with no answer or teaching leakage', () => {
    const dto = sanitizeGuidedExamPrepQuestion({
      id: 'question-1',
      question_text: input.questionText,
      options: input.options,
      difficulty: Difficulty.MEDIUM,
      question_type: QuestionType.APPLICATION,
    });
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain('correct_answer');
    expect(serialized).not.toContain('correctAnswer');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('approach_guide');
    expect(dto.options).toEqual(input.options);
  });
});

describe('guided Exam Prep feedback contract', () => {
  it('keeps objective correctness true when model feedback identifies weak reasoning', () => {
    const feedback = validatePersonalizedFeedback(weakReasoningModelOutput, input);
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.verdict).toBe('CORRECT');
    expect(feedback.reasoningAssessment.qualityScore).toBe(12);
    expect(feedback.reasoningAssessment.whatYouMissed).toHaveLength(1);
    expect(feedback.optionBreakdown.filter((option) => option.isCorrect).map((option) => option.option))
      .toEqual(['Newton second law']);
  });

  it('rejects malformed or incomplete option feedback', () => {
    expect(() => validatePersonalizedFeedback({ ...weakReasoningModelOutput, optionBreakdown: [] }, input))
      .toThrow('exactly one entry for every option');
  });

  it('returns deterministic canonical feedback when the provider fails', async () => {
    (aiProvider.generateResponse as jest.Mock).mockRejectedValueOnce(new Error('provider unavailable'));
    const feedback = await new ExamPrepFeedbackService().generate(input);
    expect(feedback.personalized).toBe(false);
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.correctAnswer).toBe('Newton second law');
    expect(feedback.teachingExplanation.whyCorrect).toContain('F = ma');
  });

  it('returns deterministic fallback for malformed model JSON', async () => {
    (aiProvider.generateResponse as jest.Mock).mockResolvedValueOnce('{not valid feedback json');
    const feedback = await new ExamPrepFeedbackService().generate(input);
    expect(feedback.personalized).toBe(false);
    expect(feedback.correctAnswer).toBe(input.canonicalCorrectAnswer);
  });
});

describe('guided Exam Prep submission persistence', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects missing reasoning before any database or model work', async () => {
    const generate = jest.fn();
    const service = new ExamPrepService({ generate } as any);
    await expect(service.submitGuidedQuestion('user-1', 'session-1', 'question-1', {
      selectedAnswer: input.studentSelectedAnswer,
      reasoning: '   ',
    })).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_REASONING' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('uses the same ownership-safe not-found response for missing or foreign sessions', async () => {
    jest.spyOn(prisma.session, 'findFirst').mockResolvedValue(null);
    const service = new ExamPrepService({ generate: jest.fn() } as any);
    await expect(service.getGuidedSession('user-1', 'foreign-session'))
      .rejects.toMatchObject({ statusCode: 404, code: 'SESSION_NOT_FOUND' });
  });

  it('persists deterministic correctness independently from weak reasoning feedback', async () => {
    const personalized = validatePersonalizedFeedback(weakReasoningModelOutput, input);
    const generate = jest.fn().mockResolvedValue(personalized);
    const service = new ExamPrepService({ generate } as any);
    const metadata = {
      mode: 'guided-question-study', version: 1, entitlementFeature: 'EXAM_PREP', questionIds: ['question-1'], currentIndex: 0,
    };
    const material = { id: 'material-1', title: 'Mechanics notes', course_code: 'PHY101', content: input.relevantSourceContext, reader_structure: null };
    const baseSession = {
      id: 'session-1', user_id: 'user-1', material_id: material.id, session_type: 'EXAM_PREP', reply_mode: null,
      course_code: 'PHY101', topic: material.title, duration: null, metadata, university: 'UNILAG', department: 'Physics',
      started_at: new Date(), ended_at: null, created_at: new Date(), material, question_attempts: [],
    };
    const storedAttempt = {
      id: 'attempt-1', question_id: 'question-1', user_id: 'user-1', session_id: 'session-1',
      answer: 'Newton second law', is_correct: true, feedback: personalized.reasoningAssessment.summary,
      reasoning: input.studentReasoning, reasoning_quality: 12, feedback_payload: personalized, created_at: new Date(),
    };

    jest.spyOn(prisma.session, 'findFirst')
      .mockResolvedValueOnce(baseSession as any)
      .mockResolvedValueOnce({ ...baseSession, ended_at: new Date(), question_attempts: [storedAttempt] } as any);
    jest.spyOn(prisma.question, 'findFirst').mockResolvedValue({
      id: 'question-1', material_id: material.id, question_text: input.questionText, options: input.options,
      correct_answer: 'B', explanation: input.canonicalExplanation, approach_guide: input.approachGuide,
      source_page_start: null, source_page_end: null,
    } as any);
    const create = jest.spyOn(prisma.questionAttempt, 'create').mockResolvedValue({ ...storedAttempt, reasoning_quality: null, feedback_payload: buildFallbackFeedback(input) } as any);
    jest.spyOn(prisma.questionAttempt, 'update').mockResolvedValue(storedAttempt as any);
    jest.spyOn(prisma.session, 'updateMany').mockResolvedValue({ count: 1 });

    const result = await service.submitGuidedQuestion('user-1', 'session-1', 'question-1', {
      selectedAnswer: 'Newton second law', reasoning: input.studentReasoning,
    });

    expect(create.mock.calls[0][0].data.is_correct).toBe(true);
    expect(result.isCorrect).toBe(true);
    expect(result.reasoningAssessment.qualityScore).toBe(12);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('returns an existing session/question attempt without calling feedback again', async () => {
    const storedFeedback = buildFallbackFeedback(input);
    const generate = jest.fn();
    const service = new ExamPrepService({ generate } as any);
    jest.spyOn(prisma.session, 'findFirst').mockResolvedValue({
      id: 'session-1', user_id: 'user-1', session_type: 'EXAM_PREP', metadata: {
        mode: 'guided-question-study', version: 1, entitlementFeature: 'EXAM_PREP', questionIds: ['question-1'], currentIndex: 0,
      },
      ended_at: null,
      material: { id: 'material-1', title: 'Mechanics notes', course_code: 'PHY101', content: null, reader_structure: null },
      question_attempts: [{
        id: 'attempt-1', question_id: 'question-1', is_correct: true, reasoning: input.studentReasoning,
        feedback_payload: storedFeedback,
      }],
    } as any);
    const create = jest.spyOn(prisma.questionAttempt, 'create');
    const result = await service.submitGuidedQuestion('user-1', 'session-1', 'question-1', {
      selectedAnswer: input.studentSelectedAnswer, reasoning: input.studentReasoning,
    });
    expect(result.attemptId).toBe('attempt-1');
    expect(create).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
});

describe('guided Exam Prep session creation', () => {
  afterEach(() => jest.restoreAllMocks());

  it('creates an EXAM_PREP session and returns only the first sanitized question', async () => {
    const questions = Array.from({ length: 10 }, (_, index) => ({
      id: `question-${index + 1}`,
      question_text: `Study question ${index + 1}`,
      options: [`Option A${index}`, `Option B${index}`, `Option C${index}`, `Option D${index}`],
      correct_answer: `Option B${index}`,
      explanation: 'Canonical explanation',
      approach_guide: 'Apply the governing concept.',
      difficulty: Difficulty.MEDIUM,
      question_type: QuestionType.APPLICATION,
      source_page_start: null,
      source_page_end: null,
    }));
    const material = {
      id: 'material-1', title: 'Mechanics notes', course_code: 'PHY101', university: 'UNILAG', faculty: 'Science',
      department: 'Physics', level: 100, verification_status: 'VERIFIED', unpublished_at: null,
      content: 'Material source', reader_structure: null,
    };
    jest.spyOn(prisma.session, 'findMany').mockResolvedValue([]);
    jest.spyOn(MaterialsService.prototype, 'getMaterial').mockResolvedValue(material as any);
    jest.spyOn(prisma.question, 'findMany').mockResolvedValue(questions as any);
    jest.spyOn(prisma.questionAttempt, 'findMany').mockResolvedValue([]);
    (checkFeatureAccess as jest.Mock).mockResolvedValue(true);
    (usageService.assertAvailable as jest.Mock).mockResolvedValue({ remaining: 3 });
    (usageService.consume as jest.Mock).mockResolvedValue({ remaining: 2 });
    const create = jest.spyOn(prisma.session, 'create').mockResolvedValue({ id: 'session-new' } as any);
    jest.spyOn(prisma.session, 'findFirst').mockResolvedValue({
      id: 'session-new', user_id: 'user-1', material_id: material.id, session_type: 'EXAM_PREP', reply_mode: null,
      course_code: material.course_code, topic: material.title, duration: null,
      metadata: { mode: 'guided-question-study', version: 1, entitlementFeature: 'EXAM_PREP', questionIds: questions.map((question) => question.id), currentIndex: 0 },
      university: material.university, department: material.department, started_at: new Date(), ended_at: null, created_at: new Date(),
      material: { id: material.id, title: material.title, course_code: material.course_code, content: material.content, reader_structure: null },
      question_attempts: [],
    } as any);
    jest.spyOn(prisma.question, 'findFirst').mockResolvedValue(questions[0] as any);

    const result = await new ExamPrepService({ generate: jest.fn() } as any).startGuidedSession('user-1', material.id);

    expect(create.mock.calls[0][0].data.session_type).toBe('EXAM_PREP');
    expect(create.mock.calls[0][0].data.material_id).toBe(material.id);
    expect(usageService.consume).toHaveBeenCalledTimes(1);
    expect(result.currentQuestion).toMatchObject({ id: questions[0].id, text: questions[0].question_text });
    expect(JSON.stringify(result)).not.toMatch(/correct_answer|correctAnswer|explanation|approach_guide/);
  });
});

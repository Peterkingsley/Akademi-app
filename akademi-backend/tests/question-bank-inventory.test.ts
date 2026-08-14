const questionCount = jest.fn();
const attempts = jest.fn();
const findMaterial = jest.fn();
const updateMaterial = jest.fn();
const claimMaterial = jest.fn();
const add = jest.fn();

jest.mock('../src/config/db', () => ({
  __esModule: true,
  default: {
    question: { count: questionCount },
    questionAttempt: { findMany: attempts },
    material: { findUnique: findMaterial, update: updateMaterial, updateMany: claimMaterial },
  },
}));

jest.mock('../src/config/queue', () => ({
  JOB_NAMES: { GENERATE_QUESTIONS: 'GENERATE_QUESTIONS' },
  systemQueue: { add },
}));

import { queueQuestionBankRefillIfNeeded } from '../src/modules/questions/question-bank-inventory.service';
import { expectedDifficultyCounts, semanticSimilarity } from '../src/jobs/generateQuestions.job';

describe('question-bank inventory controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    attempts.mockResolvedValue([]);
    updateMaterial.mockResolvedValue({});
    claimMaterial.mockResolvedValue({ count: 1 });
    add.mockResolvedValue(undefined);
    findMaterial.mockResolvedValue({
      question_generation_status: 'READY',
      question_bank_refill_cooldown_until: null,
      question_bank_hour_window_started_at: null,
      question_bank_hour_batch_count: 0,
    });
  });

  it('does not refill while a user has at least 20 unseen questions', async () => {
    questionCount.mockResolvedValue(30);
    attempts.mockResolvedValue(Array.from({ length: 10 }, (_, index) => ({ question_id: `q-${index}` })));
    const result = await queueQuestionBankRefillIfNeeded('material', 'user');
    expect(result).toMatchObject({ unseen: 20, queued: false, reason: 'healthy' });
    expect(add).not.toHaveBeenCalled();
  });

  it('queues a priority refill when fewer than 10 unseen questions remain', async () => {
    questionCount.mockResolvedValue(30);
    attempts.mockResolvedValue(Array.from({ length: 24 }, (_, index) => ({ question_id: `q-${index}` })));
    const result = await queueQuestionBankRefillIfNeeded('material', 'user');
    expect(result).toMatchObject({ unseen: 6, queued: true, reason: 'critical' });
    expect(add).toHaveBeenCalledWith('GENERATE_QUESTIONS', expect.objectContaining({
      materialId: 'material', requestedCount: 10, priority: 100,
    }));
  });

  it('stops generation at the configured ceiling and marks the bank for revision mode', async () => {
    questionCount.mockResolvedValue(300);
    attempts.mockResolvedValue(Array.from({ length: 300 }, (_, index) => ({ question_id: `q-${index}` })));
    const result = await queueQuestionBankRefillIfNeeded('material', 'user');
    expect(result).toMatchObject({ unseen: 0, queued: false, reason: 'ceiling_reached' });
    expect(updateMaterial).toHaveBeenCalledWith(expect.objectContaining({
      data: { question_bank_inventory_status: 'EXHAUSTED' },
    }));
    expect(add).not.toHaveBeenCalled();
  });

  it('recognizes close paraphrases and calculates exact ten-question difficulty targets', () => {
    expect(semanticSimilarity(
      'What statement describes Newton second law of motion?',
      'Which statement correctly describes Newton second law?',
    )).toBeGreaterThanOrEqual(0.82);
    expect(expectedDifficultyCounts(10)).toEqual({ EASY: 2, MEDIUM: 3, HARD: 5 });
  });
});

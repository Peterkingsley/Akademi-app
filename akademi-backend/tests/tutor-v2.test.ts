import { ReplyMode } from '@prisma/client';
import { buildBaselineTutorState, determineTutorDepth } from '../src/modules/ai/tutor-state';
import { buildTutorBenchmarkSuite } from '../src/modules/ai/tutor-benchmark';

jest.mock('../src/modules/ai/ai.provider', () => ({
  aiProvider: { generateResponse: jest.fn() },
}));

describe('Adaptive tutor V2', () => {
  it('uses foundation depth for high confusion instead of course level', () => {
    const depth = determineTutorDepth(
      'Please explain why this step works',
      { mastery: 0.24, confidence: 0.3, confusion: 0.82 },
      { vocabulary_level: 'ADVANCED' },
      false,
    );
    expect(depth).toBe('FOUNDATION');
  });

  it('uses advanced depth for a strong learner and does not force zero-background teaching', () => {
    const depth = determineTutorDepth(
      'Explain the key reasoning only',
      { mastery: 0.9, confidence: 0.82, confusion: 0.14 },
      { vocabulary_level: 'ADVANCED' },
      false,
    );
    expect(depth).toBe('ADVANCED');
  });

  it('honors an explicit request to skip basics', () => {
    const depth = determineTutorDepth(
      'Skip the basics; I already know algebra. Focus on why this substitution is valid.',
      { mastery: 0.5, confidence: 0.55, confusion: 0.4 },
      { vocabulary_level: 'INTERMEDIATE' },
      false,
    );
    expect(depth).toBe('ADVANCED');
  });

  it('keeps mastery, confidence and confusion as independent learner signals', () => {
    const state = buildBaselineTutorState({
      studentMessage: 'Is my answer x = 4 correct?',
      replyMode: ReplyMode.DIRECT,
      standalone: false,
      learningProfile: {
        vocabulary_level: 'ADVANCED',
        subject_strengths: { mastery: { Algebra: 0.9 } },
        question_patterns: {
          topic_states: {
            Algebra: { mastery: 0.9, confidence: 0.3, confusion: 0.15 },
          },
        },
      },
      calculationSignal: true,
      essaySignal: false,
    });

    expect(state.studentState.mastery).toBeGreaterThan(0.8);
    expect(state.studentState.confidence).toBeLessThan(0.4);
    expect(state.intent).toBe('verify');
    expect(state.strategy).toBe('verification');
  });

  it('ships a permanent 120-case cross-discipline benchmark matrix', () => {
    const suite = buildTutorBenchmarkSuite();
    expect(suite).toHaveLength(120);
    expect(new Set(suite.map((item) => item.discipline)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(suite.map((item) => item.learner.id))).toEqual(
      new Set(['foundation', 'guided', 'standard', 'advanced']),
    );
  });
});

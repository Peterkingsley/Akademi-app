import { AIService } from '../src/modules/ai/ai.service';
import { aiProvider } from '../src/modules/ai/ai.provider';

jest.mock('../src/modules/ai/ai.provider', () => ({
  aiProvider: {
    generateResponse: jest.fn(),
  },
}));

// Regression coverage for the board-walkthrough step duplication/fragmentation bug, reproduced
// with "Solve this question: 2x^2 + 3x + 4 = 0" (quadratic formula walkthrough).
//
// Root cause: the old splitEquationChain/splitPartOnEquals logic assumed any math field with
// 3+ "=" separated segments was one continuous equality chain, and blindly paired consecutive
// segments. When the model instead put an equation restatement plus several *independent*
// coefficient assignments in one "math" field (e.g. "2x^2+3x+4 = 0 a = 2 b = 3 c = 4"), that
// logic shredded it into overlapping fragments and cloned the parent step's text/note across
// each one - producing 4 duplicated steps out of what should have been 1.
describe('board walkthrough step parsing', () => {
  let aiService: AIService;

  const buildRawBoardResponse = (steps: Array<{ id: string; type?: string; text: string; math: string; note: string }>) =>
    JSON.stringify({
      title: 'Solving a Quadratic Equation Using the Quadratic Formula',
      steps,
      final_answer: 'x is approximately -1.72 or 1.22',
      final_answer_math: 'x \\approx -1.72, \\quad x \\approx 1.22',
      summary: 'Check by substituting each root back into the original equation.',
    });

  beforeEach(() => {
    aiService = new AIService();
    jest.clearAllMocks();
  });

  it('parses a step whose math field crams the equation and coefficient facts together as ONE step, never cloning it into duplicated fragments', () => {
    const rawResponse = buildRawBoardResponse([
      {
        id: 'step-1',
        text: 'First, we recognize that our equation is a quadratic equation, which has the general form ax^2 + bx + c = 0.',
        math: 'ax^2 + bx + c = 0',
        note: 'We start by identifying the type of equation.',
      },
      {
        id: 'step-2',
        text: 'Now, we compare our given equation, 2x^2+3x+4=0, with the standard quadratic form to identify the coefficients a, b, and c.',
        // Reproduces the exact malformed field from the bug report: the equation restated plus
        // three independent coefficient assignments, run together with no separators.
        math: '2x^2+3x+4 = 0 a = 2 b = 3 c = 4',
        note: 'We identify these values so we know exactly which numbers to substitute into the quadratic formula.',
      },
      {
        id: 'step-3',
        text: 'Next, we substitute a, b, and c into the quadratic formula.',
        math: 'x = \\frac{-3 \\pm \\sqrt{3^2 - 4(2)(4)}}{2(2)}',
        note: 'We plug the values in to compute the roots.',
      },
    ]);

    (aiProvider.generateResponse as jest.Mock).mockResolvedValue(rawResponse);

    const payload = (aiService as any).parseWhiteboardPayload(rawResponse);

    expect(payload).not.toBeNull();
    // 3 source steps in, 3 rendered steps out - no cloning, no inflation.
    expect(payload.steps).toHaveLength(3);
  });

  it('never emits two consecutive steps with identical explanation text', () => {
    const rawResponse = buildRawBoardResponse([
      {
        id: 'step-1',
        text: 'Now, we compare our given equation, 2x^2+3x+4=0, with the standard quadratic form to identify the coefficients a, b, and c.',
        math: '2x^2+3x+4 = 0 a = 2 b = 3 c = 4',
        note: 'We identify these values so we know exactly which numbers to substitute into the quadratic formula.',
      },
    ]);

    const payload = (aiService as any).parseWhiteboardPayload(rawResponse);
    const steps: Array<{ text: string; note: string }> = payload.steps;

    for (let index = 1; index < steps.length; index += 1) {
      const previousText = steps[index - 1].text.trim().toLowerCase();
      const currentText = steps[index].text.trim().toLowerCase();
      expect(currentText === previousText && previousText.length > 0).toBe(false);
    }
  });

  it('produces equation fields that are all balanced LaTeX and never end with a dangling single-variable token', () => {
    const rawResponse = buildRawBoardResponse([
      {
        id: 'step-1',
        text: 'We identify the coefficients from the standard form.',
        math: '2x^2+3x+4 = 0 a = 2 b = 3 c = 4',
        note: 'We identify these values so we can substitute them.',
      },
      {
        id: 'step-2',
        text: 'We substitute into the quadratic formula.',
        math: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
        note: 'This formula always works for any quadratic equation.',
      },
    ]);

    const payload = (aiService as any).parseWhiteboardPayload(rawResponse);
    const steps: Array<{ math?: string }> = payload.steps;

    for (const step of steps) {
      if (!step.math) continue;

      expect((aiService as any).hasBalancedBraces(step.math)).toBe(true);
      expect((aiService as any).endsWithDanglingVariable(step.math)).toBe(false);
    }
  });

  it('retries once when the model repeats the same explanation across consecutive steps, and returns null if the retry is still broken', async () => {
    const duplicatedResponse = buildRawBoardResponse([
      {
        id: 'step-2',
        text: 'Now, we compare our given equation to identify the coefficients a, b, and c.',
        math: '2x^2+3x+4 = 0 a',
        note: 'We identify these values so we know exactly which numbers to substitute.',
      },
      {
        id: 'step-3',
        text: 'Now, we compare our given equation to identify the coefficients a, b, and c.',
        math: '0 a = 2 b',
        note: 'We identify these values so we know exactly which numbers to substitute.',
      },
    ]);

    const cleanRetryResponse = buildRawBoardResponse([
      {
        id: 'step-2',
        text: 'Now, we compare our given equation to identify the coefficients a, b, and c.',
        math: 'a = 2, \\quad b = 3, \\quad c = 4',
        note: 'We identify these values so we know exactly which numbers to substitute.',
      },
    ]);

    (aiProvider.generateResponse as jest.Mock)
      .mockResolvedValueOnce(duplicatedResponse)
      .mockResolvedValueOnce(cleanRetryResponse);

    const result = await (aiService as any).buildWhiteboardPayload('Solve 2x^2 + 3x + 4 = 0', 'x = ...');

    expect(aiProvider.generateResponse).toHaveBeenCalledTimes(2);
    expect(result).not.toBeNull();
    expect(result.steps).toHaveLength(1);

    // Second scenario: retry is still broken - must fall back to null rather than surface a
    // duplicated walkthrough to the student.
    (aiProvider.generateResponse as jest.Mock).mockReset();
    (aiProvider.generateResponse as jest.Mock)
      .mockResolvedValueOnce(duplicatedResponse)
      .mockResolvedValueOnce(duplicatedResponse);

    const stillBroken = await (aiService as any).buildWhiteboardPayload('Solve 2x^2 + 3x + 4 = 0', 'x = ...');

    expect(aiProvider.generateResponse).toHaveBeenCalledTimes(2);
    expect(stillBroken).toBeNull();
  });
});

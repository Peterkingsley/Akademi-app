import { answersMatch, compareAnswers, tryParseExpression } from '../src/modules/verification/answerNormalizer';

describe('answerNormalizer — numeric equivalence', () => {
  it('treats equivalent fractions as equal', () => {
    expect(answersMatch('3/6', '1/2')).toBe(true);
    expect(answersMatch('1/2', '0.5')).toBe(true);
    expect(answersMatch('3/6', '0.5')).toBe(true);
    expect(answersMatch('2/4', '1/2')).toBe(true);
  });

  it('treats negative fractions and decimals as equal', () => {
    expect(answersMatch('-1/2', '-0.5')).toBe(true);
    expect(answersMatch('-3/6', '-0.5')).toBe(true);
  });

  it('treats plain integers as equal regardless of formatting', () => {
    expect(answersMatch('4', '4.0')).toBe(true);
    expect(answersMatch('4', '4.00000')).toBe(true);
    expect(answersMatch('-4', '-4')).toBe(true);
  });

  it('treats surds and their decimal approximations as equal', () => {
    expect(answersMatch('sqrt(2)', '1.41421356')).toBe(true);
    expect(answersMatch('2*sqrt(3)', '3.4641016')).toBe(true);
    expect(answersMatch('sqrt(4)', '2')).toBe(true);
  });

  it('handles unicode math notation', () => {
    expect(answersMatch('√2', '1.41421356')).toBe(true);
    expect(answersMatch('2×3', '6')).toBe(true);
    expect(answersMatch('6÷2', '3')).toBe(true);
    expect(answersMatch('−5', '-5')).toBe(true);
  });

  it('handles pi and e', () => {
    expect(answersMatch('pi', '3.14159265')).toBe(true);
    expect(answersMatch('2*pi', '6.2831853')).toBe(true);
    expect(answersMatch('e', '2.71828183')).toBe(true);
  });

  it('handles small rounding differences within tolerance', () => {
    expect(answersMatch('0.3333333', '1/3')).toBe(true);
    expect(answersMatch('3.14159', '3.14160')).toBe(true);
  });

  it('rejects genuinely different numbers', () => {
    expect(answersMatch('1/2', '1/3')).toBe(false);
    expect(answersMatch('4', '5')).toBe(false);
    expect(answersMatch('sqrt(2)', 'sqrt(3)')).toBe(false);
    expect(answersMatch('3.14', '3.15')).toBe(false);
  });

  it('rejects numbers of the same magnitude but different sign', () => {
    expect(answersMatch('5', '-5')).toBe(false);
    expect(answersMatch('1/2', '-1/2')).toBe(false);
  });
});

describe('answerNormalizer — algebraic expressions', () => {
  it('treats an expanded and factored polynomial as equal', () => {
    expect(answersMatch('x^2 - 1', '(x-1)*(x+1)')).toBe(true);
    expect(answersMatch('x^2 + 5x + 6', '(x+2)*(x+3)')).toBe(true);
  });

  it('treats reordered terms as equal', () => {
    expect(answersMatch('3x^2 + 4x', '4x + 3x^2')).toBe(true);
    expect(answersMatch('2x + 3y', '3y + 2x')).toBe(true);
  });

  it('handles implicit multiplication (coefficient next to variable)', () => {
    expect(answersMatch('2x', '2*x')).toBe(true);
    expect(answersMatch('3x^2', '3*x^2')).toBe(true);
    expect(answersMatch('2sqrt(x)', '2*sqrt(x)')).toBe(true);
  });

  it('recognizes a derivative written two different ways', () => {
    // d/dx[x^3] = 3x^2, written as "3x^2" vs "3*x*x"
    expect(answersMatch('3x^2', '3*x*x')).toBe(true);
  });

  it('recognizes trig identity equivalence at sampled points', () => {
    expect(answersMatch('sin(x)^2 + cos(x)^2', '1')).toBe(true);
  });

  it('rejects genuinely different expressions', () => {
    expect(answersMatch('x^2', 'x^3')).toBe(false);
    expect(answersMatch('3x^2 + 4x', '3x^2 + 5x')).toBe(false);
    expect(answersMatch('x + 1', 'x - 1')).toBe(false);
  });

  it('rejects expressions differing only by a constant (common near-miss)', () => {
    expect(answersMatch('x^2 + 1', 'x^2 + 2')).toBe(false);
  });

  it('handles multi-variable expressions', () => {
    expect(answersMatch('x*y + y*x', '2*x*y')).toBe(true);
    expect(answersMatch('x + y', 'y + x')).toBe(true);
    expect(answersMatch('x + y', 'x - y')).toBe(false);
  });
});

describe('answerNormalizer — units', () => {
  it('treats matching numeric value + matching unit as equal', () => {
    expect(answersMatch('5m', '5 meters')).toBe(true);
    expect(answersMatch('3.2 N', '3.2 newtons')).toBe(true);
    expect(answersMatch('10cm', '10 centimeters')).toBe(true);
  });

  it('rejects matching numeric value with mismatched units', () => {
    expect(answersMatch('5m', '5 kg')).toBe(false);
  });

  it('rejects mismatched numeric value even with matching units', () => {
    expect(answersMatch('5m', '6m')).toBe(false);
  });

  it('treats unitless numeric answers as comparable when neither side has a unit', () => {
    expect(answersMatch('5', '5.0')).toBe(true);
  });
});

describe('answerNormalizer — text fallback', () => {
  it('normalizes common "no answer" phrasings', () => {
    expect(answersMatch('undefined', 'does not exist')).toBe(true);
    expect(answersMatch('DNE', 'undefined')).toBe(true);
    expect(answersMatch('no solution', 'undefined')).toBe(true);
  });

  it('is case- and whitespace-insensitive for text answers', () => {
    expect(answersMatch('Undefined', '  undefined  ')).toBe(true);
  });

  it('rejects genuinely different text answers', () => {
    expect(answersMatch('increasing', 'decreasing')).toBe(false);
  });
});

describe('answerNormalizer — compareAnswers method reporting', () => {
  it('reports which comparison method was used', () => {
    expect(compareAnswers('1/2', '0.5').method).toBe('numeric');
    expect(compareAnswers('3x^2', '4x + 3x^2 - 4x').method).toBe('algebraic');
    expect(compareAnswers('undefined', 'dne').method).toBe('text');
  });

  it('reports a reason on unit mismatch', () => {
    const result = compareAnswers('5m', '5kg');
    expect(result.equal).toBe(false);
    expect(result.reason).toMatch(/unit mismatch/);
  });
});

describe('answerNormalizer — parser robustness (should not throw)', () => {
  it('does not throw on malformed or empty input', () => {
    expect(() => tryParseExpression('')).not.toThrow();
    expect(() => tryParseExpression('   ')).not.toThrow();
    expect(() => tryParseExpression('((')).not.toThrow();
    expect(() => tryParseExpression('+')).not.toThrow();
    expect(() => tryParseExpression('x +')).not.toThrow();
  });

  it('falls back to text comparison gracefully when one side is unparseable prose', () => {
    expect(() => answersMatch('the limit does not exist because the one-sided limits differ', '5')).not.toThrow();
    expect(answersMatch('the limit does not exist because the one-sided limits differ', '5')).toBe(false);
  });

  it('handles negative exponents and nested parentheses', () => {
    expect(answersMatch('2^-1', '0.5')).toBe(true);
    expect(answersMatch('((1+1))*2', '4')).toBe(true);
  });

  it('handles division by zero on one side without crashing', () => {
    expect(() => answersMatch('1/x', '1/0')).not.toThrow();
  });
});

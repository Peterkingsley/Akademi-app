import {
  deriveFailedConcepts,
  isNonSubstantiveStudentResponse,
  sanitizeFailedConcepts,
  sanitizeTutorStyle,
} from '../src/modules/sessions/study-companion-quality-relevance';
import {
  buildGapReteach,
  buildTeachBackPrompt,
} from '../src/modules/sessions/study-companion-teaching-pass';

const prefixSection = {
  key: 'prefixes',
  title: 'SOME IMPORTANT ABBREVIATIONS',
  content: [
    'Metric prefixes provide shorthand for powers of ten.',
    'centi represents 10^-2, milli represents 10^-3, micro represents 10^-6, nano represents 10^-9.',
    'Use each prefix multiplier to convert a prefixed unit to its base unit.',
  ].join('\n'),
  status: 'IN_PROGRESS',
  pageStart: 2,
  pageEnd: 2,
} as any;

const decision = {
  strategy: 'definition_first',
  pace: 'normal',
  prerequisiteRepairMode: 'none',
  learnerDepth: 'STANDARD',
  shouldUseAnalogy: false,
  shouldUseWorkedExample: false,
  shouldUseVisualExplanation: false,
  shouldUseCalculationSteps: false,
  shouldUseExamFraming: false,
  shouldChallengeStudent: false,
  shouldSlowDown: false,
  shouldRepairPrerequisite: false,
  repairConcepts: [],
  reason: 'test',
  promptDirectives: [],
  traceMetadata: {},
} as any;

describe('Study Companion section-grounding regressions', () => {
  it('treats no-recall acknowledgements as no evidence', () => {
    expect(isNonSubstantiveStudentResponse("I don't remember")).toBe(true);
    expect(isNonSubstantiveStudentResponse('I understand now')).toBe(true);
    expect(isNonSubstantiveStudentResponse("Yes it's clear")).toBe(true);
    expect(isNonSubstantiveStudentResponse('10^-9')).toBe(false);
  });

  it('never surfaces an unrelated electric-field concept for a prefix lesson', () => {
    const sanitized = sanitizeFailedConcepts(prefixSection, [
      'We want to find electric field at point P at a distance of r from it',
    ]);

    expect(sanitized).toEqual([
      'using metric-prefix multipliers correctly in unit conversions',
    ]);
    expect(sanitized.join(' ')).not.toMatch(/electric field|point P|distance of r/i);
  });

  it('grounds failed concepts for I do not remember to the current section', () => {
    const failed = deriveFailedConcepts(prefixSection, "I don't remember");
    expect(failed).toEqual([
      'using metric-prefix multipliers correctly in unit conversions',
    ]);
  });

  it('removes source-routing labels and renders simple powers readably', () => {
    const cleaned = sanitizeTutorStyle(
      "deca means \\(10^{1}\\). (External support: Standard SI symbol da was omitted in the table.) kilo means \\(10^{3}\\).",
    );

    expect(cleaned).toContain('10¹');
    expect(cleaned).toContain('10³');
    expect(cleaned).not.toMatch(/External support/i);
    expect(cleaned).not.toMatch(/\\\(10\^/);
  });

  it('uses a clean prefix teach-back instead of visual-structure/checkpoint-focus text', async () => {
    const prompt = await buildTeachBackPrompt(
      prefixSection,
      2,
      decision,
      '',
      undefined,
      undefined,
      '',
      {
        checkpointFocus: [
          'Recall of standard metric prefixes and their corresponding powers of ten',
          'Application of conversion factors for length units',
        ],
      } as any,
    );

    expect(prompt).toBe(
      'Final teach-back: Explain how metric prefixes change a base unit and give one fresh conversion example in your own words.',
    );
    expect(prompt).not.toMatch(/visual structure|Recall of|Application of|\.\.\./i);
  });

  it('keeps prefix reteach short and targeted instead of dumping the full SI table', async () => {
    const reteach = await buildGapReteach(
      prefixSection,
      ['using metric-prefix multipliers correctly in unit conversions'],
      decision,
    );

    expect(reteach.length).toBeLessThan(700);
    expect(reteach).toContain('milli means 10⁻³');
    expect(reteach).toContain('5 × 10⁻³ meters');
    expect(reteach).not.toMatch(/External support|deci.*centi.*milli.*micro.*nano.*pico/i);
    expect(reteach).not.toContain('?');
  });
});

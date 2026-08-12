import {
  isCalculationHeavySection,
  isDiagramHeavySection,
} from '../src/modules/sessions/study-companion-teacher-brain';
import { shouldUseCondensedCompanionFlow } from '../src/modules/sessions/study-companion-session-state';
import { sanitizeTutorStyle } from '../src/modules/sessions/study-companion-quality-relevance';

const emptyTeacherBrainSection = {
  currentChapterSummary: null,
  previousChapterSummary: null,
  nextChapterSummary: null,
  concepts: [],
  prerequisites: [],
  formulas: [],
  calculationMethods: [],
  diagrams: [],
  misconceptions: [],
  examAngles: [],
  teacherNotes: {
    teaching_style: '',
    best_analogies: [],
    sections_that_need_extra_care: [],
    calculation_heavy_sections: [],
    diagram_heavy_sections: [],
    recommended_teaching_sequence: [],
  },
  subjectFamily: 'physics',
  confidence: 90,
} as any;

const prefixSection = {
  key: 'prefixes',
  title: 'Some Important Abbreviations',
  content:
    'SI prefixes are shorthand for powers of ten. Kilo represents 10^3, milli represents 10^-3, micro represents 10^-6, and nano represents 10^-9. The prefixes make measurements easier to write and compare. A student should know the symbol and meaning of each common prefix.',
  status: 'IN_PROGRESS',
  pageStart: 2,
  pageEnd: 2,
} as any;

describe('Study Companion flow-quality regressions', () => {
  it('does not classify a factual physics prefix section as calculation-heavy', () => {
    expect(
      isCalculationHeavySection(prefixSection, emptyTeacherBrainSection),
    ).toBe(false);
  });

  it('does not force visual teaching for tables, units, or factual prefix lists', () => {
    const tableSection = {
      ...prefixSection,
      content:
        'The following table lists common SI prefixes, their symbols, and their powers of ten.',
    };
    expect(isDiagramHeavySection(tableSection, emptyTeacherBrainSection)).toBe(
      false,
    );
  });

  it('still identifies genuine calculation work', () => {
    const calculationSection = {
      ...prefixSection,
      title: 'Newton Second Law Problems',
      content:
        'Use F = ma. Calculate the force when mass is 5 kg and acceleration is 2 m/s^2.',
    };
    expect(
      isCalculationHeavySection(calculationSection, emptyTeacherBrainSection),
    ).toBe(true);
  });

  it('still identifies genuine graph or diagram work', () => {
    const graphSection = {
      ...prefixSection,
      title: 'Velocity Time Graph',
      content:
        'Study the velocity-time graph. Explain the x-axis, y-axis, and slope.',
    };
    expect(isDiagramHeavySection(graphSection, emptyTeacherBrainSection)).toBe(
      true,
    );
  });

  it('condenses simple rule-based sections but not complex problem-solving sections', () => {
    expect(shouldUseCondensedCompanionFlow(prefixSection)).toBe(true);

    const complexSection = {
      ...prefixSection,
      title: 'Integration by Parts',
      content:
        'Derive the integration-by-parts formula, then solve the integral step by step and explain the procedure used to choose u and dv.',
    };
    expect(shouldUseCondensedCompanionFlow(complexSection)).toBe(false);
  });

  it('removes robotic praise, stock visual filler, and duplicate sentences', () => {
    const cleaned = sanitizeTutorStyle(
      'You are absolutely correct! Kilo represents 1000 times the base unit. That is a perfect example of how prefixes work. Picture the process clearly and follow the main parts or stages in order. Kilo represents 1000 times the base unit.',
    );

    expect(cleaned).toContain('Correct — Kilo represents 1000 times the base unit.');
    expect(cleaned).not.toMatch(/absolutely correct|perfect example/i);
    expect(cleaned).not.toContain(
      'Picture the process clearly and follow the main parts or stages in order.',
    );
    expect(
      cleaned.match(/Kilo represents 1000 times the base unit\./g)?.length,
    ).toBe(1);
  });
});

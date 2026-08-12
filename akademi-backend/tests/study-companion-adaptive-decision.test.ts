import { decideTeachingStrategy } from '../src/modules/sessions/teaching-decision-engine';

const baseInput = {
  phase: 'TEACHING_PASS_1_BIG_PICTURE',
  sectionTitle: 'Some Important Abbreviations',
  sectionContent: 'Metric prefixes such as nano and giga represent powers of ten used in measurements.',
  subjectFamily: 'physics',
  prerequisiteIssues: ['scientific notation'],
  weakPoints: [],
  misconceptions: [],
  calculationIssues: [],
  diagramIssues: [],
  hiddenConfusionSignals: [],
  isCalculationHeavy: false,
  isDiagramHeavy: false,
};

describe('Study Companion adaptive teaching decision', () => {
  it('does not treat a curriculum prerequisite as a student weakness without evidence', () => {
    const decision = decideTeachingStrategy(baseInput);

    expect(decision.shouldRepairPrerequisite).toBe(false);
    expect(decision.prerequisiteRepairMode).toBe('none');
    expect(decision.learnerDepth).toBe('STANDARD');
    expect(decision.repairConcepts).toEqual([]);
    expect(decision.promptDirectives.join(' ')).toContain('not proven weaknesses');
  });

  it('repairs a prerequisite when learner evidence explicitly supports it', () => {
    const decision = decideTeachingStrategy({
      ...baseInput,
      recommendedConfusionIntervention: 'prerequisite_repair',
      hiddenConfusionRisk: 78,
      weakPoints: ['I am missing the scientific notation foundation'],
    });

    expect(decision.shouldRepairPrerequisite).toBe(true);
    expect(decision.prerequisiteRepairMode).toBe('medium_repair');
    expect(decision.learnerDepth).toBe('FOUNDATION');
    expect(decision.repairConcepts).toContain('scientific notation');
  });

  it('keeps a strong learner advanced instead of forcing beginner Pass 1 teaching', () => {
    const decision = decideTeachingStrategy({
      ...baseInput,
      currentMasteryScore: 92,
      conceptUnderstanding: 90,
      proceduralAccuracy: 88,
      reasoningQuality: 90,
      confidence: 84,
      hiddenConfusionRisk: 18,
      retentionRisk: 20,
    });

    expect(decision.learnerDepth).toBe('ADVANCED');
    expect(decision.pace).toBe('fast');
    expect(decision.promptDirectives.join(' ')).toContain('Pass number controls lesson scope');
  });

  it('forbids vague familiarity checks and malformed split math in teaching directives', () => {
    const decision = decideTeachingStrategy(baseInput);
    const directives = decision.promptDirectives.join(' ');

    expect(directives).toContain('Never ask whether the idea sounds familiar');
    expect(directives).toContain('never 1 \\(\\times\\) 10^{-9}');
  });
});

export type TeachingStrategy =
  | 'definition_first'
  | 'analogy_first'
  | 'visual_first'
  | 'worked_example_first'
  | 'problem_first'
  | 'story_first'
  | 'exam_first'
  | 'hybrid';

export type TeachingPace = 'slow' | 'normal' | 'fast';

export type PrerequisiteRepairMode = 'none' | 'quick_refresh' | 'medium_repair' | 'full_reteach';

export type LearningSignal = {
  masteryScore: number | null;
  conceptUnderstanding: number;
  proceduralAccuracy: number;
  reasoningQuality: number;
  confidence: number;
  hiddenConfusionRisk: number;
  calculationWeakness: number;
  diagramWeakness: number;
  prerequisiteWeakness: number;
};

export type TeachingDecisionInput = {
  phase: string;
  sectionTitle: string;
  sectionContent: string;
  subjectFamily?: string;
  teacherBrainContext?: string;
  studentMemoryContext?: string;
  lessonPlanContext?: string;
  calculationContext?: string;
  diagramContext?: string;
  relevantMaterialContext?: string;
  currentMasteryScore?: number | null;
  lastMasteryScore?: number | null;
  weakPoints?: string[];
  misconceptions?: string[];
  calculationIssues?: string[];
  diagramIssues?: string[];
  prerequisiteIssues?: string[];
  isCalculationHeavy?: boolean;
  isDiagramHeavy?: boolean;
};

export type TeachingDecision = {
  strategy: TeachingStrategy;
  pace: TeachingPace;
  prerequisiteRepairMode: PrerequisiteRepairMode;
  shouldUseAnalogy: boolean;
  shouldUseWorkedExample: boolean;
  shouldUseVisualExplanation: boolean;
  shouldUseCalculationSteps: boolean;
  shouldUseExamFraming: boolean;
  shouldChallengeStudent: boolean;
  shouldSlowDown: boolean;
  shouldRepairPrerequisite: boolean;
  repairConcepts: string[];
  reason: string;
  promptDirectives: string[];
  traceMetadata: Record<string, unknown>;
};

const calculationFamilies = new Set([
  'mathematics',
  'statistics',
  'finance',
  'economics',
  'engineering',
  'physics',
  'chemistry',
]);

const diagramFamilies = new Set([
  'biology',
  'medicine',
  'agriculture',
  'geography',
  'engineering',
  'computer_science',
]);

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniqueItems(items: string[] | undefined) {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean)));
}

function inferLearningSignal(input: TeachingDecisionInput): LearningSignal {
  const weakPoints = uniqueItems(input.weakPoints);
  const misconceptions = uniqueItems(input.misconceptions);
  const calculationIssues = uniqueItems(input.calculationIssues);
  const diagramIssues = uniqueItems(input.diagramIssues);
  const prerequisiteIssues = uniqueItems(input.prerequisiteIssues);
  const masteryScore =
    input.currentMasteryScore ??
    input.lastMasteryScore ??
    null;

  const issueWeight =
    weakPoints.length * 10 +
    misconceptions.length * 12 +
    calculationIssues.length * 8 +
    diagramIssues.length * 8 +
    prerequisiteIssues.length * 15;

  const baseline = masteryScore ?? 60;
  const prerequisiteWeakness = clampScore(prerequisiteIssues.length * 25);
  const calculationWeakness = clampScore(calculationIssues.length * 20 + (input.isCalculationHeavy ? 10 : 0));
  const diagramWeakness = clampScore(diagramIssues.length * 20 + (input.isDiagramHeavy ? 10 : 0));
  const hiddenConfusionRisk = clampScore(
    issueWeight +
      (input.studentMemoryContext ? 10 : 0) +
      (input.isCalculationHeavy ? 8 : 0) +
      (input.isDiagramHeavy ? 8 : 0) -
      Math.max(0, baseline - 60),
  );

  return {
    masteryScore,
    conceptUnderstanding: clampScore(baseline - weakPoints.length * 10 - misconceptions.length * 12),
    proceduralAccuracy: clampScore(baseline - calculationIssues.length * 15 - prerequisiteIssues.length * 10),
    reasoningQuality: clampScore(baseline - misconceptions.length * 10 - weakPoints.length * 8),
    confidence: clampScore(baseline - hiddenConfusionRisk * 0.2),
    hiddenConfusionRisk,
    calculationWeakness,
    diagramWeakness,
    prerequisiteWeakness,
  };
}

export function decideTeachingStrategy(input: TeachingDecisionInput): TeachingDecision {
  const weakPoints = uniqueItems(input.weakPoints);
  const misconceptions = uniqueItems(input.misconceptions);
  const calculationIssues = uniqueItems(input.calculationIssues);
  const diagramIssues = uniqueItems(input.diagramIssues);
  const prerequisiteIssues = uniqueItems(input.prerequisiteIssues);
  const subjectFamily = String(input.subjectFamily || '').trim().toLowerCase();
  const signal = inferLearningSignal(input);

  let strategy: TeachingStrategy = 'hybrid';
  let pace: TeachingPace = 'normal';
  let prerequisiteRepairMode: PrerequisiteRepairMode = 'none';
  let shouldUseAnalogy = false;
  let shouldUseWorkedExample = false;
  let shouldUseVisualExplanation = false;
  let shouldUseCalculationSteps = false;
  let shouldUseExamFraming = false;
  let shouldChallengeStudent = false;
  let shouldSlowDown = false;
  let shouldRepairPrerequisite = false;
  const reasons: string[] = [];
  const promptDirectives: string[] = [];

  if (input.isCalculationHeavy) {
    strategy = 'worked_example_first';
    shouldUseWorkedExample = true;
    shouldUseCalculationSteps = true;
    reasons.push('calculation-heavy section');
  }

  if (input.isDiagramHeavy) {
    strategy = strategy === 'worked_example_first' ? 'hybrid' : 'visual_first';
    shouldUseVisualExplanation = true;
    reasons.push('diagram-heavy section');
  }

  if (calculationFamilies.has(subjectFamily) && input.calculationContext) {
    strategy = strategy === 'visual_first' ? 'hybrid' : 'worked_example_first';
    shouldUseWorkedExample = true;
    shouldUseCalculationSteps = true;
    reasons.push('calculation-oriented subject family');
  }

  if (diagramFamilies.has(subjectFamily) && input.diagramContext) {
    strategy = strategy === 'worked_example_first' ? 'hybrid' : 'visual_first';
    shouldUseVisualExplanation = true;
    reasons.push('visual-oriented subject family');
  }

  if (prerequisiteIssues.length) {
    prerequisiteRepairMode = 'medium_repair';
    shouldRepairPrerequisite = true;
    shouldSlowDown = true;
    reasons.push('prerequisite issues detected');
  } else if (input.studentMemoryContext && /prerequisite/i.test(input.studentMemoryContext)) {
    prerequisiteRepairMode = 'quick_refresh';
    shouldRepairPrerequisite = true;
    reasons.push('student memory suggests prerequisite refresh');
  }

  if (weakPoints.length || misconceptions.length) {
    shouldSlowDown = true;
    reasons.push('weak points or misconceptions found');
  }

  if (signal.hiddenConfusionRisk >= 55) {
    shouldSlowDown = true;
    shouldUseAnalogy = true;
    if (input.isDiagramHeavy || input.diagramContext) {
      shouldUseVisualExplanation = true;
    }
    reasons.push('hidden confusion risk is high');
  }

  if (signal.masteryScore !== null && signal.masteryScore >= 85 && weakPoints.length <= 1 && misconceptions.length === 0) {
    pace = signal.masteryScore >= 92 ? 'fast' : 'normal';
    shouldChallengeStudent = true;
    shouldUseExamFraming = true;
    reasons.push('strong recent mastery');
  }

  if (shouldSlowDown) {
    pace = 'slow';
  } else if (signal.masteryScore !== null && signal.masteryScore >= 90) {
    pace = 'fast';
  }

  if (signal.calculationWeakness >= 35) {
    shouldUseWorkedExample = true;
    shouldUseCalculationSteps = true;
    reasons.push('calculation weakness present');
  }

  if (signal.diagramWeakness >= 35) {
    shouldUseVisualExplanation = true;
    shouldUseAnalogy = true;
    reasons.push('diagram weakness present');
  }

  if (/TEACHING_PASS_3|TEACHBACK|MEMORY_DUMP|MASTERY/i.test(input.phase)) {
    shouldUseExamFraming = true;
  }

  if (strategy === 'hybrid' && shouldUseAnalogy && !shouldUseVisualExplanation && !shouldUseWorkedExample) {
    strategy = 'analogy_first';
  }

  if (strategy === 'hybrid' && shouldUseVisualExplanation && !shouldUseWorkedExample) {
    strategy = 'visual_first';
  }

  if (strategy === 'hybrid' && shouldUseWorkedExample && !shouldUseVisualExplanation) {
    strategy = 'worked_example_first';
  }

  if (shouldUseAnalogy) {
    promptDirectives.push('Use one simple analogy if it clarifies the concept.');
  }
  if (shouldUseWorkedExample) {
    promptDirectives.push('Include a short worked example if it helps the student follow the method.');
  }
  if (shouldUseVisualExplanation) {
    promptDirectives.push('Use mental-visual explanation with clear spatial or process language.');
  }
  if (shouldUseCalculationSteps) {
    promptDirectives.push('Show calculation steps clearly and explain variables before substitution.');
  }
  if (shouldUseExamFraming) {
    promptDirectives.push('Connect the explanation to likely exam use or application.');
  }
  if (shouldSlowDown) {
    promptDirectives.push('Slow the pace and make each step explicit.');
  }
  if (shouldChallengeStudent) {
    promptDirectives.push('Slightly raise the challenge level because the student appears ready.');
  }
  if (shouldRepairPrerequisite && prerequisiteIssues.length) {
    promptDirectives.push(`Briefly repair these prerequisites first: ${prerequisiteIssues.join(', ')}.`);
  }

  return {
    strategy,
    pace,
    prerequisiteRepairMode,
    shouldUseAnalogy,
    shouldUseWorkedExample,
    shouldUseVisualExplanation,
    shouldUseCalculationSteps,
    shouldUseExamFraming,
    shouldChallengeStudent,
    shouldSlowDown,
    shouldRepairPrerequisite,
    repairConcepts: prerequisiteIssues,
    reason: reasons.join('; ') || 'default hybrid strategy',
    promptDirectives,
    traceMetadata: {
      phase: input.phase,
      section_title: input.sectionTitle,
      learning_signal: signal,
      weak_point_count: weakPoints.length,
      misconception_count: misconceptions.length,
      calculation_issue_count: calculationIssues.length,
      diagram_issue_count: diagramIssues.length,
      prerequisite_issue_count: prerequisiteIssues.length,
      lecturer_constraints_reserved: null,
    },
  };
}

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
export type AdaptiveLearnerDepth = 'FOUNDATION' | 'GUIDED' | 'STANDARD' | 'ADVANCED';

export type LearningSignal = {
  masteryScore: number | null;
  conceptUnderstanding: number;
  proceduralAccuracy: number;
  reasoningQuality: number;
  confidence: number;
  hiddenConfusionRisk: number;
  retentionRisk: number;
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
  conceptUnderstanding?: number | null;
  proceduralAccuracy?: number | null;
  reasoningQuality?: number | null;
  confidence?: number | null;
  hiddenConfusionRisk?: number | null;
  retentionRisk?: number | null;
  hiddenConfusionSignals?: string[];
  recommendedConfusionIntervention?: string;
  preferredTeachingStrategy?: TeachingStrategy | null;
  preferredPace?: TeachingPace | null;
  strategySuccessScores?: Partial<Record<TeachingStrategy, number>>;
  calculationSupportNeeded?: boolean;
  visualSupportNeeded?: boolean;
  confidenceSupportNeeded?: boolean;
  tutorSelfImprovementContext?: {
    bestStrategies: string[];
    weakStrategies: string[];
    effectiveInterventions: string[];
    ineffectiveInterventions: string[];
    recommendedStrategy?: string;
    recommendedPace?: string;
    avoidPatterns: string[];
    reason: string;
  };
  lecturerConstraintContext?: string;
  lecturerStrictness?: 'low' | 'medium' | 'high';
  requiredMethods?: string[];
  forbiddenMethods?: string[];
  assessmentFocus?: string[];
  mustCoverTopics?: string[];
  primaryObjective?: string;
  inScopeConcepts?: string[];
  previewOnlyConcepts?: string[];
  outOfScopeConcepts?: string[];
  teachingDepthPlan?: Record<string, unknown>;
  targetDepth?: 'basic' | 'standard' | 'deep';
  deferredDepthConcepts?: string[];
  isCalculationHeavy?: boolean;
  isDiagramHeavy?: boolean;
  hybridMasteryResult?: {
    passedMastery: boolean;
    prerequisiteHealthy: boolean;
    shouldAdvance: boolean;
    shouldRunRepair: boolean;
    repairConcepts: string[];
    repairReason: string;
  } | null;
};

export type TeachingDecision = {
  strategy: TeachingStrategy;
  pace: TeachingPace;
  prerequisiteRepairMode: PrerequisiteRepairMode;
  learnerDepth?: AdaptiveLearnerDepth;
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
  return Array.from(
    new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean)),
  );
}

function hasMethod(items: string[] | undefined, pattern: RegExp) {
  return uniqueItems(items).some((item) => pattern.test(item));
}

function isTeachingStrategyValue(value: string | null | undefined): value is TeachingStrategy {
  return [
    'definition_first',
    'analogy_first',
    'visual_first',
    'worked_example_first',
    'problem_first',
    'story_first',
    'exam_first',
    'hybrid',
  ].includes(String(value || ''));
}

function conceptTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4);
}

/**
 * Teacher Brain prerequisites are curriculum dependencies, not proof that this
 * particular student is weak at them. The old engine treated every listed
 * prerequisite as a student deficit, which made Pass 1 repeatedly reteach
 * background topics even when no learner evidence supported that move.
 */
function hasPrerequisiteWeaknessEvidence(
  input: TeachingDecisionInput,
  prerequisiteCandidates: string[],
) {
  if (!prerequisiteCandidates.length) return false;
  if (input.hybridMasteryResult?.shouldRunRepair) return true;
  if (input.recommendedConfusionIntervention === 'prerequisite_repair') return true;

  const explicitSignals = uniqueItems(input.hiddenConfusionSignals).join(' ').toLowerCase();
  if (/prerequisite|missing foundation|background gap|forgotten foundation/.test(explicitSignals)) {
    return true;
  }

  const learnerEvidence = [
    ...uniqueItems(input.weakPoints),
    ...uniqueItems(input.misconceptions),
    ...uniqueItems(input.calculationIssues),
    String(input.studentMemoryContext || ''),
  ]
    .join(' ')
    .toLowerCase();

  const explicitWeaknessLanguage =
    /(?:weak|struggl|confus|forgot|missing|gap|revisit|incorrect|misconception)[^.!?\n]{0,100}(?:prerequisite|foundation|background)/i.test(
      learnerEvidence,
    ) ||
    /(?:prerequisite|foundation|background)[^.!?\n]{0,100}(?:weak|struggl|confus|forgot|missing|gap|revisit|incorrect|misconception)/i.test(
      learnerEvidence,
    );
  if (explicitWeaknessLanguage) return true;

  const evidenceTokens = new Set(conceptTokens(learnerEvidence));
  return prerequisiteCandidates.some((candidate) => {
    const tokens = conceptTokens(candidate);
    if (!tokens.length) return false;
    const overlap = tokens.filter((token) => evidenceTokens.has(token)).length;
    return overlap >= Math.min(2, tokens.length) &&
      /weak|struggl|confus|forgot|missing|gap|incorrect|misconception/i.test(learnerEvidence);
  });
}

function inferLearningSignal(
  input: TeachingDecisionInput,
  prerequisiteWeaknessEvidence: boolean,
): LearningSignal {
  const weakPoints = uniqueItems(input.weakPoints);
  const misconceptions = uniqueItems(input.misconceptions);
  const calculationIssues = uniqueItems(input.calculationIssues);
  const diagramIssues = uniqueItems(input.diagramIssues);
  const prerequisiteCandidates = uniqueItems(input.prerequisiteIssues);
  const masteryScore = input.currentMasteryScore ?? input.lastMasteryScore ?? null;
  const activePrerequisiteCount = prerequisiteWeaknessEvidence
    ? prerequisiteCandidates.length
    : 0;

  const issueWeight =
    weakPoints.length * 10 +
    misconceptions.length * 12 +
    calculationIssues.length * 8 +
    diagramIssues.length * 8 +
    activePrerequisiteCount * 15;

  const baseline = masteryScore ?? 60;
  const prerequisiteWeakness = clampScore(activePrerequisiteCount * 25);
  const calculationWeakness = clampScore(
    calculationIssues.length * 20 + (input.isCalculationHeavy ? 10 : 0),
  );
  const diagramWeakness = clampScore(
    diagramIssues.length * 20 + (input.isDiagramHeavy ? 10 : 0),
  );
  const hiddenConfusionRisk = clampScore(
    input.hiddenConfusionRisk ??
      issueWeight +
        (input.isCalculationHeavy ? 8 : 0) +
        (input.isDiagramHeavy ? 8 : 0) -
        Math.max(0, baseline - 60),
  );
  const retentionRisk = clampScore(
    input.retentionRisk ??
      (100 - baseline) * 0.6 + weakPoints.length * 8 + misconceptions.length * 6,
  );

  return {
    masteryScore,
    conceptUnderstanding: clampScore(
      input.conceptUnderstanding ??
        baseline - weakPoints.length * 10 - misconceptions.length * 12,
    ),
    proceduralAccuracy: clampScore(
      input.proceduralAccuracy ??
        baseline - calculationIssues.length * 15 - activePrerequisiteCount * 10,
    ),
    reasoningQuality: clampScore(
      input.reasoningQuality ??
        baseline - misconceptions.length * 10 - weakPoints.length * 8,
    ),
    confidence: clampScore(input.confidence ?? baseline - hiddenConfusionRisk * 0.2),
    hiddenConfusionRisk,
    retentionRisk,
    calculationWeakness,
    diagramWeakness,
    prerequisiteWeakness,
  };
}

function deriveLearnerDepth(
  signal: LearningSignal,
  prerequisiteRepairRequired: boolean,
): AdaptiveLearnerDepth {
  if (
    prerequisiteRepairRequired ||
    signal.hiddenConfusionRisk >= 72 ||
    (signal.masteryScore !== null && signal.masteryScore <= 35) ||
    signal.conceptUnderstanding <= 35
  ) {
    return 'FOUNDATION';
  }

  if (
    signal.hiddenConfusionRisk >= 50 ||
    (signal.masteryScore !== null && signal.masteryScore < 60) ||
    signal.conceptUnderstanding < 60 ||
    signal.confidence < 45
  ) {
    return 'GUIDED';
  }

  if (
    signal.masteryScore !== null &&
    signal.masteryScore >= 85 &&
    signal.conceptUnderstanding >= 80 &&
    signal.reasoningQuality >= 80 &&
    signal.confidence >= 70 &&
    signal.hiddenConfusionRisk <= 30
  ) {
    return 'ADVANCED';
  }

  return 'STANDARD';
}

function addAdaptiveDepthDirectives(
  directives: string[],
  depth: AdaptiveLearnerDepth,
  input: TeachingDecisionInput,
) {
  directives.push(
    `Adaptive learner depth: ${depth}. Pass number controls lesson scope, not the student's ability level. Do not treat Pass 1 as beginner mode by itself.`,
  );

  if (depth === 'FOUNDATION') {
    directives.push(
      'Foundation depth: explain the blocking idea and important transitions clearly, but teach only prerequisites that have actual learner evidence of weakness.',
    );
  } else if (depth === 'GUIDED') {
    directives.push(
      'Guided depth: explain the important reasoning transitions and one useful example; do not restart the subject from zero.',
    );
  } else if (depth === 'ADVANCED') {
    directives.push(
      'Advanced depth: assume mastered basics, compress routine definitions and arithmetic, and spend the reply on high-value reasoning, distinctions, transfer, or exam use.',
    );
  } else {
    directives.push(
      'Standard depth: begin at the current section objective, explain the central reasoning clearly, and do not reteach background material unless learner evidence requires it.',
    );
  }

  if (/TEACHING_PASS_1|TEACHING_PASS_2/i.test(input.phase)) {
    directives.push(
      'The closing micro-question must test one specific idea from this exact pass by recall, prediction, or application. Never ask whether the idea sounds familiar, whether the student understands, whether it makes sense, or whether they are ready.',
    );
  }

  directives.push(
    'Math formatting rule: LaTeX delimiters must wrap the complete mathematical expression, never only an operator. Write \\(1 \\times 10^{-9}\\), never 1 \\(\\times\\) 10^{-9}.',
  );

  if (/scientific notation|standard form|powers? of ten|powers? of 10/i.test(input.sectionContent)) {
    directives.push(
      'Scientific-notation precision: the coefficient magnitude is at least 1 and strictly less than 10. Do not describe it ambiguously as merely being between 1 and 10.',
    );
  }
}

export function decideTeachingStrategy(input: TeachingDecisionInput): TeachingDecision {
  const weakPoints = uniqueItems(input.weakPoints);
  const misconceptions = uniqueItems(input.misconceptions);
  const calculationIssues = uniqueItems(input.calculationIssues);
  const diagramIssues = uniqueItems(input.diagramIssues);
  const prerequisiteCandidates = uniqueItems(input.prerequisiteIssues);
  const hiddenConfusionSignals = uniqueItems(input.hiddenConfusionSignals);
  const subjectFamily = String(input.subjectFamily || '').trim().toLowerCase();
  const prerequisiteWeaknessEvidence = hasPrerequisiteWeaknessEvidence(
    input,
    prerequisiteCandidates,
  );
  const signal = inferLearningSignal(input, prerequisiteWeaknessEvidence);
  const requiredMethods = uniqueItems(input.requiredMethods);
  const forbiddenMethods = uniqueItems(input.forbiddenMethods);
  const assessmentFocus = uniqueItems(input.assessmentFocus);
  const mustCoverTopics = uniqueItems(input.mustCoverTopics);
  const inScopeConcepts = uniqueItems(input.inScopeConcepts);
  const previewOnlyConcepts = uniqueItems(input.previewOnlyConcepts);
  const outOfScopeConcepts = uniqueItems(input.outOfScopeConcepts);
  const deferredDepthConcepts = uniqueItems(input.deferredDepthConcepts);
  const lecturerStrictness = input.lecturerStrictness || 'medium';
  const selfImprovement = input.tutorSelfImprovementContext;
  const hybridMasteryResult = input.hybridMasteryResult || null;

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
  const profilePreferredStrategy = input.preferredTeachingStrategy || null;
  const profilePreferredPace = input.preferredPace || null;

  if (lecturerStrictness === 'high') {
    strategy = 'definition_first';
    reasons.push('lecturer strictness is high');
  }

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

  if (hasMethod(requiredMethods, /\bproof\b/)) {
    strategy = strategy === 'worked_example_first' ? 'hybrid' : 'definition_first';
    reasons.push('lecturer requires proof-first or definition-led teaching');
  }

  if (hasMethod(requiredMethods, /\bworked example\b|\bexample\b|\bcalculation steps\b/)) {
    shouldUseWorkedExample = true;
    shouldUseCalculationSteps = true;
    if (!hasMethod(forbiddenMethods, /\bworked example\b|\bexample\b/)) {
      strategy = strategy === 'visual_first' ? 'hybrid' : 'worked_example_first';
    }
    reasons.push('lecturer requires worked examples');
  }

  if (hasMethod(requiredMethods, /\bdiagram\b|\bvisual\b|\bflowchart\b|\bgraph\b/)) {
    shouldUseVisualExplanation = true;
    reasons.push('lecturer requires diagrams or visual explanation');
  }

  if (hasMethod(forbiddenMethods, /\banalogy\b/)) {
    shouldUseAnalogy = false;
    reasons.push('lecturer forbids analogy-led teaching');
  }

  if (hasMethod(forbiddenMethods, /\bproblem first\b/)) {
    reasons.push('lecturer forbids problem-first ordering');
  }

  if (prerequisiteWeaknessEvidence) {
    prerequisiteRepairMode = 'medium_repair';
    shouldRepairPrerequisite = true;
    shouldSlowDown = true;
    reasons.push('learner evidence supports prerequisite repair');
  }

  if (weakPoints.length || misconceptions.length) {
    shouldSlowDown = true;
    reasons.push('weak points or misconceptions found');
  }

  if (signal.hiddenConfusionRisk >= 55) {
    shouldSlowDown = true;
    shouldUseAnalogy = true;
    if (input.isDiagramHeavy || input.diagramContext) shouldUseVisualExplanation = true;
    reasons.push('hidden confusion risk is elevated');
  }

  if (signal.conceptUnderstanding <= 45) {
    shouldSlowDown = true;
    shouldUseAnalogy = true;
    shouldChallengeStudent = false;
    reasons.push('low concept understanding');
  }

  if (signal.proceduralAccuracy <= 45) {
    strategy = 'worked_example_first';
    shouldUseWorkedExample = true;
    shouldUseCalculationSteps = true;
    shouldChallengeStudent = false;
    reasons.push('low procedural accuracy');
  }

  if (signal.reasoningQuality <= 45) {
    shouldSlowDown = true;
    shouldChallengeStudent = false;
    promptDirectives.push('Ask for reasoning and explain why important steps make sense.');
    reasons.push('low reasoning quality');
  }

  if (signal.confidence <= 45) {
    shouldSlowDown = true;
    shouldUseWorkedExample = true;
    shouldChallengeStudent = false;
    promptDirectives.push('Use a clear, low-friction example and structure to rebuild confidence.');
    reasons.push('low confidence');
  }

  if (signal.hiddenConfusionRisk >= 70) {
    pace = 'slow';
    shouldSlowDown = true;
    shouldChallengeStudent = false;
    if (input.isCalculationHeavy || signal.calculationWeakness >= 35) {
      shouldUseWorkedExample = true;
      shouldUseCalculationSteps = true;
    } else if (input.isDiagramHeavy || signal.diagramWeakness >= 35) {
      shouldUseVisualExplanation = true;
    } else {
      shouldUseAnalogy = true;
    }
    if (prerequisiteWeaknessEvidence) {
      prerequisiteRepairMode = 'medium_repair';
      shouldRepairPrerequisite = true;
    }
    if (input.recommendedConfusionIntervention === 'mini_example') {
      promptDirectives.push('Add one short, simpler example before moving on.');
    } else if (input.recommendedConfusionIntervention === 'visual_explanation') {
      promptDirectives.push('Add a brief mental visual to clarify the structure.');
    } else if (input.recommendedConfusionIntervention === 'prerequisite_repair') {
      promptDirectives.push('Give a short prerequisite repair before continuing.');
    } else {
      promptDirectives.push('Add one short clarification before moving on.');
    }
    reasons.push('high hidden confusion needs intervention');
  } else if (signal.hiddenConfusionRisk >= 40) {
    shouldSlowDown = true;
    if (input.recommendedConfusionIntervention === 'mini_example') {
      promptDirectives.push('Before moving on, add one short mini example.');
    } else if (input.recommendedConfusionIntervention === 'visual_explanation') {
      promptDirectives.push('Before moving on, add one short mental visual explanation.');
    }
    reasons.push('medium hidden confusion suggests a light clarification');
  }

  if (hybridMasteryResult?.shouldRunRepair) {
    prerequisiteRepairMode = 'medium_repair';
    shouldRepairPrerequisite = true;
    shouldSlowDown = true;
    shouldChallengeStudent = false;
    promptDirectives.push('Run the explicit prerequisite repair before continuing.');
    if (hybridMasteryResult.repairReason) {
      promptDirectives.push(`Repair reason: ${hybridMasteryResult.repairReason}`);
    }
    reasons.push('hybrid mastery requires prerequisite repair');
  }

  if (selfImprovement?.recommendedStrategy && isTeachingStrategyValue(selfImprovement.recommendedStrategy)) {
    const locked =
      lecturerStrictness === 'high' ||
      Boolean(hybridMasteryResult?.shouldRunRepair) ||
      input.isCalculationHeavy ||
      input.isDiagramHeavy;
    if (!locked) {
      strategy = selfImprovement.recommendedStrategy;
      reasons.push(`self-improvement context recommends ${selfImprovement.recommendedStrategy}`);
    }
    promptDirectives.push(
      `Prior outcomes suggest ${selfImprovement.recommendedStrategy} works better for this student. Use it where appropriate.`,
    );
  }

  if (selfImprovement?.recommendedPace && !shouldSlowDown) {
    if (['slow', 'normal', 'fast'].includes(selfImprovement.recommendedPace)) {
      pace = selfImprovement.recommendedPace as TeachingPace;
      reasons.push(`self-improvement context recommends ${selfImprovement.recommendedPace} pace`);
    }
  }
  if (selfImprovement?.avoidPatterns.length) {
    promptDirectives.push(`Avoid these patterns: ${selfImprovement.avoidPatterns.join(' | ')}.`);
  }

  if (profilePreferredStrategy && profilePreferredStrategy !== 'hybrid' && strategy === 'hybrid') {
    strategy = profilePreferredStrategy;
    reasons.push(`student profile prefers ${profilePreferredStrategy}`);
  }
  if (profilePreferredPace && pace === 'normal' && !shouldSlowDown) {
    pace = profilePreferredPace;
    reasons.push(`student profile prefers ${profilePreferredPace} pace`);
  }

  if (input.visualSupportNeeded) {
    shouldUseVisualExplanation = true;
    reasons.push('student profile indicates visual support is needed');
  }
  if (input.calculationSupportNeeded) {
    shouldUseWorkedExample = true;
    shouldUseCalculationSteps = true;
    reasons.push('student profile indicates calculation support is needed');
  }
  if (input.confidenceSupportNeeded) {
    shouldSlowDown = true;
    shouldChallengeStudent = false;
    reasons.push('student profile indicates confidence support is needed');
  }

  if (signal.retentionRisk >= 60) {
    shouldUseExamFraming = true;
    promptDirectives.push('Add concise recap or memory reinforcement because retention risk is high.');
    reasons.push('high retention risk');
  }

  if (assessmentFocus.length) {
    shouldUseExamFraming = true;
    promptDirectives.push(`Assessment focus to respect: ${assessmentFocus.join(', ')}.`);
    reasons.push('lecturer specified assessment focus');
  }

  if (mustCoverTopics.length) {
    promptDirectives.push(`Must cover these topics before moving on: ${mustCoverTopics.join(', ')}.`);
  }
  if (input.primaryObjective) {
    promptDirectives.push(`Primary lesson objective: ${input.primaryObjective}.`);
  }
  if (inScopeConcepts.length) {
    promptDirectives.push(`Stay within these in-scope concepts: ${inScopeConcepts.join(', ')}.`);
  }
  if (previewOnlyConcepts.length) {
    promptDirectives.push(
      `Preview-only concepts may be mentioned briefly but must not be explained: ${previewOnlyConcepts.join(', ')}.`,
    );
  }
  if (outOfScopeConcepts.length) {
    promptDirectives.push(`Do not expand into these out-of-scope concepts: ${outOfScopeConcepts.join(', ')}.`);
  }
  if (deferredDepthConcepts.length) {
    promptDirectives.push(
      `Do not explain these deferred-depth concepts yet: ${deferredDepthConcepts.join(', ')}.`,
    );
  }

  if (
    signal.masteryScore !== null &&
    signal.masteryScore >= 85 &&
    weakPoints.length <= 1 &&
    misconceptions.length === 0 &&
    !prerequisiteWeaknessEvidence
  ) {
    pace = signal.masteryScore >= 92 ? 'fast' : 'normal';
    shouldChallengeStudent = true;
    shouldUseExamFraming = true;
    reasons.push('strong recent mastery');
  }

  if (shouldSlowDown) {
    pace = 'slow';
  } else if (
    signal.masteryScore !== null &&
    signal.masteryScore >= 90 &&
    signal.conceptUnderstanding >= 80 &&
    signal.proceduralAccuracy >= 80 &&
    signal.reasoningQuality >= 80 &&
    signal.confidence >= 75 &&
    signal.hiddenConfusionRisk <= 35 &&
    signal.retentionRisk <= 40
  ) {
    pace = 'fast';
  }

  if (lecturerStrictness === 'high' && pace === 'fast') pace = 'normal';

  if (profilePreferredStrategy === 'analogy_first' && strategy === 'worked_example_first') {
    shouldUseAnalogy = true;
  }
  if (profilePreferredStrategy === 'visual_first' && strategy === 'worked_example_first') {
    shouldUseVisualExplanation = true;
  }
  if (profilePreferredStrategy === 'worked_example_first' && strategy === 'visual_first') {
    shouldUseWorkedExample = true;
  }

  const strongAcrossDimensions =
    signal.conceptUnderstanding >= 85 &&
    signal.proceduralAccuracy >= 85 &&
    signal.reasoningQuality >= 85 &&
    signal.confidence >= 80 &&
    signal.hiddenConfusionRisk <= 30 &&
    signal.retentionRisk <= 35;
  if (input.confidenceSupportNeeded && !strongAcrossDimensions) shouldChallengeStudent = false;

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

  // Apply lecturer prohibitions last because profile and self-improvement signals can
  // change the strategy after the initial lecturer-constraint pass.
  if (hasMethod(forbiddenMethods, /\banalogy\b/)) {
    shouldUseAnalogy = false;
    if (strategy === 'analogy_first') {
      strategy = shouldUseWorkedExample ? 'worked_example_first' : 'definition_first';
    }
  }
  if (hasMethod(forbiddenMethods, /\bproblem first\b/) && strategy === 'problem_first') {
    strategy = 'definition_first';
  }

  if (shouldUseAnalogy) promptDirectives.push('Use one simple analogy only if it clarifies the concept.');
  if (shouldUseWorkedExample) promptDirectives.push('Include a short worked example if it helps the student follow the method.');
  if (shouldUseVisualExplanation) promptDirectives.push('Use mental-visual explanation with clear spatial or process language.');
  if (shouldUseCalculationSteps) promptDirectives.push('Show calculation steps clearly and explain variables before substitution.');
  if (shouldUseExamFraming) promptDirectives.push('Connect the explanation to likely exam use or application.');
  if (shouldSlowDown) promptDirectives.push('Slow the pace and make the important transitions explicit.');
  if (shouldChallengeStudent) promptDirectives.push('Slightly raise the challenge level because the student appears ready.');

  const repairConcepts = hybridMasteryResult?.repairConcepts?.length
    ? uniqueItems(hybridMasteryResult.repairConcepts)
    : prerequisiteWeaknessEvidence
      ? prerequisiteCandidates
      : [];

  if (shouldRepairPrerequisite && repairConcepts.length) {
    promptDirectives.push(`Briefly repair these prerequisites first: ${repairConcepts.join(', ')}.`);
  } else if (prerequisiteCandidates.length) {
    promptDirectives.push(
      `Known curriculum prerequisites (not proven weaknesses): ${prerequisiteCandidates.join(', ')}. Do not reteach them unless the student's work shows a gap.`,
    );
  }

  if (input.lecturerConstraintContext) {
    promptDirectives.push(
      'Respect lecturer constraints above soft personalization preferences when they conflict.',
    );
  }

  const learnerDepth = deriveLearnerDepth(signal, shouldRepairPrerequisite);
  addAdaptiveDepthDirectives(promptDirectives, learnerDepth, input);

  return {
    strategy,
    pace,
    prerequisiteRepairMode,
    learnerDepth,
    shouldUseAnalogy,
    shouldUseWorkedExample,
    shouldUseVisualExplanation,
    shouldUseCalculationSteps,
    shouldUseExamFraming,
    shouldChallengeStudent,
    shouldSlowDown,
    shouldRepairPrerequisite,
    repairConcepts,
    reason:
      [reasons.join('; '), hybridMasteryResult?.repairReason || ''].filter(Boolean).join('; ') ||
      'default adaptive strategy',
    promptDirectives,
    traceMetadata: {
      phase: input.phase,
      section_title: input.sectionTitle,
      learning_signal: signal,
      learner_depth: learnerDepth,
      prerequisite_weakness_evidence: prerequisiteWeaknessEvidence,
      prerequisite_candidate_count: prerequisiteCandidates.length,
      weak_point_count: weakPoints.length,
      misconception_count: misconceptions.length,
      calculation_issue_count: calculationIssues.length,
      diagram_issue_count: diagramIssues.length,
      hidden_confusion_signal_count: hiddenConfusionSignals.length,
      recommended_confusion_intervention: input.recommendedConfusionIntervention || 'none',
      hybrid_mastery_result: hybridMasteryResult,
      retention_risk: signal.retentionRisk,
      preferred_teaching_strategy: profilePreferredStrategy,
      preferred_pace: profilePreferredPace,
      lecturer_strictness: lecturerStrictness,
      self_improvement_used: Boolean(selfImprovement),
      self_improvement_recommended_strategy: selfImprovement?.recommendedStrategy || null,
      self_improvement_recommended_pace: selfImprovement?.recommendedPace || null,
      avoid_patterns_count: selfImprovement?.avoidPatterns.length || 0,
      effective_interventions_count: selfImprovement?.effectiveInterventions.length || 0,
      required_method_count: requiredMethods.length,
      forbidden_method_count: forbiddenMethods.length,
      assessment_focus_count: assessmentFocus.length,
      must_cover_topic_count: mustCoverTopics.length,
      in_scope_count: inScopeConcepts.length,
      preview_only_count: previewOnlyConcepts.length,
      out_of_scope_count: outOfScopeConcepts.length,
      primary_objective: input.primaryObjective || null,
      target_depth: input.targetDepth || null,
      deferred_depth_count: deferredDepthConcepts.length,
      lecturer_constraints_reserved: null,
    },
  };
}

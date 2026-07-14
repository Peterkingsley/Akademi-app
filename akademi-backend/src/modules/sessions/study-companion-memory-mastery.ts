import {
  TeachingDecision,
  TeachingPace,
  TeachingStrategy,
} from './teaching-decision-engine';
import {
  RoadmapSection,
  TeacherBrainSectionContext,
  CalculationTeachingContext,
  DiagramTeachingContext,
  StudentMemoryRecord,
  StudySectionLessonPlanRecord,
  StudentMemoryContext,
  StudentMaterialMemoryRow,
  TeachingReflectionRecord,
  LearningIntelligenceRecordRow,
  LearningIntelligenceContext,
  HybridMasteryResult,
} from './study-companion.types';
import {
  truncate,
  truncateList,
  safeStringArray,
} from './study-companion-teacher-brain';
import {
  safeJsonObject,
  normalizeText,
} from './study-companion-prompt-directives';

export function parseStudentMemoryRecord(value: {
  understood?: unknown;
  weak_points?: unknown;
  misconceptions?: unknown;
  calculation_issues?: unknown;
  diagram_issues?: unknown;
  preferred_explanation_style?: string | null;
  revisit_later?: unknown;
  compressed_summary?: string | null;
}): StudentMemoryRecord {
  return {
    understood: safeStringArray(value.understood),
    weakPoints: safeStringArray(value.weak_points),
    misconceptions: safeStringArray(value.misconceptions),
    calculationIssues: safeStringArray(value.calculation_issues),
    diagramIssues: safeStringArray(value.diagram_issues),
    preferredExplanationStyle: value.preferred_explanation_style || null,
    revisitLater: safeStringArray(value.revisit_later),
    compressedSummary: value.compressed_summary || null,
  };
}

export function buildStudentMemoryPromptContext(
  previousSectionMemory: StudentMemoryRecord | null,
  priorMemories: StudentMemoryRecord[],
) {
  const aggregateWeakPoints = truncateList(
    priorMemories.flatMap((item) => item.weakPoints),
    6,
    100,
  );
  const aggregateCalculationIssues = truncateList(
    priorMemories.flatMap((item) => item.calculationIssues),
    5,
    100,
  );
  const aggregateDiagramIssues = truncateList(
    priorMemories.flatMap((item) => item.diagramIssues),
    5,
    100,
  );
  const aggregateRevisit = truncateList(
    priorMemories.flatMap((item) => item.revisitLater),
    6,
    100,
  );
  const preferredStyles = truncateList(
    priorMemories
      .map((item) => item.preferredExplanationStyle || '')
      .filter(Boolean),
    3,
    80,
  );

  const lines: string[] = [];
  if (previousSectionMemory?.compressedSummary) {
    lines.push(
      `Previous section memory: ${truncate(previousSectionMemory.compressedSummary, 180)}`,
    );
  }
  if (aggregateWeakPoints.length) {
    lines.push(
      `Earlier weak points to watch: ${aggregateWeakPoints.join(' | ')}`,
    );
  }
  if (aggregateCalculationIssues.length) {
    lines.push(
      `Earlier calculation issues: ${aggregateCalculationIssues.join(' | ')}`,
    );
  }
  if (aggregateDiagramIssues.length) {
    lines.push(`Earlier diagram issues: ${aggregateDiagramIssues.join(' | ')}`);
  }
  if (aggregateRevisit.length) {
    lines.push(`Revisit later list: ${aggregateRevisit.join(' | ')}`);
  }
  if (preferredStyles.length) {
    lines.push(
      `Preferred explanation style cues: ${preferredStyles.join(' | ')}`,
    );
  }
  return lines.join('\n');
}

export function buildDeterministicStudentMemoryFallback(args: {
  score: number;
  passed: boolean;
  failedConcepts: string[];
  calculationContext: CalculationTeachingContext;
  diagramContext: DiagramTeachingContext;
  sectionTitle: string;
}) {
  return {
    understood: args.passed
      ? [`Core ideas from ${args.sectionTitle} were recalled well.`]
      : [],
    weak_points: truncateList(args.failedConcepts, 5, 120),
    misconceptions: [],
    calculation_issues: args.calculationContext.detected
      ? truncateList(args.calculationContext.commonMistakes, 4, 100)
      : [],
    diagram_issues: args.diagramContext.detected
      ? truncateList(
          args.diagramContext.diagrams.flatMap(
            (item) => item.student_should_notice || [],
          ),
          4,
          100,
        )
      : [],
    preferred_explanation_style: args.calculationContext.detected
      ? 'Step-by-step formula explanation with careful substitution.'
      : args.diagramContext.detected
        ? 'Clear verbal visualization using simple spatial language.'
        : 'Short, structured explanation with one idea at a time.',
    revisit_later: args.passed ? [] : truncateList(args.failedConcepts, 4, 100),
    compressed_summary: args.passed
      ? `${args.sectionTitle} is mostly understood, but keep reinforcing application in later sections.`
      : `${args.sectionTitle} still needs support around ${truncateList(args.failedConcepts, 3, 80).join(', ') || 'core ideas'}.`,
  };
}

export function clampReflectionScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function parseTeachingReflectionRecord(value: {
  concept_understanding?: number | null;
  procedural_accuracy?: number | null;
  reasoning_quality?: number | null;
  confidence?: number | null;
  hidden_confusion_risk?: number | null;
  what_worked?: unknown;
  what_failed?: unknown;
  recommended_next_strategy?: string | null;
  recommended_next_pace?: string | null;
  recommended_interventions?: unknown;
  compressed_reflection?: string | null;
}): TeachingReflectionRecord {
  return {
    conceptUnderstanding: clampReflectionScore(
      Number(value.concept_understanding ?? 0),
    ),
    proceduralAccuracy: clampReflectionScore(
      Number(value.procedural_accuracy ?? 0),
    ),
    reasoningQuality: clampReflectionScore(
      Number(value.reasoning_quality ?? 0),
    ),
    confidence: clampReflectionScore(Number(value.confidence ?? 0)),
    hiddenConfusionRisk: clampReflectionScore(
      Number(value.hidden_confusion_risk ?? 0),
    ),
    whatWorked: safeStringArray(value.what_worked),
    whatFailed: safeStringArray(value.what_failed),
    recommendedNextStrategy: value.recommended_next_strategy
      ? String(value.recommended_next_strategy)
      : null,
    recommendedNextPace: value.recommended_next_pace
      ? String(value.recommended_next_pace)
      : null,
    recommendedInterventions: safeStringArray(value.recommended_interventions),
    compressedReflection: value.compressed_reflection
      ? String(value.compressed_reflection)
      : null,
  };
}

export function buildDeterministicTeachingReflectionFallback(args: {
  score: number;
  passed: boolean;
  failedConcepts: string[];
  decision: TeachingDecision;
  calculationContext: CalculationTeachingContext;
  diagramContext: DiagramTeachingContext;
  studentMemoryContext: StudentMemoryContext;
  sectionTitle: string;
}) {
  const confidencePenalty =
    args.failedConcepts.length * 8 + (args.passed ? 0 : 10);
  const proceduralPenalty = args.calculationContext.detected
    ? Math.max(
        8,
        args.studentMemoryContext.priorMemories.flatMap(
          (item) => item.calculationIssues,
        ).length * 6,
      )
    : 0;
  const conceptUnderstanding = clampReflectionScore(args.score);
  const proceduralAccuracy = clampReflectionScore(
    args.score - proceduralPenalty,
  );
  const reasoningQuality = clampReflectionScore(
    args.score - args.failedConcepts.length * 6,
  );
  const confidence = clampReflectionScore(args.score - confidencePenalty);
  const hiddenConfusionRisk = clampReflectionScore(
    (args.passed ? 25 : 55) +
      args.failedConcepts.length * 8 +
      (args.score < 85 ? 10 : 0) +
      (args.studentMemoryContext.priorMemories.flatMap(
        (item) => item.weakPoints,
      ).length > 0
        ? 8
        : 0),
  );

  const whatWorked = [
    args.decision.shouldUseWorkedExample
      ? 'Worked example structure supported understanding.'
      : '',
    args.decision.shouldUseVisualExplanation
      ? 'Visual-style explanation helped with mental organization.'
      : '',
    args.decision.shouldUseAnalogy
      ? 'Analogy-based framing improved initial grasp.'
      : '',
    args.passed
      ? `The section ${args.sectionTitle} reached a usable mastery level.`
      : '',
  ].filter(Boolean);

  const whatFailed = [
    ...truncateList(args.failedConcepts, 4, 100),
    args.calculationContext.detected &&
    proceduralAccuracy < conceptUnderstanding
      ? 'Procedural calculation accuracy remained weaker than concept recall.'
      : '',
    args.diagramContext.detected && hiddenConfusionRisk >= 55
      ? 'Visual relationships likely still need reinforcement.'
      : '',
  ].filter(Boolean);

  return {
    concept_understanding: conceptUnderstanding,
    procedural_accuracy: proceduralAccuracy,
    reasoning_quality: reasoningQuality,
    confidence,
    hidden_confusion_risk: hiddenConfusionRisk,
    what_worked: truncateList(whatWorked, 5, 120),
    what_failed: truncateList(whatFailed, 5, 120),
    recommended_next_strategy: args.failedConcepts.length
      ? 'worked_example_first'
      : args.decision.strategy,
    recommended_next_pace:
      hiddenConfusionRisk >= 55 ? 'slow' : args.decision.pace,
    recommended_interventions: truncateList(
      [
        args.decision.shouldRepairPrerequisite
          ? 'Add a short prerequisite refresh before the next related section.'
          : '',
        args.calculationContext.detected
          ? 'Reinforce calculation steps with one compact example.'
          : '',
        args.diagramContext.detected
          ? 'Use clearer verbal visualization for the next related topic.'
          : '',
      ].filter(Boolean),
      4,
      120,
    ),
    compressed_reflection: args.passed
      ? `${args.sectionTitle} responded reasonably well to ${args.decision.strategy} at ${args.decision.pace} pace, but keep watching ${truncateList(args.failedConcepts, 2, 80).join(', ') || 'application depth'}.`
      : `${args.sectionTitle} did not respond strongly enough to ${args.decision.strategy}; the next attempt should slow down and target ${truncateList(args.failedConcepts, 3, 80).join(', ') || 'the missing ideas'}.`,
  };
}

export function estimateHiddenConfusionRisk(args: {
  sectionTitle: string;
  sectionContent: string;
  masteryScore: number;
  masteryThreshold: number;
  teachBackAttempts: Array<{
    student_response: string;
    evaluation: string;
    score: number;
  }>;
  memoryDumpEvaluation: {
    studentResponse: string;
    evaluation: string;
    score: number;
  };
  failedConcepts: string[];
  studentMemoryContext: StudentMemoryContext;
  latestStudentMemory?: StudentMaterialMemoryRow | null;
  latestLearningIntelligenceContext?: LearningIntelligenceContext | null;
  traceQualityIssues?: string[];
  calculationContext: CalculationTeachingContext;
  diagramContext: DiagramTeachingContext;
}) {
  console.log('hidden_confusion_estimation_started', {
    sectionTitle: args.sectionTitle,
    masteryScore: args.masteryScore,
    attemptCount: args.teachBackAttempts.length,
  });

  let risk = 0;
  const signals: string[] = [];
  const latestMemory = args.latestStudentMemory
    ? parseStudentMemoryRecord(args.latestStudentMemory)
    : null;
  const averageTeachBack =
    args.teachBackAttempts.length > 0
      ? Math.round(
          args.teachBackAttempts.reduce(
            (sum, attempt) => sum + attempt.score,
            0,
          ) / args.teachBackAttempts.length,
        )
      : args.masteryScore;
  const memoryGap = averageTeachBack - args.memoryDumpEvaluation.score;
  const shortTeachBack = args.teachBackAttempts.some(
    (attempt) =>
      attempt.student_response.trim().split(/\s+/).filter(Boolean).length < 18,
  );
  const affirmativeOnly = args.teachBackAttempts.some((attempt) =>
    /^(yes|okay|ok|understood|i understand|alright)$/i.test(
      attempt.student_response.trim(),
    ),
  );
  const copiedWording = args.teachBackAttempts.some((attempt) => {
    const response = normalizeText(attempt.student_response).toLowerCase();
    if (response.length < 40) return false;
    return normalizeText(args.sectionContent)
      .toLowerCase()
      .includes(response.slice(0, Math.min(response.length, 140)));
  });
  const repeatedWeakPoints = args.studentMemoryContext.priorMemories
    .flatMap((item) => [...item.weakPoints, ...item.misconceptions])
    .filter((point) =>
      args.failedConcepts.some((failed) => conceptMatches(point, failed)),
    );
  const repeatedCalculationIssues =
    args.studentMemoryContext.priorMemories.flatMap(
      (item) => item.calculationIssues,
    );
  const repeatedDiagramIssues = args.studentMemoryContext.priorMemories.flatMap(
    (item) => item.diagramIssues,
  );

  if (shortTeachBack) {
    risk += 12;
    signals.push('Teach-back answer was very short.');
  }
  if (args.masteryScore <= args.masteryThreshold + 5) {
    risk += 10;
    signals.push('Mastery score only barely passed.');
  }
  if (memoryGap >= 15) {
    risk += 14;
    signals.push('Memory dump was much weaker than teach-back.');
  }
  if (args.failedConcepts.length) {
    risk += Math.min(20, args.failedConcepts.length * 6);
    signals.push(
      `Failed concepts still present: ${truncateList(args.failedConcepts, 3, 80).join(', ')}.`,
    );
  }
  if (repeatedWeakPoints.length) {
    risk += 10;
    signals.push('Some weak concepts have repeated from earlier sections.');
  }
  if ((args.latestLearningIntelligenceContext?.confidence ?? 100) <= 45) {
    risk += 12;
    signals.push('Confidence signal is low.');
  }
  if ((args.latestLearningIntelligenceContext?.retentionRisk ?? 0) >= 65) {
    risk += 10;
    signals.push('Retention risk is already high.');
  }
  if ((args.traceQualityIssues || []).length >= 2) {
    risk += 8;
    signals.push('Recent tutor quality issues may have reduced clarity.');
  }
  if (
    repeatedCalculationIssues.length >= 2 ||
    (args.calculationContext.detected && latestMemory?.calculationIssues.length)
  ) {
    risk += 10;
    signals.push('Calculation issues are recurring.');
  }
  if (
    repeatedDiagramIssues.length >= 2 ||
    (args.diagramContext.detected && latestMemory?.diagramIssues.length)
  ) {
    risk += 10;
    signals.push('Diagram or visual interpretation issues are recurring.');
  }
  if (affirmativeOnly) {
    risk += 12;
    signals.push(
      'Student gave a very brief confirmation without demonstrating understanding.',
    );
  }
  if (copiedWording) {
    risk += 10;
    signals.push(
      'Student response echoed the material wording without enough explanation.',
    );
  }
  if (args.teachBackAttempts.length > 1) {
    risk += 10;
    signals.push('Student needed multiple attempts before moving forward.');
  }
  // TODO: incorporate response latency / hesitation once reliable timing data is available.

  const clampedRisk = clampReflectionScore(risk);
  const level: 'low' | 'medium' | 'high' =
    clampedRisk >= 70 ? 'high' : clampedRisk >= 40 ? 'medium' : 'low';
  const recommendedIntervention =
    level === 'high'
      ? args.calculationContext.detected
        ? 'mini_example'
        : args.diagramContext.detected
          ? 'visual_explanation'
          : args.failedConcepts.some((item) =>
                /prerequisite|basic|foundation|prior|background/i.test(item),
              )
            ? 'prerequisite_repair'
            : 'slow_down'
      : level === 'medium'
        ? args.diagramContext.detected
          ? 'visual_explanation'
          : args.calculationContext.detected
            ? 'mini_example'
            : 'short_clarification'
        : 'none';

  const result = {
    risk: clampedRisk,
    level,
    signals: truncateList(signals, 6, 140),
    recommendedIntervention,
  } as const;

  console.log('hidden_confusion_estimation_completed', {
    sectionTitle: args.sectionTitle,
    risk: result.risk,
    level: result.level,
    recommendedIntervention: result.recommendedIntervention,
    signals: result.signals,
  });
  return result;
}

export function parseLearningIntelligenceContext(
  value: LearningIntelligenceRecordRow,
): LearningIntelligenceContext {
  const evidence = safeJsonObject<{
    main_reason?: string;
    signals?: unknown;
    hidden_confusion_level?: string;
    hidden_confusion_signals?: unknown;
    recommended_confusion_intervention?: string;
  }>(value.evidence, {});
  return {
    masteryScore: value.mastery_score ?? null,
    conceptUnderstanding: clampReflectionScore(value.concept_understanding),
    proceduralAccuracy: clampReflectionScore(value.procedural_accuracy),
    reasoningQuality: clampReflectionScore(value.reasoning_quality),
    confidence: clampReflectionScore(value.confidence),
    hiddenConfusionRisk: clampReflectionScore(value.hidden_confusion_risk),
    hiddenConfusionLevel:
      String(evidence.hidden_confusion_level || '')
        .trim()
        .toLowerCase() === 'high'
        ? 'high'
        : String(evidence.hidden_confusion_level || '')
              .trim()
              .toLowerCase() === 'medium'
          ? 'medium'
          : 'low',
    hiddenConfusionSignals: safeStringArray(evidence.hidden_confusion_signals),
    recommendedConfusionIntervention: [
      'none',
      'slow_down',
      'short_clarification',
      'prerequisite_repair',
      'mini_example',
      'visual_explanation',
    ].includes(String(evidence.recommended_confusion_intervention || ''))
      ? (String(
          evidence.recommended_confusion_intervention,
        ) as LearningIntelligenceContext['recommendedConfusionIntervention'])
      : 'none',
    retentionRisk: clampReflectionScore(value.retention_risk),
    calculationWeakness: Boolean(value.calculation_weakness),
    diagramWeakness: Boolean(value.diagram_weakness),
    prerequisiteWeakness: Boolean(value.prerequisite_weakness),
    recommendedAction: value.recommended_action || null,
    evidence: {
      mainReason: evidence.main_reason ? String(evidence.main_reason) : null,
      signals: safeStringArray(evidence.signals),
    },
  };
}

export function inferPrerequisiteWeaknessFromFailedConcepts(
  failedConcepts: string[],
) {
  return failedConcepts.some((item) =>
    /\bprerequisite\b|\bbasic\b|\bfoundation\b|\bprior\b|\bbackground\b/i.test(
      item,
    ),
  );
}

export function normalizeConceptKey(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function conceptMatches(a: string, b: string) {
  const left = normalizeConceptKey(a);
  const right = normalizeConceptKey(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export function uniqueConcepts(items: string[]) {
  return Array.from(
    new Set(items.map((item) => normalizeConceptKey(item)).filter(Boolean)),
  );
}

export function hasRelevantConceptMatch(
  targets: string[],
  candidates: string[],
) {
  return targets.some((target) =>
    candidates.some((candidate) => conceptMatches(target, candidate)),
  );
}

export function buildCriticalPrerequisiteConcepts(args: {
  nextTeacherBrainSectionContext: TeacherBrainSectionContext | null;
  nextLessonPlan: StudySectionLessonPlanRecord | null;
}) {
  const concepts = [
    ...(args.nextTeacherBrainSectionContext?.prerequisites || []).map((item) =>
      String(item.concept || '').trim(),
    ),
    ...(args.nextLessonPlan?.prerequisiteRefresh || []),
  ];
  return uniqueConcepts(concepts).slice(0, 6);
}

export function isRepairRiskAcceptable(args: {
  repairConcepts: string[];
  learningIntelligenceContext?: LearningIntelligenceContext | null;
}) {
  const hiddenConfusionRisk =
    args.learningIntelligenceContext?.hiddenConfusionRisk ?? 50;
  const conceptUnderstanding =
    args.learningIntelligenceContext?.conceptUnderstanding ?? 50;
  return (
    args.repairConcepts.length <= 1 &&
    hiddenConfusionRisk <= 70 &&
    conceptUnderstanding >= 45
  );
}

export function evaluateHybridMastery(args: {
  masteryScore: number;
  masteryThreshold: number;
  failedConcepts: string[];
  currentSection: RoadmapSection;
  nextSection: RoadmapSection | null;
  nextTeacherBrainSectionContext: TeacherBrainSectionContext | null;
  nextLessonPlan: StudySectionLessonPlanRecord | null;
  teacherBrainSectionContext: TeacherBrainSectionContext;
  studentMemoryContext: StudentMemoryContext;
  learningIntelligenceContext?: LearningIntelligenceContext | null;
}): HybridMasteryResult {
  console.log('hybrid_mastery_started', {
    sectionTitle: args.currentSection.title,
    nextSectionTitle: args.nextSection?.title || null,
    masteryScore: args.masteryScore,
    masteryThreshold: args.masteryThreshold,
  });

  const passedMastery = args.masteryScore >= args.masteryThreshold;
  if (!passedMastery) {
    console.log('hybrid_mastery_failed', {
      sectionTitle: args.currentSection.title,
      masteryScore: args.masteryScore,
      masteryThreshold: args.masteryThreshold,
    });
    return {
      passedMastery: false,
      prerequisiteHealthy: false,
      shouldAdvance: false,
      shouldRunRepair: false,
      repairConcepts: [],
      repairReason: 'Overall mastery is below the required threshold.',
    };
  }

  const criticalPrerequisites = buildCriticalPrerequisiteConcepts({
    nextTeacherBrainSectionContext: args.nextTeacherBrainSectionContext,
    nextLessonPlan: args.nextLessonPlan,
  });

  if (!args.nextSection || !criticalPrerequisites.length) {
    console.log('hybrid_mastery_passed', {
      sectionTitle: args.currentSection.title,
      masteryScore: args.masteryScore,
      prerequisiteHealthy: true,
      reason: 'No critical prerequisites detected for the next section.',
    });
    return {
      passedMastery: true,
      prerequisiteHealthy: true,
      shouldAdvance: true,
      shouldRunRepair: false,
      repairConcepts: [],
      repairReason: '',
    };
  }

  const priorWeakPoints = [
    ...(args.studentMemoryContext.previousSectionMemory?.weakPoints || []),
    ...(args.studentMemoryContext.previousSectionMemory?.misconceptions || []),
    ...args.studentMemoryContext.priorMemories.flatMap(
      (item) => item.weakPoints,
    ),
    ...args.studentMemoryContext.priorMemories.flatMap(
      (item) => item.misconceptions,
    ),
  ];
  const currentPrerequisiteSignals =
    args.teacherBrainSectionContext.prerequisites
      .map((item) => String(item.concept || '').trim())
      .filter(Boolean);
  const repairConcepts = criticalPrerequisites.filter((concept) =>
    hasRelevantConceptMatch(
      [concept],
      [
        ...args.failedConcepts,
        ...priorWeakPoints,
        ...currentPrerequisiteSignals,
      ],
    ),
  );

  const prerequisiteWeaknessFlag = Boolean(
    args.learningIntelligenceContext?.prerequisiteWeakness,
  );
  const hiddenConfusionHigh =
    (args.learningIntelligenceContext?.hiddenConfusionRisk ?? 0) >= 70;
  const conceptUnderstandingLow =
    (args.learningIntelligenceContext?.conceptUnderstanding ?? 100) < 50;
  const prerequisiteHealthy =
    repairConcepts.length === 0 &&
    !prerequisiteWeaknessFlag &&
    !hiddenConfusionHigh &&
    !conceptUnderstandingLow;

  if (prerequisiteHealthy) {
    console.log('hybrid_mastery_passed', {
      sectionTitle: args.currentSection.title,
      masteryScore: args.masteryScore,
      prerequisiteHealthy: true,
      criticalPrerequisiteCount: criticalPrerequisites.length,
    });
    return {
      passedMastery: true,
      prerequisiteHealthy: true,
      shouldAdvance: true,
      shouldRunRepair: false,
      repairConcepts: [],
      repairReason: '',
    };
  }

  const narrowedRepairConcepts = repairConcepts.length
    ? repairConcepts
    : criticalPrerequisites.slice(0, Math.min(2, criticalPrerequisites.length));
  const repairReason = `Mastery passed, but the next section depends on ${narrowedRepairConcepts.join(', ')} and those prerequisites still look weak.`;
  console.log('hybrid_mastery_repair_required', {
    sectionTitle: args.currentSection.title,
    nextSectionTitle: args.nextSection.title,
    masteryScore: args.masteryScore,
    repairConcepts: narrowedRepairConcepts,
    prerequisiteWeaknessFlag,
    hiddenConfusionHigh,
    conceptUnderstandingLow,
  });
  return {
    passedMastery: true,
    prerequisiteHealthy: false,
    shouldAdvance: false,
    shouldRunRepair: true,
    repairConcepts: narrowedRepairConcepts,
    repairReason,
  };
}

export function isTeachingStrategy(
  value: string | null | undefined,
): value is TeachingStrategy {
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

export function isTeachingPace(
  value: string | null | undefined,
): value is TeachingPace {
  return ['slow', 'normal', 'fast'].includes(String(value || ''));
}

export function isPrerequisiteRepairMode(
  value: string | null | undefined,
): value is TeachingDecision['prerequisiteRepairMode'] {
  return ['none', 'quick_refresh', 'medium_repair', 'full_reteach'].includes(
    String(value || ''),
  );
}

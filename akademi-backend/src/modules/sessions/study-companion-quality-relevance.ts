import {
  RoadmapSection,
  CalculationTeachingContext,
  DiagramTeachingContext,
  StudySectionLessonPlanRecord,
  TutorMessageQualityResult,
  TutorMessageQualityArgs,
  LecturerConstraintRecord,
  LecturerConstraintContext,
} from './study-companion.types';
import {
  safeJsonObject,
  normalizeText,
  buildDeterministicTeachbackPrompt,
  estimateConceptLoad,
  sentenceContainsConcept,
  detectScopeViolation,
  detectDepthViolation,
  PASS_1,
  PASS_2,
  PASS_3,
} from './study-companion-prompt-directives';
import {
  trimAfterFirstQuestion,
  sanitizeSingleQuestionTurn,
  removeAccidentalTeachingQuestions,
  truncate,
  truncateToSentence,
  truncateList,
  safeStringArray,
  hasMathNotation,
} from './study-companion-teacher-brain';
import { aiProvider } from '../ai/ai.provider';

export function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || !b.length) return 0;
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  if (!magnitudeA || !magnitudeB) return 0;
  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

export function parseEmbeddingVector(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
    : [];
}

export function normalizeConstraintStrictness(
  value: string | null | undefined,
): 'low' | 'medium' | 'high' {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'low' || normalized === 'high') return normalized;
  return 'medium';
}

export function parseLecturerConstraintContext(
  constraints: LecturerConstraintRecord[],
): LecturerConstraintContext {
  const activeConstraints = constraints.filter(
    (item) => item.is_active !== false,
  );
  const strictness = activeConstraints.reduce<'low' | 'medium' | 'high'>(
    (current, item) => {
      const next = normalizeConstraintStrictness(item.strictness);
      if (next === 'high' || current === 'high') return 'high';
      if (next === 'medium' || current === 'medium') return 'medium';
      return 'low';
    },
    'low',
  );

  const requiredOrder = truncateList(
    activeConstraints.flatMap((item) => safeStringArray(item.required_order)),
    6,
    110,
  );
  const mustCoverTopics = truncateList(
    activeConstraints.flatMap((item) =>
      safeStringArray(item.must_cover_topics),
    ),
    8,
    110,
  );
  const doNotSkipTopics = truncateList(
    activeConstraints.flatMap((item) =>
      safeStringArray(item.do_not_skip_topics),
    ),
    8,
    110,
  );
  const requiredMethods = truncateList(
    activeConstraints.flatMap((item) => safeStringArray(item.required_methods)),
    6,
    110,
  );
  const forbiddenMethods = truncateList(
    activeConstraints.flatMap((item) =>
      safeStringArray(item.forbidden_methods),
    ),
    6,
    110,
  );
  const assessmentFocus = truncateList(
    activeConstraints.flatMap((item) => safeStringArray(item.assessment_focus)),
    6,
    110,
  );
  const terminology = activeConstraints
    .flatMap((item) => {
      const source = safeJsonObject<Record<string, unknown>>(
        item.preferred_terminology,
        {},
      );
      return Object.entries(source)
        .map(([key, value]) => `${key}: ${String(value || '').trim()}`.trim())
        .filter((entry) => !entry.endsWith(':'));
    })
    .slice(0, 6);
  const policies = truncateList(
    activeConstraints.flatMap((item) =>
      [
        item.unit_policy ? `Unit policy: ${item.unit_policy}` : '',
        item.proof_policy ? `Proof policy: ${item.proof_policy}` : '',
        item.calculation_policy
          ? `Calculation policy: ${item.calculation_policy}`
          : '',
        item.diagram_policy ? `Diagram policy: ${item.diagram_policy}` : '',
      ].filter(Boolean),
    ),
    6,
    120,
  );

  const lines = [
    requiredOrder.length ? `Required order: ${requiredOrder.join(' | ')}` : '',
    mustCoverTopics.length
      ? `Must-cover topics: ${mustCoverTopics.join(' | ')}`
      : '',
    doNotSkipTopics.length
      ? `Do-not-skip topics: ${doNotSkipTopics.join(' | ')}`
      : '',
    terminology.length
      ? `Preferred terminology: ${terminology.join(' | ')}`
      : '',
    requiredMethods.length
      ? `Required methods: ${requiredMethods.join(' | ')}`
      : '',
    forbiddenMethods.length
      ? `Forbidden methods: ${forbiddenMethods.join(' | ')}`
      : '',
    assessmentFocus.length
      ? `Assessment focus: ${assessmentFocus.join(' | ')}`
      : '',
    policies.length ? `Policies: ${policies.join(' | ')}` : '',
    activeConstraints.length ? `Lecturer strictness: ${strictness}` : '',
  ].filter(Boolean);

  return {
    constraints: activeConstraints,
    promptContext: lines.join('\n'),
    strictness: activeConstraints.length ? strictness : 'medium',
    requiredMethods,
    forbiddenMethods,
    assessmentFocus,
    mustCoverTopics,
  };
}

export function tokenOverlapScore(a: string, b: string) {
  const sourceTokens = new Set(
    normalizeText(a)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4),
  );
  const targetTokens = new Set(
    normalizeText(b)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4),
  );
  if (!sourceTokens.size || !targetTokens.size) return 0;

  let overlap = 0;
  sourceTokens.forEach((token) => {
    if (targetTokens.has(token)) overlap += 1;
  });

  return overlap / Math.max(sourceTokens.size, targetTokens.size);
}

export function explainChunkRelevance(chunkText: string, queryParts: string[]) {
  const lower = chunkText.toLowerCase();
  const matched = queryParts
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .find((part) => {
      const tokens = part
        .toLowerCase()
        .split(/\s+/)
        .filter((token) => token.length >= 4);
      return tokens.some((token) => lower.includes(token));
    });

  if (matched) {
    return `Supports: ${truncate(matched, 90)}`;
  }

  if (/\bformula\b|\bmethod\b|\bexample\b|\bdefinition\b/.test(lower)) {
    return 'Supports a related formula, method, example, or definition.';
  }

  return 'Supports continuity with a related explanation from the same material.';
}

export function hasStepLanguage(text: string) {
  return /\bstep\b|\bfirst\b|\bsecond\b|\bthen\b|\bnext\b|\bsubstitute\b|\bsolve\b|\bcalculate\b|\bapply\b/i.test(
    text,
  );
}

export function hasVisualLanguage(text: string) {
  return /\bimagine\b|\bpicture\b|\bvisual\b|\bflow\b|\barrow\b|\bgraph\b|\baxis\b|\blabel\b|\bpart\b|\bstage\b|\bprocess\b|\bcurve\b|\bdiagram\b/i.test(
    text,
  );
}

export function buildDeterministicTutorFallback(args: TutorMessageQualityArgs) {
  const scopedPrimary =
    args.lessonScope?.primaryObjective || args.section.title;
  const scopedConcepts = truncateList(
    args.lessonScope?.inScopeConcepts || [],
    3,
    40,
  );
  const depthTarget = args.teachingDepthPlan?.targetDepth || 'standard';
  const firstSentence = normalizeText(args.section.content || '')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)[0];

  if (args.turnType === 'checkpoint_question') {
    const conceptPart = scopedConcepts.length
      ? ` focusing on ${scopedConcepts.join(', ')}`
      : '';
    return `Explain ${args.section.title}${conceptPart} in your own words using one clear point at a time.`;
  }

  if (args.isCalculationHeavy && args.phase === PASS_2) {
    return `For ${args.section.title}, focus on the formula or method, define each variable clearly, and work through the steps in order with one simple example.`;
  }

  if (args.isDiagramHeavy) {
    return `Picture ${args.section.title} as a clear process or diagram. Start with the main parts, then explain how each part or stage connects to the next.`;
  }

  if (args.lessonScope?.inScopeConcepts.length) {
    return `Focus on ${scopedPrimary}. Keep the explanation on ${scopedConcepts.join(', ')} at a ${depthTarget} depth and stop after the main idea is clear.`;
  }

  return firstSentence
    ? removeAccidentalTeachingQuestions(firstSentence)
    : `This part explains the core idea in ${args.section.title} and why it matters for the section.`;
}

export function applyTutorMessageCorrections(
  content: string,
  issues: string[],
  context: TutorMessageQualityArgs,
) {
  let corrected = normalizeText(content);

  if (
    issues.includes('question_not_allowed') ||
    (!context.questionAllowed && !context.microQuestionAllowed)
  ) {
    corrected = removeAccidentalTeachingQuestions(corrected);
  }

  if (issues.includes('too_many_questions')) {
    corrected = trimAfterFirstQuestion(corrected);
  }

  if (issues.includes('micro_question_missing')) {
    const genericMicroQuestion =
      context.phase === PASS_1
        ? 'Quick guess before we go further: what do you think happens next?'
        : 'Quick check: where would you apply this?';
    corrected = `${corrected} ${genericMicroQuestion}`.trim();
  }

  if (issues.includes('too_long')) {
    corrected = truncateToSentence(
      corrected,
      context.turnType === 'checkpoint_question' ? 260 : 900,
    );
  }

  if (
    issues.includes('pacing_too_long') ||
    issues.includes('intro_too_dense') ||
    issues.includes('pass1_too_dense')
  ) {
    const limit =
      context.targetWordRange?.max ||
      (context.turnType === 'checkpoint_question' ? 70 : 180);
    corrected = corrected
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean)
      .reduce((acc, sentence) => {
        const next = `${acc} ${sentence}`.trim();
        return next.split(/\s+/).filter(Boolean).length <= limit ? next : acc;
      }, '');
    corrected = corrected || buildDeterministicTutorFallback(context);
    console.log('pacing_trim_applied', {
      phase: context.phase,
      turnType: context.turnType,
      targetWordRange: context.targetWordRange || null,
    });
  }

  if (
    context.lessonScope &&
    (issues.includes('scope_out_of_scope_expansion') ||
      issues.includes('scope_preview_overexplained') ||
      issues.includes('scope_forbidden_expansion') ||
      issues.includes('teachback_scope_violation'))
  ) {
    const violation = detectScopeViolation(corrected, context.lessonScope);
    if (violation.violated) {
      corrected = corrected
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean)
        .filter(
          (sentence) =>
            !violation.forbiddenConceptsFound.some((concept) =>
              sentenceContainsConcept(sentence, concept),
            ),
        )
        .filter(
          (sentence) =>
            !violation.previewConceptsOverExplained.some((concept) =>
              sentenceContainsConcept(sentence, concept),
            ),
        )
        .join(' ')
        .trim();
      if (!corrected) {
        corrected = buildDeterministicTutorFallback(context);
        console.log('scoped_fallback_used', {
          phase: context.phase,
          turnType: context.turnType,
          primaryObjective: context.lessonScope.primaryObjective,
        });
      } else {
        console.log('scope_trim_applied', {
          phase: context.phase,
          turnType: context.turnType,
          forbiddenConceptsFound: violation.forbiddenConceptsFound,
          previewConceptsOverExplained: violation.previewConceptsOverExplained,
        });
      }
    }
  }

  if (
    context.teachingDepthPlan &&
    (issues.includes('depth_deferred_explained') ||
      issues.includes('depth_too_many_reasoning_layers') ||
      issues.includes('depth_too_many_examples') ||
      issues.includes('depth_too_advanced_for_pass'))
  ) {
    const violation = detectDepthViolation(
      corrected,
      context.teachingDepthPlan,
    );
    if (violation.violated) {
      corrected = corrected
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean)
        .filter(
          (sentence) =>
            !violation.deferredConceptsExplained.some((concept) =>
              sentenceContainsConcept(sentence, concept),
            ),
        )
        .slice(
          0,
          Math.max(
            1,
            context.teachingDepthPlan.maxExamples +
              context.teachingDepthPlan.maxReasoningLayers +
              1,
          ),
        )
        .join(' ')
        .trim();
      if (!corrected) {
        corrected = buildDeterministicTutorFallback(context);
        console.log('depth_safe_fallback_used', {
          phase: context.phase,
          turnType: context.turnType,
          targetDepth: context.teachingDepthPlan.targetDepth,
        });
      } else {
        console.log('depth_trim_applied', {
          phase: context.phase,
          turnType: context.turnType,
          targetDepth: context.teachingDepthPlan.targetDepth,
          deferredConceptsExplained: violation.deferredConceptsExplained,
          tooManyReasoningLayers: violation.tooManyReasoningLayers,
          tooManyExamples: violation.tooManyExamples,
          tooAdvancedForPass: violation.tooAdvancedForPass,
        });
      }
    }
  }

  if (issues.includes('repeated_welcome')) {
    corrected = corrected.replace(/^\s*welcome[^.?!]*[.?!]?\s*/i, '').trim();
  }

  if (issues.includes('repeated_prerequisite_explanation')) {
    corrected = corrected
      .replace(
        /\b(science|matter|energy|measurement|variables|formulas)\b[^.?!]*[.?!]/gi,
        '',
      )
      .trim();
    corrected =
      corrected ||
      'We have already refreshed the prerequisite ideas, so now connect them directly to the main concept.';
  }

  if (issues.includes('too_short') || issues.includes('empty_content')) {
    corrected = buildDeterministicTutorFallback(context);
  }

  if (
    issues.includes('missing_calculation_steps') &&
    context.phase === PASS_2
  ) {
    corrected =
      `${corrected} State the formula, define the variables, then show the steps in order.`.trim();
  }

  if (issues.includes('missing_visual_language')) {
    corrected =
      `${corrected} Picture the process clearly and follow the main parts or stages in order.`.trim();
  }

  if (
    (issues.includes('checkpoint_too_long') ||
      issues.includes('checkpoint_missing_instruction')) &&
    !context.completionProblemCheckpoint
  ) {
    corrected = buildDeterministicTeachbackPrompt(
      context.section,
      context.turnType === 'checkpoint_question' &&
        /Teach-Back 2|teach-back 2/i.test(context.content)
        ? 2
        : 1,
      [],
      /memory dump/i.test(context.content) ? 'memory_dump' : 'teachback',
    );
  } else if (
    issues.includes('checkpoint_too_long') &&
    context.completionProblemCheckpoint
  ) {
    corrected = truncateToSentence(corrected, 900);
  }

  if (
    issues.includes('checkpoint_teaching_content') &&
    !context.completionProblemCheckpoint
  ) {
    corrected = buildDeterministicTeachbackPrompt(
      context.section,
      context.turnType === 'checkpoint_question' &&
        /Teach-Back 2|teach-back 2/i.test(context.content)
        ? 2
        : 1,
      [],
      /memory dump/i.test(context.content) ? 'memory_dump' : 'teachback',
    );
  }

  if (!context.questionAllowed && !context.microQuestionAllowed) {
    corrected = removeAccidentalTeachingQuestions(corrected);
  } else if (context.turnType === 'checkpoint_question') {
    corrected = sanitizeSingleQuestionTurn(corrected);
  } else if (context.microQuestionAllowed) {
    corrected = trimAfterFirstQuestion(corrected) || corrected;
  }

  return normalizeText(corrected);
}

export function validateTutorMessageQuality(
  args: TutorMessageQualityArgs,
): TutorMessageQualityResult {
  const normalized = normalizeText(args.content || '');
  const issues: string[] = [];

  if (!normalized) {
    issues.push('empty_content');
  }

  if (
    normalized.length >
    (args.turnType === 'checkpoint_question'
      ? args.completionProblemCheckpoint
        ? 900
        : 320
      : 1200)
  ) {
    issues.push('too_long');
  }

  if (normalized.length < 40) {
    issues.push('too_short');
  }

  const questionMarkCount = (normalized.match(/\?/g) || []).length;

  if (args.microQuestionAllowed) {
    if (questionMarkCount === 0) {
      issues.push('micro_question_missing');
    } else if (questionMarkCount > 1) {
      issues.push('too_many_questions');
    }
  } else {
    if (!args.questionAllowed && questionMarkCount > 0) {
      issues.push('question_not_allowed');
    }

    if (
      (args.phase === PASS_1 ||
        args.phase === PASS_2 ||
        args.phase === PASS_3) &&
      questionMarkCount > 0
    ) {
      if (!issues.includes('question_not_allowed')) {
        issues.push('question_not_allowed');
      }
    }
  }

  if (
    (args.phase === PASS_1 || args.phase === PASS_2 || args.phase === PASS_3) &&
    !args.isFirstIntro &&
    /^\s*welcome\b/i.test(normalized)
  ) {
    issues.push('repeated_welcome');
  }

  if (
    args.coveredConcepts?.length &&
    (args.phase === PASS_1 || args.phase === PASS_2 || args.phase === PASS_3)
  ) {
    const repeatedConceptHits = args.coveredConcepts.filter(
      (concept) =>
        concept &&
        new RegExp(
          `\\b${concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i',
        ).test(normalized),
    );
    if (repeatedConceptHits.length >= 2) {
      issues.push('repeated_prerequisite_explanation');
    }
  }

  if (args.isCalculationHeavy && args.phase === PASS_2) {
    if (!hasMathNotation(normalized) && !hasStepLanguage(normalized)) {
      issues.push('missing_calculation_steps');
    }
  }

  if (args.isDiagramHeavy && !hasVisualLanguage(normalized)) {
    issues.push('missing_visual_language');
  }

  if (args.turnType === 'checkpoint_question') {
    const sentenceCount = normalized
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean).length;
    if (args.completionProblemCheckpoint) {
      if (sentenceCount > 10 || normalized.length > 900) {
        issues.push('checkpoint_too_long');
      }
      if (
        !/\b(complete|solve|finish|calculate|work out|final step|final answer)\b/i.test(
          normalized,
        )
      ) {
        issues.push('checkpoint_missing_instruction');
      }
    } else {
      if (sentenceCount > 2 || normalized.length > 260) {
        issues.push('checkpoint_too_long');
      }
      if (
        !/\b(explain|respond|say|write|teach-back|memory dump)\b/i.test(
          normalized,
        )
      ) {
        issues.push('checkpoint_missing_instruction');
      }
    }
  }

  const conceptLoad = estimateConceptLoad(normalized);
  if (conceptLoad.tooDense) {
    console.log('pacing_density_warning', {
      phase: args.phase,
      turnType: args.turnType,
      estimatedConceptCount: conceptLoad.estimatedConceptCount,
      signals: conceptLoad.signals,
    });
  }
  if (args.targetWordRange) {
    const wordCount = normalized
      ? normalized.split(/\s+/).filter(Boolean).length
      : 0;
    if (wordCount > args.targetWordRange.max) {
      issues.push('pacing_too_long');
    }
  }
  if (args.phase === 'INTRO' && conceptLoad.estimatedConceptCount > 1) {
    issues.push('intro_too_dense');
  }
  if (args.phase === PASS_1 && conceptLoad.estimatedConceptCount > 2) {
    issues.push('pass1_too_dense');
  }
  if (
    args.turnType === 'checkpoint_question' &&
    !args.completionProblemCheckpoint &&
    conceptLoad.estimatedConceptCount > 1
  ) {
    issues.push('checkpoint_teaching_content');
  }

  if (args.lessonScope) {
    const scopeViolation = detectScopeViolation(normalized, args.lessonScope);
    if (scopeViolation.violated) {
      console.log('scope_violation_detected', {
        phase: args.phase,
        turnType: args.turnType,
        violations: scopeViolation.violations,
        forbiddenConceptsFound: scopeViolation.forbiddenConceptsFound,
        previewConceptsOverExplained:
          scopeViolation.previewConceptsOverExplained,
      });
    }
    if (scopeViolation.forbiddenConceptsFound.length) {
      issues.push('scope_out_of_scope_expansion');
      issues.push('scope_forbidden_expansion');
    }
    if (scopeViolation.previewConceptsOverExplained.length) {
      issues.push('scope_preview_overexplained');
    }
    if (args.turnType === 'checkpoint_question') {
      const checkpointOffScope = [
        ...(args.lessonScope.previewOnlyConcepts || []),
        ...(args.lessonScope.outOfScopeConcepts || []),
      ].some((concept) => sentenceContainsConcept(normalized, concept));
      if (checkpointOffScope) {
        issues.push('teachback_scope_violation');
      }
    }
  }

  if (args.teachingDepthPlan) {
    const depthViolation = detectDepthViolation(
      normalized,
      args.teachingDepthPlan,
    );
    if (depthViolation.violated) {
      console.log('depth_violation_detected', {
        phase: args.phase,
        turnType: args.turnType,
        targetDepth: args.teachingDepthPlan.targetDepth,
        violations: depthViolation.violations,
        deferredConceptsExplained: depthViolation.deferredConceptsExplained,
        tooManyReasoningLayers: depthViolation.tooManyReasoningLayers,
        tooManyExamples: depthViolation.tooManyExamples,
        tooAdvancedForPass: depthViolation.tooAdvancedForPass,
      });
    }
    if (depthViolation.deferredConceptsExplained.length) {
      issues.push('depth_deferred_explained');
    }
    if (depthViolation.tooManyReasoningLayers) {
      issues.push('depth_too_many_reasoning_layers');
    }
    if (depthViolation.tooManyExamples) {
      issues.push('depth_too_many_examples');
    }
    if (depthViolation.tooAdvancedForPass) {
      issues.push('depth_too_advanced_for_pass');
    }
  }

  const correctedContent = issues.length
    ? applyTutorMessageCorrections(normalized, issues, args)
    : undefined;
  return {
    passed: issues.length === 0,
    issues,
    correctedContent,
  };
}

export function estimatePromptTokens(value: string) {
  return Math.max(1, Math.round(normalizeText(value).length / 4));
}

export function parseStudySectionLessonPlanRecord(value: {
  lesson_objective?: string | null;
  prerequisite_refresh?: unknown;
  teaching_sequence?: unknown;
  analogy_plan?: unknown;
  calculation_plan?: unknown;
  diagram_plan?: unknown;
  checkpoint_focus?: unknown;
  exam_focus?: unknown;
  fallback_plan?: unknown;
}): StudySectionLessonPlanRecord {
  const lessonObjective = String(value.lesson_objective || '').trim();
  const prerequisiteRefresh = safeStringArray(value.prerequisite_refresh);
  const teachingSequence = safeStringArray(value.teaching_sequence);
  const analogyPlan = safeStringArray(value.analogy_plan);
  const calculationPlan = safeStringArray(value.calculation_plan);
  const diagramPlan = safeStringArray(value.diagram_plan);
  const checkpointFocus = safeStringArray(value.checkpoint_focus);
  const examFocus = safeStringArray(value.exam_focus);
  const fallbackPlan = safeStringArray(value.fallback_plan);

  const lines: string[] = [];
  if (lessonObjective) {
    lines.push(`Lesson objective: ${truncate(lessonObjective, 180)}`);
  }
  if (prerequisiteRefresh.length) {
    lines.push(
      `Prerequisite refresh: ${truncateList(prerequisiteRefresh, 4, 110).join(' | ')}`,
    );
  }
  if (teachingSequence.length) {
    lines.push(
      `Teaching sequence: ${truncateList(teachingSequence, 5, 110).join(' | ')}`,
    );
  }
  if (analogyPlan.length) {
    lines.push(
      `Analogy plan: ${truncateList(analogyPlan, 3, 110).join(' | ')}`,
    );
  }
  if (calculationPlan.length) {
    lines.push(
      `Calculation plan: ${truncateList(calculationPlan, 4, 120).join(' | ')}`,
    );
  }
  if (diagramPlan.length) {
    lines.push(
      `Diagram plan: ${truncateList(diagramPlan, 4, 120).join(' | ')}`,
    );
  }
  if (checkpointFocus.length) {
    lines.push(
      `Checkpoint focus: ${truncateList(checkpointFocus, 4, 110).join(' | ')}`,
    );
  }
  if (examFocus.length) {
    lines.push(`Exam focus: ${truncateList(examFocus, 4, 110).join(' | ')}`);
  }
  if (fallbackPlan.length) {
    lines.push(
      `Fallback plan: ${truncateList(fallbackPlan, 4, 110).join(' | ')}`,
    );
  }

  return {
    lessonObjective,
    prerequisiteRefresh,
    teachingSequence,
    analogyPlan,
    calculationPlan,
    diagramPlan,
    checkpointFocus,
    examFocus,
    fallbackPlan,
    promptContext: lines.join('\n'),
  };
}

export function buildFallbackLessonPlan(args: {
  section: RoadmapSection;
  calculationContext: CalculationTeachingContext;
  diagramContext: DiagramTeachingContext;
  studentMemoryPromptContext: string;
  teacherBrainContext: string;
}): StudySectionLessonPlanRecord {
  const firstParagraph = normalizeText(args.section.content || '')
    .split(/\n{2,}|(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  const sectionGoal =
    firstParagraph[0] || `Understand the core idea in ${args.section.title}.`;
  const teachingSequence = firstParagraph.length
    ? firstParagraph.map((item) => truncate(item, 120))
    : [
        `Introduce ${args.section.title}`,
        'Explain the main mechanism or idea clearly',
        'Connect it to likely exam use',
      ];
  const prerequisiteRefresh = args.teacherBrainContext
    ? truncateList(
        args.teacherBrainContext
          .split('\n')
          .filter((line) =>
            /Prerequisites:|Previous section bridge:/i.test(line),
          )
          .map((line) => line.replace(/^[^:]+:\s*/, '').trim()),
        3,
        110,
      )
    : [];
  const analogyPlan = truncateList(
    [
      args.studentMemoryPromptContext.includes(
        'Preferred explanation style cues',
      )
        ? 'Use the student’s preferred explanation style from earlier sections.'
        : '',
      `Use one grounded analogy to make ${args.section.title} easier to remember.`,
    ].filter(Boolean),
    2,
    110,
  );
  const calculationPlan = args.calculationContext.detected
    ? truncateList(
        [
          ...args.calculationContext.formulas.map(
            (item) =>
              `${item.name || 'Formula'}: explain variables and when to use it.`,
          ),
          ...args.calculationContext.calculationMethods.map(
            (item) =>
              `${item.topic || 'Method'}: teach the solving order step by step.`,
          ),
          ...args.calculationContext.commonMistakes.map(
            (item) => `Warn about: ${item}`,
          ),
        ],
        4,
        120,
      )
    : [];
  const diagramPlan = args.diagramContext.detected
    ? truncateList(
        [
          ...args.diagramContext.diagrams.map(
            (item) =>
              `${item.title || 'Diagram'}: explain ${item.diagram_type || 'visual'} using imagine language.`,
          ),
          ...args.diagramContext.imageDescriptions.map(
            (item) => `Use existing visual cue: ${item}`,
          ),
        ],
        4,
        120,
      )
    : [];
  const checkpointFocus = truncateList(
    [
      args.calculationContext.detected
        ? 'Check formula or method selection and solving order.'
        : '',
      args.diagramContext.detected
        ? 'Check visual sequence, labels, and relationships.'
        : '',
      'Check whether the student can explain the core idea without copying.',
    ].filter(Boolean),
    4,
    110,
  );
  const examFocus = truncateList(
    [
      args.calculationContext.detected
        ? 'Connect the method to exam-style application and final answer format.'
        : '',
      args.diagramContext.detected
        ? 'Connect the visual to exam interpretation or reproduction.'
        : '',
      `Show why ${args.section.title} matters in an exam setting.`,
    ].filter(Boolean),
    4,
    110,
  );
  const fallbackPlan = truncateList(
    [
      'Reteach the weak idea in simpler words.',
      args.calculationContext.detected
        ? 'Use one small numeric simple example.'
        : '',
      args.diagramContext.detected
        ? 'Use one clean verbal visualization with parts or arrows.'
        : '',
      'Return to one checkpoint question after reteaching.',
    ].filter(Boolean),
    4,
    110,
  );

  return parseStudySectionLessonPlanRecord({
    lesson_objective: truncate(sectionGoal, 180),
    prerequisite_refresh: prerequisiteRefresh,
    teaching_sequence: teachingSequence,
    analogy_plan: analogyPlan,
    calculation_plan: calculationPlan,
    diagram_plan: diagramPlan,
    checkpoint_focus: checkpointFocus,
    exam_focus: examFocus,
    fallback_plan: fallbackPlan,
  });
}

export function countKeywordHits(source: string, target: string) {
  const sourceTokens = new Set(
    source
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 5),
  );

  if (!sourceTokens.size) return 0;

  let hits = 0;
  sourceTokens.forEach((token) => {
    if (target.toLowerCase().includes(token)) hits += 1;
  });
  return hits;
}

export function deriveFailedConcepts(
  section: RoadmapSection,
  studentResponse: string,
) {
  const sentences = section.content
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const misses = sentences
    .filter((sentence) => countKeywordHits(sentence, studentResponse) === 0)
    .slice(0, 4)
    .map((sentence) => truncate(sentence, 120));

  return misses;
}

export function computeCoverageScore(
  section: RoadmapSection,
  studentResponse: string,
) {
  const sectionWords = new Set(
    section.content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 5),
  );
  if (!sectionWords.size) return 50;

  const responseWords = new Set(
    studentResponse
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 5),
  );

  let hits = 0;
  sectionWords.forEach((token) => {
    if (responseWords.has(token)) hits += 1;
  });

  const ratio = hits / sectionWords.size;
  return Math.max(15, Math.min(100, Math.round(ratio * 100)));
}

export async function generateText(
  prompt: string,
  systemPrompt: string,
  maxTokens = 900,
) {
  return aiProvider.generateResponse(prompt, {
    systemPrompt,
    maxTokens,
  });
}

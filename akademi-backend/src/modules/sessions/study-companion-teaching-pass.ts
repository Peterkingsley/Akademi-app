import { TeachingDecision } from './teaching-decision-engine';
import {
  RoadmapSection,
  TeacherBrainSectionContext,
  StudySectionLessonPlanRecord,
  RelevantMaterialContext,
  TutorQualityTraceCapture,
  SectionContext,
} from './study-companion.types';
import {
  PASS_1,
  PASS_2,
  PASS_3,
  safeJsonObject,
  normalizeText,
  mergeCoveredConcepts,
  buildFeedbackDoctrineLines,
  buildLecturerStyleDirectives,
  planPrerequisiteRefresh,
  buildDeterministicTeachbackPrompt,
  buildPacingDirectives,
  formatLessonScopePrompt,
  buildLessonScope,
  formatTeachingDepthPlan,
  buildTeachingDepthPlan,
  buildTeachingDecisionPromptLines,
} from './study-companion-prompt-directives';
import {
  truncate,
  truncateList,
  safeStringArray,
  getTeacherBrainSectionContext,
  buildCalculationTeachingContext,
  buildCalculationInstructions,
  buildDiagramTeachingContext,
  buildDiagramInstructions,
} from './study-companion-teacher-brain';
import { conceptMatches } from './study-companion-memory-mastery';
import {
  deriveFailedConcepts,
  computeCoverageScore,
  generateText,
} from './study-companion-quality-relevance';
import { enforceTutorMessageQuality } from './study-companion-tutor-trace';
import { companionSystemPrompt } from './study-companion-session-state';

export async function buildTeachingPass(
  section: RoadmapSection,
  pass: 1 | 2 | 3,
  decision: TeachingDecision,
  teacherBrainContext = '',
  contextMeta?: { sessionId: string; materialId: string; sectionIndex: number },
  teacherBrainSectionContext?: TeacherBrainSectionContext,
  studentMemoryPromptContext = '',
  lecturerConstraintPromptContext = '',
  lessonPlan?: StudySectionLessonPlanRecord,
  relevantMaterialContext?: RelevantMaterialContext,
  sectionContext?: SectionContext,
  qualityTrace?: TutorQualityTraceCapture,
  priorInteraction?: { question: string; answer: string },
): Promise<{ content: string; coveredConcepts: string[] }> {
  const askMicroQuestion = pass === 1 || pass === 2;
  const calculationContext = buildCalculationTeachingContext(
    section,
    teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
  );
  const diagramContext = buildDiagramTeachingContext(
    section,
    teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
  );
  if (calculationContext.detected) {
    console.log('calculation_context_detected', {
      ...contextMeta,
      prompt: `teaching_pass_${pass}`,
      subjectFamily: calculationContext.subjectFamily,
    });
  } else {
    console.log('calculation_context_missing', {
      ...contextMeta,
      prompt: `teaching_pass_${pass}`,
    });
  }
  if (diagramContext.detected) {
    console.log('diagram_context_detected', {
      ...contextMeta,
      prompt: `teaching_pass_${pass}`,
      subjectFamily: diagramContext.subjectFamily,
    });
  } else {
    console.log('diagram_context_missing', {
      ...contextMeta,
      prompt: `teaching_pass_${pass}`,
    });
  }
  const refreshPlan = planPrerequisiteRefresh({
    phase: pass,
    decision,
    sectionContext: sectionContext || {},
    teacherBrainSectionContext,
    lessonPlan,
  });
  const pacing = buildPacingDirectives({
    phase: pass === 1 ? PASS_1 : pass === 2 ? PASS_2 : PASS_3,
    turnType: 'teaching',
    passNumber: pass,
    teachingDecision: decision,
    sectionTitle: section.title,
    sectionContent: section.content,
    lessonPlan,
    isCalculationHeavy: calculationContext.detected,
    isDiagramHeavy: diagramContext.detected,
    isCheckpointQuestion: false,
    prerequisiteRepairActive: false,
  });
  const lessonScope = buildLessonScope({
    sectionTitle: section.title,
    sectionContent: section.content,
    teacherBrainContext,
    teacherBrainSectionContext,
    lessonPlan,
    lessonPlanContext: lessonPlan?.promptContext,
    relevantMaterialContext,
    lecturerConstraintContext: lecturerConstraintPromptContext,
    teachingDecision: decision,
    phase: pass === 1 ? PASS_1 : pass === 2 ? PASS_2 : PASS_3,
    passNumber: pass,
  });
  const depthPlan = buildTeachingDepthPlan({
    phase: pass === 1 ? PASS_1 : pass === 2 ? PASS_2 : PASS_3,
    turnType: 'teaching',
    passNumber: pass,
    sectionTitle: section.title,
    sectionContent: section.content,
    lessonScope,
    teachingDecision: decision,
    lessonPlan,
    isCalculationHeavy: calculationContext.detected,
    isDiagramHeavy: diagramContext.detected,
    prerequisiteRepairActive: false,
  });
  const modeInstructions = [
    calculationContext.detected
      ? buildCalculationInstructions(pass, calculationContext)
      : '',
    diagramContext.detected
      ? buildDiagramInstructions(pass, diagramContext)
      : '',
    ...buildTeachingDecisionPromptLines(decision, { pass }),
    ...buildLecturerStyleDirectives({
      phase: pass === 1 ? PASS_1 : pass === 2 ? PASS_2 : PASS_3,
      turnType: 'teaching',
      teachingDecision: decision,
      sectionTitle: section.title,
      alreadyCoveredConcepts: safeStringArray(sectionContext?.coveredConcepts),
      prerequisiteRepairActive: false,
      isCheckpointQuestion: false,
      microQuestionAllowed: askMicroQuestion,
    }),
    ...pacing.lines,
    ...refreshPlan.lines,
    priorInteraction
      ? [
          `The student was just asked: "${truncate(priorInteraction.question, 240)}"`,
          `The student answered: "${truncate(priorInteraction.answer, 240)}"`,
          ...buildFeedbackDoctrineLines({ brief: true }),
        ].join(' ')
      : '',
    pass === 1
      ? 'Give Pass 1 only. Start from the current lesson point, not from the beginning again. Focus on the big idea, the main intuition, and why it matters. Avoid long prerequisite chains. Do not use markdown. End the turn with exactly one short micro-question that asks the student to predict, guess, or recall a specific detail that Pass 2 will reveal. Ask only that one question, in one short sentence, and stop right after it. Do not answer it yourself.'
      : pass === 2
        ? 'Give Pass 2 only. Continue directly from the previous idea. Explain details, definitions, formulas, process, and one strong example from this section. Do not repeat the intro or refresh the same prerequisite again unless repair is active. Do not use markdown. End the turn with exactly one short micro-question that checks whether the student can apply or spot one idea from this pass. Ask only that one question, in one short sentence, and stop right after it. Do not answer it yourself.'
        : 'Give Pass 3 only. Continue directly from the previous idea. Connect this section to earlier ideas, exam use, and the next conceptual link. Do not restart the lesson. Do not ask any question. Do not include a question mark. End with a statement.',
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = [
    `Section title: ${section.title}`,
    teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
    studentMemoryPromptContext
      ? `Student memory context:\n${studentMemoryPromptContext}`
      : '',
    lecturerConstraintPromptContext
      ? `Lecturer constraint context:\n${lecturerConstraintPromptContext}`
      : '',
    lessonPlan?.promptContext
      ? `Lesson plan context:\n${lessonPlan.promptContext}`
      : '',
    relevantMaterialContext?.promptContext
      ? `Relevant material context:\n${relevantMaterialContext.promptContext}`
      : '',
    `Lesson scope:\n${formatLessonScopePrompt(lessonScope)}`,
    `Teaching depth plan:\n${formatTeachingDepthPlan(depthPlan)}`,
    calculationContext.detected
      ? `Calculation context:\n${calculationContext.summary}`
      : '',
    diagramContext.detected
      ? `Diagram context:\n${diagramContext.summary}`
      : '',
    `Section content:\n${truncate(section.content, 3800)}`,
    pass === 1 && lessonPlan?.lessonObjective
      ? `Follow this lesson objective first: ${lessonPlan.lessonObjective}`
      : '',
    pass === 1 && lessonPlan?.teachingSequence.length
      ? `Start with these sequence cues: ${truncateList(lessonPlan.teachingSequence, 2, 120).join(' | ')}`
      : '',
    pass === 2 && lessonPlan?.teachingSequence.length
      ? `Follow this detailed teaching sequence: ${truncateList(lessonPlan.teachingSequence, 5, 120).join(' | ')}`
      : '',
    pass === 2 && lessonPlan?.calculationPlan.length
      ? `Calculation lesson plan: ${truncateList(lessonPlan.calculationPlan, 4, 120).join(' | ')}`
      : '',
    pass === 2 && lessonPlan?.diagramPlan.length
      ? `Diagram lesson plan: ${truncateList(lessonPlan.diagramPlan, 4, 120).join(' | ')}`
      : '',
    pass === 3 && lessonPlan?.examFocus.length
      ? `Exam focus for this pass: ${truncateList(lessonPlan.examFocus, 4, 120).join(' | ')}`
      : '',
    pass === 3 && lessonPlan?.checkpointFocus.length
      ? `Checkpoint focus for this pass: ${truncateList(lessonPlan.checkpointFocus, 4, 120).join(' | ')}`
      : '',
    modeInstructions,
    'Use student memory to adapt explanation. If the student previously struggled with a prerequisite, briefly refresh it. If calculation issues exist, slow down formula substitution. If diagram issues exist, use clearer mental visualization. Be encouraging, not judgmental.',
    lecturerConstraintPromptContext
      ? 'Respect lecturer constraints. Do not violate required order, required methods, forbidden methods, terminology, unit policy, proof policy, calculation policy, or diagram policy.'
      : '',
    'End naturally without asking for permission to continue. Do not ask "do you understand", "are you ready", or any similar check-in.',
  ].join('\n\n');

  if (teacherBrainContext && contextMeta) {
    console.log('teacher_brain_context_applied', {
      ...contextMeta,
      prompt: `teaching_pass_${pass}`,
    });
  }
  if (calculationContext.detected && contextMeta) {
    console.log('calculation_context_applied', {
      ...contextMeta,
      prompt: `teaching_pass_${pass}`,
    });
  }
  if (diagramContext.detected && contextMeta) {
    console.log('diagram_context_applied', {
      ...contextMeta,
      prompt: `teaching_pass_${pass}`,
    });
  }
  if (relevantMaterialContext?.promptContext && contextMeta) {
    console.log('relevant_material_context_applied', {
      ...contextMeta,
      prompt: `teaching_pass_${pass}`,
    });
  }
  if (lecturerConstraintPromptContext && contextMeta) {
    console.log('lecturer_constraints_applied', {
      ...contextMeta,
      prompt: `teaching_pass_${pass}`,
    });
  }
  if (contextMeta) {
    console.log('lesson_scope_applied', {
      ...contextMeta,
      prompt: `teaching_pass_${pass}`,
      primaryObjective: lessonScope.primaryObjective,
      inScopeCount: lessonScope.inScopeConcepts.length,
      previewOnlyCount: lessonScope.previewOnlyConcepts.length,
      outOfScopeCount: lessonScope.outOfScopeConcepts.length,
    });
    console.log('teaching_depth_applied', {
      ...contextMeta,
      prompt: `teaching_pass_${pass}`,
      targetDepth: depthPlan.targetDepth,
      minimumUnderstandingCount: depthPlan.minimumUnderstanding.length,
      deferredDepthCount: depthPlan.deferredDepthConcepts.length,
    });
  }
  if (contextMeta) {
    console.log('teaching_decision_applied', {
      ...contextMeta,
      prompt: `teaching_pass_${pass}`,
      strategy: decision.strategy,
      pace: decision.pace,
      repairMode: decision.prerequisiteRepairMode,
    });
  }
  const rawContent = await generateText(prompt, companionSystemPrompt(), 900);
  const content = await enforceTutorMessageQuality({
    content: rawContent,
    prompt,
    maxTokens: 900,
    phase: pass === 1 ? PASS_1 : pass === 2 ? PASS_2 : PASS_3,
    turnType: 'teaching',
    section,
    isCalculationHeavy: calculationContext.detected,
    isDiagramHeavy: diagramContext.detected,
    questionAllowed: askMicroQuestion,
    microQuestionAllowed: askMicroQuestion,
    coveredConcepts: safeStringArray(sectionContext?.coveredConcepts),
    isFirstIntro: false,
    targetWordRange: pacing.targetWordRange,
    lessonScope,
    teachingDepthPlan: depthPlan,
    contextMeta: contextMeta
      ? { ...contextMeta, prompt: `teaching_pass_${pass}` }
      : undefined,
    qualityTrace,
  });
  return {
    content,
    coveredConcepts: mergeCoveredConcepts(
      safeStringArray(sectionContext?.coveredConcepts),
      refreshPlan.newCoveredConcepts,
    ),
  };
}

export async function evaluateTeachBack(
  section: RoadmapSection,
  studentResponse: string,
  attemptNumber: number,
  teacherBrainContext = '',
  contextMeta?: { sessionId: string; materialId: string; sectionIndex: number },
  teacherBrainSectionContext?: TeacherBrainSectionContext,
  lessonPlan?: StudySectionLessonPlanRecord,
  relevantMaterialContext?: RelevantMaterialContext,
) {
  const heuristicScore = computeCoverageScore(section, studentResponse);
  const calculationContext = buildCalculationTeachingContext(
    section,
    teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
  );
  const diagramContext = buildDiagramTeachingContext(
    section,
    teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
  );
  const lessonScope = buildLessonScope({
    sectionTitle: section.title,
    sectionContent: section.content,
    teacherBrainContext,
    teacherBrainSectionContext,
    lessonPlan,
    lessonPlanContext: lessonPlan?.promptContext,
    relevantMaterialContext,
    phase: 'CHECKPOINT',
  });
  const depthPlan = buildTeachingDepthPlan({
    phase: 'CHECKPOINT',
    turnType: 'checkpoint_question',
    sectionTitle: section.title,
    sectionContent: section.content,
    lessonScope,
    teachingDecision: {
      strategy: 'hybrid',
      pace: 'normal',
      prerequisiteRepairMode: 'none',
      shouldUseAnalogy: false,
      shouldUseWorkedExample: calculationContext.detected,
      shouldUseVisualExplanation: diagramContext.detected,
      shouldUseCalculationSteps: calculationContext.detected,
      shouldUseExamFraming: true,
      shouldChallengeStudent: false,
      shouldSlowDown: false,
      shouldRepairPrerequisite: false,
      repairConcepts: [],
      reason: 'evaluation depth plan',
      promptDirectives: [],
      traceMetadata: {},
    },
    lessonPlan,
    isCalculationHeavy: calculationContext.detected,
    isDiagramHeavy: diagramContext.detected,
    prerequisiteRepairActive: false,
  });
  const prompt = [
    `Section title: ${section.title}`,
    teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
    lessonPlan?.promptContext
      ? `Lesson plan context:\n${lessonPlan.promptContext}`
      : '',
    relevantMaterialContext?.promptContext
      ? `Relevant material context:\n${relevantMaterialContext.promptContext}`
      : '',
    `Lesson scope:\n${formatLessonScopePrompt(lessonScope)}`,
    `Teaching depth plan:\n${formatTeachingDepthPlan(depthPlan)}`,
    calculationContext.detected
      ? `Calculation context:\n${calculationContext.summary}`
      : '',
    diagramContext.detected
      ? `Diagram context:\n${diagramContext.summary}`
      : '',
    `Section content:\n${truncate(section.content, 3000)}`,
    `Student teach-back attempt ${attemptNumber}:\n${studentResponse}`,
    lessonPlan?.checkpointFocus.length
      ? `Checkpoint focus: ${truncateList(lessonPlan.checkpointFocus, 4, 120).join(' | ')}`
      : '',
    ...buildFeedbackDoctrineLines(),
    calculationContext.detected
      ? 'Task: Evaluate the teach-back. Check whether the student identified the correct formula or method, explained variables, explained solving order, mentioned units or interpretation, avoided common mistakes, and understood when to apply the method. Following the feedback doctrine above, state what was right first, then the single highest-leverage idea that must be corrected next.'
      : diagramContext.detected
        ? 'Task: Evaluate the teach-back. Check whether the student named the key parts, explained relationships, understood sequence or flow, explained functions, and avoided common label or process mistakes. Following the feedback doctrine above, state what was right first, then the single highest-leverage idea that must be corrected next.'
        : 'Task: Evaluate the teach-back. Following the feedback doctrine above, state what the student got right first, then the single highest-leverage idea that must be corrected next. Keep it concise and exam-focused.',
  ].join('\n\n');
  if (teacherBrainContext && contextMeta) {
    console.log('teacher_brain_context_applied', {
      ...contextMeta,
      prompt: `evaluate_teachback_${attemptNumber}`,
    });
  }
  if (calculationContext.detected && contextMeta) {
    console.log('calculation_context_applied', {
      ...contextMeta,
      prompt: `evaluate_teachback_${attemptNumber}`,
    });
  }
  if (diagramContext.detected && contextMeta) {
    console.log('diagram_context_applied', {
      ...contextMeta,
      prompt: `evaluate_teachback_${attemptNumber}`,
    });
  }
  if (relevantMaterialContext?.promptContext && contextMeta) {
    console.log('relevant_material_context_applied', {
      ...contextMeta,
      prompt: `evaluate_teachback_${attemptNumber}`,
    });
  }
  if (contextMeta) {
    console.log('lesson_scope_applied', {
      ...contextMeta,
      prompt: `evaluate_teachback_${attemptNumber}`,
      primaryObjective: lessonScope.primaryObjective,
      inScopeCount: lessonScope.inScopeConcepts.length,
      previewOnlyCount: lessonScope.previewOnlyConcepts.length,
      outOfScopeCount: lessonScope.outOfScopeConcepts.length,
    });
    console.log('teaching_depth_applied', {
      ...contextMeta,
      prompt: `evaluate_teachback_${attemptNumber}`,
      targetDepth: depthPlan.targetDepth,
      minimumUnderstandingCount: depthPlan.minimumUnderstanding.length,
      deferredDepthCount: depthPlan.deferredDepthConcepts.length,
    });
  }
  const evaluation = await generateText(prompt, companionSystemPrompt(), 500);
  return {
    evaluation,
    score: heuristicScore,
    failedConcepts: deriveFailedConcepts(section, studentResponse),
  };
}

export async function evaluateMemoryDump(
  section: RoadmapSection,
  studentResponse: string,
  teacherBrainContext = '',
  contextMeta?: { sessionId: string; materialId: string; sectionIndex: number },
  teacherBrainSectionContext?: TeacherBrainSectionContext,
  lessonPlan?: StudySectionLessonPlanRecord,
  relevantMaterialContext?: RelevantMaterialContext,
) {
  const heuristicScore = Math.max(
    20,
    computeCoverageScore(section, studentResponse) - 5,
  );
  const calculationContext = buildCalculationTeachingContext(
    section,
    teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
  );
  const diagramContext = buildDiagramTeachingContext(
    section,
    teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
  );
  const lessonScope = buildLessonScope({
    sectionTitle: section.title,
    sectionContent: section.content,
    teacherBrainContext,
    teacherBrainSectionContext,
    lessonPlan,
    lessonPlanContext: lessonPlan?.promptContext,
    relevantMaterialContext,
    phase: 'CHECKPOINT',
  });
  const depthPlan = buildTeachingDepthPlan({
    phase: 'CHECKPOINT',
    turnType: 'checkpoint_question',
    sectionTitle: section.title,
    sectionContent: section.content,
    lessonScope,
    teachingDecision: {
      strategy: 'hybrid',
      pace: 'normal',
      prerequisiteRepairMode: 'none',
      shouldUseAnalogy: false,
      shouldUseWorkedExample: calculationContext.detected,
      shouldUseVisualExplanation: diagramContext.detected,
      shouldUseCalculationSteps: calculationContext.detected,
      shouldUseExamFraming: true,
      shouldChallengeStudent: false,
      shouldSlowDown: false,
      shouldRepairPrerequisite: false,
      repairConcepts: [],
      reason: 'evaluation depth plan',
      promptDirectives: [],
      traceMetadata: {},
    },
    lessonPlan,
    isCalculationHeavy: calculationContext.detected,
    isDiagramHeavy: diagramContext.detected,
    prerequisiteRepairActive: false,
  });
  const prompt = [
    `Section title: ${section.title}`,
    teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
    lessonPlan?.promptContext
      ? `Lesson plan context:\n${lessonPlan.promptContext}`
      : '',
    relevantMaterialContext?.promptContext
      ? `Relevant material context:\n${relevantMaterialContext.promptContext}`
      : '',
    `Lesson scope:\n${formatLessonScopePrompt(lessonScope)}`,
    `Teaching depth plan:\n${formatTeachingDepthPlan(depthPlan)}`,
    calculationContext.detected
      ? `Calculation context:\n${calculationContext.summary}`
      : '',
    diagramContext.detected
      ? `Diagram context:\n${diagramContext.summary}`
      : '',
    `Section content:\n${truncate(section.content, 3000)}`,
    `Student memory dump:\n${studentResponse}`,
    lessonPlan?.checkpointFocus.length
      ? `Memory checkpoint focus: ${truncateList(lessonPlan.checkpointFocus, 4, 120).join(' | ')}`
      : '',
    ...buildFeedbackDoctrineLines(),
    calculationContext.detected
      ? 'Task: Compare the memory dump to the expected knowledge for this section. Check recall of the formula, variables, steps, common mistakes, when to use it, and final answer format. Following the feedback doctrine above, briefly identify what was remembered well first, then what is still missing.'
      : diagramContext.detected
        ? 'Task: Compare the memory dump to the expected knowledge for this section. Check whether the student remembered labels or parts, sequence or stages, relationships, functions, and exam interpretation. Following the feedback doctrine above, briefly identify what was remembered well first, then what is still missing.'
        : 'Task: Compare the memory dump to the expected knowledge for this section. Following the feedback doctrine above, briefly identify what was remembered well first, then what is still missing.',
  ].join('\n\n');
  if (teacherBrainContext && contextMeta) {
    console.log('teacher_brain_context_applied', {
      ...contextMeta,
      prompt: 'evaluate_memory_dump',
    });
  }
  if (calculationContext.detected && contextMeta) {
    console.log('calculation_context_applied', {
      ...contextMeta,
      prompt: 'evaluate_memory_dump',
    });
  }
  if (diagramContext.detected && contextMeta) {
    console.log('diagram_context_applied', {
      ...contextMeta,
      prompt: 'evaluate_memory_dump',
    });
  }
  if (relevantMaterialContext?.promptContext && contextMeta) {
    console.log('relevant_material_context_applied', {
      ...contextMeta,
      prompt: 'evaluate_memory_dump',
    });
  }
  if (contextMeta) {
    console.log('lesson_scope_applied', {
      ...contextMeta,
      prompt: 'evaluate_memory_dump',
      primaryObjective: lessonScope.primaryObjective,
      inScopeCount: lessonScope.inScopeConcepts.length,
      previewOnlyCount: lessonScope.previewOnlyConcepts.length,
      outOfScopeCount: lessonScope.outOfScopeConcepts.length,
    });
    console.log('teaching_depth_applied', {
      ...contextMeta,
      prompt: 'evaluate_memory_dump',
      targetDepth: depthPlan.targetDepth,
      minimumUnderstandingCount: depthPlan.minimumUnderstanding.length,
      deferredDepthCount: depthPlan.deferredDepthConcepts.length,
    });
  }
  const evaluation = await generateText(prompt, companionSystemPrompt(), 450);
  return {
    evaluation,
    score: heuristicScore,
    failedConcepts: deriveFailedConcepts(section, studentResponse),
  };
}

export async function evaluatePrerequisiteRepair(
  section: RoadmapSection,
  studentResponse: string,
  repairConcepts: string[],
  repairReason: string,
  teacherBrainContext = '',
) {
  const conceptMatchesCount = repairConcepts.filter((concept) =>
    conceptMatches(concept, studentResponse),
  ).length;
  const heuristicScore = Math.max(
    25,
    Math.min(
      100,
      Math.round(
        (studentResponse.trim().length >= 60 ? 45 : 25) +
          conceptMatchesCount * 25,
      ),
    ),
  );
  const prompt = [
    `Section title: ${section.title}`,
    teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
    `Section content:\n${truncate(section.content, 2200)}`,
    `Prerequisite repair concepts:\n${repairConcepts.join('\n')}`,
    repairReason ? `Repair reason:\n${repairReason}` : '',
    `Student repair answer:\n${truncate(studentResponse, 900)}`,
    'Task: Evaluate only whether the student now understands the repaired prerequisite concepts strongly enough to continue.',
    'Return strict JSON with keys: score, passed, evaluation, remainingWeaknesses.',
    'Score must be 0 to 100.',
    'Passed must be true only if the repaired prerequisites are now sufficiently understood for the next section.',
    'evaluation should be 2 to 4 short sentences and mention exactly what is clear or still weak.',
    'remainingWeaknesses must be a short array.',
  ].join('\n\n');
  const raw = await generateText(prompt, companionSystemPrompt(), 220);
  let parsedJson: Record<string, unknown> | null = null;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        parsedJson = JSON.parse(raw.slice(start, end + 1));
      } catch {
        parsedJson = null;
      }
    }
  }
  const parsed = safeJsonObject<{
    score?: number;
    passed?: boolean;
    evaluation?: string;
    remainingWeaknesses?: unknown;
  }>(parsedJson, {});
  const remainingWeaknesses = safeStringArray(parsed.remainingWeaknesses);
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Number.isFinite(Number(parsed.score))
          ? Number(parsed.score)
          : heuristicScore,
      ),
    ),
  );
  const passed =
    typeof parsed.passed === 'boolean'
      ? parsed.passed
      : score >= 70 && remainingWeaknesses.length === 0;

  return {
    score,
    passed,
    evaluation: normalizeText(
      String(parsed.evaluation || '').trim() ||
        (passed
          ? 'That prerequisite looks strong enough now, so we can continue.'
          : 'That prerequisite still needs one more short repair before we continue.'),
    ),
    remainingWeaknesses,
  };
}

export async function buildTeachBackPrompt(
  section: RoadmapSection,
  attemptNumber: 1 | 2,
  decision: TeachingDecision,
  teacherBrainContext = '',
  contextMeta?: { sessionId: string; materialId: string; sectionIndex: number },
  teacherBrainSectionContext?: TeacherBrainSectionContext,
  lecturerConstraintPromptContext = '',
  lessonPlan?: StudySectionLessonPlanRecord,
  qualityTrace?: TutorQualityTraceCapture,
) {
  const calculationContext = buildCalculationTeachingContext(
    section,
    teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
  );
  const diagramContext = buildDiagramTeachingContext(
    section,
    teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
  );
  const isCompletionProblemCheckpoint =
    calculationContext.detected && attemptNumber === 1;
  const pacing = buildPacingDirectives({
    phase: 'CHECKPOINT',
    turnType: 'checkpoint_question',
    teachingDecision: decision,
    sectionTitle: section.title,
    sectionContent: section.content,
    lessonPlan,
    isCalculationHeavy: false,
    isDiagramHeavy: diagramContext.detected,
    isCheckpointQuestion: true,
    prerequisiteRepairActive: false,
  });
  if (isCompletionProblemCheckpoint) {
    pacing.targetWordRange = { min: 30, max: 140 };
    pacing.lines.push(
      'Completion problem pacing: show the given setup and steps concisely, blank only the final step or two, and stop. No extra teaching.',
    );
  }
  const lessonScope = buildLessonScope({
    sectionTitle: section.title,
    sectionContent: section.content,
    teacherBrainContext,
    teacherBrainSectionContext,
    lessonPlan,
    lessonPlanContext: lessonPlan?.promptContext,
    lecturerConstraintContext: lecturerConstraintPromptContext,
    teachingDecision: decision,
    phase: 'CHECKPOINT',
  });
  const depthPlan = buildTeachingDepthPlan({
    phase: 'CHECKPOINT',
    turnType: 'checkpoint_question',
    sectionTitle: section.title,
    sectionContent: section.content,
    lessonScope,
    teachingDecision: decision,
    lessonPlan,
    isCalculationHeavy: false,
    isDiagramHeavy: diagramContext.detected,
    prerequisiteRepairActive: false,
  });
  const prompt = [
    `Section title: ${section.title}`,
    teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
    lecturerConstraintPromptContext
      ? `Lecturer constraint context:\n${lecturerConstraintPromptContext}`
      : '',
    lessonPlan?.promptContext
      ? `Lesson plan context:\n${lessonPlan.promptContext}`
      : '',
    `Lesson scope:\n${formatLessonScopePrompt(lessonScope)}`,
    `Teaching depth plan:\n${formatTeachingDepthPlan(depthPlan)}`,
    diagramContext.detected
      ? `Diagram context:\n${diagramContext.summary}`
      : '',
    isCompletionProblemCheckpoint
      ? `Calculation context:\n${calculationContext.summary}`
      : '',
    `Section content:\n${truncate(section.content, 2800)}`,
    lessonPlan?.checkpointFocus.length
      ? `Ask around these checkpoint targets: ${truncateList(lessonPlan.checkpointFocus, 4, 120).join(' | ')}`
      : '',
    lessonPlan?.calculationPlan.length
      ? `Calculation lesson plan: ${truncateList(lessonPlan.calculationPlan, 4, 120).join(' | ')}`
      : '',
    `Teaching decision:\n${buildTeachingDecisionPromptLines(decision, { includeCheckpoint: true }).join('\n')}`,
    buildLecturerStyleDirectives({
      phase: 'CHECKPOINT',
      turnType: 'checkpoint_question',
      teachingDecision: decision,
      sectionTitle: section.title,
      alreadyCoveredConcepts: [],
      prerequisiteRepairActive: false,
      isCheckpointQuestion: true,
    }).join('\n'),
    pacing.lines.join('\n'),
    lecturerConstraintPromptContext
      ? 'Respect lecturer constraints while asking for the teach-back.'
      : '',
    isCompletionProblemCheckpoint
      ? 'Ask the student for a completion problem, not a teach-back. Set up a worked example on this calculation using the formula or method already taught, show the setup and every step except the final one or two steps, then ask the student to complete only those last steps and give the final answer. Keep the setup short. State clearly what is already given and what they must finish. Do not ask them to explain in words; this is a numeric completion, not a teach-back.'
      : diagramContext.detected
        ? attemptNumber === 1
          ? 'Ask the student for Teach-Back 1. Tell them to explain the diagram or process in their own words as if they are drawing it from memory.'
          : 'Ask the student for Teach-Back 2. Tell them to explain the visual again, this time correcting the missing labels, flow, or relationships from the first attempt.'
        : attemptNumber === 1
          ? 'Ask the student for Teach-Back 1. Tell them to explain the section in their own words without copying.'
          : calculationContext.detected
            ? 'Ask the student for Teach-Back 2. This time ask them to explain in words why the method works, not to redo the calculation, correcting the missing ideas from the first attempt.'
            : 'Ask the student for Teach-Back 2. Tell them to explain again, this time correcting the missing ideas from the first attempt.',
  ].join('\n\n');

  if (teacherBrainContext && contextMeta) {
    console.log('teacher_brain_context_applied', {
      ...contextMeta,
      prompt: `teachback_prompt_${attemptNumber}`,
    });
  }
  if (diagramContext.detected && contextMeta) {
    console.log('diagram_context_applied', {
      ...contextMeta,
      prompt: `teachback_prompt_${attemptNumber}`,
    });
  }
  if (contextMeta) {
    console.log('lesson_scope_applied', {
      ...contextMeta,
      prompt: `teachback_prompt_${attemptNumber}`,
      primaryObjective: lessonScope.primaryObjective,
      inScopeCount: lessonScope.inScopeConcepts.length,
      previewOnlyCount: lessonScope.previewOnlyConcepts.length,
      outOfScopeCount: lessonScope.outOfScopeConcepts.length,
    });
    console.log('teaching_depth_applied', {
      ...contextMeta,
      prompt: `teachback_prompt_${attemptNumber}`,
      targetDepth: depthPlan.targetDepth,
      minimumUnderstandingCount: depthPlan.minimumUnderstanding.length,
      deferredDepthCount: depthPlan.deferredDepthConcepts.length,
    });
    console.log('teaching_decision_applied', {
      ...contextMeta,
      prompt: `teachback_prompt_${attemptNumber}`,
      strategy: decision.strategy,
      pace: decision.pace,
      repairMode: decision.prerequisiteRepairMode,
    });
  }
  const checkpointMaxTokens = isCompletionProblemCheckpoint ? 380 : 220;
  const rawContent = await generateText(
    prompt,
    companionSystemPrompt(),
    checkpointMaxTokens,
  );
  const content = await enforceTutorMessageQuality({
    content: rawContent,
    prompt,
    maxTokens: checkpointMaxTokens,
    phase: 'CHECKPOINT',
    turnType: 'checkpoint_question',
    section,
    isCalculationHeavy: calculationContext.detected,
    isDiagramHeavy: diagramContext.detected,
    questionAllowed: true,
    completionProblemCheckpoint: isCompletionProblemCheckpoint,
    coveredConcepts: [],
    isFirstIntro: false,
    targetWordRange: pacing.targetWordRange,
    lessonScope,
    teachingDepthPlan: depthPlan,
    contextMeta: contextMeta
      ? { ...contextMeta, prompt: `teachback_prompt_${attemptNumber}` }
      : undefined,
    qualityTrace,
  });
  const sentenceCount = content.split(/(?<=[.!?])\s+/).filter(Boolean).length;
  const looksTooTeachy =
    !isCompletionProblemCheckpoint &&
    (sentenceCount > 2 ||
      /\bthis means|let us|remember that|in this section\b/i.test(content));
  if (looksTooTeachy) {
    const simplified = buildDeterministicTeachbackPrompt(
      section,
      attemptNumber,
      lessonPlan?.checkpointFocus || [],
      'teachback',
    );
    console.log('teachback_prompt_simplified', {
      ...contextMeta,
      attemptNumber,
    });
    return simplified;
  }
  return content;
}

export async function buildMemoryDumpPrompt(
  section: RoadmapSection,
  decision: TeachingDecision,
  teacherBrainContext = '',
  contextMeta?: { sessionId: string; materialId: string; sectionIndex: number },
  lecturerConstraintPromptContext = '',
  lessonPlan?: StudySectionLessonPlanRecord,
  qualityTrace?: TutorQualityTraceCapture,
) {
  const pacing = buildPacingDirectives({
    phase: 'CHECKPOINT',
    turnType: 'checkpoint_question',
    teachingDecision: decision,
    sectionTitle: section.title,
    sectionContent: section.content,
    lessonPlan,
    isCalculationHeavy: false,
    isDiagramHeavy: false,
    isCheckpointQuestion: true,
    prerequisiteRepairActive: false,
  });
  const lessonScope = buildLessonScope({
    sectionTitle: section.title,
    sectionContent: section.content,
    teacherBrainContext,
    lessonPlan,
    lessonPlanContext: lessonPlan?.promptContext,
    lecturerConstraintContext: lecturerConstraintPromptContext,
    teachingDecision: decision,
    phase: 'CHECKPOINT',
  });
  const depthPlan = buildTeachingDepthPlan({
    phase: 'CHECKPOINT',
    turnType: 'checkpoint_question',
    sectionTitle: section.title,
    sectionContent: section.content,
    lessonScope,
    teachingDecision: decision,
    lessonPlan,
    isCalculationHeavy: false,
    isDiagramHeavy: false,
    prerequisiteRepairActive: false,
  });
  if (teacherBrainContext && contextMeta) {
    console.log('teacher_brain_context_applied', {
      ...contextMeta,
      prompt: 'memory_dump_prompt',
    });
  }
  const prompt = [
    `Section title: ${section.title}`,
    teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
    lecturerConstraintPromptContext
      ? `Lecturer constraint context:\n${lecturerConstraintPromptContext}`
      : '',
    lessonPlan?.promptContext
      ? `Lesson plan context:\n${lessonPlan.promptContext}`
      : '',
    `Lesson scope:\n${formatLessonScopePrompt(lessonScope)}`,
    `Teaching depth plan:\n${formatTeachingDepthPlan(depthPlan)}`,
    `Section content:\n${truncate(section.content, 2600)}`,
    lessonPlan?.checkpointFocus.length
      ? `Memory dump should target these ideas: ${truncateList(lessonPlan.checkpointFocus, 4, 120).join(' | ')}`
      : '',
    `Teaching decision:\n${buildTeachingDecisionPromptLines(decision, { includeCheckpoint: true }).join('\n')}`,
    buildLecturerStyleDirectives({
      phase: 'CHECKPOINT',
      turnType: 'checkpoint_question',
      teachingDecision: decision,
      sectionTitle: section.title,
      alreadyCoveredConcepts: [],
      prerequisiteRepairActive: false,
      isCheckpointQuestion: true,
    }).join('\n'),
    pacing.lines.join('\n'),
    lecturerConstraintPromptContext
      ? 'Respect lecturer constraints while deciding what the student should recall.'
      : '',
    'Ask the student for a memory dump. Tell them to write or say everything they remember from this section without checking notes.',
  ].join('\n\n');
  if (contextMeta) {
    console.log('lesson_scope_applied', {
      ...contextMeta,
      prompt: 'memory_dump_prompt',
      primaryObjective: lessonScope.primaryObjective,
      inScopeCount: lessonScope.inScopeConcepts.length,
      previewOnlyCount: lessonScope.previewOnlyConcepts.length,
      outOfScopeCount: lessonScope.outOfScopeConcepts.length,
    });
    console.log('teaching_depth_applied', {
      ...contextMeta,
      prompt: 'memory_dump_prompt',
      targetDepth: depthPlan.targetDepth,
      minimumUnderstandingCount: depthPlan.minimumUnderstanding.length,
      deferredDepthCount: depthPlan.deferredDepthConcepts.length,
    });
    console.log('teaching_decision_applied', {
      ...contextMeta,
      prompt: 'memory_dump_prompt',
      strategy: decision.strategy,
      pace: decision.pace,
      repairMode: decision.prerequisiteRepairMode,
    });
  }
  const rawContent = await generateText(prompt, companionSystemPrompt(), 220);
  const content = await enforceTutorMessageQuality({
    content: rawContent,
    prompt,
    maxTokens: 220,
    phase: 'CHECKPOINT',
    turnType: 'checkpoint_question',
    section,
    isCalculationHeavy: false,
    isDiagramHeavy: false,
    questionAllowed: true,
    coveredConcepts: [],
    isFirstIntro: false,
    targetWordRange: pacing.targetWordRange,
    lessonScope,
    teachingDepthPlan: depthPlan,
    contextMeta: contextMeta
      ? { ...contextMeta, prompt: 'memory_dump_prompt' }
      : undefined,
    qualityTrace,
  });
  const sentenceCount = content.split(/(?<=[.!?])\s+/).filter(Boolean).length;
  if (sentenceCount > 2) {
    console.log('teachback_prompt_simplified', {
      ...contextMeta,
      attemptNumber: 'memory_dump',
    });
    return buildDeterministicTeachbackPrompt(
      section,
      1,
      lessonPlan?.checkpointFocus || [],
      'memory_dump',
    );
  }
  return content;
}

export async function buildGapReteach(
  section: RoadmapSection,
  failedConcepts: string[],
  decision: TeachingDecision,
  teacherBrainContext = '',
  contextMeta?: { sessionId: string; materialId: string; sectionIndex: number },
  teacherBrainSectionContext?: TeacherBrainSectionContext,
  lecturerConstraintPromptContext = '',
  lessonPlan?: StudySectionLessonPlanRecord,
  relevantMaterialContext?: RelevantMaterialContext,
  options?: {
    repairMode?: 'medium_prerequisite_repair' | 'full_section_reteach';
    repairReason?: string;
    repairAttemptCount?: number;
    reteachCycleCount?: number;
  },
  qualityTrace?: TutorQualityTraceCapture,
) {
  const halveStep =
    options?.repairMode !== 'medium_prerequisite_repair' &&
    (options?.reteachCycleCount || 0) >= 2;
  const calculationContext = buildCalculationTeachingContext(
    section,
    teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
  );
  const diagramContext = buildDiagramTeachingContext(
    section,
    teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
  );
  if (teacherBrainContext && contextMeta) {
    console.log('teacher_brain_context_applied', {
      ...contextMeta,
      prompt: 'gap_reteach',
    });
  }
  if (calculationContext.detected && contextMeta) {
    console.log('calculation_context_applied', {
      ...contextMeta,
      prompt: 'gap_reteach',
    });
  }
  if (diagramContext.detected && contextMeta) {
    console.log('diagram_context_applied', {
      ...contextMeta,
      prompt: 'gap_reteach',
    });
  }
  if (relevantMaterialContext?.promptContext && contextMeta) {
    console.log('relevant_material_context_applied', {
      ...contextMeta,
      prompt: 'gap_reteach',
    });
  }
  if (lecturerConstraintPromptContext && contextMeta) {
    console.log('lecturer_constraints_applied', {
      ...contextMeta,
      prompt: 'gap_reteach',
    });
  }
  const pacing = buildPacingDirectives({
    phase: 'RETEACH',
    turnType:
      options?.repairMode === 'medium_prerequisite_repair'
        ? 'checkpoint_question'
        : 'reteach',
    teachingDecision: decision,
    sectionTitle: section.title,
    sectionContent: section.content,
    lessonPlan,
    isCalculationHeavy: calculationContext.detected,
    isDiagramHeavy: diagramContext.detected,
    isCheckpointQuestion: options?.repairMode === 'medium_prerequisite_repair',
    prerequisiteRepairActive:
      options?.repairMode === 'medium_prerequisite_repair',
  });
  const lessonScope = buildLessonScope({
    sectionTitle: section.title,
    sectionContent: section.content,
    teacherBrainContext,
    teacherBrainSectionContext,
    lessonPlan,
    lessonPlanContext: lessonPlan?.promptContext,
    relevantMaterialContext,
    lecturerConstraintContext: lecturerConstraintPromptContext,
    teachingDecision: decision,
    phase: 'RETEACH',
  });
  const depthPlan = buildTeachingDepthPlan({
    phase: 'RETEACH',
    turnType:
      options?.repairMode === 'medium_prerequisite_repair'
        ? 'checkpoint_question'
        : 'reteach',
    sectionTitle: section.title,
    sectionContent: section.content,
    lessonScope,
    teachingDecision: decision,
    lessonPlan,
    isCalculationHeavy: calculationContext.detected,
    isDiagramHeavy: diagramContext.detected,
    prerequisiteRepairActive:
      options?.repairMode === 'medium_prerequisite_repair',
  });
  const prompt = [
    `Section title: ${section.title}`,
    teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
    lecturerConstraintPromptContext
      ? `Lecturer constraint context:\n${lecturerConstraintPromptContext}`
      : '',
    lessonPlan?.promptContext
      ? `Lesson plan context:\n${lessonPlan.promptContext}`
      : '',
    relevantMaterialContext?.promptContext
      ? `Relevant material context:\n${relevantMaterialContext.promptContext}`
      : '',
    `Lesson scope:\n${formatLessonScopePrompt(lessonScope)}`,
    `Teaching depth plan:\n${formatTeachingDepthPlan(depthPlan)}`,
    calculationContext.detected
      ? `Calculation context:\n${calculationContext.summary}`
      : '',
    diagramContext.detected
      ? `Diagram context:\n${diagramContext.summary}`
      : '',
    `Section content:\n${truncate(section.content, 3000)}`,
    `Missing or weak ideas:\n${failedConcepts.join('\n') || 'The explanation was too thin.'}`,
    options?.repairReason ? `Repair reason:\n${options.repairReason}` : '',
    lessonPlan?.fallbackPlan.length
      ? `Use this fallback plan: ${truncateList(lessonPlan.fallbackPlan, 5, 120).join(' | ')}`
      : '',
    `Teaching decision:\n${buildTeachingDecisionPromptLines(decision, { includeReteach: true }).join('\n')}`,
    ...buildLecturerStyleDirectives({
      phase: 'RETEACH',
      turnType:
        options?.repairMode === 'medium_prerequisite_repair'
          ? 'checkpoint_question'
          : 'reteach',
      teachingDecision: decision,
      sectionTitle: section.title,
      alreadyCoveredConcepts: [],
      prerequisiteRepairActive:
        options?.repairMode === 'medium_prerequisite_repair',
      isCheckpointQuestion:
        options?.repairMode === 'medium_prerequisite_repair',
    }),
    ...pacing.lines,
    lecturerConstraintPromptContext
      ? 'Respect lecturer constraints during this repair or reteach.'
      : '',
    halveStep
      ? 'This section has failed mastery more than once in a row. Halve the step: reteach only the single most critical missing link in the chain, nothing else. Verify understanding with one short yes-or-no-plus-why question before ending. Do not give a longer explanation than last time; give a smaller one.'
      : '',
    options?.repairMode === 'medium_prerequisite_repair'
      ? [
          'Task: We need a short prerequisite repair before continuing.',
          'Give a short explanation focused only on the blocking prerequisite ideas.',
          'Include one practical example.',
          'End with exactly one checkpoint question that checks only the repaired prerequisite.',
          'Do not reteach the whole section.',
          `This is repair attempt ${(options?.repairAttemptCount || 0) + 1}.`,
        ].join(' ')
      : calculationContext.detected
        ? 'Task: reteach this section more simply. Use one small numeric example labelled simple example, explain the method step by step, and warn about one common calculation mistake. Then tell the student they will try the teach-back again.'
        : diagramContext.detected
          ? 'Task: reteach this section using a simple verbal visualization. Say things like imagine this as, start from the left or top or center, the arrow means, and this part connects to. Then tell the student they will try the teach-back again.'
          : 'Task: reteach this section in a simpler way with one easy analogy, then tell the student they will try the teach-back again.',
  ].join('\n\n');
  if (contextMeta) {
    console.log('lesson_scope_applied', {
      ...contextMeta,
      prompt: 'gap_reteach',
      primaryObjective: lessonScope.primaryObjective,
      inScopeCount: lessonScope.inScopeConcepts.length,
      previewOnlyCount: lessonScope.previewOnlyConcepts.length,
      outOfScopeCount: lessonScope.outOfScopeConcepts.length,
    });
    console.log('teaching_depth_applied', {
      ...contextMeta,
      prompt: 'gap_reteach',
      targetDepth: depthPlan.targetDepth,
      minimumUnderstandingCount: depthPlan.minimumUnderstanding.length,
      deferredDepthCount: depthPlan.deferredDepthConcepts.length,
    });
    console.log('teaching_decision_applied', {
      ...contextMeta,
      prompt: 'gap_reteach',
      strategy: decision.strategy,
      pace: decision.pace,
      repairMode: decision.prerequisiteRepairMode,
    });
  }
  const rawContent = await generateText(prompt, companionSystemPrompt(), 650);
  return enforceTutorMessageQuality({
    content: rawContent,
    prompt,
    maxTokens: 650,
    phase: 'RETEACH',
    turnType:
      options?.repairMode === 'medium_prerequisite_repair'
        ? 'checkpoint_question'
        : 'reteach',
    section,
    isCalculationHeavy: calculationContext.detected,
    isDiagramHeavy: diagramContext.detected,
    questionAllowed: options?.repairMode === 'medium_prerequisite_repair',
    targetWordRange: pacing.targetWordRange,
    lessonScope,
    teachingDepthPlan: depthPlan,
    contextMeta: contextMeta
      ? { ...contextMeta, prompt: 'gap_reteach' }
      : undefined,
    qualityTrace,
  });
}

export async function buildInterruptResponse(
  section: RoadmapSection,
  studentResponse: string,
  decision: TeachingDecision,
  teacherBrainContext = '',
  contextMeta?: { sessionId: string; materialId: string; sectionIndex: number },
  studentMemoryPromptContext = '',
  lecturerConstraintPromptContext = '',
  relevantMaterialContext?: RelevantMaterialContext,
  qualityTrace?: TutorQualityTraceCapture,
) {
  const interruptPacing = buildPacingDirectives({
    phase: 'CHECKPOINT',
    turnType: 'checkpoint_question',
    teachingDecision: decision,
    sectionTitle: section.title,
    sectionContent: section.content,
    isCalculationHeavy: false,
    isDiagramHeavy: false,
    isCheckpointQuestion: true,
    prerequisiteRepairActive: false,
  });
  const lessonScope = buildLessonScope({
    sectionTitle: section.title,
    sectionContent: section.content,
    teacherBrainContext,
    relevantMaterialContext,
    lecturerConstraintContext: lecturerConstraintPromptContext,
    teachingDecision: decision,
    phase: 'CHECKPOINT',
  });
  const depthPlan = buildTeachingDepthPlan({
    phase: 'CHECKPOINT',
    turnType: 'checkpoint_question',
    sectionTitle: section.title,
    sectionContent: section.content,
    lessonScope,
    teachingDecision: decision,
    isCalculationHeavy: false,
    isDiagramHeavy: false,
    prerequisiteRepairActive: false,
  });
  const prompt = [
    `Section title: ${section.title}`,
    teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
    studentMemoryPromptContext
      ? `Student memory context:\n${studentMemoryPromptContext}`
      : '',
    lecturerConstraintPromptContext
      ? `Lecturer constraint context:\n${lecturerConstraintPromptContext}`
      : '',
    relevantMaterialContext?.promptContext
      ? `Relevant material context:\n${relevantMaterialContext.promptContext}`
      : '',
    `Lesson scope:\n${formatLessonScopePrompt(lessonScope)}`,
    `Teaching depth plan:\n${formatTeachingDepthPlan(depthPlan)}`,
    `Section content:\n${truncate(section.content, 2600)}`,
    `Student interruption:\n${truncate(studentResponse, 600)}`,
    `Teaching decision:\n${buildTeachingDecisionPromptLines(decision, { includeInterrupt: true, includeCheckpoint: true }).join('\n')}`,
    ...buildLecturerStyleDirectives({
      phase: 'CHECKPOINT',
      turnType: 'checkpoint_question',
      teachingDecision: decision,
      sectionTitle: section.title,
      alreadyCoveredConcepts: [],
      prerequisiteRepairActive: false,
      isCheckpointQuestion: true,
    }),
    ...interruptPacing.lines,
    lecturerConstraintPromptContext
      ? 'Respect lecturer constraints while answering the interruption.'
      : '',
    'Task: Respond like a live tutor who was interrupted. Briefly acknowledge what the student said, answer or correct it directly, then ask exactly one short checkpoint question. Do not ask multiple questions. Do not continue into the next concept.',
  ].join('\n\n');

  if (teacherBrainContext && contextMeta) {
    console.log('teacher_brain_context_applied', {
      ...contextMeta,
      prompt: 'interrupt_response',
    });
  }
  if (relevantMaterialContext?.promptContext && contextMeta) {
    console.log('relevant_material_context_applied', {
      ...contextMeta,
      prompt: 'interrupt_response',
    });
  }
  if (contextMeta) {
    console.log('lesson_scope_applied', {
      ...contextMeta,
      prompt: 'interrupt_response',
      primaryObjective: lessonScope.primaryObjective,
      inScopeCount: lessonScope.inScopeConcepts.length,
      previewOnlyCount: lessonScope.previewOnlyConcepts.length,
      outOfScopeCount: lessonScope.outOfScopeConcepts.length,
    });
    console.log('teaching_depth_applied', {
      ...contextMeta,
      prompt: 'interrupt_response',
      targetDepth: depthPlan.targetDepth,
      minimumUnderstandingCount: depthPlan.minimumUnderstanding.length,
      deferredDepthCount: depthPlan.deferredDepthConcepts.length,
    });
    console.log('teaching_decision_applied', {
      ...contextMeta,
      prompt: 'interrupt_response',
      strategy: decision.strategy,
      pace: decision.pace,
      repairMode: decision.prerequisiteRepairMode,
    });
  }
  const rawContent = await generateText(prompt, companionSystemPrompt(), 320);
  return enforceTutorMessageQuality({
    content: rawContent,
    prompt,
    maxTokens: 320,
    phase: 'CHECKPOINT',
    turnType: 'checkpoint_question',
    section,
    isCalculationHeavy: false,
    isDiagramHeavy: false,
    questionAllowed: true,
    targetWordRange: interruptPacing.targetWordRange,
    lessonScope,
    teachingDepthPlan: depthPlan,
    contextMeta: contextMeta
      ? { ...contextMeta, prompt: 'interrupt_response' }
      : undefined,
    qualityTrace,
  });
}

export async function buildMasteryOutcome(
  section: RoadmapSection,
  score: number,
  passed: boolean,
  failedConcepts: string[],
) {
  if (passed) {
    return [
      `Mastery check: ${score}%`,
      `Your explanation of ${section.title} held together end to end. That is real understanding of the process, not just a lucky answer.`,
      'If you are ready, I will move us to the next section.',
    ].join('\n\n');
  }

  return [
    `Mastery check: ${score}%`,
    `This is below the 80% mastery threshold for ${section.title}, and the gap is in the process, not in you.`,
    failedConcepts.length
      ? `The one thing to fix first:\n- ${failedConcepts[0]}`
      : 'One or two key ideas are still missing.',
    'I will reteach this section more simply and check again.',
  ].join('\n\n');
}

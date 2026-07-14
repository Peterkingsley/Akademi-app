import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import {
  TeachingDecision,
  TeachingPace,
  TeachingStrategy,
} from './teaching-decision-engine';
import {
  CalculationTeachingContext,
  DiagramTeachingContext,
  StudentMemoryContext,
  StudentMaterialMemoryRow,
  TeachingReflectionRow,
  LearningIntelligenceRecordRow,
  LearningIntelligenceContext,
} from './study-companion.types';
import { safeJsonObject } from './study-companion-prompt-directives';
import {
  truncate,
  truncateList,
  safeStringArray,
} from './study-companion-teacher-brain';
import {
  parseStudentMemoryRecord,
  buildDeterministicStudentMemoryFallback,
  clampReflectionScore,
  parseTeachingReflectionRecord,
  buildDeterministicTeachingReflectionFallback,
  estimateHiddenConfusionRisk,
  inferPrerequisiteWeaknessFromFailedConcepts,
  isTeachingStrategy,
  isTeachingPace,
  isPrerequisiteRepairMode,
} from './study-companion-memory-mastery';
import { generateText } from './study-companion-quality-relevance';

export async function compressStudentSectionMemory(args: {
  userId: string;
  materialId: string;
  courseCode: string;
  sectionIndex: number;
  sectionTitle: string;
  sectionContent: string;
  passed: boolean;
  score: number;
  failedConcepts: string[];
  calculationContext: CalculationTeachingContext;
  diagramContext: DiagramTeachingContext;
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
}) {
  console.log('student_memory_compression_started', {
    userId: args.userId,
    materialId: args.materialId,
    sectionIndex: args.sectionIndex,
  });

  const fallback = buildDeterministicStudentMemoryFallback({
    score: args.score,
    passed: args.passed,
    failedConcepts: args.failedConcepts,
    calculationContext: args.calculationContext,
    diagramContext: args.diagramContext,
    sectionTitle: args.sectionTitle,
  });

  const studentMaterialMemory = (
    prisma as typeof prisma & {
      studentMaterialMemory: {
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
        upsert: (args: unknown) => Promise<unknown>;
      };
    }
  ).studentMaterialMemory;

  const existing = await studentMaterialMemory.findFirst({
    where: {
      user_id: args.userId,
      material_id: args.materialId,
      course_code: args.courseCode,
      section_index: args.sectionIndex,
    },
    select: { id: true },
  });

  try {
    const prompt = [
      'Return JSON only.',
      'No markdown.',
      `Section title: ${args.sectionTitle}`,
      `Mastered: ${args.passed ? 'yes' : 'no'}`,
      `Mastery score: ${args.score}`,
      args.calculationContext.detected
        ? `Calculation context:\n${args.calculationContext.summary}`
        : '',
      args.diagramContext.detected
        ? `Diagram context:\n${args.diagramContext.summary}`
        : '',
      `Section content:\n${truncate(args.sectionContent, 2500)}`,
      `Teach-back attempts:\n${args.teachBackAttempts.map((attempt, index) => `Attempt ${index + 1} score ${attempt.score}\nStudent: ${truncate(attempt.student_response, 400)}\nEvaluation: ${truncate(attempt.evaluation, 300)}`).join('\n\n')}`,
      `Memory dump:\nStudent: ${truncate(args.memoryDumpEvaluation.studentResponse, 500)}\nEvaluation: ${truncate(args.memoryDumpEvaluation.evaluation, 320)}\nScore: ${args.memoryDumpEvaluation.score}`,
      `Failed concepts:\n${args.failedConcepts.join('\n') || 'None listed'}`,
      'Create compact student learning memory JSON with keys: understood, weak_points, misconceptions, calculation_issues, diagram_issues, preferred_explanation_style, revisit_later, compressed_summary.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const raw = await generateText(
      prompt,
      'You compress student learning memory for future adaptive tutoring. Return valid JSON only. Be concise, encouraging, and grounded in the evidence provided.',
      900,
    );

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          parsed = JSON.parse(raw.slice(start, end + 1));
        } catch {
          parsed = null;
        }
      }
    }

    if (!parsed) {
      throw new Error('Student memory JSON parse failed.');
    }

    const normalized = parseStudentMemoryRecord({
      understood: parsed.understood,
      weak_points: parsed.weak_points,
      misconceptions: parsed.misconceptions,
      calculation_issues: parsed.calculation_issues,
      diagram_issues: parsed.diagram_issues,
      preferred_explanation_style:
        typeof parsed.preferred_explanation_style === 'string'
          ? parsed.preferred_explanation_style
          : null,
      revisit_later: parsed.revisit_later,
      compressed_summary:
        typeof parsed.compressed_summary === 'string'
          ? parsed.compressed_summary
          : null,
    });

    const record = await studentMaterialMemory.upsert({
      where: {
        id:
          existing?.id ||
          `missing-${args.userId}-${args.materialId}-${args.sectionIndex}`,
      },
      create: {
        user_id: args.userId,
        material_id: args.materialId,
        course_code: args.courseCode,
        section_index: args.sectionIndex,
        section_title: args.sectionTitle,
        mastered: args.passed,
        mastery_score: args.score,
        understood: normalized.understood as unknown as Prisma.InputJsonValue,
        weak_points: normalized.weakPoints as unknown as Prisma.InputJsonValue,
        misconceptions:
          normalized.misconceptions as unknown as Prisma.InputJsonValue,
        calculation_issues:
          normalized.calculationIssues as unknown as Prisma.InputJsonValue,
        diagram_issues:
          normalized.diagramIssues as unknown as Prisma.InputJsonValue,
        preferred_explanation_style: normalized.preferredExplanationStyle,
        revisit_later:
          normalized.revisitLater as unknown as Prisma.InputJsonValue,
        compressed_summary: normalized.compressedSummary,
      },
      update: {
        section_title: args.sectionTitle,
        mastered: args.passed,
        mastery_score: args.score,
        understood: normalized.understood as unknown as Prisma.InputJsonValue,
        weak_points: normalized.weakPoints as unknown as Prisma.InputJsonValue,
        misconceptions:
          normalized.misconceptions as unknown as Prisma.InputJsonValue,
        calculation_issues:
          normalized.calculationIssues as unknown as Prisma.InputJsonValue,
        diagram_issues:
          normalized.diagramIssues as unknown as Prisma.InputJsonValue,
        preferred_explanation_style: normalized.preferredExplanationStyle,
        revisit_later:
          normalized.revisitLater as unknown as Prisma.InputJsonValue,
        compressed_summary: normalized.compressedSummary,
      },
    });

    console.log('student_memory_compression_completed', {
      userId: args.userId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
    });
    return record;
  } catch (error) {
    console.error('student_memory_compression_failed', {
      userId: args.userId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
      message:
        error instanceof Error ? error.message : 'Unknown student memory error',
    });

    const record = await studentMaterialMemory.upsert({
      where: {
        id:
          existing?.id ||
          `missing-${args.userId}-${args.materialId}-${args.sectionIndex}`,
      },
      create: {
        user_id: args.userId,
        material_id: args.materialId,
        course_code: args.courseCode,
        section_index: args.sectionIndex,
        section_title: args.sectionTitle,
        mastered: args.passed,
        mastery_score: args.score,
        understood: fallback.understood as unknown as Prisma.InputJsonValue,
        weak_points: fallback.weak_points as unknown as Prisma.InputJsonValue,
        misconceptions:
          fallback.misconceptions as unknown as Prisma.InputJsonValue,
        calculation_issues:
          fallback.calculation_issues as unknown as Prisma.InputJsonValue,
        diagram_issues:
          fallback.diagram_issues as unknown as Prisma.InputJsonValue,
        preferred_explanation_style: fallback.preferred_explanation_style,
        revisit_later:
          fallback.revisit_later as unknown as Prisma.InputJsonValue,
        compressed_summary: fallback.compressed_summary,
      },
      update: {
        section_title: args.sectionTitle,
        mastered: args.passed,
        mastery_score: args.score,
        understood: fallback.understood as unknown as Prisma.InputJsonValue,
        weak_points: fallback.weak_points as unknown as Prisma.InputJsonValue,
        misconceptions:
          fallback.misconceptions as unknown as Prisma.InputJsonValue,
        calculation_issues:
          fallback.calculation_issues as unknown as Prisma.InputJsonValue,
        diagram_issues:
          fallback.diagram_issues as unknown as Prisma.InputJsonValue,
        preferred_explanation_style: fallback.preferred_explanation_style,
        revisit_later:
          fallback.revisit_later as unknown as Prisma.InputJsonValue,
        compressed_summary: fallback.compressed_summary,
      },
    });

    console.log('student_memory_fallback_created', {
      userId: args.userId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
    });
    return record;
  }
}

export async function createTeachingReflectionAfterSection(args: {
  sessionId: string;
  companionStateId: string;
  userId: string;
  materialId: string;
  courseCode: string;
  sectionIndex: number;
  sectionTitle: string;
  sectionContent: string;
  decision: TeachingDecision;
  score: number;
  passed: boolean;
  failedConcepts: string[];
  calculationContext: CalculationTeachingContext;
  diagramContext: DiagramTeachingContext;
  studentMemoryContext: StudentMemoryContext;
  latestStudentMemory?: StudentMaterialMemoryRow | null;
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
}) {
  console.log('teaching_reflection_started', {
    sessionId: args.sessionId,
    materialId: args.materialId,
    sectionIndex: args.sectionIndex,
    strategy: args.decision.strategy,
  });

  const teachingReflection = (
    prisma as typeof prisma & {
      teachingReflection: {
        findFirst: (query: unknown) => Promise<TeachingReflectionRow | null>;
        upsert: (query: unknown) => Promise<TeachingReflectionRow>;
      };
    }
  ).teachingReflection;

  const existing = await teachingReflection.findFirst({
    where: {
      session_id: args.sessionId,
      section_index: args.sectionIndex,
    },
    select: { id: true },
  });

  const memoryRecord = args.latestStudentMemory
    ? parseStudentMemoryRecord(args.latestStudentMemory)
    : null;
  const recentTrace = await prisma.tutorTurnTrace.findFirst({
    where: {
      session_id: args.sessionId,
      section_index: args.sectionIndex,
    },
    orderBy: { created_at: 'desc' },
    select: {
      quality_issues: true,
      metadata: true,
    },
  });

  const fallback = buildDeterministicTeachingReflectionFallback({
    score: args.score,
    passed: args.passed,
    failedConcepts: args.failedConcepts,
    decision: args.decision,
    calculationContext: args.calculationContext,
    diagramContext: args.diagramContext,
    studentMemoryContext: args.studentMemoryContext,
    sectionTitle: args.sectionTitle,
  });

  try {
    const prompt = [
      'Return JSON only.',
      'No markdown.',
      `Section title: ${args.sectionTitle}`,
      `Mastery score: ${args.score}`,
      `Passed: ${args.passed ? 'yes' : 'no'}`,
      `Teaching decision used: strategy=${args.decision.strategy}; pace=${args.decision.pace}; repair=${args.decision.prerequisiteRepairMode}; analogy=${args.decision.shouldUseAnalogy}; worked_example=${args.decision.shouldUseWorkedExample}; visual=${args.decision.shouldUseVisualExplanation}; calculation_steps=${args.decision.shouldUseCalculationSteps}; exam_framing=${args.decision.shouldUseExamFraming}; challenge=${args.decision.shouldChallengeStudent}.`,
      args.calculationContext.detected
        ? `Calculation context:\n${args.calculationContext.summary}`
        : '',
      args.diagramContext.detected
        ? `Diagram context:\n${args.diagramContext.summary}`
        : '',
      args.studentMemoryContext.promptContext
        ? `Prior student memory context:\n${args.studentMemoryContext.promptContext}`
        : '',
      memoryRecord?.compressedSummary
        ? `Current student memory summary:\n${memoryRecord.compressedSummary}`
        : '',
      `Section content:\n${truncate(args.sectionContent, 2200)}`,
      `Teach-back evidence:\n${args.teachBackAttempts.map((attempt, index) => `Attempt ${index + 1} score ${attempt.score}\nStudent: ${truncate(attempt.student_response, 240)}\nEvaluation: ${truncate(attempt.evaluation, 220)}`).join('\n\n')}`,
      `Memory dump evidence:\nStudent: ${truncate(args.memoryDumpEvaluation.studentResponse, 320)}\nEvaluation: ${truncate(args.memoryDumpEvaluation.evaluation, 220)}\nScore: ${args.memoryDumpEvaluation.score}`,
      `Failed concepts:\n${args.failedConcepts.join('\n') || 'None listed'}`,
      recentTrace?.quality_issues
        ? `Quality issues:\n${safeStringArray(recentTrace.quality_issues).join(' | ') || 'None recorded'}`
        : '',
      recentTrace?.metadata
        ? `Trace metadata:\n${truncate(JSON.stringify(recentTrace.metadata), 900)}`
        : '',
      'Create compact teaching reflection JSON with keys: concept_understanding, procedural_accuracy, reasoning_quality, confidence, hidden_confusion_risk, what_worked, what_failed, recommended_next_strategy, recommended_next_pace, recommended_interventions, compressed_reflection.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const raw = await generateText(
      prompt,
      'You evaluate teaching effectiveness for adaptive tutoring. Return valid JSON only. Be concise, evidence-grounded, and focused on what teaching strategy helped or failed.',
      700,
    );

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          parsed = JSON.parse(raw.slice(start, end + 1));
        } catch {
          parsed = null;
        }
      }
    }

    if (!parsed) {
      throw new Error('Teaching reflection JSON parse failed.');
    }

    const normalized = parseTeachingReflectionRecord({
      concept_understanding: Number(parsed.concept_understanding ?? 0),
      procedural_accuracy: Number(parsed.procedural_accuracy ?? 0),
      reasoning_quality: Number(parsed.reasoning_quality ?? 0),
      confidence: Number(parsed.confidence ?? 0),
      hidden_confusion_risk: Number(parsed.hidden_confusion_risk ?? 0),
      what_worked: parsed.what_worked,
      what_failed: parsed.what_failed,
      recommended_next_strategy:
        typeof parsed.recommended_next_strategy === 'string'
          ? parsed.recommended_next_strategy
          : null,
      recommended_next_pace:
        typeof parsed.recommended_next_pace === 'string'
          ? parsed.recommended_next_pace
          : null,
      recommended_interventions: parsed.recommended_interventions,
      compressed_reflection:
        typeof parsed.compressed_reflection === 'string'
          ? parsed.compressed_reflection
          : null,
    });

    const record = await teachingReflection.upsert({
      where: {
        id: existing?.id || `missing-${args.sessionId}-${args.sectionIndex}`,
      },
      create: {
        session_id: args.sessionId,
        companion_state_id: args.companionStateId,
        user_id: args.userId,
        material_id: args.materialId,
        course_code: args.courseCode,
        section_index: args.sectionIndex,
        section_title: args.sectionTitle,
        strategy_used: args.decision.strategy,
        pace_used: args.decision.pace,
        repair_mode_used: args.decision.prerequisiteRepairMode,
        analogy_used: args.decision.shouldUseAnalogy,
        worked_example_used: args.decision.shouldUseWorkedExample,
        visual_explanation_used: args.decision.shouldUseVisualExplanation,
        calculation_steps_used: args.decision.shouldUseCalculationSteps,
        exam_framing_used: args.decision.shouldUseExamFraming,
        challenge_used: args.decision.shouldChallengeStudent,
        mastery_score: args.score,
        concept_understanding: normalized.conceptUnderstanding,
        procedural_accuracy: normalized.proceduralAccuracy,
        reasoning_quality: normalized.reasoningQuality,
        confidence: normalized.confidence,
        hidden_confusion_risk: normalized.hiddenConfusionRisk,
        what_worked: normalized.whatWorked as unknown as Prisma.InputJsonValue,
        what_failed: normalized.whatFailed as unknown as Prisma.InputJsonValue,
        recommended_next_strategy: normalized.recommendedNextStrategy,
        recommended_next_pace: normalized.recommendedNextPace,
        recommended_interventions:
          normalized.recommendedInterventions as unknown as Prisma.InputJsonValue,
        compressed_reflection: normalized.compressedReflection,
      },
      update: {
        section_title: args.sectionTitle,
        strategy_used: args.decision.strategy,
        pace_used: args.decision.pace,
        repair_mode_used: args.decision.prerequisiteRepairMode,
        analogy_used: args.decision.shouldUseAnalogy,
        worked_example_used: args.decision.shouldUseWorkedExample,
        visual_explanation_used: args.decision.shouldUseVisualExplanation,
        calculation_steps_used: args.decision.shouldUseCalculationSteps,
        exam_framing_used: args.decision.shouldUseExamFraming,
        challenge_used: args.decision.shouldChallengeStudent,
        mastery_score: args.score,
        concept_understanding: normalized.conceptUnderstanding,
        procedural_accuracy: normalized.proceduralAccuracy,
        reasoning_quality: normalized.reasoningQuality,
        confidence: normalized.confidence,
        hidden_confusion_risk: normalized.hiddenConfusionRisk,
        what_worked: normalized.whatWorked as unknown as Prisma.InputJsonValue,
        what_failed: normalized.whatFailed as unknown as Prisma.InputJsonValue,
        recommended_next_strategy: normalized.recommendedNextStrategy,
        recommended_next_pace: normalized.recommendedNextPace,
        recommended_interventions:
          normalized.recommendedInterventions as unknown as Prisma.InputJsonValue,
        compressed_reflection: normalized.compressedReflection,
      },
    });

    console.log('teaching_reflection_completed', {
      sessionId: args.sessionId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
    });
    return record;
  } catch (error) {
    console.error('teaching_reflection_failed', {
      sessionId: args.sessionId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
      message:
        error instanceof Error ? error.message : 'Unknown reflection error',
    });

    const normalized = parseTeachingReflectionRecord(fallback);
    const record = await teachingReflection.upsert({
      where: {
        id: existing?.id || `missing-${args.sessionId}-${args.sectionIndex}`,
      },
      create: {
        session_id: args.sessionId,
        companion_state_id: args.companionStateId,
        user_id: args.userId,
        material_id: args.materialId,
        course_code: args.courseCode,
        section_index: args.sectionIndex,
        section_title: args.sectionTitle,
        strategy_used: args.decision.strategy,
        pace_used: args.decision.pace,
        repair_mode_used: args.decision.prerequisiteRepairMode,
        analogy_used: args.decision.shouldUseAnalogy,
        worked_example_used: args.decision.shouldUseWorkedExample,
        visual_explanation_used: args.decision.shouldUseVisualExplanation,
        calculation_steps_used: args.decision.shouldUseCalculationSteps,
        exam_framing_used: args.decision.shouldUseExamFraming,
        challenge_used: args.decision.shouldChallengeStudent,
        mastery_score: args.score,
        concept_understanding: normalized.conceptUnderstanding,
        procedural_accuracy: normalized.proceduralAccuracy,
        reasoning_quality: normalized.reasoningQuality,
        confidence: normalized.confidence,
        hidden_confusion_risk: normalized.hiddenConfusionRisk,
        what_worked: normalized.whatWorked as unknown as Prisma.InputJsonValue,
        what_failed: normalized.whatFailed as unknown as Prisma.InputJsonValue,
        recommended_next_strategy: normalized.recommendedNextStrategy,
        recommended_next_pace: normalized.recommendedNextPace,
        recommended_interventions:
          normalized.recommendedInterventions as unknown as Prisma.InputJsonValue,
        compressed_reflection: normalized.compressedReflection,
      },
      update: {
        section_title: args.sectionTitle,
        strategy_used: args.decision.strategy,
        pace_used: args.decision.pace,
        repair_mode_used: args.decision.prerequisiteRepairMode,
        analogy_used: args.decision.shouldUseAnalogy,
        worked_example_used: args.decision.shouldUseWorkedExample,
        visual_explanation_used: args.decision.shouldUseVisualExplanation,
        calculation_steps_used: args.decision.shouldUseCalculationSteps,
        exam_framing_used: args.decision.shouldUseExamFraming,
        challenge_used: args.decision.shouldChallengeStudent,
        mastery_score: args.score,
        concept_understanding: normalized.conceptUnderstanding,
        procedural_accuracy: normalized.proceduralAccuracy,
        reasoning_quality: normalized.reasoningQuality,
        confidence: normalized.confidence,
        hidden_confusion_risk: normalized.hiddenConfusionRisk,
        what_worked: normalized.whatWorked as unknown as Prisma.InputJsonValue,
        what_failed: normalized.whatFailed as unknown as Prisma.InputJsonValue,
        recommended_next_strategy: normalized.recommendedNextStrategy,
        recommended_next_pace: normalized.recommendedNextPace,
        recommended_interventions:
          normalized.recommendedInterventions as unknown as Prisma.InputJsonValue,
        compressed_reflection: normalized.compressedReflection,
      },
    });

    console.log('teaching_reflection_fallback_created', {
      sessionId: args.sessionId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
    });
    return record;
  }
}

export async function createLearningIntelligenceRecordAfterSection(args: {
  sessionId: string;
  companionStateId: string;
  userId: string;
  materialId: string;
  courseCode: string;
  sectionIndex: number;
  sectionTitle: string;
  sectionContent: string;
  score: number;
  passed: boolean;
  failedConcepts: string[];
  calculationContext: CalculationTeachingContext;
  diagramContext: DiagramTeachingContext;
  studentMemoryContext: StudentMemoryContext;
  latestStudentMemory?: StudentMaterialMemoryRow | null;
  latestTeachingReflection?: TeachingReflectionRow | null;
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
}) {
  console.log('learning_intelligence_started', {
    sessionId: args.sessionId,
    materialId: args.materialId,
    sectionIndex: args.sectionIndex,
  });

  const learningIntelligenceRecord = (
    prisma as typeof prisma & {
      learningIntelligenceRecord: {
        findFirst: (
          query: unknown,
        ) => Promise<LearningIntelligenceRecordRow | null>;
        upsert: (query: unknown) => Promise<LearningIntelligenceRecordRow>;
      };
    }
  ).learningIntelligenceRecord;

  const existing = await learningIntelligenceRecord.findFirst({
    where: {
      session_id: args.sessionId,
      section_index: args.sectionIndex,
    },
    select: { id: true },
  });

  const memoryRecord = args.latestStudentMemory
    ? parseStudentMemoryRecord(args.latestStudentMemory)
    : null;
  const reflection = args.latestTeachingReflection
    ? parseTeachingReflectionRecord(args.latestTeachingReflection)
    : null;
  const averageTeachBack =
    args.teachBackAttempts.length > 0
      ? Math.round(
          args.teachBackAttempts.reduce(
            (sum, attempt) => sum + attempt.score,
            0,
          ) / args.teachBackAttempts.length,
        )
      : args.score;
  const shortAnswerRisk = args.teachBackAttempts.some(
    (attempt) =>
      attempt.student_response.trim().split(/\s+/).filter(Boolean).length < 18,
  );
  const calculationIssues = memoryRecord?.calculationIssues || [];
  const diagramIssues = memoryRecord?.diagramIssues || [];
  const prerequisiteWeakness = inferPrerequisiteWeaknessFromFailedConcepts(
    args.failedConcepts,
  );
  const recentTutorTrace = await (
    prisma as typeof prisma & {
      tutorTurnTrace: {
        findFirst: (
          query: unknown,
        ) => Promise<{ quality_issues: unknown } | null>;
      };
    }
  ).tutorTurnTrace.findFirst({
    where: {
      session_id: args.sessionId,
      section_index: args.sectionIndex,
    },
    orderBy: { created_at: 'desc' },
    select: {
      quality_issues: true,
    },
  });
  const hiddenConfusionEstimate = estimateHiddenConfusionRisk({
    sectionTitle: args.sectionTitle,
    sectionContent: args.sectionContent,
    masteryScore: args.score,
    masteryThreshold: 80,
    teachBackAttempts: args.teachBackAttempts,
    memoryDumpEvaluation: args.memoryDumpEvaluation,
    failedConcepts: args.failedConcepts,
    studentMemoryContext: args.studentMemoryContext,
    latestStudentMemory: args.latestStudentMemory,
    latestLearningIntelligenceContext: null,
    traceQualityIssues: safeStringArray(recentTutorTrace?.quality_issues),
    calculationContext: args.calculationContext,
    diagramContext: args.diagramContext,
  });

  const fallback = {
    concept_understanding: clampReflectionScore(args.score),
    procedural_accuracy: clampReflectionScore(
      args.score - (calculationIssues.length ? 15 : 0),
    ),
    reasoning_quality: clampReflectionScore(
      averageTeachBack - Math.max(0, 70 - averageTeachBack) * 0.4,
    ),
    confidence: clampReflectionScore(
      args.score -
        Math.max(0, averageTeachBack - args.memoryDumpEvaluation.score) -
        args.failedConcepts.length * 4,
    ),
    hidden_confusion_risk: clampReflectionScore(
      Math.max(
        hiddenConfusionEstimate.risk,
        (args.passed ? 30 : 60) +
          args.failedConcepts.length * 8 +
          (shortAnswerRisk ? 10 : 0) +
          (args.score <= 84 ? 8 : 0),
      ),
    ),
    retention_risk: clampReflectionScore(
      (100 - args.memoryDumpEvaluation.score) * 0.7 +
        (args.memoryDumpEvaluation.score < averageTeachBack ? 10 : 0),
    ),
    calculation_weakness:
      calculationIssues.length > 0 ||
      (args.calculationContext.detected && args.score < 75),
    diagram_weakness:
      diagramIssues.length > 0 ||
      (args.diagramContext.detected && args.score < 75),
    prerequisite_weakness: prerequisiteWeakness,
    recommended_action:
      args.score < 80
        ? 'Reteach with slower pacing, prerequisite refresh, and one targeted worked example.'
        : 'Reinforce retention with a short recap and one retrieval prompt in the next related section.',
    evidence: {
      main_reason:
        args.failedConcepts[0] ||
        'Assessment pattern suggests uneven mastery across dimensions.',
      signals: truncateList(
        [
          `Teach-back average: ${averageTeachBack}`,
          `Memory dump score: ${args.memoryDumpEvaluation.score}`,
          shortAnswerRisk ? 'Student answers were unusually short.' : '',
          calculationIssues.length
            ? `Calculation issues: ${calculationIssues.slice(0, 2).join(', ')}`
            : '',
          diagramIssues.length
            ? `Diagram issues: ${diagramIssues.slice(0, 2).join(', ')}`
            : '',
          ...hiddenConfusionEstimate.signals,
        ].filter(Boolean),
        5,
        140,
      ),
      hidden_confusion_level: hiddenConfusionEstimate.level,
      hidden_confusion_signals: hiddenConfusionEstimate.signals,
      recommended_confusion_intervention:
        hiddenConfusionEstimate.recommendedIntervention,
    },
  };

  try {
    const prompt = [
      'Return JSON only.',
      'No markdown.',
      `Section title: ${args.sectionTitle}`,
      `Mastery score: ${args.score}`,
      `Passed: ${args.passed ? 'yes' : 'no'}`,
      args.calculationContext.detected
        ? `Calculation context:\n${args.calculationContext.summary}`
        : '',
      args.diagramContext.detected
        ? `Diagram context:\n${args.diagramContext.summary}`
        : '',
      memoryRecord?.compressedSummary
        ? `Student memory:\n${memoryRecord.compressedSummary}`
        : '',
      reflection?.compressedReflection
        ? `Teaching reflection:\n${reflection.compressedReflection}`
        : '',
      `Teach-back evidence:\n${args.teachBackAttempts.map((attempt, index) => `Attempt ${index + 1} score ${attempt.score}\nStudent: ${truncate(attempt.student_response, 220)}\nEvaluation: ${truncate(attempt.evaluation, 180)}`).join('\n\n')}`,
      `Memory dump evidence:\nStudent: ${truncate(args.memoryDumpEvaluation.studentResponse, 260)}\nEvaluation: ${truncate(args.memoryDumpEvaluation.evaluation, 180)}\nScore: ${args.memoryDumpEvaluation.score}`,
      `Failed concepts:\n${args.failedConcepts.join('\n') || 'None listed'}`,
      `Section content:\n${truncate(args.sectionContent, 1800)}`,
      'Create learning intelligence JSON with keys: concept_understanding, procedural_accuracy, reasoning_quality, confidence, hidden_confusion_risk, retention_risk, calculation_weakness, diagram_weakness, prerequisite_weakness, recommended_action, evidence.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const raw = await generateText(
      prompt,
      'You analyze student learning quality across multiple dimensions. Return valid JSON only. Be concise, evidence-based, and practical.',
      650,
    );

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          parsed = JSON.parse(raw.slice(start, end + 1));
        } catch {
          parsed = null;
        }
      }
    }

    if (!parsed) {
      throw new Error('Learning intelligence JSON parse failed.');
    }

    const evidence = safeJsonObject<{
      main_reason?: string;
      signals?: unknown;
      hidden_confusion_level?: string;
      hidden_confusion_signals?: unknown;
      recommended_confusion_intervention?: string;
    }>(parsed.evidence, {});
    const record = await learningIntelligenceRecord.upsert({
      where: {
        id: existing?.id || `missing-${args.sessionId}-${args.sectionIndex}`,
      },
      create: {
        session_id: args.sessionId,
        companion_state_id: args.companionStateId,
        user_id: args.userId,
        material_id: args.materialId,
        course_code: args.courseCode,
        section_index: args.sectionIndex,
        section_title: args.sectionTitle,
        mastery_score: args.score,
        concept_understanding: clampReflectionScore(
          Number(parsed.concept_understanding ?? 50),
        ),
        procedural_accuracy: clampReflectionScore(
          Number(parsed.procedural_accuracy ?? 50),
        ),
        reasoning_quality: clampReflectionScore(
          Number(parsed.reasoning_quality ?? 50),
        ),
        confidence: clampReflectionScore(Number(parsed.confidence ?? 50)),
        hidden_confusion_risk: clampReflectionScore(
          Number(parsed.hidden_confusion_risk ?? 50),
        ),
        retention_risk: clampReflectionScore(
          Number(parsed.retention_risk ?? 50),
        ),
        calculation_weakness: Boolean(parsed.calculation_weakness),
        diagram_weakness: Boolean(parsed.diagram_weakness),
        prerequisite_weakness: Boolean(parsed.prerequisite_weakness),
        recommended_action:
          typeof parsed.recommended_action === 'string'
            ? parsed.recommended_action
            : null,
        evidence: {
          main_reason: evidence.main_reason ? String(evidence.main_reason) : '',
          signals: safeStringArray(evidence.signals),
          hidden_confusion_level: evidence.hidden_confusion_level
            ? String(evidence.hidden_confusion_level)
            : hiddenConfusionEstimate.level,
          hidden_confusion_signals: safeStringArray(
            evidence.hidden_confusion_signals,
          ).length
            ? safeStringArray(evidence.hidden_confusion_signals)
            : hiddenConfusionEstimate.signals,
          recommended_confusion_intervention:
            evidence.recommended_confusion_intervention
              ? String(evidence.recommended_confusion_intervention)
              : hiddenConfusionEstimate.recommendedIntervention,
        } as unknown as Prisma.InputJsonValue,
      },
      update: {
        section_title: args.sectionTitle,
        mastery_score: args.score,
        concept_understanding: clampReflectionScore(
          Number(parsed.concept_understanding ?? 50),
        ),
        procedural_accuracy: clampReflectionScore(
          Number(parsed.procedural_accuracy ?? 50),
        ),
        reasoning_quality: clampReflectionScore(
          Number(parsed.reasoning_quality ?? 50),
        ),
        confidence: clampReflectionScore(Number(parsed.confidence ?? 50)),
        hidden_confusion_risk: clampReflectionScore(
          Number(parsed.hidden_confusion_risk ?? 50),
        ),
        retention_risk: clampReflectionScore(
          Number(parsed.retention_risk ?? 50),
        ),
        calculation_weakness: Boolean(parsed.calculation_weakness),
        diagram_weakness: Boolean(parsed.diagram_weakness),
        prerequisite_weakness: Boolean(parsed.prerequisite_weakness),
        recommended_action:
          typeof parsed.recommended_action === 'string'
            ? parsed.recommended_action
            : null,
        evidence: {
          main_reason: evidence.main_reason ? String(evidence.main_reason) : '',
          signals: safeStringArray(evidence.signals),
          hidden_confusion_level: evidence.hidden_confusion_level
            ? String(evidence.hidden_confusion_level)
            : hiddenConfusionEstimate.level,
          hidden_confusion_signals: safeStringArray(
            evidence.hidden_confusion_signals,
          ).length
            ? safeStringArray(evidence.hidden_confusion_signals)
            : hiddenConfusionEstimate.signals,
          recommended_confusion_intervention:
            evidence.recommended_confusion_intervention
              ? String(evidence.recommended_confusion_intervention)
              : hiddenConfusionEstimate.recommendedIntervention,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    console.log('learning_intelligence_completed', {
      sessionId: args.sessionId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
    });
    return record;
  } catch (error) {
    console.error('learning_intelligence_failed', {
      sessionId: args.sessionId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
      message:
        error instanceof Error
          ? error.message
          : 'Unknown learning intelligence error',
    });

    const record = await learningIntelligenceRecord.upsert({
      where: {
        id: existing?.id || `missing-${args.sessionId}-${args.sectionIndex}`,
      },
      create: {
        session_id: args.sessionId,
        companion_state_id: args.companionStateId,
        user_id: args.userId,
        material_id: args.materialId,
        course_code: args.courseCode,
        section_index: args.sectionIndex,
        section_title: args.sectionTitle,
        mastery_score: args.score,
        concept_understanding: fallback.concept_understanding,
        procedural_accuracy: fallback.procedural_accuracy,
        reasoning_quality: fallback.reasoning_quality,
        confidence: fallback.confidence,
        hidden_confusion_risk: fallback.hidden_confusion_risk,
        retention_risk: fallback.retention_risk,
        calculation_weakness: fallback.calculation_weakness,
        diagram_weakness: fallback.diagram_weakness,
        prerequisite_weakness: fallback.prerequisite_weakness,
        recommended_action: fallback.recommended_action,
        evidence: fallback.evidence as unknown as Prisma.InputJsonValue,
      },
      update: {
        section_title: args.sectionTitle,
        mastery_score: args.score,
        concept_understanding: fallback.concept_understanding,
        procedural_accuracy: fallback.procedural_accuracy,
        reasoning_quality: fallback.reasoning_quality,
        confidence: fallback.confidence,
        hidden_confusion_risk: fallback.hidden_confusion_risk,
        retention_risk: fallback.retention_risk,
        calculation_weakness: fallback.calculation_weakness,
        diagram_weakness: fallback.diagram_weakness,
        prerequisite_weakness: fallback.prerequisite_weakness,
        recommended_action: fallback.recommended_action,
        evidence: fallback.evidence as unknown as Prisma.InputJsonValue,
      },
    });

    console.log('learning_intelligence_fallback_created', {
      sessionId: args.sessionId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
    });
    return record;
  }
}

export async function buildImmediateLearningIntelligenceContext(args: {
  sessionId: string;
  sectionIndex: number;
  sectionTitle: string;
  sectionContent: string;
  score: number;
  passed: boolean;
  failedConcepts: string[];
  calculationContext: CalculationTeachingContext;
  diagramContext: DiagramTeachingContext;
  studentMemoryContext: StudentMemoryContext;
  latestStudentMemory?: StudentMaterialMemoryRow | null;
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
}): Promise<LearningIntelligenceContext> {
  const memoryRecord = args.latestStudentMemory
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
      : args.score;
  const shortAnswerRisk = args.teachBackAttempts.some(
    (attempt) =>
      attempt.student_response.trim().split(/\s+/).filter(Boolean).length < 18,
  );
  const calculationIssues = memoryRecord?.calculationIssues || [];
  const diagramIssues = memoryRecord?.diagramIssues || [];
  const prerequisiteWeakness = inferPrerequisiteWeaknessFromFailedConcepts(
    args.failedConcepts,
  );
  const recentTutorTrace = await (
    prisma as typeof prisma & {
      tutorTurnTrace: {
        findFirst: (
          query: unknown,
        ) => Promise<{ quality_issues: unknown } | null>;
      };
    }
  ).tutorTurnTrace.findFirst({
    where: {
      session_id: args.sessionId,
      section_index: args.sectionIndex,
    },
    orderBy: { created_at: 'desc' },
    select: {
      quality_issues: true,
    },
  });
  const hiddenConfusionEstimate = estimateHiddenConfusionRisk({
    sectionTitle: args.sectionTitle,
    sectionContent: args.sectionContent,
    masteryScore: args.score,
    masteryThreshold: 80,
    teachBackAttempts: args.teachBackAttempts,
    memoryDumpEvaluation: args.memoryDumpEvaluation,
    failedConcepts: args.failedConcepts,
    studentMemoryContext: args.studentMemoryContext,
    latestStudentMemory: args.latestStudentMemory,
    latestLearningIntelligenceContext: null,
    traceQualityIssues: safeStringArray(recentTutorTrace?.quality_issues),
    calculationContext: args.calculationContext,
    diagramContext: args.diagramContext,
  });

  const hiddenConfusionRisk = clampReflectionScore(
    Math.max(
      hiddenConfusionEstimate.risk,
      (args.passed ? 30 : 60) +
        args.failedConcepts.length * 8 +
        (shortAnswerRisk ? 10 : 0) +
        (args.score <= 84 ? 8 : 0),
    ),
  );

  return {
    masteryScore: args.score,
    conceptUnderstanding: clampReflectionScore(args.score),
    proceduralAccuracy: clampReflectionScore(
      args.score - (calculationIssues.length ? 15 : 0),
    ),
    reasoningQuality: clampReflectionScore(
      averageTeachBack - Math.max(0, 70 - averageTeachBack) * 0.4,
    ),
    confidence: clampReflectionScore(
      args.score -
        Math.max(0, averageTeachBack - args.memoryDumpEvaluation.score) -
        args.failedConcepts.length * 4,
    ),
    hiddenConfusionRisk,
    hiddenConfusionLevel: hiddenConfusionEstimate.level,
    hiddenConfusionSignals: hiddenConfusionEstimate.signals,
    recommendedConfusionIntervention:
      hiddenConfusionEstimate.recommendedIntervention,
    retentionRisk: clampReflectionScore(
      (100 - args.memoryDumpEvaluation.score) * 0.7 +
        (args.memoryDumpEvaluation.score < averageTeachBack ? 10 : 0),
    ),
    calculationWeakness:
      calculationIssues.length > 0 ||
      (args.calculationContext.detected && args.score < 75),
    diagramWeakness:
      diagramIssues.length > 0 ||
      (args.diagramContext.detected && args.score < 75),
    prerequisiteWeakness,
    recommendedAction:
      args.score < 80
        ? 'Reteach with slower pacing, prerequisite refresh, and one targeted worked example.'
        : 'Reinforce retention with a short recap and one retrieval prompt in the next related section.',
    evidence: {
      mainReason:
        args.failedConcepts[0] ||
        'Assessment pattern suggests uneven mastery across dimensions.',
      signals: truncateList(
        [
          `Teach-back average: ${averageTeachBack}`,
          `Memory dump score: ${args.memoryDumpEvaluation.score}`,
          shortAnswerRisk ? 'Student answers were unusually short.' : '',
          calculationIssues.length
            ? `Calculation issues: ${calculationIssues.slice(0, 2).join(', ')}`
            : '',
          diagramIssues.length
            ? `Diagram issues: ${diagramIssues.slice(0, 2).join(', ')}`
            : '',
          ...hiddenConfusionEstimate.signals,
        ].filter(Boolean),
        5,
        140,
      ),
    },
  };
}

export function parseTeachingDecisionSnapshot(
  snapshot: Record<string, unknown> | undefined,
): TeachingDecision | null {
  if (!snapshot) return null;

  const strategy =
    typeof snapshot.strategy === 'string' ? snapshot.strategy : null;
  const pace = typeof snapshot.pace === 'string' ? snapshot.pace : null;
  const prerequisiteRepairMode =
    typeof snapshot.prerequisiteRepairMode === 'string'
      ? snapshot.prerequisiteRepairMode
      : null;

  if (
    !isTeachingStrategy(strategy) ||
    !isTeachingPace(pace) ||
    !isPrerequisiteRepairMode(prerequisiteRepairMode)
  ) {
    return null;
  }

  return {
    strategy,
    pace,
    prerequisiteRepairMode,
    shouldUseAnalogy: Boolean(snapshot.shouldUseAnalogy),
    shouldUseWorkedExample: Boolean(snapshot.shouldUseWorkedExample),
    shouldUseVisualExplanation: Boolean(snapshot.shouldUseVisualExplanation),
    shouldUseCalculationSteps: Boolean(snapshot.shouldUseCalculationSteps),
    shouldUseExamFraming: Boolean(snapshot.shouldUseExamFraming),
    shouldChallengeStudent: Boolean(snapshot.shouldChallengeStudent),
    shouldSlowDown: Boolean(snapshot.shouldSlowDown),
    shouldRepairPrerequisite: Boolean(snapshot.shouldRepairPrerequisite),
    repairConcepts: safeStringArray(snapshot.repairConcepts),
    reason: typeof snapshot.reason === 'string' ? snapshot.reason : '',
    promptDirectives: safeStringArray(snapshot.promptDirectives),
    traceMetadata: safeJsonObject<Record<string, unknown>>(
      snapshot.traceMetadata,
      {},
    ),
  };
}

export async function updateStudentLearningProfileAfterReflection(
  userId: string,
  courseCode: string,
  materialId: string,
) {
  console.log('student_learning_profile_update_started', {
    userId,
    courseCode,
    materialId,
  });

  try {
    const [reflections, intelligenceRecords, memories] = await Promise.all([
      (
        prisma as typeof prisma & {
          teachingReflection: {
            findMany: (query: unknown) => Promise<TeachingReflectionRow[]>;
          };
        }
      ).teachingReflection.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: 30,
      }),
      (
        prisma as typeof prisma & {
          learningIntelligenceRecord: {
            findMany: (
              query: unknown,
            ) => Promise<LearningIntelligenceRecordRow[]>;
          };
        }
      ).learningIntelligenceRecord.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: 30,
      }),
      (
        prisma as typeof prisma & {
          studentMaterialMemory: {
            findMany: (query: unknown) => Promise<StudentMaterialMemoryRow[]>;
          };
        }
      ).studentMaterialMemory.findMany({
        where: { user_id: userId },
        orderBy: { updated_at: 'desc' },
        take: 30,
      }),
    ]);

    const strategyScores: Record<TeachingStrategy, number> = {
      analogy_first: 50,
      visual_first: 50,
      worked_example_first: 50,
      definition_first: 50,
      problem_first: 50,
      story_first: 50,
      exam_first: 50,
      hybrid: 50,
    };

    for (const reflection of reflections) {
      if (!isTeachingStrategy(reflection.strategy_used)) continue;
      const scoreBase = reflection.mastery_score ?? 50;
      const confusionPenalty =
        Math.max(0, (reflection.hidden_confusion_risk ?? 50) - 40) * 0.2;
      const confidenceBonus =
        Math.max(0, (reflection.confidence ?? 50) - 50) * 0.15;
      const net = clampReflectionScore(
        scoreBase - confusionPenalty + confidenceBonus,
      );
      strategyScores[reflection.strategy_used] = clampReflectionScore(
        strategyScores[reflection.strategy_used] * 0.65 + net * 0.35,
      );
    }

    const diagramHeavyReflections = reflections.filter(
      (item) => item.visual_explanation_used,
    );
    if (
      diagramHeavyReflections.some(
        (item) =>
          (item.mastery_score ?? 0) >= 80 &&
          (item.hidden_confusion_risk ?? 100) <= 40,
      )
    ) {
      strategyScores.visual_first = clampReflectionScore(
        strategyScores.visual_first + 8,
      );
    }
    const workedExampleReflections = reflections.filter(
      (item) => item.worked_example_used,
    );
    if (
      workedExampleReflections.some(
        (item) =>
          (item.mastery_score ?? 0) >= 80 &&
          (item.hidden_confusion_risk ?? 100) <= 40,
      )
    ) {
      strategyScores.worked_example_first = clampReflectionScore(
        strategyScores.worked_example_first + 8,
      );
    }
    const analogyReflections = reflections.filter((item) => item.analogy_used);
    if (
      analogyReflections.some(
        (item) =>
          (item.confidence ?? 0) >= 65 ||
          (item.hidden_confusion_risk ?? 100) <= 40,
      )
    ) {
      strategyScores.analogy_first = clampReflectionScore(
        strategyScores.analogy_first + 6,
      );
    }

    const avgConfidence = intelligenceRecords.length
      ? intelligenceRecords.reduce((sum, item) => sum + item.confidence, 0) /
        intelligenceRecords.length
      : 50;
    const avgHiddenConfusion = intelligenceRecords.length
      ? intelligenceRecords.reduce(
          (sum, item) => sum + item.hidden_confusion_risk,
          0,
        ) / intelligenceRecords.length
      : 50;
    const avgMastery = intelligenceRecords.length
      ? intelligenceRecords.reduce(
          (sum, item) => sum + (item.mastery_score ?? 50),
          0,
        ) / intelligenceRecords.length
      : 50;

    const repeatedCalculationIssues =
      memories.filter(
        (item) => safeStringArray(item.calculation_issues).length > 0,
      ).length >= 2;
    const repeatedDiagramIssues =
      memories.filter((item) => safeStringArray(item.diagram_issues).length > 0)
        .length >= 2;
    const repeatedLowConfidence =
      intelligenceRecords.filter((item) => item.confidence < 50).length >= 2;

    let preferredTeachingStrategy: TeachingStrategy | null = null;
    const bestEntry = Object.entries(strategyScores).sort(
      (a, b) => b[1] - a[1],
    )[0];
    const secondEntry = Object.entries(strategyScores).sort(
      (a, b) => b[1] - a[1],
    )[1];
    if (
      bestEntry &&
      isTeachingStrategy(bestEntry[0]) &&
      bestEntry[1] >= 60 &&
      (!secondEntry || bestEntry[1] - secondEntry[1] >= 5)
    ) {
      preferredTeachingStrategy = bestEntry[0];
    } else if (reflections.length >= 6) {
      preferredTeachingStrategy = 'hybrid';
    }

    let preferredPace: TeachingPace = 'normal';
    const slowHelpful = reflections.filter(
      (item) =>
        item.pace_used === 'slow' &&
        (item.mastery_score ?? 0) >= 75 &&
        (item.hidden_confusion_risk ?? 100) <= 45,
    ).length;
    const fastStrong = intelligenceRecords.filter(
      (item) =>
        (item.mastery_score ?? 0) >= 85 &&
        item.confidence >= 75 &&
        item.hidden_confusion_risk <= 35,
    ).length;
    if (avgConfidence < 55 || avgHiddenConfusion > 55 || slowHelpful >= 2) {
      preferredPace = 'slow';
    } else if (
      avgMastery >= 85 &&
      avgConfidence >= 75 &&
      avgHiddenConfusion <= 35 &&
      fastStrong >= 3
    ) {
      preferredPace = 'fast';
    }

    await prisma.learningProfile.upsert({
      where: { user_id: userId },
      update: {
        teaching_strategy_success:
          strategyScores as unknown as Prisma.InputJsonValue,
        preferred_teaching_strategy: preferredTeachingStrategy,
        preferred_pace: preferredPace,
        analogy_success_score: strategyScores.analogy_first,
        visual_success_score: strategyScores.visual_first,
        worked_example_success_score: strategyScores.worked_example_first,
        definition_success_score: strategyScores.definition_first,
        problem_first_success_score: strategyScores.problem_first,
        story_success_score: strategyScores.story_first,
        exam_first_success_score: strategyScores.exam_first,
        calculation_support_needed: repeatedCalculationIssues,
        visual_support_needed: repeatedDiagramIssues,
        confidence_support_needed: repeatedLowConfidence,
        last_profile_update_at: new Date(),
        last_active: new Date(),
      },
      create: {
        user_id: userId,
        subject_strengths: {} as unknown as Prisma.InputJsonValue,
        subject_weaknesses: {} as unknown as Prisma.InputJsonValue,
        question_patterns: {} as unknown as Prisma.InputJsonValue,
        teaching_strategy_success:
          strategyScores as unknown as Prisma.InputJsonValue,
        preferred_teaching_strategy: preferredTeachingStrategy,
        preferred_pace: preferredPace,
        analogy_success_score: strategyScores.analogy_first,
        visual_success_score: strategyScores.visual_first,
        worked_example_success_score: strategyScores.worked_example_first,
        definition_success_score: strategyScores.definition_first,
        problem_first_success_score: strategyScores.problem_first,
        story_success_score: strategyScores.story_first,
        exam_first_success_score: strategyScores.exam_first,
        calculation_support_needed: repeatedCalculationIssues,
        visual_support_needed: repeatedDiagramIssues,
        confidence_support_needed: repeatedLowConfidence,
        last_profile_update_at: new Date(),
        last_active: new Date(),
      },
    });

    console.log('student_learning_profile_update_completed', {
      userId,
      courseCode,
      materialId,
      preferredTeachingStrategy,
      preferredPace,
    });
  } catch (error) {
    console.error('student_learning_profile_update_failed', {
      userId,
      courseCode,
      materialId,
      message:
        error instanceof Error
          ? error.message
          : 'Unknown learning profile update error',
    });
  }
}

import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import {
  decideTeachingStrategy,
  TeachingDecision,
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
  RelevantMaterialContext,
  LessonScope,
  TeachingDepthPlan,
  StudentMaterialMemoryRow,
  TeachingReflectionRow,
  LearningIntelligenceRecordRow,
  LearningIntelligenceContext,
  StudentLearningProfileContext,
  TutorSelfImprovementContext,
  LecturerConstraintRecord,
  LecturerConstraintContext,
  HybridMasteryResult,
} from './study-companion.types';
import {
  RETENTION_THROWBACK_THRESHOLD,
  safeJsonObject,
} from './study-companion-prompt-directives';
import { truncateList, safeStringArray } from './study-companion-teacher-brain';
import {
  parseStudentMemoryRecord,
  buildStudentMemoryPromptContext,
  clampReflectionScore,
  parseLearningIntelligenceContext,
  isTeachingStrategy,
  isTeachingPace,
} from './study-companion-memory-mastery';
import { parseLecturerConstraintContext } from './study-companion-quality-relevance';
import { sectionAt } from './study-companion-session-state';

const TRANSCRIPT_MESSAGE_LIMIT = 12;
const TRANSCRIPT_AI_CHAR_BUDGET = 700;
const TRANSCRIPT_STUDENT_CHAR_BUDGET = 240;

function truncateTranscriptEntry(value: string, max: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  // Keep the TAIL of the message, not the head. The end of a tutor turn
  // carries the newest statements - the worked example just given and the
  // question just asked - which is exactly what the next generation must not
  // repeat and must respond to. Keeping the head instead caused the model to
  // re-derive examples that had been trimmed out of its view.
  const slice = normalized.slice(normalized.length - max);
  // Advance to the first full sentence inside the window so the model reads
  // coherent prior statements, not an amputated half-sentence.
  const firstStart = slice.search(/(?<=[.!?])\s+[A-Z0-9(]/);
  return firstStart > -1 && firstStart < max * 0.5
    ? `…${slice.slice(firstStart).trim()}`
    : `…${slice.trimStart()}`;
}

/**
 * Session transcript memory: the tutor must remember everything it already
 * said in this chat. Without this, every pass is generated in isolation and
 * the model re-introduces the topic from scratch each turn ("We define
 * Physics as..." x4). This loads the most recent turns of the actual
 * conversation - both what the tutor said and what the student said - and
 * formats them as prompt context with a hard anti-repetition directive.
 */
export async function loadSessionTranscriptContext(sessionId: string): Promise<string> {
  const rows = await prisma.message.findMany({
    where: { session_id: sessionId },
    orderBy: { created_at: 'desc' },
    take: TRANSCRIPT_MESSAGE_LIMIT,
    select: { role: true, content: true },
  });
  if (!rows.length) return '';

  const lines = rows
    .reverse()
    .map((row: { role: string; content: string }) => {
      const isAi = row.role === 'AI';
      const label = isAi ? 'You (tutor) said' : 'Student said';
      const budget = isAi ? TRANSCRIPT_AI_CHAR_BUDGET : TRANSCRIPT_STUDENT_CHAR_BUDGET;
      const text = truncateTranscriptEntry(String(row.content || ''), budget);
      return text ? `${label}: ${text}` : '';
    })
    .filter(Boolean);
  if (!lines.length) return '';

  return [
    'Conversation so far in this session (most recent last):',
    ...lines,
    'You remember everything above. Never restate a definition, introduction, or example you already gave. Continue from exactly where the conversation left off, referring back to your earlier words naturally ("as we saw with the falling book...") instead of re-explaining them. If the student answered your last question, acknowledge their answer first.',
  ].join('\n');
}

export async function buildStudentMemoryContext(
  userId: string,
  materialId: string,
  courseCode: string,
  currentSectionIndex: number,
) {
  const studentMaterialMemory = (
    prisma as typeof prisma & {
      studentMaterialMemory: {
        findMany: (args: unknown) => Promise<StudentMaterialMemoryRow[]>;
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
        upsert: (args: unknown) => Promise<unknown>;
      };
    }
  ).studentMaterialMemory;

  const memories = await studentMaterialMemory.findMany({
    where: {
      user_id: userId,
      material_id: materialId,
      course_code: courseCode,
      section_index: {
        lt: currentSectionIndex,
      },
    },
    orderBy: {
      section_index: 'asc',
    },
    take: 8,
  });

  if (!memories.length) {
    console.log('student_memory_context_missing', {
      userId,
      materialId,
      courseCode,
      currentSectionIndex,
    });
    return {
      previousSectionMemory: null,
      priorMemories: [] as StudentMemoryRecord[],
      promptContext: '',
    } satisfies StudentMemoryContext;
  }

  const parsed = memories.map((memory: StudentMaterialMemoryRow) =>
    parseStudentMemoryRecord(memory),
  );
  console.log('student_memory_context_loaded', {
    userId,
    materialId,
    courseCode,
    currentSectionIndex,
    memoryCount: parsed.length,
  });
  return {
    previousSectionMemory: parsed[parsed.length - 1] || null,
    priorMemories: parsed,
    promptContext: buildStudentMemoryPromptContext(
      parsed[parsed.length - 1] || null,
      parsed,
    ),
  } satisfies StudentMemoryContext;
}

export async function loadLatestLearningIntelligenceContext(
  userId: string,
  materialId: string,
  courseCode: string,
  currentSectionIndex: number,
) {
  const learningIntelligenceRecord = (
    prisma as typeof prisma & {
      learningIntelligenceRecord: {
        findFirst: (
          query: unknown,
        ) => Promise<LearningIntelligenceRecordRow | null>;
      };
    }
  ).learningIntelligenceRecord;

  const record = await learningIntelligenceRecord.findFirst({
    where: {
      user_id: userId,
      material_id: materialId,
      course_code: courseCode,
      section_index: {
        lt: currentSectionIndex,
      },
    },
    orderBy: {
      section_index: 'desc',
    },
  });

  if (!record) {
    console.log('learning_intelligence_context_missing', {
      userId,
      materialId,
      courseCode,
      currentSectionIndex,
    });
    return null;
  }

  const parsed = parseLearningIntelligenceContext(record);
  console.log('learning_intelligence_context_loaded', {
    userId,
    materialId,
    courseCode,
    currentSectionIndex,
    sectionIndex: record.section_index,
    hiddenConfusionRisk: parsed.hiddenConfusionRisk,
    retentionRisk: parsed.retentionRisk,
  });
  return parsed;
}

export async function selectThrowbackSection(
  userId: string,
  materialId: string,
  courseCode: string,
  lastCompletedIndex: number,
  roadmap: RoadmapSection[],
): Promise<{
  section: RoadmapSection;
  sectionIndex: number;
  retentionRisk: number;
  isRetentionThrowback: boolean;
}> {
  const fallbackIndex = Math.max(
    0,
    Math.min(lastCompletedIndex, roadmap.length - 1),
  );
  const learningIntelligenceRecord = (
    prisma as typeof prisma & {
      learningIntelligenceRecord: {
        findFirst: (
          query: unknown,
        ) => Promise<LearningIntelligenceRecordRow | null>;
      };
    }
  ).learningIntelligenceRecord;

  const highRiskRecord = await learningIntelligenceRecord.findFirst({
    where: {
      user_id: userId,
      material_id: materialId,
      course_code: courseCode,
      section_index: { lte: lastCompletedIndex, gte: 0 },
      retention_risk: { gte: RETENTION_THROWBACK_THRESHOLD },
    },
    orderBy: [{ retention_risk: 'desc' }, { created_at: 'desc' }],
  });

  if (highRiskRecord && roadmap[highRiskRecord.section_index]) {
    console.log('retention_throwback_selected', {
      userId,
      materialId,
      sectionIndex: highRiskRecord.section_index,
      retentionRisk: highRiskRecord.retention_risk,
      lastCompletedIndex,
    });
    return {
      section: sectionAt(roadmap, highRiskRecord.section_index),
      sectionIndex: highRiskRecord.section_index,
      retentionRisk: highRiskRecord.retention_risk,
      isRetentionThrowback: true,
    };
  }

  return {
    section: sectionAt(roadmap, fallbackIndex),
    sectionIndex: fallbackIndex,
    retentionRisk: highRiskRecord?.retention_risk ?? 50,
    isRetentionThrowback: false,
  };
}

export async function loadStudentLearningProfileContext(userId: string) {
  const profile = await prisma.learningProfile.findUnique({
    where: { user_id: userId },
    select: {
      preferred_teaching_strategy: true,
      preferred_pace: true,
      teaching_strategy_success: true,
      calculation_support_needed: true,
      visual_support_needed: true,
      confidence_support_needed: true,
    },
  });

  if (!profile) {
    console.log('student_learning_profile_context_missing', { userId });
    return null;
  }

  const rawScores = safeJsonObject<Record<string, unknown>>(
    profile.teaching_strategy_success,
    {},
  );
  const strategySuccessScores: Partial<Record<TeachingStrategy, number>> = {};
  for (const [key, value] of Object.entries(rawScores)) {
    if (isTeachingStrategy(key)) {
      strategySuccessScores[key] = clampReflectionScore(Number(value));
    }
  }

  const context: StudentLearningProfileContext = {
    preferredTeachingStrategy: isTeachingStrategy(
      profile.preferred_teaching_strategy,
    )
      ? profile.preferred_teaching_strategy
      : null,
    preferredPace: isTeachingPace(profile.preferred_pace)
      ? profile.preferred_pace
      : null,
    strategySuccessScores,
    calculationSupportNeeded: Boolean(profile.calculation_support_needed),
    visualSupportNeeded: Boolean(profile.visual_support_needed),
    confidenceSupportNeeded: Boolean(profile.confidence_support_needed),
  };

  console.log('student_learning_profile_context_loaded', {
    userId,
    preferredTeachingStrategy: context.preferredTeachingStrategy,
    preferredPace: context.preferredPace,
  });
  return context;
}

export async function buildTutorSelfImprovementContext(
  userId: string,
  materialId: string,
  courseCode: string,
): Promise<TutorSelfImprovementContext | null> {
  try {
    const [reflections, intelligenceRecords, memories, profile] =
      await Promise.all([
        (
          prisma as typeof prisma & {
            teachingReflection: {
              findMany: (query: unknown) => Promise<TeachingReflectionRow[]>;
            };
          }
        ).teachingReflection.findMany({
          where: {
            user_id: userId,
            material_id: materialId,
            course_code: courseCode,
          },
          orderBy: { created_at: 'desc' },
          take: 10,
          select: {
            strategy_used: true,
            pace_used: true,
            mastery_score: true,
            hidden_confusion_risk: true,
            confidence: true,
            recommended_interventions: true,
            created_at: true,
          },
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
          where: {
            user_id: userId,
            material_id: materialId,
            course_code: courseCode,
          },
          orderBy: { created_at: 'desc' },
          take: 10,
          select: {
            mastery_score: true,
            confidence: true,
            hidden_confusion_risk: true,
            created_at: true,
          },
        }),
        (
          prisma as typeof prisma & {
            studentMaterialMemory: {
              findMany: (query: unknown) => Promise<StudentMaterialMemoryRow[]>;
            };
          }
        ).studentMaterialMemory.findMany({
          where: {
            user_id: userId,
            material_id: materialId,
            course_code: courseCode,
          },
          orderBy: { updated_at: 'desc' },
          take: 10,
          select: {
            weak_points: true,
            misconceptions: true,
            updated_at: true,
          },
        }),
        prisma.learningProfile.findUnique({
          where: { user_id: userId },
          select: {
            preferred_teaching_strategy: true,
            preferred_pace: true,
            teaching_strategy_success: true,
          },
        }),
      ]);

    if (
      !reflections.length &&
      !intelligenceRecords.length &&
      !memories.length &&
      !profile
    ) {
      console.log('tutor_self_improvement_context_missing', {
        userId,
        materialId,
        courseCode,
      });
      return null;
    }

    const strategySuccessScores = safeJsonObject<Record<string, unknown>>(
      profile?.teaching_strategy_success,
      {},
    );
    const rankedStrategies = Object.entries(strategySuccessScores)
      .filter(([key]) => isTeachingStrategy(key))
      .map(
        ([key, value]) => [key, clampReflectionScore(Number(value))] as const,
      )
      .sort((a, b) => b[1] - a[1]);

    const bestStrategies = rankedStrategies
      .filter(([, score]) => score >= 60)
      .slice(0, 3)
      .map(([key]) => key);
    const weakStrategies = rankedStrategies
      .filter(([, score]) => score <= 45)
      .slice(0, 3)
      .map(([key]) => key);

    const interventionScores = new Map<string, { good: number; bad: number }>();
    for (const reflection of reflections) {
      const interventions = safeStringArray(
        reflection.recommended_interventions,
      );
      for (const intervention of interventions) {
        const current = interventionScores.get(intervention) || {
          good: 0,
          bad: 0,
        };
        if (
          (reflection.mastery_score ?? 0) >= 80 &&
          (reflection.hidden_confusion_risk ?? 100) <= 45
        ) {
          current.good += 1;
        } else {
          current.bad += 1;
        }
        interventionScores.set(intervention, current);
      }
    }

    const effectiveInterventions = Array.from(interventionScores.entries())
      .filter(([, value]) => value.good > value.bad)
      .sort((a, b) => b[1].good - a[1].good)
      .slice(0, 4)
      .map(([key]) => key);
    const ineffectiveInterventions = Array.from(interventionScores.entries())
      .filter(([, value]) => value.bad >= value.good && value.bad > 0)
      .sort((a, b) => b[1].bad - a[1].bad)
      .slice(0, 4)
      .map(([key]) => key);

    const repeatedWeakPoints = truncateList(
      memories.flatMap((memory) => [
        ...safeStringArray(memory.weak_points),
        ...safeStringArray(memory.misconceptions),
      ]),
      6,
      100,
    );
    const avoidPatterns = truncateList(
      [
        ...weakStrategies.map(
          (item) =>
            `Avoid leading with ${item.replace(/_/g, ' ')} when possible.`,
        ),
        ...ineffectiveInterventions.map((item) => `Avoid overusing: ${item}.`),
        ...repeatedWeakPoints.map(
          (item) => `Do not assume mastery of ${item}.`,
        ),
      ],
      6,
      120,
    );

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

    const context: TutorSelfImprovementContext = {
      bestStrategies,
      weakStrategies,
      effectiveInterventions,
      ineffectiveInterventions,
      recommendedStrategy:
        bestStrategies[0] || profile?.preferred_teaching_strategy || undefined,
      recommendedPace:
        avgConfidence < 55 || avgHiddenConfusion > 55
          ? 'slow'
          : profile?.preferred_pace || 'normal',
      avoidPatterns,
      reason: bestStrategies.length
        ? `Recent outcomes suggest ${bestStrategies[0]} works better for this student in this material.`
        : 'Recent outcomes do not yet show a dominant teaching strategy, so stay adaptive.',
    };

    console.log('tutor_self_improvement_context_loaded', {
      userId,
      materialId,
      courseCode,
      recommendedStrategy: context.recommendedStrategy || null,
      recommendedPace: context.recommendedPace || null,
      bestStrategies: context.bestStrategies,
    });
    return context;
  } catch (error) {
    console.error('tutor_self_improvement_context_missing', {
      userId,
      materialId,
      courseCode,
      message:
        error instanceof Error
          ? error.message
          : 'Unknown tutor self-improvement error',
    });
    return null;
  }
}

export async function loadLecturerConstraintsForSession(session: {
  id: string;
  course_code?: string | null;
  material?: {
    id: string;
    course_code?: string | null;
    university?: string | null;
    faculty?: string | null;
    department?: string | null;
    level?: number | null;
    semester?: number | null;
  } | null;
}) {
  const material = session.material;
  if (!material) {
    console.log('lecturer_constraints_missing', {
      sessionId: session.id,
      reason: 'no_material',
    });
    return null;
  }

  const lecturerTeachingConstraint = (
    prisma as typeof prisma & {
      lecturerTeachingConstraint?: {
        findMany: (query: unknown) => Promise<LecturerConstraintRecord[]>;
      };
    }
  ).lecturerTeachingConstraint;

  if (!lecturerTeachingConstraint) {
    console.log('lecturer_constraints_missing', {
      sessionId: session.id,
      materialId: material.id,
      reason: 'model_unavailable',
    });
    return null;
  }

  const courseCode = material.course_code || session.course_code || null;
  const matches = await lecturerTeachingConstraint.findMany({
    where: {
      is_active: true,
      OR: [
        { material_id: material.id },
        {
          material_id: null,
          course_code: courseCode,
          university: material.university,
          department: material.department,
          level: material.level ?? undefined,
          semester: material.semester ?? undefined,
        },
        {
          material_id: null,
          course_code: courseCode,
          department: material.department,
        },
        {
          material_id: null,
          course_code: courseCode,
        },
      ],
    },
    orderBy: [{ updated_at: 'desc' }],
  });

  const prioritized = matches
    .map((constraint) => ({
      constraint,
      priority:
        constraint.material_id === material.id
          ? 0
          : constraint.course_code === courseCode &&
              constraint.university === material.university &&
              constraint.department === material.department &&
              constraint.level === material.level &&
              constraint.semester === material.semester
            ? 1
            : constraint.course_code === courseCode &&
                constraint.department === material.department
              ? 2
              : constraint.course_code === courseCode
                ? 3
                : 4,
    }))
    .sort((left, right) => left.priority - right.priority)
    .map((item) => item.constraint)
    .slice(0, 4);

  if (!prioritized.length) {
    console.log('lecturer_constraints_missing', {
      sessionId: session.id,
      materialId: material.id,
      courseCode,
    });
    return null;
  }

  const context = parseLecturerConstraintContext(prioritized);
  console.log('lecturer_constraints_loaded', {
    sessionId: session.id,
    materialId: material.id,
    count: prioritized.length,
    strictness: context.strictness,
  });
  return context;
}

export function createTeachingDecision(args: {
  phase: string;
  section: RoadmapSection;
  lessonScope?: LessonScope | null;
  teachingDepthPlan?: TeachingDepthPlan | null;
  teacherBrainSectionContext: TeacherBrainSectionContext;
  teacherBrainContext: string;
  studentMemoryContext: StudentMemoryContext;
  lessonPlan: StudySectionLessonPlanRecord;
  calculationContext: CalculationTeachingContext;
  diagramContext: DiagramTeachingContext;
  relevantMaterialContext: RelevantMaterialContext;
  learningIntelligenceContext?: LearningIntelligenceContext | null;
  studentLearningProfileContext?: StudentLearningProfileContext | null;
  tutorSelfImprovementContext?: TutorSelfImprovementContext | null;
  lecturerConstraintContext?: LecturerConstraintContext | null;
  hybridMasteryResult?: HybridMasteryResult | null;
  currentMasteryScore?: number | null;
  lastMasteryScore?: number | null;
}): TeachingDecision {
  const previousMemory = args.studentMemoryContext.previousSectionMemory;
  const weakPoints = [
    ...(previousMemory?.weakPoints || []),
    ...args.studentMemoryContext.priorMemories
      .flatMap((item) => item.weakPoints)
      .slice(0, 6),
  ];
  const misconceptions = [
    ...(previousMemory?.misconceptions || []),
    ...args.studentMemoryContext.priorMemories
      .flatMap((item) => item.misconceptions)
      .slice(0, 6),
  ];
  const calculationIssues = args.studentMemoryContext.priorMemories
    .flatMap((item) => item.calculationIssues)
    .slice(0, 6);
  const diagramIssues = args.studentMemoryContext.priorMemories
    .flatMap((item) => item.diagramIssues)
    .slice(0, 6);
  const prerequisiteIssues = [
    ...args.teacherBrainSectionContext.prerequisites
      .map((item) => String(item.concept || '').trim())
      .filter(Boolean),
    ...args.lessonPlan.prerequisiteRefresh,
  ].slice(0, 6);

  const decision = decideTeachingStrategy({
    phase: args.phase,
    sectionTitle: args.section.title,
    sectionContent: args.section.content,
    subjectFamily: args.teacherBrainSectionContext.subjectFamily || undefined,
    teacherBrainContext: args.teacherBrainContext,
    studentMemoryContext: args.studentMemoryContext.promptContext,
    lessonPlanContext: args.lessonPlan.promptContext,
    calculationContext: args.calculationContext.summary,
    diagramContext: args.diagramContext.summary,
    relevantMaterialContext: args.relevantMaterialContext.promptContext,
    currentMasteryScore: args.currentMasteryScore ?? null,
    lastMasteryScore: args.lastMasteryScore ?? null,
    weakPoints,
    misconceptions,
    calculationIssues,
    diagramIssues,
    prerequisiteIssues,
    conceptUnderstanding:
      args.learningIntelligenceContext?.conceptUnderstanding ?? null,
    proceduralAccuracy:
      args.learningIntelligenceContext?.proceduralAccuracy ?? null,
    reasoningQuality:
      args.learningIntelligenceContext?.reasoningQuality ?? null,
    confidence: args.learningIntelligenceContext?.confidence ?? null,
    hiddenConfusionRisk:
      args.learningIntelligenceContext?.hiddenConfusionRisk ?? null,
    hiddenConfusionSignals:
      args.learningIntelligenceContext?.hiddenConfusionSignals ?? [],
    recommendedConfusionIntervention:
      args.learningIntelligenceContext?.recommendedConfusionIntervention ??
      'none',
    retentionRisk: args.learningIntelligenceContext?.retentionRisk ?? null,
    preferredTeachingStrategy:
      args.studentLearningProfileContext?.preferredTeachingStrategy ?? null,
    preferredPace: args.studentLearningProfileContext?.preferredPace ?? null,
    strategySuccessScores:
      args.studentLearningProfileContext?.strategySuccessScores ?? {},
    calculationSupportNeeded:
      args.studentLearningProfileContext?.calculationSupportNeeded ?? false,
    visualSupportNeeded:
      args.studentLearningProfileContext?.visualSupportNeeded ?? false,
    confidenceSupportNeeded:
      args.studentLearningProfileContext?.confidenceSupportNeeded ?? false,
    tutorSelfImprovementContext: args.tutorSelfImprovementContext || undefined,
    lecturerConstraintContext:
      args.lecturerConstraintContext?.promptContext || undefined,
    lecturerStrictness: args.lecturerConstraintContext?.strictness || 'medium',
    requiredMethods: args.lecturerConstraintContext?.requiredMethods || [],
    forbiddenMethods: args.lecturerConstraintContext?.forbiddenMethods || [],
    assessmentFocus: args.lecturerConstraintContext?.assessmentFocus || [],
    mustCoverTopics: args.lecturerConstraintContext?.mustCoverTopics || [],
    primaryObjective: args.lessonScope?.primaryObjective,
    inScopeConcepts: args.lessonScope?.inScopeConcepts || [],
    previewOnlyConcepts: args.lessonScope?.previewOnlyConcepts || [],
    outOfScopeConcepts: args.lessonScope?.outOfScopeConcepts || [],
    teachingDepthPlan: args.teachingDepthPlan || undefined,
    targetDepth: args.teachingDepthPlan?.targetDepth,
    deferredDepthConcepts: args.teachingDepthPlan?.deferredDepthConcepts || [],
    isCalculationHeavy: args.calculationContext.detected,
    isDiagramHeavy: args.diagramContext.detected,
    hybridMasteryResult: args.hybridMasteryResult ?? null,
  });

  console.log('teaching_decision_created', {
    phase: args.phase,
    sectionTitle: args.section.title,
    strategy: decision.strategy,
    pace: decision.pace,
    prerequisiteRepairMode: decision.prerequisiteRepairMode,
    shouldUseAnalogy: decision.shouldUseAnalogy,
    shouldUseWorkedExample: decision.shouldUseWorkedExample,
    shouldUseVisualExplanation: decision.shouldUseVisualExplanation,
    shouldUseCalculationSteps: decision.shouldUseCalculationSteps,
    shouldUseExamFraming: decision.shouldUseExamFraming,
    shouldChallengeStudent: decision.shouldChallengeStudent,
    shouldSlowDown: decision.shouldSlowDown,
    shouldRepairPrerequisite: decision.shouldRepairPrerequisite,
    lessonScope: args.lessonScope || null,
    lecturerConstraintStrictness:
      args.lecturerConstraintContext?.strictness || 'medium',
    tutorSelfImprovement: args.tutorSelfImprovementContext || null,
    hybridMasteryResult: args.hybridMasteryResult ?? null,
  });
  if (
    args.tutorSelfImprovementContext?.recommendedStrategy ||
    args.tutorSelfImprovementContext?.recommendedPace
  ) {
    console.log('tutor_self_improvement_applied', {
      phase: args.phase,
      sectionTitle: args.section.title,
      recommendedStrategy:
        args.tutorSelfImprovementContext.recommendedStrategy || null,
      recommendedPace: args.tutorSelfImprovementContext.recommendedPace || null,
      avoidPatterns: args.tutorSelfImprovementContext.avoidPatterns,
    });
  }
  if (
    args.learningIntelligenceContext?.recommendedConfusionIntervention &&
    args.learningIntelligenceContext.recommendedConfusionIntervention !== 'none'
  ) {
    console.log('hidden_confusion_intervention_applied', {
      phase: args.phase,
      sectionTitle: args.section.title,
      hiddenConfusionRisk: args.learningIntelligenceContext.hiddenConfusionRisk,
      hiddenConfusionLevel:
        args.learningIntelligenceContext.hiddenConfusionLevel,
      recommendedIntervention:
        args.learningIntelligenceContext.recommendedConfusionIntervention,
      signals: args.learningIntelligenceContext.hiddenConfusionSignals,
    });
  }

  return decision;
}

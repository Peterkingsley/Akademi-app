import {
  MasteryStatus,
  MessageRole,
  Prisma,
  ReplyMode,
  Session,
  StudyCompanionPhase,
  StudyRoadmapStatus,
} from '@prisma/client';
import prisma from '../../config/db';
import { JOB_NAMES, systemQueue } from '../../config/queue';
import { aiProvider } from '../ai/ai.provider';
import { decideTeachingStrategy, TeachingDecision, TeachingPace, TeachingStrategy } from './teaching-decision-engine';
import {
  ReaderPageShape,
  RoadmapSection,
  TeacherBrainSummary,
  TeacherBrainChapterSummary,
  TeacherBrainConcept,
  TeacherBrainPrerequisite,
  TeacherBrainFormula,
  TeacherBrainCalculationMethod,
  TeacherBrainDiagram,
  TeacherBrainMisconception,
  TeacherBrainExamAngle,
  TeacherBrainNotes,
  ParsedTeacherBrain,
  TeacherBrainSectionContext,
  CalculationTeachingContext,
  DiagramTeachingContext,
  StudyVisualSuggestedRenderer,
  StudyVisualItem,
  StudyVisualPlan,
  StudentMemoryRecord,
  StudySectionLessonPlanRecord,
  StudentMemoryContext,
  RelevantMaterialChunk,
  RelevantMaterialContext,
  LessonScope,
  ScopeViolation,
  TeachingDepthPlan,
  DepthViolation,
  TutorMessageQualityResult,
  TutorMessageQualityArgs,
  TutorQualityTraceCapture,
  TutorTraceRuntime,
  TutorTraceSeed,
  StudentMaterialMemoryRow,
  StudySectionLessonPlanRow,
  TeachingReflectionRow,
  TeachingReflectionRecord,
  LearningIntelligenceRecordRow,
  LearningIntelligenceContext,
  PostAssessmentIntelligencePayload,
  StudentLearningProfileContext,
  TutorSelfImprovementContext,
  LecturerConstraintRecord,
  LecturerConstraintContext,
  MaterialEmbeddingRow,
  CompanionMetadata,
  CompanionResponseMetadata,
  SectionContext,
  HybridMasteryResult,
  CompanionStartMode,
  PublicState,
} from './study-companion.types';
import {
  RETENTION_THROWBACK_THRESHOLD,
  PASS_1,
  PASS_2,
  PASS_3,
  TEACHBACK_1,
  GAP_RETEACH,
  TEACHBACK_2,
  MEMORY_DUMP,
  NEXT_SECTION,
  SESSION_DONE,
  safeJsonObject,
  safeJsonArray,
  normalizeText,
  readSectionContext,
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
  questionCountForContent,
  findFirstRealTeachingSection,
  truncate,
  truncateList,
  safeStringArray,
  parseTeacherBrain,
  getTeacherBrainSectionContext,
  buildCalculationTeachingContext,
  buildCalculationInstructions,
  buildDiagramTeachingContext,
  buildDiagramInstructions,
  mapDiagramTypeToSuggestedRenderer,
  buildTeacherBrainPromptContext,
} from './study-companion-teacher-brain';
import {
  parseStudentMemoryRecord,
  buildStudentMemoryPromptContext,
  buildDeterministicStudentMemoryFallback,
  clampReflectionScore,
  parseTeachingReflectionRecord,
  buildDeterministicTeachingReflectionFallback,
  estimateHiddenConfusionRisk,
  parseLearningIntelligenceContext,
  inferPrerequisiteWeaknessFromFailedConcepts,
  conceptMatches,
  isRepairRiskAcceptable,
  evaluateHybridMastery,
  isTeachingStrategy,
  isTeachingPace,
  isPrerequisiteRepairMode,
} from './study-companion-memory-mastery';
import {
  cosineSimilarity,
  parseEmbeddingVector,
  parseLecturerConstraintContext,
  tokenOverlapScore,
  explainChunkRelevance,
  buildDeterministicTutorFallback,
  validateTutorMessageQuality,
  estimatePromptTokens,
  parseStudySectionLessonPlanRecord,
  buildFallbackLessonPlan,
  deriveFailedConcepts,
  computeCoverageScore,
  generateText,
} from './study-companion-quality-relevance';
export class StudyCompanionService {
  private metadataDefaultsForTurnType(turnType: NonNullable<CompanionResponseMetadata['turnType']>) {
    switch (turnType) {
      case 'checkpoint_question':
        return { waitForStudent: true, autoContinue: false };
      case 'evaluation':
        return { waitForStudent: false, autoContinue: true };
      case 'teaching':
      case 'reteach':
      case 'transition':
      default:
        return { waitForStudent: false, autoContinue: true };
    }
  }

  private async buildTurnMetadata(
    sessionId: string,
    turnType: NonNullable<CompanionResponseMetadata['turnType']>,
    extra: Omit<CompanionResponseMetadata, 'study_companion' | 'turnType' | 'waitForStudent' | 'autoContinue'> & {
      waitForStudent?: boolean;
      autoContinue?: boolean;
    } = {},
  ) {
    const defaults = this.metadataDefaultsForTurnType(turnType);
    return this.buildResponseMetadata(sessionId, {
      turnType,
      waitForStudent: extra.waitForStudent ?? defaults.waitForStudent,
      autoContinue: extra.autoContinue ?? defaults.autoContinue,
      ...extra,
    });
  }

  private async buildResponseMetadata(
    sessionId: string,
    extra: Omit<CompanionResponseMetadata, 'study_companion'> = {},
  ): Promise<CompanionResponseMetadata> {
    const questionCount = extra.questionCount ?? 0;
    return {
      allowInterruption: extra.allowInterruption ?? true,
      questionCount,
      ...extra,
      study_companion: await this.getPublicState(sessionId),
    };
  }

  private parseMetadata(session: Session) {
    return safeJsonObject<CompanionMetadata>(session.metadata, {});
  }

  private isCompanionSession(session: Session) {
    const metadata = this.parseMetadata(session);
    return session.session_type === 'STUDY' && metadata.mode === 'ai-study-companion' && !!session.material_id;
  }

  private buildRoadmapFromReaderStructure(readerStructure: unknown, fallbackRoadmap: string[]) {
    const pages = safeJsonArray<ReaderPageShape>(safeJsonObject<{ pages?: ReaderPageShape[] }>(readerStructure, {}).pages);
    const grouped = new Map<string, RoadmapSection>();

    for (const page of pages) {
      const title = String(page.chapterTitle || page.pageTitle || 'Reading').trim();
      if (!title) continue;

      if (!grouped.has(title)) {
        grouped.set(title, {
          key: `section-${grouped.size + 1}`,
          title,
          content: normalizeText(page.content || ''),
          status: StudyRoadmapStatus.NOT_STARTED,
          pageStart: Number(page.pageNumber || 1),
          pageEnd: Number(page.pageNumber || 1),
        });
      } else {
        const current = grouped.get(title)!;
        current.content = normalizeText([current.content, page.content || ''].filter(Boolean).join('\n\n'));
        current.pageEnd = Number(page.pageNumber || current.pageEnd);
      }
    }

    const roadmap = Array.from(grouped.values()).filter((section) => section.content);
    if (roadmap.length) return roadmap;

    return fallbackRoadmap
      .map((title, index) => ({
        key: `section-${index + 1}`,
        title: String(title).trim(),
        content: '',
        status: StudyRoadmapStatus.NOT_STARTED,
        pageStart: index + 1,
        pageEnd: index + 1,
      }))
      .filter((section) => section.title);
  }

  private buildProgress(roadmap: RoadmapSection[]) {
    return {
      completedSections: roadmap.filter((section) => section.status === StudyRoadmapStatus.MASTERED).length,
      totalSections: roadmap.length,
      masteredSections: roadmap.filter((section) => section.status === StudyRoadmapStatus.MASTERED).length,
    };
  }

  async ensureState(sessionId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        material: {
          select: {
            id: true,
            title: true,
            course_code: true,
            content: true,
            reader_structure: true,
          },
        },
      },
    });

    if (!session) throw new Error('Session not found');
    if (!this.isCompanionSession(session)) return null;
    if (!session.material) throw new Error('Companion study requires a selected material');

    const existing = await prisma.studyCompanionState.findUnique({
      where: { session_id: sessionId },
    });
    if (existing) return existing;

    const metadata = this.parseMetadata(session);
    const fallbackRoadmap = Array.isArray(metadata.roadmap) ? metadata.roadmap.map((value) => String(value)) : [];
    const roadmap = this.buildRoadmapFromReaderStructure(session.material.reader_structure, fallbackRoadmap);
    if (!roadmap.length) {
      roadmap.push({
        key: 'section-1',
        title: metadata.chapterTitle || session.material.title || 'Section 1',
        content: normalizeText(session.material.content || ''),
        status: StudyRoadmapStatus.NOT_STARTED,
        pageStart: 1,
        pageEnd: 1,
      });
    }

    const progress = this.buildProgress(roadmap);
    const previousState = await prisma.studyCompanionState.findFirst({
      where: {
        user_id: session.user_id,
        material_id: session.material.id,
        course_code: session.course_code || session.material.course_code || 'GENERAL',
        session_id: { not: session.id },
      },
      orderBy: { updated_at: 'desc' },
    });

    const restoredRoadmap = previousState?.roadmap ? safeJsonArray<RoadmapSection>(previousState.roadmap) : roadmap;
    const restoredProgress = this.buildProgress(restoredRoadmap);
    return prisma.studyCompanionState.create({
      data: {
        session_id: session.id,
        user_id: session.user_id,
        material_id: session.material.id,
        course_code: session.course_code || session.material.course_code || 'GENERAL',
        roadmap: restoredRoadmap as unknown as Prisma.InputJsonValue,
        progress: restoredProgress as unknown as Prisma.InputJsonValue,
        section_context: {} as Prisma.InputJsonValue,
        current_phase: StudyCompanionPhase.MATERIAL_SELECTED,
        current_section_index: previousState?.current_section_index ?? 0,
        last_completed_index: previousState?.last_completed_index ?? -1,
        last_mastery_score: previousState?.last_mastery_score ?? null,
        refresh_question: previousState?.refresh_question ?? null,
        refresh_answer: previousState?.refresh_answer ?? null,
        session_summary: previousState?.session_summary ?? null,
      },
    });
  }

  async getPublicState(sessionId: string): Promise<PublicState | null> {
    const state = await this.ensureState(sessionId);
    if (!state) return null;
    const roadmap = safeJsonArray<RoadmapSection>(state.roadmap);
    return {
      phase: state.current_phase,
      currentSectionIndex: state.current_section_index,
      lastCompletedIndex: state.last_completed_index,
      lastMasteryScore: state.last_mastery_score ?? null,
      masteryThreshold: state.mastery_threshold,
      roadmap,
      progress: this.buildProgress(roadmap),
      refreshQuestion: state.refresh_question || null,
      pendingPrompt: state.pending_prompt || null,
      materialId: state.material_id,
      courseCode: state.course_code,
      passNumber: state.current_phase === PASS_1 ? 1 : state.current_phase === PASS_2 ? 2 : state.current_phase === PASS_3 ? 3 : null,
      totalPasses: 3,
    };
  }

  private async persistRoadmap(stateId: string, roadmap: RoadmapSection[], extra: Partial<{
    current_phase: StudyCompanionPhase;
    current_section_index: number;
    last_completed_index: number;
    last_mastery_score: number | null;
    refresh_question: string | null;
    refresh_answer: string | null;
    pending_prompt: string | null;
    session_summary: string | null;
    external_support_used: boolean;
    section_context: Prisma.InputJsonValue;
  }> = {}) {
    return prisma.studyCompanionState.update({
      where: { id: stateId },
      data: {
        roadmap: roadmap as unknown as Prisma.InputJsonValue,
        progress: this.buildProgress(roadmap) as unknown as Prisma.InputJsonValue,
        ...extra,
      },
    });
  }

  private async buildStudentMemoryContext(userId: string, materialId: string, courseCode: string, currentSectionIndex: number) {
    const studentMaterialMemory = (prisma as typeof prisma & {
      studentMaterialMemory: {
        findMany: (args: unknown) => Promise<StudentMaterialMemoryRow[]>;
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
        upsert: (args: unknown) => Promise<unknown>;
      };
    }).studentMaterialMemory;

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

    const parsed = memories.map((memory: StudentMaterialMemoryRow) => parseStudentMemoryRecord(memory));
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
      promptContext: buildStudentMemoryPromptContext(parsed[parsed.length - 1] || null, parsed),
    } satisfies StudentMemoryContext;
  }

  private async loadLatestLearningIntelligenceContext(userId: string, materialId: string, courseCode: string, currentSectionIndex: number) {
    const learningIntelligenceRecord = (prisma as typeof prisma & {
      learningIntelligenceRecord: {
        findFirst: (query: unknown) => Promise<LearningIntelligenceRecordRow | null>;
      };
    }).learningIntelligenceRecord;

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

  private async selectThrowbackSection(
    userId: string,
    materialId: string,
    courseCode: string,
    lastCompletedIndex: number,
    roadmap: RoadmapSection[],
  ): Promise<{ section: RoadmapSection; sectionIndex: number; retentionRisk: number; isRetentionThrowback: boolean }> {
    const fallbackIndex = Math.max(0, Math.min(lastCompletedIndex, roadmap.length - 1));
    const learningIntelligenceRecord = (prisma as typeof prisma & {
      learningIntelligenceRecord: {
        findFirst: (query: unknown) => Promise<LearningIntelligenceRecordRow | null>;
      };
    }).learningIntelligenceRecord;

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
        section: this.sectionAt(roadmap, highRiskRecord.section_index),
        sectionIndex: highRiskRecord.section_index,
        retentionRisk: highRiskRecord.retention_risk,
        isRetentionThrowback: true,
      };
    }

    return {
      section: this.sectionAt(roadmap, fallbackIndex),
      sectionIndex: fallbackIndex,
      retentionRisk: highRiskRecord?.retention_risk ?? 50,
      isRetentionThrowback: false,
    };
  }

  private async loadStudentLearningProfileContext(userId: string) {
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

    const rawScores = safeJsonObject<Record<string, unknown>>(profile.teaching_strategy_success, {});
    const strategySuccessScores: Partial<Record<TeachingStrategy, number>> = {};
    for (const [key, value] of Object.entries(rawScores)) {
      if (isTeachingStrategy(key)) {
        strategySuccessScores[key] = clampReflectionScore(Number(value));
      }
    }

    const context: StudentLearningProfileContext = {
      preferredTeachingStrategy: isTeachingStrategy(profile.preferred_teaching_strategy) ? profile.preferred_teaching_strategy : null,
      preferredPace: isTeachingPace(profile.preferred_pace) ? profile.preferred_pace : null,
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

  private async buildTutorSelfImprovementContext(userId: string, materialId: string, courseCode: string): Promise<TutorSelfImprovementContext | null> {
    try {
      const [reflections, intelligenceRecords, memories, profile] = await Promise.all([
        (prisma as typeof prisma & {
          teachingReflection: { findMany: (query: unknown) => Promise<TeachingReflectionRow[]> };
        }).teachingReflection.findMany({
          where: { user_id: userId, material_id: materialId, course_code: courseCode },
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
        (prisma as typeof prisma & {
          learningIntelligenceRecord: { findMany: (query: unknown) => Promise<LearningIntelligenceRecordRow[]> };
        }).learningIntelligenceRecord.findMany({
          where: { user_id: userId, material_id: materialId, course_code: courseCode },
          orderBy: { created_at: 'desc' },
          take: 10,
          select: {
            mastery_score: true,
            confidence: true,
            hidden_confusion_risk: true,
            created_at: true,
          },
        }),
        (prisma as typeof prisma & {
          studentMaterialMemory: { findMany: (query: unknown) => Promise<StudentMaterialMemoryRow[]> };
        }).studentMaterialMemory.findMany({
          where: { user_id: userId, material_id: materialId, course_code: courseCode },
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

      if (!reflections.length && !intelligenceRecords.length && !memories.length && !profile) {
        console.log('tutor_self_improvement_context_missing', { userId, materialId, courseCode });
        return null;
      }

      const strategySuccessScores = safeJsonObject<Record<string, unknown>>(profile?.teaching_strategy_success, {});
      const rankedStrategies = Object.entries(strategySuccessScores)
        .filter(([key]) => isTeachingStrategy(key))
        .map(([key, value]) => [key, clampReflectionScore(Number(value))] as const)
        .sort((a, b) => b[1] - a[1]);

      const bestStrategies = rankedStrategies.filter(([, score]) => score >= 60).slice(0, 3).map(([key]) => key);
      const weakStrategies = rankedStrategies.filter(([, score]) => score <= 45).slice(0, 3).map(([key]) => key);

      const interventionScores = new Map<string, { good: number; bad: number }>();
      for (const reflection of reflections) {
        const interventions = safeStringArray(reflection.recommended_interventions);
        for (const intervention of interventions) {
          const current = interventionScores.get(intervention) || { good: 0, bad: 0 };
          if ((reflection.mastery_score ?? 0) >= 80 && (reflection.hidden_confusion_risk ?? 100) <= 45) {
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
      const avoidPatterns = truncateList([
        ...weakStrategies.map((item) => `Avoid leading with ${item.replace(/_/g, ' ')} when possible.`),
        ...ineffectiveInterventions.map((item) => `Avoid overusing: ${item}.`),
        ...repeatedWeakPoints.map((item) => `Do not assume mastery of ${item}.`),
      ], 6, 120);

      const avgConfidence = intelligenceRecords.length
        ? intelligenceRecords.reduce((sum, item) => sum + item.confidence, 0) / intelligenceRecords.length
        : 50;
      const avgHiddenConfusion = intelligenceRecords.length
        ? intelligenceRecords.reduce((sum, item) => sum + item.hidden_confusion_risk, 0) / intelligenceRecords.length
        : 50;

      const context: TutorSelfImprovementContext = {
        bestStrategies,
        weakStrategies,
        effectiveInterventions,
        ineffectiveInterventions,
        recommendedStrategy: bestStrategies[0] || (profile?.preferred_teaching_strategy || undefined),
        recommendedPace: avgConfidence < 55 || avgHiddenConfusion > 55 ? 'slow' : (profile?.preferred_pace || 'normal'),
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
        message: error instanceof Error ? error.message : 'Unknown tutor self-improvement error',
      });
      return null;
    }
  }

  private async loadLecturerConstraintsForSession(session: {
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
      console.log('lecturer_constraints_missing', { sessionId: session.id, reason: 'no_material' });
      return null;
    }

    const lecturerTeachingConstraint = (prisma as typeof prisma & {
      lecturerTeachingConstraint?: {
        findMany: (query: unknown) => Promise<LecturerConstraintRecord[]>;
      };
    }).lecturerTeachingConstraint;

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
        priority: constraint.material_id === material.id
          ? 0
          : constraint.course_code === courseCode &&
              constraint.university === material.university &&
              constraint.department === material.department &&
              constraint.level === material.level &&
              constraint.semester === material.semester
            ? 1
            : constraint.course_code === courseCode && constraint.department === material.department
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

  private createTeachingDecision(args: {
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
      ...args.studentMemoryContext.priorMemories.flatMap((item) => item.weakPoints).slice(0, 6),
    ];
    const misconceptions = [
      ...(previousMemory?.misconceptions || []),
      ...args.studentMemoryContext.priorMemories.flatMap((item) => item.misconceptions).slice(0, 6),
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
      conceptUnderstanding: args.learningIntelligenceContext?.conceptUnderstanding ?? null,
      proceduralAccuracy: args.learningIntelligenceContext?.proceduralAccuracy ?? null,
      reasoningQuality: args.learningIntelligenceContext?.reasoningQuality ?? null,
      confidence: args.learningIntelligenceContext?.confidence ?? null,
      hiddenConfusionRisk: args.learningIntelligenceContext?.hiddenConfusionRisk ?? null,
      hiddenConfusionSignals: args.learningIntelligenceContext?.hiddenConfusionSignals ?? [],
      recommendedConfusionIntervention: args.learningIntelligenceContext?.recommendedConfusionIntervention ?? 'none',
      retentionRisk: args.learningIntelligenceContext?.retentionRisk ?? null,
      preferredTeachingStrategy: args.studentLearningProfileContext?.preferredTeachingStrategy ?? null,
      preferredPace: args.studentLearningProfileContext?.preferredPace ?? null,
      strategySuccessScores: args.studentLearningProfileContext?.strategySuccessScores ?? {},
      calculationSupportNeeded: args.studentLearningProfileContext?.calculationSupportNeeded ?? false,
      visualSupportNeeded: args.studentLearningProfileContext?.visualSupportNeeded ?? false,
      confidenceSupportNeeded: args.studentLearningProfileContext?.confidenceSupportNeeded ?? false,
      tutorSelfImprovementContext: args.tutorSelfImprovementContext || undefined,
      lecturerConstraintContext: args.lecturerConstraintContext?.promptContext || undefined,
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
      lecturerConstraintStrictness: args.lecturerConstraintContext?.strictness || 'medium',
      tutorSelfImprovement: args.tutorSelfImprovementContext || null,
      hybridMasteryResult: args.hybridMasteryResult ?? null,
    });
    if (args.tutorSelfImprovementContext?.recommendedStrategy || args.tutorSelfImprovementContext?.recommendedPace) {
      console.log('tutor_self_improvement_applied', {
        phase: args.phase,
        sectionTitle: args.section.title,
        recommendedStrategy: args.tutorSelfImprovementContext.recommendedStrategy || null,
        recommendedPace: args.tutorSelfImprovementContext.recommendedPace || null,
        avoidPatterns: args.tutorSelfImprovementContext.avoidPatterns,
      });
    }
    if (args.learningIntelligenceContext?.recommendedConfusionIntervention && args.learningIntelligenceContext.recommendedConfusionIntervention !== 'none') {
      console.log('hidden_confusion_intervention_applied', {
        phase: args.phase,
        sectionTitle: args.section.title,
        hiddenConfusionRisk: args.learningIntelligenceContext.hiddenConfusionRisk,
        hiddenConfusionLevel: args.learningIntelligenceContext.hiddenConfusionLevel,
        recommendedIntervention: args.learningIntelligenceContext.recommendedConfusionIntervention,
        signals: args.learningIntelligenceContext.hiddenConfusionSignals,
      });
    }

    return decision;
  }

  private async compressStudentSectionMemory(args: {
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
    teachBackAttempts: Array<{ student_response: string; evaluation: string; score: number }>;
    memoryDumpEvaluation: { studentResponse: string; evaluation: string; score: number };
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

    const studentMaterialMemory = (prisma as typeof prisma & {
      studentMaterialMemory: {
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
        upsert: (args: unknown) => Promise<unknown>;
      };
    }).studentMaterialMemory;

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
        args.calculationContext.detected ? `Calculation context:\n${args.calculationContext.summary}` : '',
        args.diagramContext.detected ? `Diagram context:\n${args.diagramContext.summary}` : '',
        `Section content:\n${truncate(args.sectionContent, 2500)}`,
        `Teach-back attempts:\n${args.teachBackAttempts.map((attempt, index) => `Attempt ${index + 1} score ${attempt.score}\nStudent: ${truncate(attempt.student_response, 400)}\nEvaluation: ${truncate(attempt.evaluation, 300)}`).join('\n\n')}`,
        `Memory dump:\nStudent: ${truncate(args.memoryDumpEvaluation.studentResponse, 500)}\nEvaluation: ${truncate(args.memoryDumpEvaluation.evaluation, 320)}\nScore: ${args.memoryDumpEvaluation.score}`,
        `Failed concepts:\n${args.failedConcepts.join('\n') || 'None listed'}`,
        'Create compact student learning memory JSON with keys: understood, weak_points, misconceptions, calculation_issues, diagram_issues, preferred_explanation_style, revisit_later, compressed_summary.',
      ].filter(Boolean).join('\n\n');

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
        preferred_explanation_style: typeof parsed.preferred_explanation_style === 'string' ? parsed.preferred_explanation_style : null,
        revisit_later: parsed.revisit_later,
        compressed_summary: typeof parsed.compressed_summary === 'string' ? parsed.compressed_summary : null,
      });

      const record = await studentMaterialMemory.upsert({
        where: { id: existing?.id || `missing-${args.userId}-${args.materialId}-${args.sectionIndex}` },
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
          misconceptions: normalized.misconceptions as unknown as Prisma.InputJsonValue,
          calculation_issues: normalized.calculationIssues as unknown as Prisma.InputJsonValue,
          diagram_issues: normalized.diagramIssues as unknown as Prisma.InputJsonValue,
          preferred_explanation_style: normalized.preferredExplanationStyle,
          revisit_later: normalized.revisitLater as unknown as Prisma.InputJsonValue,
          compressed_summary: normalized.compressedSummary,
        },
        update: {
          section_title: args.sectionTitle,
          mastered: args.passed,
          mastery_score: args.score,
          understood: normalized.understood as unknown as Prisma.InputJsonValue,
          weak_points: normalized.weakPoints as unknown as Prisma.InputJsonValue,
          misconceptions: normalized.misconceptions as unknown as Prisma.InputJsonValue,
          calculation_issues: normalized.calculationIssues as unknown as Prisma.InputJsonValue,
          diagram_issues: normalized.diagramIssues as unknown as Prisma.InputJsonValue,
          preferred_explanation_style: normalized.preferredExplanationStyle,
          revisit_later: normalized.revisitLater as unknown as Prisma.InputJsonValue,
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
        message: error instanceof Error ? error.message : 'Unknown student memory error',
      });

      const record = await studentMaterialMemory.upsert({
        where: { id: existing?.id || `missing-${args.userId}-${args.materialId}-${args.sectionIndex}` },
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
          misconceptions: fallback.misconceptions as unknown as Prisma.InputJsonValue,
          calculation_issues: fallback.calculation_issues as unknown as Prisma.InputJsonValue,
          diagram_issues: fallback.diagram_issues as unknown as Prisma.InputJsonValue,
          preferred_explanation_style: fallback.preferred_explanation_style,
          revisit_later: fallback.revisit_later as unknown as Prisma.InputJsonValue,
          compressed_summary: fallback.compressed_summary,
        },
        update: {
          section_title: args.sectionTitle,
          mastered: args.passed,
          mastery_score: args.score,
          understood: fallback.understood as unknown as Prisma.InputJsonValue,
          weak_points: fallback.weak_points as unknown as Prisma.InputJsonValue,
          misconceptions: fallback.misconceptions as unknown as Prisma.InputJsonValue,
          calculation_issues: fallback.calculation_issues as unknown as Prisma.InputJsonValue,
          diagram_issues: fallback.diagram_issues as unknown as Prisma.InputJsonValue,
          preferred_explanation_style: fallback.preferred_explanation_style,
          revisit_later: fallback.revisit_later as unknown as Prisma.InputJsonValue,
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

  private async createTeachingReflectionAfterSection(args: {
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
    teachBackAttempts: Array<{ student_response: string; evaluation: string; score: number }>;
    memoryDumpEvaluation: { studentResponse: string; evaluation: string; score: number };
  }) {
    console.log('teaching_reflection_started', {
      sessionId: args.sessionId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
      strategy: args.decision.strategy,
    });

    const teachingReflection = (prisma as typeof prisma & {
      teachingReflection: {
        findFirst: (query: unknown) => Promise<TeachingReflectionRow | null>;
        upsert: (query: unknown) => Promise<TeachingReflectionRow>;
      };
    }).teachingReflection;

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
        args.calculationContext.detected ? `Calculation context:\n${args.calculationContext.summary}` : '',
        args.diagramContext.detected ? `Diagram context:\n${args.diagramContext.summary}` : '',
        args.studentMemoryContext.promptContext ? `Prior student memory context:\n${args.studentMemoryContext.promptContext}` : '',
        memoryRecord?.compressedSummary ? `Current student memory summary:\n${memoryRecord.compressedSummary}` : '',
        `Section content:\n${truncate(args.sectionContent, 2200)}`,
        `Teach-back evidence:\n${args.teachBackAttempts.map((attempt, index) => `Attempt ${index + 1} score ${attempt.score}\nStudent: ${truncate(attempt.student_response, 240)}\nEvaluation: ${truncate(attempt.evaluation, 220)}`).join('\n\n')}`,
        `Memory dump evidence:\nStudent: ${truncate(args.memoryDumpEvaluation.studentResponse, 320)}\nEvaluation: ${truncate(args.memoryDumpEvaluation.evaluation, 220)}\nScore: ${args.memoryDumpEvaluation.score}`,
        `Failed concepts:\n${args.failedConcepts.join('\n') || 'None listed'}`,
        recentTrace?.quality_issues ? `Quality issues:\n${safeStringArray(recentTrace.quality_issues).join(' | ') || 'None recorded'}` : '',
        recentTrace?.metadata ? `Trace metadata:\n${truncate(JSON.stringify(recentTrace.metadata), 900)}` : '',
        'Create compact teaching reflection JSON with keys: concept_understanding, procedural_accuracy, reasoning_quality, confidence, hidden_confusion_risk, what_worked, what_failed, recommended_next_strategy, recommended_next_pace, recommended_interventions, compressed_reflection.',
      ].filter(Boolean).join('\n\n');

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
        recommended_next_strategy: typeof parsed.recommended_next_strategy === 'string' ? parsed.recommended_next_strategy : null,
        recommended_next_pace: typeof parsed.recommended_next_pace === 'string' ? parsed.recommended_next_pace : null,
        recommended_interventions: parsed.recommended_interventions,
        compressed_reflection: typeof parsed.compressed_reflection === 'string' ? parsed.compressed_reflection : null,
      });

      const record = await teachingReflection.upsert({
        where: { id: existing?.id || `missing-${args.sessionId}-${args.sectionIndex}` },
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
          recommended_interventions: normalized.recommendedInterventions as unknown as Prisma.InputJsonValue,
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
          recommended_interventions: normalized.recommendedInterventions as unknown as Prisma.InputJsonValue,
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
        message: error instanceof Error ? error.message : 'Unknown reflection error',
      });

      const normalized = parseTeachingReflectionRecord(fallback);
      const record = await teachingReflection.upsert({
        where: { id: existing?.id || `missing-${args.sessionId}-${args.sectionIndex}` },
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
          recommended_interventions: normalized.recommendedInterventions as unknown as Prisma.InputJsonValue,
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
          recommended_interventions: normalized.recommendedInterventions as unknown as Prisma.InputJsonValue,
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

  private async createLearningIntelligenceRecordAfterSection(args: {
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
    teachBackAttempts: Array<{ student_response: string; evaluation: string; score: number }>;
    memoryDumpEvaluation: { studentResponse: string; evaluation: string; score: number };
  }) {
    console.log('learning_intelligence_started', {
      sessionId: args.sessionId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
    });

    const learningIntelligenceRecord = (prisma as typeof prisma & {
      learningIntelligenceRecord: {
        findFirst: (query: unknown) => Promise<LearningIntelligenceRecordRow | null>;
        upsert: (query: unknown) => Promise<LearningIntelligenceRecordRow>;
      };
    }).learningIntelligenceRecord;

    const existing = await learningIntelligenceRecord.findFirst({
      where: {
        session_id: args.sessionId,
        section_index: args.sectionIndex,
      },
      select: { id: true },
    });

    const memoryRecord = args.latestStudentMemory ? parseStudentMemoryRecord(args.latestStudentMemory) : null;
    const reflection = args.latestTeachingReflection ? parseTeachingReflectionRecord(args.latestTeachingReflection) : null;
    const averageTeachBack =
      args.teachBackAttempts.length > 0
        ? Math.round(args.teachBackAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / args.teachBackAttempts.length)
        : args.score;
    const shortAnswerRisk = args.teachBackAttempts.some((attempt) => attempt.student_response.trim().split(/\s+/).filter(Boolean).length < 18);
    const calculationIssues = memoryRecord?.calculationIssues || [];
    const diagramIssues = memoryRecord?.diagramIssues || [];
    const prerequisiteWeakness = inferPrerequisiteWeaknessFromFailedConcepts(args.failedConcepts);
    const recentTutorTrace = await (prisma as typeof prisma & {
      tutorTurnTrace: {
        findFirst: (query: unknown) => Promise<{ quality_issues: unknown } | null>;
      };
    }).tutorTurnTrace.findFirst({
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
      procedural_accuracy: clampReflectionScore(args.score - (calculationIssues.length ? 15 : 0)),
      reasoning_quality: clampReflectionScore(averageTeachBack - Math.max(0, 70 - averageTeachBack) * 0.4),
      confidence: clampReflectionScore(args.score - Math.max(0, averageTeachBack - args.memoryDumpEvaluation.score) - (args.failedConcepts.length * 4)),
      hidden_confusion_risk: clampReflectionScore(Math.max(
        hiddenConfusionEstimate.risk,
        (args.passed ? 30 : 60) + args.failedConcepts.length * 8 + (shortAnswerRisk ? 10 : 0) + (args.score <= 84 ? 8 : 0),
      )),
      retention_risk: clampReflectionScore((100 - args.memoryDumpEvaluation.score) * 0.7 + (args.memoryDumpEvaluation.score < averageTeachBack ? 10 : 0)),
      calculation_weakness: calculationIssues.length > 0 || (args.calculationContext.detected && args.score < 75),
      diagram_weakness: diagramIssues.length > 0 || (args.diagramContext.detected && args.score < 75),
      prerequisite_weakness: prerequisiteWeakness,
      recommended_action: args.score < 80
        ? 'Reteach with slower pacing, prerequisite refresh, and one targeted worked example.'
        : 'Reinforce retention with a short recap and one retrieval prompt in the next related section.',
      evidence: {
        main_reason: args.failedConcepts[0] || 'Assessment pattern suggests uneven mastery across dimensions.',
        signals: truncateList([
          `Teach-back average: ${averageTeachBack}`,
          `Memory dump score: ${args.memoryDumpEvaluation.score}`,
          shortAnswerRisk ? 'Student answers were unusually short.' : '',
          calculationIssues.length ? `Calculation issues: ${calculationIssues.slice(0, 2).join(', ')}` : '',
          diagramIssues.length ? `Diagram issues: ${diagramIssues.slice(0, 2).join(', ')}` : '',
          ...hiddenConfusionEstimate.signals,
        ].filter(Boolean), 5, 140),
        hidden_confusion_level: hiddenConfusionEstimate.level,
        hidden_confusion_signals: hiddenConfusionEstimate.signals,
        recommended_confusion_intervention: hiddenConfusionEstimate.recommendedIntervention,
      },
    };

    try {
      const prompt = [
        'Return JSON only.',
        'No markdown.',
        `Section title: ${args.sectionTitle}`,
        `Mastery score: ${args.score}`,
        `Passed: ${args.passed ? 'yes' : 'no'}`,
        args.calculationContext.detected ? `Calculation context:\n${args.calculationContext.summary}` : '',
        args.diagramContext.detected ? `Diagram context:\n${args.diagramContext.summary}` : '',
        memoryRecord?.compressedSummary ? `Student memory:\n${memoryRecord.compressedSummary}` : '',
        reflection?.compressedReflection ? `Teaching reflection:\n${reflection.compressedReflection}` : '',
        `Teach-back evidence:\n${args.teachBackAttempts.map((attempt, index) => `Attempt ${index + 1} score ${attempt.score}\nStudent: ${truncate(attempt.student_response, 220)}\nEvaluation: ${truncate(attempt.evaluation, 180)}`).join('\n\n')}`,
        `Memory dump evidence:\nStudent: ${truncate(args.memoryDumpEvaluation.studentResponse, 260)}\nEvaluation: ${truncate(args.memoryDumpEvaluation.evaluation, 180)}\nScore: ${args.memoryDumpEvaluation.score}`,
        `Failed concepts:\n${args.failedConcepts.join('\n') || 'None listed'}`,
        `Section content:\n${truncate(args.sectionContent, 1800)}`,
        'Create learning intelligence JSON with keys: concept_understanding, procedural_accuracy, reasoning_quality, confidence, hidden_confusion_risk, retention_risk, calculation_weakness, diagram_weakness, prerequisite_weakness, recommended_action, evidence.',
      ].filter(Boolean).join('\n\n');

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
        where: { id: existing?.id || `missing-${args.sessionId}-${args.sectionIndex}` },
        create: {
          session_id: args.sessionId,
          companion_state_id: args.companionStateId,
          user_id: args.userId,
          material_id: args.materialId,
          course_code: args.courseCode,
          section_index: args.sectionIndex,
          section_title: args.sectionTitle,
          mastery_score: args.score,
          concept_understanding: clampReflectionScore(Number(parsed.concept_understanding ?? 50)),
          procedural_accuracy: clampReflectionScore(Number(parsed.procedural_accuracy ?? 50)),
          reasoning_quality: clampReflectionScore(Number(parsed.reasoning_quality ?? 50)),
          confidence: clampReflectionScore(Number(parsed.confidence ?? 50)),
          hidden_confusion_risk: clampReflectionScore(Number(parsed.hidden_confusion_risk ?? 50)),
          retention_risk: clampReflectionScore(Number(parsed.retention_risk ?? 50)),
          calculation_weakness: Boolean(parsed.calculation_weakness),
          diagram_weakness: Boolean(parsed.diagram_weakness),
          prerequisite_weakness: Boolean(parsed.prerequisite_weakness),
          recommended_action: typeof parsed.recommended_action === 'string' ? parsed.recommended_action : null,
          evidence: {
            main_reason: evidence.main_reason ? String(evidence.main_reason) : '',
            signals: safeStringArray(evidence.signals),
            hidden_confusion_level: evidence.hidden_confusion_level ? String(evidence.hidden_confusion_level) : hiddenConfusionEstimate.level,
            hidden_confusion_signals: safeStringArray(evidence.hidden_confusion_signals).length ? safeStringArray(evidence.hidden_confusion_signals) : hiddenConfusionEstimate.signals,
            recommended_confusion_intervention: evidence.recommended_confusion_intervention ? String(evidence.recommended_confusion_intervention) : hiddenConfusionEstimate.recommendedIntervention,
          } as unknown as Prisma.InputJsonValue,
        },
        update: {
          section_title: args.sectionTitle,
          mastery_score: args.score,
          concept_understanding: clampReflectionScore(Number(parsed.concept_understanding ?? 50)),
          procedural_accuracy: clampReflectionScore(Number(parsed.procedural_accuracy ?? 50)),
          reasoning_quality: clampReflectionScore(Number(parsed.reasoning_quality ?? 50)),
          confidence: clampReflectionScore(Number(parsed.confidence ?? 50)),
          hidden_confusion_risk: clampReflectionScore(Number(parsed.hidden_confusion_risk ?? 50)),
          retention_risk: clampReflectionScore(Number(parsed.retention_risk ?? 50)),
          calculation_weakness: Boolean(parsed.calculation_weakness),
          diagram_weakness: Boolean(parsed.diagram_weakness),
          prerequisite_weakness: Boolean(parsed.prerequisite_weakness),
          recommended_action: typeof parsed.recommended_action === 'string' ? parsed.recommended_action : null,
          evidence: {
            main_reason: evidence.main_reason ? String(evidence.main_reason) : '',
            signals: safeStringArray(evidence.signals),
            hidden_confusion_level: evidence.hidden_confusion_level ? String(evidence.hidden_confusion_level) : hiddenConfusionEstimate.level,
            hidden_confusion_signals: safeStringArray(evidence.hidden_confusion_signals).length ? safeStringArray(evidence.hidden_confusion_signals) : hiddenConfusionEstimate.signals,
            recommended_confusion_intervention: evidence.recommended_confusion_intervention ? String(evidence.recommended_confusion_intervention) : hiddenConfusionEstimate.recommendedIntervention,
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
        message: error instanceof Error ? error.message : 'Unknown learning intelligence error',
      });

      const record = await learningIntelligenceRecord.upsert({
        where: { id: existing?.id || `missing-${args.sessionId}-${args.sectionIndex}` },
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

  private async buildImmediateLearningIntelligenceContext(args: {
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
    teachBackAttempts: Array<{ student_response: string; evaluation: string; score: number }>;
    memoryDumpEvaluation: { studentResponse: string; evaluation: string; score: number };
  }): Promise<LearningIntelligenceContext> {
    const memoryRecord = args.latestStudentMemory ? parseStudentMemoryRecord(args.latestStudentMemory) : null;
    const averageTeachBack =
      args.teachBackAttempts.length > 0
        ? Math.round(args.teachBackAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / args.teachBackAttempts.length)
        : args.score;
    const shortAnswerRisk = args.teachBackAttempts.some((attempt) => attempt.student_response.trim().split(/\s+/).filter(Boolean).length < 18);
    const calculationIssues = memoryRecord?.calculationIssues || [];
    const diagramIssues = memoryRecord?.diagramIssues || [];
    const prerequisiteWeakness = inferPrerequisiteWeaknessFromFailedConcepts(args.failedConcepts);
    const recentTutorTrace = await (prisma as typeof prisma & {
      tutorTurnTrace: {
        findFirst: (query: unknown) => Promise<{ quality_issues: unknown } | null>;
      };
    }).tutorTurnTrace.findFirst({
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

    const hiddenConfusionRisk = clampReflectionScore(Math.max(
      hiddenConfusionEstimate.risk,
      (args.passed ? 30 : 60) + args.failedConcepts.length * 8 + (shortAnswerRisk ? 10 : 0) + (args.score <= 84 ? 8 : 0),
    ));

    return {
      masteryScore: args.score,
      conceptUnderstanding: clampReflectionScore(args.score),
      proceduralAccuracy: clampReflectionScore(args.score - (calculationIssues.length ? 15 : 0)),
      reasoningQuality: clampReflectionScore(averageTeachBack - Math.max(0, 70 - averageTeachBack) * 0.4),
      confidence: clampReflectionScore(args.score - Math.max(0, averageTeachBack - args.memoryDumpEvaluation.score) - (args.failedConcepts.length * 4)),
      hiddenConfusionRisk,
      hiddenConfusionLevel: hiddenConfusionEstimate.level,
      hiddenConfusionSignals: hiddenConfusionEstimate.signals,
      recommendedConfusionIntervention: hiddenConfusionEstimate.recommendedIntervention,
      retentionRisk: clampReflectionScore((100 - args.memoryDumpEvaluation.score) * 0.7 + (args.memoryDumpEvaluation.score < averageTeachBack ? 10 : 0)),
      calculationWeakness: calculationIssues.length > 0 || (args.calculationContext.detected && args.score < 75),
      diagramWeakness: diagramIssues.length > 0 || (args.diagramContext.detected && args.score < 75),
      prerequisiteWeakness,
      recommendedAction: args.score < 80
        ? 'Reteach with slower pacing, prerequisite refresh, and one targeted worked example.'
        : 'Reinforce retention with a short recap and one retrieval prompt in the next related section.',
      evidence: {
        mainReason: args.failedConcepts[0] || 'Assessment pattern suggests uneven mastery across dimensions.',
        signals: truncateList([
          `Teach-back average: ${averageTeachBack}`,
          `Memory dump score: ${args.memoryDumpEvaluation.score}`,
          shortAnswerRisk ? 'Student answers were unusually short.' : '',
          calculationIssues.length ? `Calculation issues: ${calculationIssues.slice(0, 2).join(', ')}` : '',
          diagramIssues.length ? `Diagram issues: ${diagramIssues.slice(0, 2).join(', ')}` : '',
          ...hiddenConfusionEstimate.signals,
        ].filter(Boolean), 5, 140),
      },
    };
  }

  async processPostAssessmentIntelligenceJob(payload: PostAssessmentIntelligencePayload) {
    console.log('post_assessment_intelligence_started', {
      sessionId: payload.sessionId,
      sectionIndex: payload.sectionIndex,
      materialId: payload.materialId,
    });

    try {
      const session = await prisma.session.findUnique({
        where: { id: payload.sessionId },
        include: {
          material: {
            select: {
              id: true,
              content: true,
              reader_structure: true,
              teacher_brain: {
                select: {
                  summary: true,
                  chapter_summaries: true,
                  concept_graph: true,
                  prerequisites: true,
                  formulas: true,
                  calculation_methods: true,
                  diagrams: true,
                  misconceptions: true,
                  exam_angles: true,
                  teacher_notes: true,
                  subject_family: true,
                  confidence: true,
                },
              },
            },
          },
          companion_state: true,
        },
      });

      if (!session?.material) {
        console.warn('post_assessment_intelligence_failed', {
          sessionId: payload.sessionId,
          sectionIndex: payload.sectionIndex,
          message: 'Session or material missing during post-assessment processing.',
        });
        return;
      }

      const roadmap = safeJsonArray<RoadmapSection>(session.companion_state?.roadmap);
      const section = roadmap[payload.sectionIndex];
      if (!section) {
        console.warn('post_assessment_intelligence_failed', {
          sessionId: payload.sessionId,
          sectionIndex: payload.sectionIndex,
          message: 'Section missing from roadmap during post-assessment processing.',
        });
        return;
      }

      const teacherBrain = parseTeacherBrain(session.material.teacher_brain);
      const teacherBrainSectionContext = getTeacherBrainSectionContext(teacherBrain, payload.sectionIndex, section.title);
      const calculationContext = buildCalculationTeachingContext(section, teacherBrainSectionContext);
      const diagramContext = buildDiagramTeachingContext(section, teacherBrainSectionContext);
      const studentMemoryContext = await this.buildStudentMemoryContext(
        payload.userId,
        payload.materialId,
        payload.courseCode,
        payload.sectionIndex,
      );
      const teachingDecision = this.parseTeachingDecisionSnapshot(payload.teachingDecisionSnapshot);

      const teachBackAttempts = await prisma.teachBackAttempt.findMany({
        where: {
          companion_state_id: payload.companionStateId,
          section_index: payload.sectionIndex,
        },
        orderBy: { created_at: 'asc' },
        select: {
          student_response: true,
          evaluation: true,
          score: true,
        },
      });
      const memoryDumpAttempt = await prisma.memoryDumpAttempt.findFirst({
        where: {
          companion_state_id: payload.companionStateId,
          section_index: payload.sectionIndex,
        },
        orderBy: { created_at: 'desc' },
        select: {
          student_response: true,
          evaluation: true,
          score: true,
        },
      });

      if (!memoryDumpAttempt) {
        console.warn('post_assessment_intelligence_failed', {
          sessionId: payload.sessionId,
          sectionIndex: payload.sectionIndex,
          message: 'Memory dump attempt missing during post-assessment processing.',
        });
        return;
      }

      const latestStudentMemory = await this.compressStudentSectionMemory({
        userId: payload.userId,
        materialId: payload.materialId,
        courseCode: payload.courseCode,
        sectionIndex: payload.sectionIndex,
        sectionTitle: payload.sectionTitle,
        sectionContent: section.content,
        passed: payload.masteryStatus === 'PASSED',
        score: payload.masteryScore,
        failedConcepts: payload.failedConcepts,
        calculationContext,
        diagramContext,
        teachBackAttempts,
        memoryDumpEvaluation: {
          studentResponse: memoryDumpAttempt.student_response,
          evaluation: memoryDumpAttempt.evaluation,
          score: memoryDumpAttempt.score,
        },
      });

      const latestTeachingReflection = teachingDecision
        ? await this.createTeachingReflectionAfterSection({
          sessionId: payload.sessionId,
          companionStateId: payload.companionStateId,
          userId: payload.userId,
          materialId: payload.materialId,
          courseCode: payload.courseCode,
          sectionIndex: payload.sectionIndex,
          sectionTitle: payload.sectionTitle,
          sectionContent: section.content,
          decision: teachingDecision,
          score: payload.masteryScore,
          passed: payload.masteryStatus === 'PASSED',
          failedConcepts: payload.failedConcepts,
          calculationContext,
          diagramContext,
          studentMemoryContext,
          latestStudentMemory: latestStudentMemory as StudentMaterialMemoryRow,
          teachBackAttempts,
          memoryDumpEvaluation: {
            studentResponse: memoryDumpAttempt.student_response,
            evaluation: memoryDumpAttempt.evaluation,
            score: memoryDumpAttempt.score,
          },
        })
        : null;

      await this.createLearningIntelligenceRecordAfterSection({
        sessionId: payload.sessionId,
        companionStateId: payload.companionStateId,
        userId: payload.userId,
        materialId: payload.materialId,
        courseCode: payload.courseCode,
        sectionIndex: payload.sectionIndex,
        sectionTitle: payload.sectionTitle,
        sectionContent: section.content,
        score: payload.masteryScore,
        passed: payload.masteryStatus === 'PASSED',
        failedConcepts: payload.failedConcepts,
        calculationContext,
        diagramContext,
        studentMemoryContext,
        latestStudentMemory: latestStudentMemory as StudentMaterialMemoryRow,
        latestTeachingReflection,
        teachBackAttempts,
        memoryDumpEvaluation: {
          studentResponse: memoryDumpAttempt.student_response,
          evaluation: memoryDumpAttempt.evaluation,
          score: memoryDumpAttempt.score,
        },
      });

      await this.updateStudentLearningProfileAfterReflection(
        payload.userId,
        payload.courseCode,
        payload.materialId,
      );

      console.log('post_assessment_intelligence_completed', {
        sessionId: payload.sessionId,
        sectionIndex: payload.sectionIndex,
        materialId: payload.materialId,
      });
    } catch (error) {
      console.error('post_assessment_intelligence_failed', {
        sessionId: payload.sessionId,
        sectionIndex: payload.sectionIndex,
        materialId: payload.materialId,
        message: error instanceof Error ? error.message : 'Unknown post-assessment intelligence error',
      });
    }
  }

  private parseTeachingDecisionSnapshot(snapshot: Record<string, unknown> | undefined): TeachingDecision | null {
    if (!snapshot) return null;

    const strategy = typeof snapshot.strategy === 'string' ? snapshot.strategy : null;
    const pace = typeof snapshot.pace === 'string' ? snapshot.pace : null;
    const prerequisiteRepairMode = typeof snapshot.prerequisiteRepairMode === 'string'
      ? snapshot.prerequisiteRepairMode
      : null;

    if (!isTeachingStrategy(strategy) || !isTeachingPace(pace) || !isPrerequisiteRepairMode(prerequisiteRepairMode)) {
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
      traceMetadata: safeJsonObject<Record<string, unknown>>(snapshot.traceMetadata, {}),
    };
  }

  private async updateStudentLearningProfileAfterReflection(userId: string, courseCode: string, materialId: string) {
    console.log('student_learning_profile_update_started', {
      userId,
      courseCode,
      materialId,
    });

    try {
      const [reflections, intelligenceRecords, memories] = await Promise.all([
        (prisma as typeof prisma & {
          teachingReflection: { findMany: (query: unknown) => Promise<TeachingReflectionRow[]> };
        }).teachingReflection.findMany({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
          take: 30,
        }),
        (prisma as typeof prisma & {
          learningIntelligenceRecord: { findMany: (query: unknown) => Promise<LearningIntelligenceRecordRow[]> };
        }).learningIntelligenceRecord.findMany({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
          take: 30,
        }),
        (prisma as typeof prisma & {
          studentMaterialMemory: { findMany: (query: unknown) => Promise<StudentMaterialMemoryRow[]> };
        }).studentMaterialMemory.findMany({
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
        const confusionPenalty = Math.max(0, (reflection.hidden_confusion_risk ?? 50) - 40) * 0.2;
        const confidenceBonus = Math.max(0, (reflection.confidence ?? 50) - 50) * 0.15;
        const net = clampReflectionScore(scoreBase - confusionPenalty + confidenceBonus);
        strategyScores[reflection.strategy_used] = clampReflectionScore((strategyScores[reflection.strategy_used] * 0.65) + (net * 0.35));
      }

      const diagramHeavyReflections = reflections.filter((item) => item.visual_explanation_used);
      if (diagramHeavyReflections.some((item) => (item.mastery_score ?? 0) >= 80 && (item.hidden_confusion_risk ?? 100) <= 40)) {
        strategyScores.visual_first = clampReflectionScore(strategyScores.visual_first + 8);
      }
      const workedExampleReflections = reflections.filter((item) => item.worked_example_used);
      if (workedExampleReflections.some((item) => (item.mastery_score ?? 0) >= 80 && (item.hidden_confusion_risk ?? 100) <= 40)) {
        strategyScores.worked_example_first = clampReflectionScore(strategyScores.worked_example_first + 8);
      }
      const analogyReflections = reflections.filter((item) => item.analogy_used);
      if (analogyReflections.some((item) => (item.confidence ?? 0) >= 65 || (item.hidden_confusion_risk ?? 100) <= 40)) {
        strategyScores.analogy_first = clampReflectionScore(strategyScores.analogy_first + 6);
      }

      const avgConfidence = intelligenceRecords.length
        ? intelligenceRecords.reduce((sum, item) => sum + item.confidence, 0) / intelligenceRecords.length
        : 50;
      const avgHiddenConfusion = intelligenceRecords.length
        ? intelligenceRecords.reduce((sum, item) => sum + item.hidden_confusion_risk, 0) / intelligenceRecords.length
        : 50;
      const avgMastery = intelligenceRecords.length
        ? intelligenceRecords.reduce((sum, item) => sum + (item.mastery_score ?? 50), 0) / intelligenceRecords.length
        : 50;

      const repeatedCalculationIssues = memories.filter((item) => safeStringArray(item.calculation_issues).length > 0).length >= 2;
      const repeatedDiagramIssues = memories.filter((item) => safeStringArray(item.diagram_issues).length > 0).length >= 2;
      const repeatedLowConfidence = intelligenceRecords.filter((item) => item.confidence < 50).length >= 2;

      let preferredTeachingStrategy: TeachingStrategy | null = null;
      const bestEntry = Object.entries(strategyScores).sort((a, b) => b[1] - a[1])[0];
      const secondEntry = Object.entries(strategyScores).sort((a, b) => b[1] - a[1])[1];
      if (bestEntry && isTeachingStrategy(bestEntry[0]) && bestEntry[1] >= 60 && (!secondEntry || bestEntry[1] - secondEntry[1] >= 5)) {
        preferredTeachingStrategy = bestEntry[0];
      } else if (reflections.length >= 6) {
        preferredTeachingStrategy = 'hybrid';
      }

      let preferredPace: TeachingPace = 'normal';
      const slowHelpful = reflections.filter((item) => item.pace_used === 'slow' && (item.mastery_score ?? 0) >= 75 && (item.hidden_confusion_risk ?? 100) <= 45).length;
      const fastStrong = intelligenceRecords.filter((item) => (item.mastery_score ?? 0) >= 85 && item.confidence >= 75 && item.hidden_confusion_risk <= 35).length;
      if (avgConfidence < 55 || avgHiddenConfusion > 55 || slowHelpful >= 2) {
        preferredPace = 'slow';
      } else if (avgMastery >= 85 && avgConfidence >= 75 && avgHiddenConfusion <= 35 && fastStrong >= 3) {
        preferredPace = 'fast';
      }

      await prisma.learningProfile.upsert({
        where: { user_id: userId },
        update: {
          teaching_strategy_success: strategyScores as unknown as Prisma.InputJsonValue,
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
          teaching_strategy_success: strategyScores as unknown as Prisma.InputJsonValue,
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
        message: error instanceof Error ? error.message : 'Unknown learning profile update error',
      });
    }
  }

  private async getOrCreateLessonPlan(args: {
    sessionId: string;
    companionStateId: string;
    userId: string;
    materialId: string;
    courseCode: string;
    section: RoadmapSection;
    sectionIndex: number;
    teacherBrainContext: string;
    calculationContext: CalculationTeachingContext;
    diagramContext: DiagramTeachingContext;
    studentMemoryPromptContext: string;
  }) {
    const studySectionLessonPlan = (prisma as typeof prisma & {
      studySectionLessonPlan: {
        findFirst: (query: unknown) => Promise<StudySectionLessonPlanRow | null>;
        upsert: (query: unknown) => Promise<StudySectionLessonPlanRow>;
      };
    }).studySectionLessonPlan;

    const existing = await studySectionLessonPlan.findFirst({
      where: {
        session_id: args.sessionId,
        section_index: args.sectionIndex,
      },
    });

    if (existing) {
      const parsed = parseStudySectionLessonPlanRecord(existing);
      console.log('lesson_plan_context_applied', {
        sessionId: args.sessionId,
        materialId: args.materialId,
        sectionIndex: args.sectionIndex,
        source: 'reused',
      });
      return parsed;
    }

    console.log('lesson_plan_generation_started', {
      sessionId: args.sessionId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
    });

    const fallback = buildFallbackLessonPlan({
      section: args.section,
      calculationContext: args.calculationContext,
      diagramContext: args.diagramContext,
      studentMemoryPromptContext: args.studentMemoryPromptContext,
      teacherBrainContext: args.teacherBrainContext,
    });

    try {
      const prompt = [
        'Return JSON only.',
        'No markdown.',
        `Course code: ${args.courseCode}`,
        `Section title: ${args.section.title}`,
        args.teacherBrainContext ? `Teacher Brain context:\n${args.teacherBrainContext}` : '',
        args.studentMemoryPromptContext ? `Student memory context:\n${args.studentMemoryPromptContext}` : '',
        args.calculationContext.detected ? `Calculation context:\n${args.calculationContext.summary}` : '',
        args.diagramContext.detected ? `Diagram context:\n${args.diagramContext.summary}` : '',
        `Section content:\n${truncate(args.section.content, 3200)}`,
        'Create a compact internal lesson plan JSON with keys: lesson_objective, prerequisite_refresh, teaching_sequence, analogy_plan, calculation_plan, diagram_plan, checkpoint_focus, exam_focus, fallback_plan.',
        'The plan is for internal tutoring only. Keep it concise, specific to the section, exam-aware, and suitable for a tertiary institution student.',
        'Use current section content as the source of truth.',
      ].filter(Boolean).join('\n\n');

      const raw = await generateText(
        prompt,
        `${this.companionSystemPrompt()}\nCreate compact internal lesson plans for one section at a time. Return valid JSON only.`,
        900,
      );

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

      if (!parsedJson) {
        throw new Error('Lesson plan JSON parse failed.');
      }

      const normalized = parseStudySectionLessonPlanRecord({
        lesson_objective: typeof parsedJson.lesson_objective === 'string' ? parsedJson.lesson_objective : '',
        prerequisite_refresh: parsedJson.prerequisite_refresh,
        teaching_sequence: parsedJson.teaching_sequence,
        analogy_plan: parsedJson.analogy_plan,
        calculation_plan: parsedJson.calculation_plan,
        diagram_plan: parsedJson.diagram_plan,
        checkpoint_focus: parsedJson.checkpoint_focus,
        exam_focus: parsedJson.exam_focus,
        fallback_plan: parsedJson.fallback_plan,
      });

      await studySectionLessonPlan.upsert({
        where: { id: `missing-${args.sessionId}-${args.sectionIndex}` },
        create: {
          session_id: args.sessionId,
          companion_state_id: args.companionStateId,
          user_id: args.userId,
          material_id: args.materialId,
          course_code: args.courseCode,
          section_index: args.sectionIndex,
          section_title: args.section.title,
          lesson_objective: normalized.lessonObjective || fallback.lessonObjective,
          prerequisite_refresh: normalized.prerequisiteRefresh as unknown as Prisma.InputJsonValue,
          teaching_sequence: normalized.teachingSequence as unknown as Prisma.InputJsonValue,
          analogy_plan: normalized.analogyPlan as unknown as Prisma.InputJsonValue,
          calculation_plan: normalized.calculationPlan as unknown as Prisma.InputJsonValue,
          diagram_plan: normalized.diagramPlan as unknown as Prisma.InputJsonValue,
          checkpoint_focus: normalized.checkpointFocus as unknown as Prisma.InputJsonValue,
          exam_focus: normalized.examFocus as unknown as Prisma.InputJsonValue,
          fallback_plan: normalized.fallbackPlan as unknown as Prisma.InputJsonValue,
        },
        update: {
          section_title: args.section.title,
          lesson_objective: normalized.lessonObjective || fallback.lessonObjective,
          prerequisite_refresh: normalized.prerequisiteRefresh as unknown as Prisma.InputJsonValue,
          teaching_sequence: normalized.teachingSequence as unknown as Prisma.InputJsonValue,
          analogy_plan: normalized.analogyPlan as unknown as Prisma.InputJsonValue,
          calculation_plan: normalized.calculationPlan as unknown as Prisma.InputJsonValue,
          diagram_plan: normalized.diagramPlan as unknown as Prisma.InputJsonValue,
          checkpoint_focus: normalized.checkpointFocus as unknown as Prisma.InputJsonValue,
          exam_focus: normalized.examFocus as unknown as Prisma.InputJsonValue,
          fallback_plan: normalized.fallbackPlan as unknown as Prisma.InputJsonValue,
        },
      });

      console.log('lesson_plan_generation_completed', {
        sessionId: args.sessionId,
        materialId: args.materialId,
        sectionIndex: args.sectionIndex,
      });
      console.log('lesson_plan_context_applied', {
        sessionId: args.sessionId,
        materialId: args.materialId,
        sectionIndex: args.sectionIndex,
        source: 'generated',
      });
      return normalized.lessonObjective ? normalized : fallback;
    } catch (error) {
      console.error('lesson_plan_generation_failed', {
        sessionId: args.sessionId,
        materialId: args.materialId,
        sectionIndex: args.sectionIndex,
        message: error instanceof Error ? error.message : 'Unknown lesson plan error',
      });

      await studySectionLessonPlan.upsert({
        where: { id: `missing-${args.sessionId}-${args.sectionIndex}` },
        create: {
          session_id: args.sessionId,
          companion_state_id: args.companionStateId,
          user_id: args.userId,
          material_id: args.materialId,
          course_code: args.courseCode,
          section_index: args.sectionIndex,
          section_title: args.section.title,
          lesson_objective: fallback.lessonObjective,
          prerequisite_refresh: fallback.prerequisiteRefresh as unknown as Prisma.InputJsonValue,
          teaching_sequence: fallback.teachingSequence as unknown as Prisma.InputJsonValue,
          analogy_plan: fallback.analogyPlan as unknown as Prisma.InputJsonValue,
          calculation_plan: fallback.calculationPlan as unknown as Prisma.InputJsonValue,
          diagram_plan: fallback.diagramPlan as unknown as Prisma.InputJsonValue,
          checkpoint_focus: fallback.checkpointFocus as unknown as Prisma.InputJsonValue,
          exam_focus: fallback.examFocus as unknown as Prisma.InputJsonValue,
          fallback_plan: fallback.fallbackPlan as unknown as Prisma.InputJsonValue,
        },
        update: {
          section_title: args.section.title,
          lesson_objective: fallback.lessonObjective,
          prerequisite_refresh: fallback.prerequisiteRefresh as unknown as Prisma.InputJsonValue,
          teaching_sequence: fallback.teachingSequence as unknown as Prisma.InputJsonValue,
          analogy_plan: fallback.analogyPlan as unknown as Prisma.InputJsonValue,
          calculation_plan: fallback.calculationPlan as unknown as Prisma.InputJsonValue,
          diagram_plan: fallback.diagramPlan as unknown as Prisma.InputJsonValue,
          checkpoint_focus: fallback.checkpointFocus as unknown as Prisma.InputJsonValue,
          exam_focus: fallback.examFocus as unknown as Prisma.InputJsonValue,
          fallback_plan: fallback.fallbackPlan as unknown as Prisma.InputJsonValue,
        },
      });

      console.log('lesson_plan_context_applied', {
        sessionId: args.sessionId,
        materialId: args.materialId,
        sectionIndex: args.sectionIndex,
        source: 'fallback',
      });
      return fallback;
    }
  }

  private async buildRelevantMaterialContext(
    materialId: string,
    section: RoadmapSection,
    teacherBrainContext: string,
    lessonPlan: StudySectionLessonPlanRecord,
    teacherBrainSectionContext?: TeacherBrainSectionContext,
    contextMeta?: { sessionId: string; sectionIndex: number },
  ): Promise<RelevantMaterialContext> {
    const materialEmbedding = (prisma as typeof prisma & {
      materialEmbedding: {
        findMany: (query: unknown) => Promise<MaterialEmbeddingRow[]>;
      };
    }).materialEmbedding;

    const queryParts = [
      section.title,
      lessonPlan.lessonObjective,
      ...lessonPlan.prerequisiteRefresh,
      ...lessonPlan.calculationPlan,
      ...lessonPlan.examFocus,
      ...lessonPlan.checkpointFocus,
      ...(teacherBrainSectionContext?.formulas || []).map((item) => `${item.name || 'Formula'} ${item.formula_latex || ''} ${item.when_to_use || ''}`.trim()),
      ...(teacherBrainSectionContext?.calculationMethods || []).map((item) => `${item.topic || 'Method'} ${(item.method_steps || []).join(' ')}`.trim()),
      ...(teacherBrainSectionContext?.misconceptions || []).map((item) => `${item.misconception || ''} ${item.correction || ''}`.trim()),
      teacherBrainContext,
    ].filter(Boolean);

    const embeddings = await materialEmbedding.findMany({
      where: { material_id: materialId },
      select: {
        chunk_index: true,
        chunk_text: true,
        embedding: true,
      },
      take: 120,
      orderBy: {
        chunk_index: 'asc',
      },
    });

    if (!embeddings.length) {
      console.log('relevant_material_context_missing', {
        materialId,
        sectionIndex: contextMeta?.sectionIndex,
        reason: 'no_embeddings',
      });
      return { chunks: [], promptContext: '' };
    }

    const queryText = truncate(queryParts.join('\n'), 4000);
    let queryVector: number[] = [];
    try {
      queryVector = await aiProvider.generateEmbedding(queryText);
    } catch (error) {
      console.error('relevant_material_context_missing', {
        materialId,
        sectionIndex: contextMeta?.sectionIndex,
        reason: error instanceof Error ? error.message : 'query_embedding_failed',
      });
    }

    const scoredChunks = embeddings
      .map((chunk) => {
        const chunkVector = parseEmbeddingVector(chunk.embedding);
        const cosineScore = queryVector.length && chunkVector.length ? cosineSimilarity(queryVector, chunkVector) : 0;
        const lexicalScore = tokenOverlapScore(queryText, chunk.chunk_text);
        const duplicatePenalty = tokenOverlapScore(section.content, chunk.chunk_text);
        const score = cosineScore > 0 ? (cosineScore * 0.75) + (lexicalScore * 0.25) : lexicalScore;
        return {
          chunkIndex: chunk.chunk_index,
          excerpt: truncate(normalizeText(chunk.chunk_text), 220),
          whyRelevant: explainChunkRelevance(chunk.chunk_text, queryParts),
          score,
          duplicatePenalty,
        };
      })
      .filter((chunk) => chunk.duplicatePenalty < 0.72)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .filter((chunk) => chunk.score > 0.05);

    if (!scoredChunks.length) {
      console.log('relevant_material_context_missing', {
        materialId,
        sectionIndex: contextMeta?.sectionIndex,
        reason: 'no_relevant_chunks',
      });
      return { chunks: [], promptContext: '' };
    }

    const selected = scoredChunks.slice(0, 4);
    const promptContext = selected
      .map((chunk) => `Chunk ${chunk.chunkIndex}: ${chunk.excerpt}\nWhy relevant: ${chunk.whyRelevant}`)
      .join('\n\n');

    console.log('relevant_material_context_loaded', {
      materialId,
      sectionIndex: contextMeta?.sectionIndex,
      chunkCount: selected.length,
    });

    return {
      chunks: selected,
      promptContext,
    };
  }

  private async startTutorTrace(seed: TutorTraceSeed): Promise<TutorTraceRuntime> {
    const runtime: TutorTraceRuntime = {
      id: null,
      startedAt: Date.now(),
      aiLatencyMs: 0,
      metadata: { ...(seed.metadata || {}) },
      quality: {
        issues: [],
        regenerated: false,
        fallbackUsed: false,
        correctionApplied: false,
      },
    };

    try {
      const trace = await (prisma as typeof prisma & {
        tutorTurnTrace: {
          create: (query: unknown) => Promise<{ id: string }>;
        };
      }).tutorTurnTrace.create({
        data: {
          session_id: seed.sessionId,
          user_id: seed.userId,
          material_id: seed.materialId || null,
          course_code: seed.courseCode || null,
          section_index: seed.sectionIndex ?? null,
          section_title: seed.sectionTitle || null,
          phase: seed.phase,
          turn_type: seed.turnType || null,
          action: seed.action || null,
          teacher_brain_used: seed.teacherBrainUsed,
          student_memory_used: seed.studentMemoryUsed,
          lesson_plan_used: seed.lessonPlanUsed,
          relevant_material_used: seed.relevantMaterialUsed,
          calculation_context_used: seed.calculationContextUsed,
          diagram_context_used: seed.diagramContextUsed,
          quality_guardrail_used: seed.qualityGuardrailUsed,
          prompt_tokens_estimate: seed.promptTokensEstimate ?? null,
          metadata: (seed.metadata || {}) as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      runtime.id = trace.id;
      console.log('tutor_trace_started', {
        traceId: runtime.id,
        sessionId: seed.sessionId,
        phase: seed.phase,
        turnType: seed.turnType,
        action: seed.action,
      });
    } catch (error) {
      console.error('tutor_trace_failed', {
        sessionId: seed.sessionId,
        phase: seed.phase,
        stage: 'start',
        message: error instanceof Error ? error.message : 'Unknown trace start error',
      });
    }

    return runtime;
  }

  private async finishTutorTrace(
    trace: TutorTraceRuntime,
    args: {
      content: string;
      qualityGuardrailUsed?: boolean;
      extraMetadata?: Record<string, unknown>;
    },
  ) {
    if (!trace.id) return;

    try {
      const latencyMs = Date.now() - trace.startedAt;
      await (prisma as typeof prisma & {
        tutorTurnTrace: {
          update: (query: unknown) => Promise<unknown>;
        };
      }).tutorTurnTrace.update({
        where: { id: trace.id },
        data: {
          quality_guardrail_used: args.qualityGuardrailUsed ?? false,
          quality_issues: trace.quality.issues as unknown as Prisma.InputJsonValue,
          response_chars: args.content.length,
          latency_ms: latencyMs,
          ai_latency_ms: trace.aiLatencyMs || null,
          metadata: {
            ...(trace.metadata || {}),
            regenerated: trace.quality.regenerated,
            fallback_used: trace.quality.fallbackUsed,
            correction_applied: trace.quality.correctionApplied,
            scope_violation_detected: trace.quality.issues.some((issue) => issue.startsWith('scope_') || issue === 'teachback_scope_violation'),
            scope_violations: trace.quality.issues.filter((issue) => issue.startsWith('scope_') || issue === 'teachback_scope_violation'),
            depth_violation_detected: trace.quality.issues.some((issue) => issue.startsWith('depth_')),
            depth_violations: trace.quality.issues.filter((issue) => issue.startsWith('depth_')),
            ...(args.extraMetadata || {}),
          } as Prisma.InputJsonValue,
        },
      });
      console.log('tutor_trace_finished', {
        traceId: trace.id,
        latencyMs,
        aiLatencyMs: trace.aiLatencyMs,
        responseChars: args.content.length,
      });
    } catch (error) {
      console.error('tutor_trace_failed', {
        traceId: trace.id,
        stage: 'finish',
        message: error instanceof Error ? error.message : 'Unknown trace finish error',
      });
    }
  }

  private async failTutorTrace(trace: TutorTraceRuntime, error: unknown) {
    if (!trace.id) return;

    try {
      await (prisma as typeof prisma & {
        tutorTurnTrace: {
          update: (query: unknown) => Promise<unknown>;
        };
      }).tutorTurnTrace.update({
        where: { id: trace.id },
        data: {
          latency_ms: Date.now() - trace.startedAt,
          ai_latency_ms: trace.aiLatencyMs || null,
          quality_issues: trace.quality.issues as unknown as Prisma.InputJsonValue,
          error_message: error instanceof Error ? error.message : 'Unknown tutor trace error',
          metadata: {
            ...(trace.metadata || {}),
            regenerated: trace.quality.regenerated,
            fallback_used: trace.quality.fallbackUsed,
            correction_applied: trace.quality.correctionApplied,
            scope_violation_detected: trace.quality.issues.some((issue) => issue.startsWith('scope_') || issue === 'teachback_scope_violation'),
            scope_violations: trace.quality.issues.filter((issue) => issue.startsWith('scope_') || issue === 'teachback_scope_violation'),
            depth_violation_detected: trace.quality.issues.some((issue) => issue.startsWith('depth_')),
            depth_violations: trace.quality.issues.filter((issue) => issue.startsWith('depth_')),
          } as Prisma.InputJsonValue,
        },
      });
      console.error('tutor_trace_failed', {
        traceId: trace.id,
        stage: 'turn',
        message: error instanceof Error ? error.message : 'Unknown tutor turn error',
      });
    } catch (traceError) {
      console.error('tutor_trace_failed', {
        traceId: trace.id,
        stage: 'fail',
        message: traceError instanceof Error ? traceError.message : 'Unknown trace fail error',
      });
    }
  }

  private async enforceTutorMessageQuality(
    args: TutorMessageQualityArgs & {
      prompt: string;
      maxTokens?: number;
      contextMeta?: { sessionId: string; materialId: string; sectionIndex: number; prompt: string };
      qualityTrace?: TutorQualityTraceCapture;
    },
  ) {
    console.log('tutor_quality_check_started', {
      phase: args.phase,
      turnType: args.turnType,
      prompt: args.contextMeta?.prompt,
      sectionTitle: args.section.title,
    });

    const validation = validateTutorMessageQuality(args);
    if (validation.passed) {
      if (args.qualityTrace) {
        args.qualityTrace.issues = [];
      }
      console.log('tutor_quality_check_passed', {
        phase: args.phase,
        turnType: args.turnType,
        prompt: args.contextMeta?.prompt,
      });
      return normalizeText(args.content);
    }

    console.log('tutor_quality_check_failed', {
      phase: args.phase,
      turnType: args.turnType,
      prompt: args.contextMeta?.prompt,
      issues: validation.issues,
    });

    const corrected = normalizeText(validation.correctedContent || '');
    if (args.qualityTrace) {
      args.qualityTrace.issues = [...validation.issues];
    }
    const regenerationNeeded =
      validation.issues.includes('empty_content') ||
      validation.issues.includes('missing_calculation_steps') ||
      validation.issues.includes('missing_visual_language') ||
      validation.issues.includes('micro_question_missing') ||
      validation.issues.includes('too_many_questions') ||
      validation.issues.includes('pacing_too_long') ||
      validation.issues.includes('intro_too_dense') ||
      validation.issues.includes('pass1_too_dense') ||
      validation.issues.includes('scope_out_of_scope_expansion') ||
      validation.issues.includes('scope_preview_overexplained') ||
      validation.issues.includes('teachback_scope_violation') ||
      validation.issues.includes('depth_deferred_explained') ||
      validation.issues.includes('depth_too_advanced_for_pass');

    if (!regenerationNeeded && corrected) {
      if (args.qualityTrace) {
        args.qualityTrace.correctionApplied = true;
      }
      console.log('tutor_quality_correction_applied', {
        phase: args.phase,
        turnType: args.turnType,
        prompt: args.contextMeta?.prompt,
        issues: validation.issues,
      });
      return corrected;
    }

    console.log('tutor_quality_regeneration_used', {
      phase: args.phase,
      turnType: args.turnType,
      prompt: args.contextMeta?.prompt,
      issues: validation.issues,
    });
    console.log('pacing_regeneration_used', {
      phase: args.phase,
      turnType: args.turnType,
      prompt: args.contextMeta?.prompt,
      issues: validation.issues,
    });
    if (validation.issues.some((issue) => issue.startsWith('scope_') || issue === 'teachback_scope_violation')) {
      console.log('scope_regeneration_used', {
        phase: args.phase,
        turnType: args.turnType,
        prompt: args.contextMeta?.prompt,
        issues: validation.issues,
      });
    }
    if (validation.issues.some((issue) => issue.startsWith('depth_'))) {
      console.log('depth_regeneration_used', {
        phase: args.phase,
        turnType: args.turnType,
        prompt: args.contextMeta?.prompt,
        issues: validation.issues,
      });
    }
    if (args.qualityTrace) {
      args.qualityTrace.regenerated = true;
    }

    try {
      const regenerationPrompt = [
        args.prompt,
        'Quality fix required:',
        args.microQuestionAllowed
          ? 'End with exactly one short real question the student must answer next. Not zero questions, not more than one.'
          : args.questionAllowed
            ? 'Keep exactly one short question if this turn is a checkpoint.'
            : 'Do not include any question mark or question.',
        args.isCalculationHeavy && args.phase === PASS_2
          ? 'This is a calculation-heavy Pass 2. Include the formula or method and the solving steps clearly.'
          : '',
        args.isDiagramHeavy
          ? 'Use clear visual language such as imagine, picture, parts, arrows, stages, flow, graph, axis, or labels.'
          : '',
        args.lessonScope ? `Strict scope reminder:\n${formatLessonScopePrompt(args.lessonScope)}` : '',
        args.teachingDepthPlan ? `Strict depth reminder:\n${formatTeachingDepthPlan(args.teachingDepthPlan)}` : '',
        'Stay grounded in the current section.',
        'Keep the reply concise.',
      ].filter(Boolean).join('\n\n');

      const regenerated = await generateText(
        regenerationPrompt,
        this.companionSystemPrompt(),
        args.maxTokens || 320,
      );
      const secondPass = validateTutorMessageQuality({
        ...args,
        content: regenerated,
      });
      if (secondPass.passed) {
        return normalizeText(regenerated);
      }
      if (secondPass.correctedContent) {
        if (args.qualityTrace) {
          args.qualityTrace.correctionApplied = true;
          args.qualityTrace.issues = [...secondPass.issues];
        }
        console.log('tutor_quality_correction_applied', {
          phase: args.phase,
          turnType: args.turnType,
          prompt: args.contextMeta?.prompt,
          issues: secondPass.issues,
        });
        return normalizeText(secondPass.correctedContent);
      }
    } catch (error) {
      console.error('tutor_quality_regeneration_used', {
        phase: args.phase,
        turnType: args.turnType,
        prompt: args.contextMeta?.prompt,
        error: error instanceof Error ? error.message : 'Unknown regeneration error',
      });
    }

    const fallback = buildDeterministicTutorFallback(args);
    if (args.qualityTrace) {
      args.qualityTrace.fallbackUsed = true;
      args.qualityTrace.correctionApplied = true;
    }
    console.log('tutor_quality_correction_applied', {
      phase: args.phase,
      turnType: args.turnType,
      prompt: args.contextMeta?.prompt,
      issues: validation.issues,
      fallback: true,
    });
    return normalizeText(fallback);
  }

  private async loadSessionContext(sessionId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        material: {
          select: {
            id: true,
            title: true,
            course_code: true,
            university: true,
            faculty: true,
            department: true,
            level: true,
            semester: true,
            content: true,
            reader_structure: true,
            teacher_brain: {
              select: {
                summary: true,
                chapter_summaries: true,
                concept_graph: true,
                prerequisites: true,
                formulas: true,
                calculation_methods: true,
                diagrams: true,
                misconceptions: true,
                exam_angles: true,
                teacher_notes: true,
                subject_family: true,
                confidence: true,
              },
            },
          },
        },
        companion_state: true,
      },
    });

    if (!session) throw new Error('Session not found');
    if (!session.material) throw new Error('Material not found for this companion session');

    const state = session.companion_state || (await this.ensureState(session.id));
    if (!state) throw new Error('Companion state is unavailable');

    const roadmap = safeJsonArray<RoadmapSection>(state.roadmap);
    const teacherBrain = parseTeacherBrain(session.material.teacher_brain);
    if (teacherBrain) {
      console.log('teacher_brain_context_loaded', {
        sessionId,
        materialId: session.material.id,
        subjectFamily: teacherBrain.subjectFamily,
        confidence: teacherBrain.confidence,
      });
    } else {
      console.log('teacher_brain_context_missing', {
        sessionId,
        materialId: session.material.id,
      });
    }
    const studentMemoryContext = await this.buildStudentMemoryContext(
      state.user_id,
      state.material_id,
      state.course_code,
      state.current_section_index,
    );
    const learningIntelligenceContext = await this.loadLatestLearningIntelligenceContext(
      state.user_id,
      state.material_id,
      state.course_code,
      state.current_section_index,
    );
    const studentLearningProfileContext = await this.loadStudentLearningProfileContext(state.user_id);
    const tutorSelfImprovementContext = await this.buildTutorSelfImprovementContext(
      state.user_id,
      state.material_id,
      state.course_code,
    );
    const lecturerConstraintContext = await this.loadLecturerConstraintsForSession(session);

    return {
      session,
      material: session.material,
      state,
      roadmap,
      teacherBrain,
      studentMemoryContext,
      learningIntelligenceContext,
      studentLearningProfileContext,
      tutorSelfImprovementContext,
      lecturerConstraintContext,
    };
  }

  private sectionAt(roadmap: RoadmapSection[], index: number) {
    return roadmap[Math.max(0, Math.min(index, roadmap.length - 1))];
  }

  async getVisualPlan(sessionId: string): Promise<StudyVisualPlan> {
    console.log('visual_plan_requested', { sessionId });

    const { state, roadmap, teacherBrain } = await this.loadSessionContext(sessionId);
    const section = this.sectionAt(roadmap, state.current_section_index);
    const teacherBrainSectionContext = getTeacherBrainSectionContext(
      teacherBrain,
      state.current_section_index,
      section.title,
    );
    const diagramContext = buildDiagramTeachingContext(section, teacherBrainSectionContext);

    if (!diagramContext.detected || !teacherBrainSectionContext.diagrams.length) {
      console.log('visual_plan_missing', {
        sessionId,
        sectionIndex: state.current_section_index,
        sectionTitle: section.title,
      });
      return {
        sectionIndex: state.current_section_index,
        sectionTitle: section.title,
        isDiagramHeavy: false,
        visuals: [],
      };
    }

    const visuals = teacherBrainSectionContext.diagrams.map((diagram, index) => ({
      title: String(diagram.title || section.title || `Section ${state.current_section_index + 1} visual`).trim(),
      diagramType: String(diagram.diagram_type || 'other').trim() || 'other',
      description: String(diagram.description || '').trim(),
      whenToShow: String(diagram.when_to_show || '').trim(),
      studentShouldNotice: (diagram.student_should_notice || [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 5),
      suggestedRenderer: mapDiagramTypeToSuggestedRenderer(diagram.diagram_type),
      priority: index + 1,
    }));

    const plan: StudyVisualPlan = {
      sectionIndex: state.current_section_index,
      sectionTitle: section.title,
      isDiagramHeavy: diagramContext.detected,
      visuals,
    };

    console.log('visual_plan_returned', {
      sessionId,
      sectionIndex: plan.sectionIndex,
      sectionTitle: plan.sectionTitle,
      visualCount: plan.visuals.length,
      isDiagramHeavy: plan.isDiagramHeavy,
    });

    return plan;
  }

  private companionSystemPrompt() {
    return [
      'You are Akademi AI Study Companion.',
      'Your goal is exam success through guided teaching.',
      'Stay inside the selected course and material.',
      'Use external knowledge only when the uploaded material is incomplete or unclear, and label it as External support.',
      'You understand the whole material through Teacher Brain context.',
      'Use the current section content as the source of truth.',
      'Use Teacher Brain for continuity, prerequisite awareness, exam angles, misconceptions, calculations, and diagram planning.',
      'Use the internal lesson plan to keep the teaching objective, sequence, checkpoints, and fallback reteach aligned.',
      'Respect lecturer constraints when they are provided.',
      'Do not violate required order, required methods, forbidden methods, terminology, unit policy, proof policy, calculation policy, or diagram policy.',
      'Use retrieved material context only to support the current section.',
      'Do not let retrieved material override current section content.',
      'If retrieved context conflicts with the section, trust current section.',
      'Stay inside the current lesson scope.',
      'Do not teach future topics too early.',
      'Preview-only ideas may be mentioned briefly, but must not be explained.',
      'Out-of-scope concepts must not be explained unless lecturer constraints explicitly require them.',
      'Do not invent material content.',
      'If Teacher Brain conflicts with section content, trust section content.',
      'Teach like a tertiary institution tutor.',
      'For calculation-heavy topics, identify the formula, explain variables, show when to use it, solve step by step, warn about common mistakes, and keep units or answer format clear.',
      'For calculation-heavy topics, never handwave.',
      'Show formulas clearly.',
      'Explain variables before substituting numbers.',
      'Solve step by step.',
      'Keep arithmetic readable.',
      'Use LaTeX delimiters for math.',
      'If the material does not provide enough numbers for a worked example, create a tiny illustrative example and label it as "simple example".',
      'Do not overcomplicate explanations.',
      'For diagram-heavy topics, explain what visual would help naturally, but do not generate images yet.',
      'For visual-heavy topics, teach with mental diagrams.',
      'Describe diagrams clearly using simple spatial language.',
      'Do not claim an actual image is shown unless the frontend supports it.',
      'Say imagine or picture instead of look at this image.',
      'For graphs, explain axes and trends.',
      'For biological or anatomical diagrams, explain parts and functions.',
      'For processes, explain stages in order.',
      'Always be structured, clear, patient, and slightly demanding about recall.',
      'Keep replies practical, short, conversational, and ready for a Nigerian university student.',
      'Sound like an experienced university lecturer, not a textbook summary.',
      'Use natural transitions and continue from the previous idea instead of restarting the lesson.',
      'Avoid repeating prerequisite explanations once they have already been refreshed in the same section.',
      'Never ask a rhetorical question, and never ask a question you do not wait for. The only teaching-pass questions allowed are the single genuine micro-question at the end of Pass 1 and Pass 2 when explicitly instructed, which the student will actually answer before the lesson continues.',
      'Whenever you respond to a student attempt (a micro-question answer, a checkpoint, a repair), follow the feedback doctrine: one sentence about the work, never the person, naming what was right before what was missing, fixing only the single highest-leverage error, and never a bare great job or well done.',
      'Whenever math appears, render it using proper LaTeX delimiters.',
      'Do not use markdown syntax, bold markers, heading markers, or chatbot-style formatting.',
      'Teach like a live tutor, one idea at a time.',
    ].join('\n');
  }

  private async buildRoadmapMessage(materialTitle: string, roadmap: RoadmapSection[], recommendedIndex: number) {
    const list = roadmap
      .map((section, index) => `${index + 1}. ${section.title} - ${section.status.replace(/_/g, ' ').toLowerCase()}`)
      .join('\n');
    return [
      `Here is your study roadmap for ${materialTitle}.`,
      '',
      list,
      '',
      `Best starting point: Section ${recommendedIndex + 1} - ${roadmap[recommendedIndex]?.title || 'Start here'}.`,
      'Reply with one of these:',
      '- Start from beginning',
      '- Continue from where I stopped',
      '- Start from section [name]',
    ].join('\n');
  }

  async start(sessionId: string, mode: CompanionStartMode, sectionTitle?: string) {
    const {
      session,
      material,
      state,
      roadmap,
      teacherBrain,
      studentMemoryContext,
      learningIntelligenceContext,
      studentLearningProfileContext,
      tutorSelfImprovementContext,
      lecturerConstraintContext,
    } = await this.loadSessionContext(sessionId);
    if (!roadmap.length) {
      throw new Error('This material does not have a usable roadmap yet.');
    }

    let nextIndex = 0;
    let nextPhase = PASS_1;
    let refreshQuestion: string | null = null;
    let isThrowbackQuestion = false;

    if (mode === 'continue') {
      nextIndex = Math.min(Math.max(state.last_completed_index + 1, 0), roadmap.length - 1);
      if (state.last_completed_index >= 0) {
        const throwback = await this.selectThrowbackSection(
          state.user_id,
          state.material_id,
          state.course_code,
          state.last_completed_index,
          roadmap,
        );
        isThrowbackQuestion = throwback.isRetentionThrowback;
        refreshQuestion = await generateText(
          throwback.isRetentionThrowback
            ? `The student is at risk of forgetting this earlier section (retention risk ${throwback.retentionRisk}/100). Create one short throwback recall question testing it before we continue.\n\nSection title: ${throwback.section.title}\n\nSection content:\n${truncate(throwback.section.content, 2200)}`
            : `Create one short refresh question from this completed section.\n\nSection title: ${throwback.section.title}\n\nSection content:\n${truncate(throwback.section.content, 2200)}`,
          this.companionSystemPrompt(),
          180,
        );
      }
    } else if (mode === 'specific' && sectionTitle) {
      const matchIndex = roadmap.findIndex((section) => section.title.toLowerCase() === sectionTitle.toLowerCase());
      nextIndex = matchIndex >= 0 ? matchIndex : 0;
    } else if (mode === 'roadmap') {
      const message = await this.buildRoadmapMessage(material.title, roadmap, Math.max(state.last_completed_index + 1, 0));
      await this.persistRoadmap(state.id, roadmap, {
        current_phase: StudyCompanionPhase.ROADMAP_GENERATED,
        pending_prompt: message,
        refresh_question: null,
        section_context: {} as Prisma.InputJsonValue,
      });
      return {
        content: message,
        metadata: await this.buildTurnMetadata(sessionId, 'transition', {
          autoContinue: false,
          waitForStudent: true,
          nextAction: 'move_next',
        }),
      };
    }

    nextIndex = findFirstRealTeachingSection(roadmap, nextIndex);

    const section = this.sectionAt(roadmap, nextIndex);
    const sectionContext = readSectionContext(state.section_context);

    if (!refreshQuestion) {
      refreshQuestion = await generateText(
        `Create one short prequestion about this upcoming section, to be asked before it is taught. A wrong guess is fine and expected, since the point is to prime attention toward the right idea. Base it on the section's core idea or a key prerequisite.\n\nSection title: ${section.title}\n\nSection content:\n${truncate(section.content, 2200)}`,
        this.companionSystemPrompt(),
        180,
      );
    }

    let isFirstEverCompanionSession = false;
    try {
      const priorCompanionSessionCount = await prisma.studyCompanionState.count({
        where: { user_id: state.user_id, id: { not: state.id } },
      });
      isFirstEverCompanionSession = priorCompanionSessionCount === 0 && state.last_completed_index < 0;
    } catch (error) {
      console.error('first_session_contract_check_failed', {
        userId: state.user_id,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    const teacherBrainContext = buildTeacherBrainPromptContext(teacherBrain, nextIndex, roadmap);
    const teacherBrainSectionContext = getTeacherBrainSectionContext(
      teacherBrain,
      nextIndex,
      section.title,
    );
    const sectionCalculationContext = buildCalculationTeachingContext(section, teacherBrainSectionContext);
    const sectionDiagramContext = buildDiagramTeachingContext(section, teacherBrainSectionContext);
    const lessonPlan = await this.getOrCreateLessonPlan({
      sessionId,
      companionStateId: state.id,
      userId: state.user_id,
      materialId: material.id,
      courseCode: state.course_code,
      section,
      sectionIndex: nextIndex,
      teacherBrainContext,
      calculationContext: sectionCalculationContext,
      diagramContext: sectionDiagramContext,
      studentMemoryPromptContext: studentMemoryContext.promptContext,
    });
    const relevantMaterialContext = await this.buildRelevantMaterialContext(
      material.id,
      section,
      teacherBrainContext,
      lessonPlan,
      teacherBrainSectionContext,
      { sessionId, sectionIndex: nextIndex },
    );
    const baseLessonScope = buildLessonScope({
      sectionTitle: section.title,
      sectionContent: section.content,
      roadmap,
      currentSectionIndex: nextIndex,
      teacherBrainContext,
      teacherBrainSectionContext,
      lessonPlan,
      lessonPlanContext: lessonPlan.promptContext,
      relevantMaterialContext,
      lecturerConstraintContext: lecturerConstraintContext?.promptContext || '',
      phase: PASS_1,
      passNumber: 1,
    });
    const teachingDecision = this.createTeachingDecision({
      phase: PASS_1,
      section,
      lessonScope: baseLessonScope,
      teacherBrainSectionContext,
      teacherBrainContext,
      studentMemoryContext,
      lessonPlan,
      calculationContext: sectionCalculationContext,
      diagramContext: sectionDiagramContext,
      relevantMaterialContext,
      learningIntelligenceContext,
      studentLearningProfileContext,
      tutorSelfImprovementContext,
      lecturerConstraintContext,
      currentMasteryScore: state.last_mastery_score,
      lastMasteryScore: state.last_mastery_score,
    });
    const introLessonScope = buildLessonScope({
      sectionTitle: section.title,
      sectionContent: section.content,
      roadmap,
      currentSectionIndex: nextIndex,
      teacherBrainContext,
      teacherBrainSectionContext,
      lessonPlan,
      lessonPlanContext: lessonPlan.promptContext,
      relevantMaterialContext,
      lecturerConstraintContext: lecturerConstraintContext?.promptContext || '',
      teachingDecision,
      phase: 'INTRO',
      passNumber: 1,
    });
    roadmap.forEach((item, index) => {
      if (index === nextIndex && item.status === StudyRoadmapStatus.NOT_STARTED) {
        item.status = StudyRoadmapStatus.IN_PROGRESS;
      }
    });

    const introRefreshPlan = planPrerequisiteRefresh({
      phase: 'INTRO',
      decision: teachingDecision,
      sectionContext,
      teacherBrainSectionContext,
      lessonPlan,
    });

    const introPacing = buildPacingDirectives({
      phase: 'INTRO',
      turnType: 'transition',
      passNumber: 1,
      teachingDecision,
      sectionTitle: section.title,
      sectionContent: section.content,
      lessonPlan,
      isCalculationHeavy: sectionCalculationContext.detected,
      isDiagramHeavy: sectionDiagramContext.detected,
      isCheckpointQuestion: false,
      prerequisiteRepairActive: false,
    });
    const introDepthPlan = buildTeachingDepthPlan({
      phase: 'INTRO',
      turnType: 'transition',
      passNumber: 1,
      sectionTitle: section.title,
      sectionContent: section.content,
      lessonScope: introLessonScope,
      teachingDecision,
      lessonPlan,
      learningIntelligence: learningIntelligenceContext,
      studentMemoryContext,
      isCalculationHeavy: sectionCalculationContext.detected,
      isDiagramHeavy: sectionDiagramContext.detected,
      prerequisiteRepairActive: false,
    });

    const introPrompt = [
      `Material title: ${material.title}`,
      `Course code: ${session.course_code || material.course_code || 'GENERAL'}`,
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      studentMemoryContext.promptContext ? `Student memory context:\n${studentMemoryContext.promptContext}` : '',
      lecturerConstraintContext?.promptContext ? `Lecturer constraint context:\n${lecturerConstraintContext.promptContext}` : '',
      lessonPlan.promptContext ? `Lesson plan context:\n${lessonPlan.promptContext}` : '',
      relevantMaterialContext.promptContext ? `Relevant material context:\n${relevantMaterialContext.promptContext}` : '',
      `Lesson scope:\n${formatLessonScopePrompt(introLessonScope)}`,
      `Teaching depth plan:\n${formatTeachingDepthPlan(introDepthPlan)}`,
      refreshQuestion
        ? isThrowbackQuestion
          ? `End the opening with this one throwback recall question, framed briefly as a quick check on an earlier idea before continuing: ${refreshQuestion}`
          : `End the opening with this one prequestion before teaching begins. Make clear a guess is welcome and expected: ${refreshQuestion}`
        : 'This is a fresh section start.',
      `Section content:\n${truncate(section.content, 3500)}`,
      lessonPlan.lessonObjective ? `Follow this lesson objective: ${lessonPlan.lessonObjective}` : '',
      lessonPlan.teachingSequence.length ? `Start with these opening sequence cues: ${truncateList(lessonPlan.teachingSequence, 2, 120).join(' | ')}` : '',
      `Teaching decision:\n${buildTeachingDecisionPromptLines(teachingDecision, { includeIntro: true, pass: 1 }).join('\n')}`,
      buildLecturerStyleDirectives({
        phase: 'INTRO',
        turnType: 'transition',
        teachingDecision,
        sectionTitle: section.title,
        alreadyCoveredConcepts: safeStringArray(sectionContext.coveredConcepts),
        prerequisiteRepairActive: false,
        isCheckpointQuestion: false,
        microQuestionAllowed: !!refreshQuestion,
      }).join('\n'),
      introPacing.lines.join('\n'),
      ...introRefreshPlan.lines,
      lecturerConstraintContext?.promptContext ? 'Respect lecturer constraints. Do not violate required order, required methods, forbidden methods, terminology, unit policy, proof policy, calculation policy, or diagram policy.' : '',
      isFirstEverCompanionSession
        ? 'This is the student\'s first ever session with you. Before the hook, add one short warm welcome contract in plain talk: you will teach in short bursts, you will ask real questions constantly, wrong answers are fuel not failure, and they will explain things back to you because that is how it sticks for the exam. Keep it to one or two sentences, then continue into the hook.'
        : '',
      refreshQuestion
        ? 'Task: Write the opening tutor message and begin the lesson naturally. Keep the opening to 2 to 4 short sentences plus the one question already specified above. Name the topic or exam-shaped hook first, then end with exactly that one question and stop right after it. Do not answer the question yourself. Do not ask any other question. Do not dump multiple prerequisites in the intro. Do not ask for permission to begin. Do not say Ready or Let us begin.'
        : 'Task: Write the opening tutor message and begin the lesson naturally. Keep the opening to 2 to 4 short sentences maximum. Name the topic, state the learning goal, and use at most one light hook or concrete anchor. Do not dump multiple prerequisites in the intro. Do not ask for permission to begin. Do not say Ready or Let us begin. Do not ask the student a question yet.',
    ].join('\n\n');
    const introQualityTrace: TutorQualityTraceCapture = {
      issues: [],
      regenerated: false,
      fallbackUsed: false,
      correctionApplied: false,
    };
    const introTrace = await this.startTutorTrace({
      sessionId,
      userId: state.user_id,
      materialId: material.id,
      courseCode: state.course_code,
      sectionIndex: nextIndex,
      sectionTitle: section.title,
      phase: PASS_1,
      turnType: 'transition',
      action: 'start_intro',
      teacherBrainUsed: !!teacherBrainContext,
      studentMemoryUsed: !!studentMemoryContext.promptContext,
      lessonPlanUsed: !!lessonPlan.promptContext,
      relevantMaterialUsed: !!relevantMaterialContext.promptContext,
      calculationContextUsed: sectionCalculationContext.detected,
      diagramContextUsed: sectionDiagramContext.detected,
      qualityGuardrailUsed: true,
      promptTokensEstimate: estimatePromptTokens(introPrompt),
      metadata: {
        teacher_brain_chars: teacherBrainContext.length,
        student_memory_chars: studentMemoryContext.promptContext.length,
        lesson_plan_chars: lessonPlan.promptContext.length,
        relevant_material_chars: relevantMaterialContext.promptContext.length,
        retrieved_chunk_count: relevantMaterialContext.chunks.length,
        formula_count: teacherBrainSectionContext.formulas.length,
        diagram_count: teacherBrainSectionContext.diagrams.length,
        weak_point_count: studentMemoryContext.priorMemories?.flatMap((item) => item.weakPoints).length || 0,
        teaching_decision: teachingDecision.traceMetadata,
        teaching_strategy: teachingDecision.strategy,
        teaching_pace: teachingDecision.pace,
        prerequisite_repair_mode: teachingDecision.prerequisiteRepairMode,
        lesson_scope_applied: true,
        primary_objective: introLessonScope.primaryObjective,
        in_scope_count: introLessonScope.inScopeConcepts.length,
        supporting_count: introLessonScope.supportingConcepts.length,
        preview_only_count: introLessonScope.previewOnlyConcepts.length,
        out_of_scope_count: introLessonScope.outOfScopeConcepts.length,
        depth_plan_applied: true,
        target_depth: introDepthPlan.targetDepth,
        minimum_understanding_count: introDepthPlan.minimumUnderstanding.length,
        deferred_depth_count: introDepthPlan.deferredDepthConcepts.length,
      },
    });
    console.log('lesson_scope_applied', {
      sessionId,
      materialId: material.id,
      sectionIndex: nextIndex,
      prompt: 'start_intro',
      primaryObjective: introLessonScope.primaryObjective,
      inScopeCount: introLessonScope.inScopeConcepts.length,
      previewOnlyCount: introLessonScope.previewOnlyConcepts.length,
      outOfScopeCount: introLessonScope.outOfScopeConcepts.length,
    });
    console.log('teaching_depth_applied', {
      sessionId,
      materialId: material.id,
      sectionIndex: nextIndex,
      prompt: 'start_intro',
      targetDepth: introDepthPlan.targetDepth,
      minimumUnderstandingCount: introDepthPlan.minimumUnderstanding.length,
      deferredDepthCount: introDepthPlan.deferredDepthConcepts.length,
    });

    if (teacherBrainContext) {
      console.log('teacher_brain_context_applied', {
        sessionId,
        materialId: material.id,
        sectionIndex: nextIndex,
        prompt: 'start_intro',
      });
    }
    if (relevantMaterialContext.promptContext) {
      console.log('relevant_material_context_applied', {
        sessionId,
        materialId: material.id,
        sectionIndex: nextIndex,
        prompt: 'start_intro',
      });
    }
    console.log('teaching_decision_applied', {
      sessionId,
      materialId: material.id,
      sectionIndex: nextIndex,
      prompt: 'start_intro',
      strategy: teachingDecision.strategy,
      pace: teachingDecision.pace,
      repairMode: teachingDecision.prerequisiteRepairMode,
    });
    try {
      const aiStartedAt = Date.now();
      const rawContent = await generateText(introPrompt, this.companionSystemPrompt());
      introTrace.aiLatencyMs += Date.now() - aiStartedAt;
      const content = await this.enforceTutorMessageQuality({
        content: rawContent,
        prompt: introPrompt,
        maxTokens: 260,
        phase: 'INTRO',
        turnType: 'transition',
        section,
        isCalculationHeavy: sectionCalculationContext.detected,
        isDiagramHeavy: sectionDiagramContext.detected,
        questionAllowed: !!refreshQuestion,
        microQuestionAllowed: !!refreshQuestion,
        coveredConcepts: [],
        isFirstIntro: true,
        targetWordRange: introPacing.targetWordRange,
        lessonScope: introLessonScope,
        teachingDepthPlan: introDepthPlan,
        contextMeta: {
          sessionId,
          materialId: material.id,
          sectionIndex: nextIndex,
          prompt: 'start_intro',
        },
        qualityTrace: introQualityTrace,
      });
      await this.persistRoadmap(state.id, roadmap, {
        current_phase: PASS_1,
        current_section_index: nextIndex,
        pending_prompt: content,
        refresh_question: refreshQuestion,
        refresh_answer: null,
        section_context: {
          coveredConcepts: introRefreshPlan.newCoveredConcepts,
        } as Prisma.InputJsonValue,
      });
      if (introRefreshPlan.newCoveredConcepts.length) {
        console.log('covered_concepts_updated', {
          sessionId,
          sectionIndex: nextIndex,
          coveredConcepts: introRefreshPlan.newCoveredConcepts,
        });
      }

      const response = {
        content,
        metadata: await this.buildTurnMetadata(sessionId, 'transition', {
          nextAction: 'continue_teaching',
          questionCount: questionCountForContent(content),
        }),
      };
      await this.finishTutorTrace(introTrace, {
        content,
        qualityGuardrailUsed: true,
        extraMetadata: {
          regenerated: introQualityTrace.regenerated,
          fallback_used: introQualityTrace.fallbackUsed,
          correction_applied: introQualityTrace.correctionApplied,
        },
      });
      return response;
    } catch (error) {
      await this.failTutorTrace(introTrace, error);
      throw error;
    }
  }

  async handleTutorContinue(sessionId: string) {
    return this.handleStudentReply(sessionId, '__AUTO_CONTINUE__');
  }

  private async buildTeachingPass(
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
      calculationContext.detected ? buildCalculationInstructions(pass, calculationContext) : '',
      diagramContext.detected ? buildDiagramInstructions(pass, diagramContext) : '',
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
      studentMemoryPromptContext ? `Student memory context:\n${studentMemoryPromptContext}` : '',
      lecturerConstraintPromptContext ? `Lecturer constraint context:\n${lecturerConstraintPromptContext}` : '',
      lessonPlan?.promptContext ? `Lesson plan context:\n${lessonPlan.promptContext}` : '',
      relevantMaterialContext?.promptContext ? `Relevant material context:\n${relevantMaterialContext.promptContext}` : '',
      `Lesson scope:\n${formatLessonScopePrompt(lessonScope)}`,
      `Teaching depth plan:\n${formatTeachingDepthPlan(depthPlan)}`,
      calculationContext.detected ? `Calculation context:\n${calculationContext.summary}` : '',
      diagramContext.detected ? `Diagram context:\n${diagramContext.summary}` : '',
      `Section content:\n${truncate(section.content, 3800)}`,
      pass === 1 && lessonPlan?.lessonObjective ? `Follow this lesson objective first: ${lessonPlan.lessonObjective}` : '',
      pass === 1 && lessonPlan?.teachingSequence.length ? `Start with these sequence cues: ${truncateList(lessonPlan.teachingSequence, 2, 120).join(' | ')}` : '',
      pass === 2 && lessonPlan?.teachingSequence.length ? `Follow this detailed teaching sequence: ${truncateList(lessonPlan.teachingSequence, 5, 120).join(' | ')}` : '',
      pass === 2 && lessonPlan?.calculationPlan.length ? `Calculation lesson plan: ${truncateList(lessonPlan.calculationPlan, 4, 120).join(' | ')}` : '',
      pass === 2 && lessonPlan?.diagramPlan.length ? `Diagram lesson plan: ${truncateList(lessonPlan.diagramPlan, 4, 120).join(' | ')}` : '',
      pass === 3 && lessonPlan?.examFocus.length ? `Exam focus for this pass: ${truncateList(lessonPlan.examFocus, 4, 120).join(' | ')}` : '',
      pass === 3 && lessonPlan?.checkpointFocus.length ? `Checkpoint focus for this pass: ${truncateList(lessonPlan.checkpointFocus, 4, 120).join(' | ')}` : '',
      modeInstructions,
      'Use student memory to adapt explanation. If the student previously struggled with a prerequisite, briefly refresh it. If calculation issues exist, slow down formula substitution. If diagram issues exist, use clearer mental visualization. Be encouraging, not judgmental.',
      lecturerConstraintPromptContext ? 'Respect lecturer constraints. Do not violate required order, required methods, forbidden methods, terminology, unit policy, proof policy, calculation policy, or diagram policy.' : '',
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
    const rawContent = await generateText(prompt, this.companionSystemPrompt(), 900);
    const content = await this.enforceTutorMessageQuality({
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
      contextMeta: contextMeta ? { ...contextMeta, prompt: `teaching_pass_${pass}` } : undefined,
      qualityTrace,
    });
    return {
      content,
      coveredConcepts: mergeCoveredConcepts(safeStringArray(sectionContext?.coveredConcepts), refreshPlan.newCoveredConcepts),
    };
  }

  private async evaluateTeachBack(
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
      lessonPlan?.promptContext ? `Lesson plan context:\n${lessonPlan.promptContext}` : '',
      relevantMaterialContext?.promptContext ? `Relevant material context:\n${relevantMaterialContext.promptContext}` : '',
      `Lesson scope:\n${formatLessonScopePrompt(lessonScope)}`,
      `Teaching depth plan:\n${formatTeachingDepthPlan(depthPlan)}`,
      calculationContext.detected ? `Calculation context:\n${calculationContext.summary}` : '',
      diagramContext.detected ? `Diagram context:\n${diagramContext.summary}` : '',
      `Section content:\n${truncate(section.content, 3000)}`,
      `Student teach-back attempt ${attemptNumber}:\n${studentResponse}`,
      lessonPlan?.checkpointFocus.length ? `Checkpoint focus: ${truncateList(lessonPlan.checkpointFocus, 4, 120).join(' | ')}` : '',
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
    const evaluation = await generateText(prompt, this.companionSystemPrompt(), 500);
    return {
      evaluation,
      score: heuristicScore,
      failedConcepts: deriveFailedConcepts(section, studentResponse),
    };
  }

  private async evaluateMemoryDump(
    section: RoadmapSection,
    studentResponse: string,
    teacherBrainContext = '',
    contextMeta?: { sessionId: string; materialId: string; sectionIndex: number },
    teacherBrainSectionContext?: TeacherBrainSectionContext,
    lessonPlan?: StudySectionLessonPlanRecord,
    relevantMaterialContext?: RelevantMaterialContext,
  ) {
    const heuristicScore = Math.max(20, computeCoverageScore(section, studentResponse) - 5);
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
      lessonPlan?.promptContext ? `Lesson plan context:\n${lessonPlan.promptContext}` : '',
      relevantMaterialContext?.promptContext ? `Relevant material context:\n${relevantMaterialContext.promptContext}` : '',
      `Lesson scope:\n${formatLessonScopePrompt(lessonScope)}`,
      `Teaching depth plan:\n${formatTeachingDepthPlan(depthPlan)}`,
      calculationContext.detected ? `Calculation context:\n${calculationContext.summary}` : '',
      diagramContext.detected ? `Diagram context:\n${diagramContext.summary}` : '',
      `Section content:\n${truncate(section.content, 3000)}`,
      `Student memory dump:\n${studentResponse}`,
      lessonPlan?.checkpointFocus.length ? `Memory checkpoint focus: ${truncateList(lessonPlan.checkpointFocus, 4, 120).join(' | ')}` : '',
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
    const evaluation = await generateText(prompt, this.companionSystemPrompt(), 450);
    return {
      evaluation,
      score: heuristicScore,
      failedConcepts: deriveFailedConcepts(section, studentResponse),
    };
  }

  private async evaluatePrerequisiteRepair(
    section: RoadmapSection,
    studentResponse: string,
    repairConcepts: string[],
    repairReason: string,
    teacherBrainContext = '',
  ) {
    const conceptMatchesCount = repairConcepts.filter((concept) => conceptMatches(concept, studentResponse)).length;
    const heuristicScore = Math.max(
      25,
      Math.min(
        100,
        Math.round(
          (studentResponse.trim().length >= 60 ? 45 : 25) +
          (conceptMatchesCount * 25),
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
    const raw = await generateText(prompt, this.companionSystemPrompt(), 220);
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
        Math.round(Number.isFinite(Number(parsed.score)) ? Number(parsed.score) : heuristicScore),
      ),
    );
    const passed = typeof parsed.passed === 'boolean'
      ? parsed.passed
      : score >= 70 && remainingWeaknesses.length === 0;

    return {
      score,
      passed,
      evaluation: normalizeText(
        String(parsed.evaluation || '').trim() || (passed
          ? 'That prerequisite looks strong enough now, so we can continue.'
          : 'That prerequisite still needs one more short repair before we continue.'),
      ),
      remainingWeaknesses,
    };
  }

  private async buildTeachBackPrompt(
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
    const isCompletionProblemCheckpoint = calculationContext.detected && attemptNumber === 1;
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
      pacing.lines.push('Completion problem pacing: show the given setup and steps concisely, blank only the final step or two, and stop. No extra teaching.');
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
      lecturerConstraintPromptContext ? `Lecturer constraint context:\n${lecturerConstraintPromptContext}` : '',
      lessonPlan?.promptContext ? `Lesson plan context:\n${lessonPlan.promptContext}` : '',
      `Lesson scope:\n${formatLessonScopePrompt(lessonScope)}`,
      `Teaching depth plan:\n${formatTeachingDepthPlan(depthPlan)}`,
      diagramContext.detected ? `Diagram context:\n${diagramContext.summary}` : '',
      isCompletionProblemCheckpoint ? `Calculation context:\n${calculationContext.summary}` : '',
      `Section content:\n${truncate(section.content, 2800)}`,
      lessonPlan?.checkpointFocus.length ? `Ask around these checkpoint targets: ${truncateList(lessonPlan.checkpointFocus, 4, 120).join(' | ')}` : '',
      lessonPlan?.calculationPlan.length ? `Calculation lesson plan: ${truncateList(lessonPlan.calculationPlan, 4, 120).join(' | ')}` : '',
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
      lecturerConstraintPromptContext ? 'Respect lecturer constraints while asking for the teach-back.' : '',
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
    const rawContent = await generateText(prompt, this.companionSystemPrompt(), checkpointMaxTokens);
    const content = await this.enforceTutorMessageQuality({
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
      contextMeta: contextMeta ? { ...contextMeta, prompt: `teachback_prompt_${attemptNumber}` } : undefined,
      qualityTrace,
    });
    const sentenceCount = content.split(/(?<=[.!?])\s+/).filter(Boolean).length;
    const looksTooTeachy = !isCompletionProblemCheckpoint && (sentenceCount > 2 || /\bthis means|let us|remember that|in this section\b/i.test(content));
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

  private async buildMemoryDumpPrompt(
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
      lecturerConstraintPromptContext ? `Lecturer constraint context:\n${lecturerConstraintPromptContext}` : '',
      lessonPlan?.promptContext ? `Lesson plan context:\n${lessonPlan.promptContext}` : '',
      `Lesson scope:\n${formatLessonScopePrompt(lessonScope)}`,
      `Teaching depth plan:\n${formatTeachingDepthPlan(depthPlan)}`,
      `Section content:\n${truncate(section.content, 2600)}`,
      lessonPlan?.checkpointFocus.length ? `Memory dump should target these ideas: ${truncateList(lessonPlan.checkpointFocus, 4, 120).join(' | ')}` : '',
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
      lecturerConstraintPromptContext ? 'Respect lecturer constraints while deciding what the student should recall.' : '',
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
    const rawContent = await generateText(
      prompt,
      this.companionSystemPrompt(),
      220,
    );
    const content = await this.enforceTutorMessageQuality({
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
      contextMeta: contextMeta ? { ...contextMeta, prompt: 'memory_dump_prompt' } : undefined,
      qualityTrace,
    });
    const sentenceCount = content.split(/(?<=[.!?])\s+/).filter(Boolean).length;
    if (sentenceCount > 2) {
      console.log('teachback_prompt_simplified', {
        ...contextMeta,
        attemptNumber: 'memory_dump',
      });
      return buildDeterministicTeachbackPrompt(section, 1, lessonPlan?.checkpointFocus || [], 'memory_dump');
    }
    return content;
  }

  private async buildGapReteach(
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
    const halveStep = options?.repairMode !== 'medium_prerequisite_repair' && (options?.reteachCycleCount || 0) >= 2;
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
      turnType: options?.repairMode === 'medium_prerequisite_repair' ? 'checkpoint_question' : 'reteach',
      teachingDecision: decision,
      sectionTitle: section.title,
      sectionContent: section.content,
      lessonPlan,
      isCalculationHeavy: calculationContext.detected,
      isDiagramHeavy: diagramContext.detected,
      isCheckpointQuestion: options?.repairMode === 'medium_prerequisite_repair',
      prerequisiteRepairActive: options?.repairMode === 'medium_prerequisite_repair',
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
      turnType: options?.repairMode === 'medium_prerequisite_repair' ? 'checkpoint_question' : 'reteach',
      sectionTitle: section.title,
      sectionContent: section.content,
      lessonScope,
      teachingDecision: decision,
      lessonPlan,
      isCalculationHeavy: calculationContext.detected,
      isDiagramHeavy: diagramContext.detected,
      prerequisiteRepairActive: options?.repairMode === 'medium_prerequisite_repair',
    });
    const prompt = [
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      lecturerConstraintPromptContext ? `Lecturer constraint context:\n${lecturerConstraintPromptContext}` : '',
      lessonPlan?.promptContext ? `Lesson plan context:\n${lessonPlan.promptContext}` : '',
      relevantMaterialContext?.promptContext ? `Relevant material context:\n${relevantMaterialContext.promptContext}` : '',
      `Lesson scope:\n${formatLessonScopePrompt(lessonScope)}`,
      `Teaching depth plan:\n${formatTeachingDepthPlan(depthPlan)}`,
      calculationContext.detected ? `Calculation context:\n${calculationContext.summary}` : '',
      diagramContext.detected ? `Diagram context:\n${diagramContext.summary}` : '',
      `Section content:\n${truncate(section.content, 3000)}`,
      `Missing or weak ideas:\n${failedConcepts.join('\n') || 'The explanation was too thin.'}`,
      options?.repairReason ? `Repair reason:\n${options.repairReason}` : '',
      lessonPlan?.fallbackPlan.length ? `Use this fallback plan: ${truncateList(lessonPlan.fallbackPlan, 5, 120).join(' | ')}` : '',
      `Teaching decision:\n${buildTeachingDecisionPromptLines(decision, { includeReteach: true }).join('\n')}`,
      ...buildLecturerStyleDirectives({
        phase: 'RETEACH',
        turnType: options?.repairMode === 'medium_prerequisite_repair' ? 'checkpoint_question' : 'reteach',
        teachingDecision: decision,
        sectionTitle: section.title,
        alreadyCoveredConcepts: [],
        prerequisiteRepairActive: options?.repairMode === 'medium_prerequisite_repair',
        isCheckpointQuestion: options?.repairMode === 'medium_prerequisite_repair',
      }),
      ...pacing.lines,
      lecturerConstraintPromptContext ? 'Respect lecturer constraints during this repair or reteach.' : '',
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
    const rawContent = await generateText(
      prompt,
      this.companionSystemPrompt(),
      650,
    );
    return this.enforceTutorMessageQuality({
      content: rawContent,
      prompt,
      maxTokens: 650,
      phase: 'RETEACH',
      turnType: options?.repairMode === 'medium_prerequisite_repair' ? 'checkpoint_question' : 'reteach',
      section,
      isCalculationHeavy: calculationContext.detected,
      isDiagramHeavy: diagramContext.detected,
      questionAllowed: options?.repairMode === 'medium_prerequisite_repair',
      targetWordRange: pacing.targetWordRange,
      lessonScope,
      teachingDepthPlan: depthPlan,
      contextMeta: contextMeta ? { ...contextMeta, prompt: 'gap_reteach' } : undefined,
      qualityTrace,
    });
  }

  private async buildInterruptResponse(
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
      studentMemoryPromptContext ? `Student memory context:\n${studentMemoryPromptContext}` : '',
      lecturerConstraintPromptContext ? `Lecturer constraint context:\n${lecturerConstraintPromptContext}` : '',
      relevantMaterialContext?.promptContext ? `Relevant material context:\n${relevantMaterialContext.promptContext}` : '',
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
      lecturerConstraintPromptContext ? 'Respect lecturer constraints while answering the interruption.' : '',
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
    const rawContent = await generateText(prompt, this.companionSystemPrompt(), 320);
    return this.enforceTutorMessageQuality({
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
      contextMeta: contextMeta ? { ...contextMeta, prompt: 'interrupt_response' } : undefined,
      qualityTrace,
    });
  }

  private async buildMasteryOutcome(section: RoadmapSection, score: number, passed: boolean, failedConcepts: string[]) {
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
      failedConcepts.length ? `The one thing to fix first:\n- ${failedConcepts[0]}` : 'One or two key ideas are still missing.',
      'I will reteach this section more simply and check again.',
    ].join('\n\n');
  }

  async handleStudentReply(sessionId: string, studentResponse: string, options?: { interrupted?: boolean }) {
    const {
      state,
      roadmap,
      material,
      teacherBrain,
      studentMemoryContext,
      learningIntelligenceContext,
      studentLearningProfileContext,
      tutorSelfImprovementContext,
      lecturerConstraintContext,
    } = await this.loadSessionContext(sessionId);
    const section = this.sectionAt(roadmap, state.current_section_index);
    const teacherBrainContext = buildTeacherBrainPromptContext(teacherBrain, state.current_section_index, roadmap);
    const teacherBrainSectionContext = getTeacherBrainSectionContext(
      teacherBrain,
      state.current_section_index,
      section.title,
    );
    const sectionCalculationContext = buildCalculationTeachingContext(section, teacherBrainSectionContext);
    const sectionDiagramContext = buildDiagramTeachingContext(section, teacherBrainSectionContext);
    const contextMeta = {
      sessionId,
      materialId: material.id,
      sectionIndex: state.current_section_index,
    };
    const lessonPlan = await this.getOrCreateLessonPlan({
      sessionId,
      companionStateId: state.id,
      userId: state.user_id,
      materialId: material.id,
      courseCode: state.course_code,
      section,
      sectionIndex: state.current_section_index,
      teacherBrainContext,
      calculationContext: sectionCalculationContext,
      diagramContext: sectionDiagramContext,
      studentMemoryPromptContext: studentMemoryContext.promptContext,
    });
    const relevantMaterialContext = await this.buildRelevantMaterialContext(
      material.id,
      section,
      teacherBrainContext,
      lessonPlan,
      teacherBrainSectionContext,
      { sessionId, sectionIndex: state.current_section_index },
    );
    const sectionContext = readSectionContext(state.section_context);
    const baseLessonScope = buildLessonScope({
      sectionTitle: section.title,
      sectionContent: section.content,
      roadmap,
      currentSectionIndex: state.current_section_index,
      teacherBrainContext,
      teacherBrainSectionContext,
      lessonPlan,
      lessonPlanContext: lessonPlan.promptContext,
      relevantMaterialContext,
      lecturerConstraintContext: lecturerConstraintContext?.promptContext || '',
      phase: state.current_phase,
      passNumber: state.current_phase === PASS_1 ? 1 : state.current_phase === PASS_2 ? 2 : state.current_phase === PASS_3 ? 3 : undefined,
    });
    const teachingDecision = this.createTeachingDecision({
      phase: state.current_phase,
      section,
      lessonScope: baseLessonScope,
      teacherBrainSectionContext,
      teacherBrainContext,
      studentMemoryContext,
      lessonPlan,
      calculationContext: sectionCalculationContext,
      diagramContext: sectionDiagramContext,
      relevantMaterialContext,
      learningIntelligenceContext,
      studentLearningProfileContext,
      tutorSelfImprovementContext,
      lecturerConstraintContext,
      hybridMasteryResult: sectionContext.repairMode === 'medium_prerequisite_repair'
        ? {
          passedMastery: true,
          prerequisiteHealthy: false,
          shouldAdvance: false,
          shouldRunRepair: true,
          repairConcepts: sectionContext.repairConcepts || [],
          repairReason: sectionContext.repairReason || '',
        }
        : null,
      currentMasteryScore: state.last_mastery_score,
      lastMasteryScore: state.last_mastery_score,
    });
    const baseDepthPlan = buildTeachingDepthPlan({
      phase: state.current_phase,
      turnType: state.current_phase === PASS_1 || state.current_phase === PASS_2 || state.current_phase === PASS_3 ? 'teaching' : 'checkpoint_question',
      passNumber: state.current_phase === PASS_1 ? 1 : state.current_phase === PASS_2 ? 2 : state.current_phase === PASS_3 ? 3 : undefined,
      sectionTitle: section.title,
      sectionContent: section.content,
      lessonScope: baseLessonScope,
      teachingDecision,
      lessonPlan,
      learningIntelligence: learningIntelligenceContext,
      studentMemoryContext,
      isCalculationHeavy: sectionCalculationContext.detected,
      isDiagramHeavy: sectionDiagramContext.detected,
      prerequisiteRepairActive: sectionContext.repairMode === 'medium_prerequisite_repair',
    });
    const trimmed = studentResponse.trim();
    const isAutoContinue = trimmed === '__AUTO_CONTINUE__';
    const isInterrupt = options?.interrupted === true;
    const buildTraceSeed = (phase: string, turnType: string, action: string, qualityGuardrailUsed: boolean, promptEstimate = 0): TutorTraceSeed => ({
      sessionId,
      userId: state.user_id,
      materialId: material.id,
      courseCode: state.course_code,
      sectionIndex: state.current_section_index,
      sectionTitle: section.title,
      phase,
      turnType,
      action,
      teacherBrainUsed: !!teacherBrainContext,
      studentMemoryUsed: !!studentMemoryContext.promptContext,
      lessonPlanUsed: !!lessonPlan.promptContext,
      relevantMaterialUsed: !!relevantMaterialContext.promptContext,
      calculationContextUsed: sectionCalculationContext.detected,
      diagramContextUsed: sectionDiagramContext.detected,
      qualityGuardrailUsed,
      promptTokensEstimate: promptEstimate || null,
      metadata: {
        teacher_brain_chars: teacherBrainContext.length,
        student_memory_chars: studentMemoryContext.promptContext.length,
        lesson_plan_chars: lessonPlan.promptContext.length,
        relevant_material_chars: relevantMaterialContext.promptContext.length,
        retrieved_chunk_count: relevantMaterialContext.chunks.length,
        formula_count: teacherBrainSectionContext.formulas.length,
        diagram_count: teacherBrainSectionContext.diagrams.length,
        weak_point_count: studentMemoryContext.priorMemories?.flatMap((item) => item.weakPoints).length || 0,
        interrupted: isInterrupt,
        auto_continue: isAutoContinue,
        teaching_decision: teachingDecision.traceMetadata,
        teaching_strategy: teachingDecision.strategy,
        teaching_pace: teachingDecision.pace,
        prerequisite_repair_mode: teachingDecision.prerequisiteRepairMode,
        hidden_confusion_risk: learningIntelligenceContext?.hiddenConfusionRisk ?? null,
        hidden_confusion_level: learningIntelligenceContext?.hiddenConfusionLevel ?? 'low',
        hidden_confusion_signals: learningIntelligenceContext?.hiddenConfusionSignals ?? [],
        recommended_confusion_intervention: learningIntelligenceContext?.recommendedConfusionIntervention ?? 'none',
        lesson_scope_applied: true,
        primary_objective: baseLessonScope.primaryObjective,
        in_scope_count: baseLessonScope.inScopeConcepts.length,
        supporting_count: baseLessonScope.supportingConcepts.length,
        preview_only_count: baseLessonScope.previewOnlyConcepts.length,
        out_of_scope_count: baseLessonScope.outOfScopeConcepts.length,
        depth_plan_applied: true,
        target_depth: baseDepthPlan.targetDepth,
        minimum_understanding_count: baseDepthPlan.minimumUnderstanding.length,
        deferred_depth_count: baseDepthPlan.deferredDepthConcepts.length,
      },
    });

    if (!trimmed) {
      throw new Error('Please send a response so Akademi can continue the study flow.');
    }

    if (state.current_phase === PASS_1) {
      const openingQuestionPending = !!state.refresh_question && !state.refresh_answer;

      if (openingQuestionPending && !isAutoContinue && !isInterrupt) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await this.startTutorTrace(buildTraceSeed(PASS_1, 'teaching', 'teaching_pass_1', true));
        try {
          const aiStartedAt = Date.now();
          const passResult = await this.buildTeachingPass(section, 1, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', lessonPlan, relevantMaterialContext, sectionContext, qualityTrace, { question: state.refresh_question || '', answer: trimmed });
          const content = passResult.content;
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await this.persistRoadmap(state.id, roadmap, {
            current_phase: PASS_1,
            pending_prompt: content,
            refresh_answer: trimmed,
            section_context: {
              pass1QuestionPending: true,
              coveredConcepts: passResult.coveredConcepts,
            } as Prisma.InputJsonValue,
          });
          if (passResult.coveredConcepts.length) {
            console.log('covered_concepts_updated', { sessionId, sectionIndex: state.current_section_index, coveredConcepts: passResult.coveredConcepts });
          }
          const response = {
            content,
            metadata: await this.buildTurnMetadata(sessionId, 'teaching', {
              nextAction: 'ask_followup',
              questionCount: questionCountForContent(content),
            }),
          };
          trace.quality = qualityTrace;
          await this.finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
          return response;
        } catch (error) {
          await this.failTutorTrace(trace, error);
          throw error;
        }
      }

      if (sectionContext.pass1QuestionPending && !isInterrupt) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await this.startTutorTrace(buildTraceSeed(PASS_2, 'teaching', 'teaching_pass_2', true));
        try {
          const aiStartedAt = Date.now();
          const priorInteraction = isAutoContinue ? undefined : { question: state.pending_prompt || '', answer: trimmed };
          const passResult = await this.buildTeachingPass(section, 2, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', lessonPlan, relevantMaterialContext, sectionContext, qualityTrace, priorInteraction);
          const content = passResult.content;
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await this.persistRoadmap(state.id, roadmap, {
            current_phase: PASS_2,
            pending_prompt: content,
            section_context: {
              coveredConcepts: passResult.coveredConcepts,
            } as Prisma.InputJsonValue,
          });
          if (passResult.coveredConcepts.length) {
            console.log('covered_concepts_updated', { sessionId, sectionIndex: state.current_section_index, coveredConcepts: passResult.coveredConcepts });
          }
          const response = {
            content,
            metadata: await this.buildTurnMetadata(sessionId, 'teaching', {
              nextAction: 'ask_followup',
              questionCount: questionCountForContent(content),
            }),
          };
          trace.quality = qualityTrace;
          await this.finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
          return response;
        } catch (error) {
          await this.failTutorTrace(trace, error);
          throw error;
        }
      }

      if (isInterrupt || !isAutoContinue) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await this.startTutorTrace(buildTraceSeed(PASS_1, 'checkpoint_question', 'interrupt_response', true));
        try {
          const aiStartedAt = Date.now();
          const content = await this.buildInterruptResponse(section, trimmed, teachingDecision, teacherBrainContext, contextMeta, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', relevantMaterialContext, qualityTrace);
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await this.persistRoadmap(state.id, roadmap, {
            current_phase: TEACHBACK_1,
            pending_prompt: content,
            section_context: {} as Prisma.InputJsonValue,
          });
          const response = {
            content,
            metadata: await this.buildTurnMetadata(sessionId, 'checkpoint_question', {
              nextAction: 'evaluate_answer',
              questionCount: 1,
            }),
          };
          await this.finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
          return response;
        } catch (error) {
          await this.failTutorTrace(trace, error);
          throw error;
        }
      }
      const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
      const trace = await this.startTutorTrace(buildTraceSeed(PASS_1, 'teaching', 'teaching_pass_1', true));
      try {
        const aiStartedAt = Date.now();
        const passResult = await this.buildTeachingPass(section, 1, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', lessonPlan, relevantMaterialContext, sectionContext, qualityTrace);
        const content = passResult.content;
        trace.aiLatencyMs += Date.now() - aiStartedAt;
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: PASS_1,
          pending_prompt: content,
          refresh_answer: state.refresh_question ? (state.refresh_answer || '(skipped)') : state.refresh_answer,
          section_context: {
            pass1QuestionPending: true,
            coveredConcepts: passResult.coveredConcepts,
          } as Prisma.InputJsonValue,
        });
        if (passResult.coveredConcepts.length) {
          console.log('covered_concepts_updated', { sessionId, sectionIndex: state.current_section_index, coveredConcepts: passResult.coveredConcepts });
        }
        const response = {
          content,
          metadata: await this.buildTurnMetadata(sessionId, 'teaching', {
            nextAction: 'ask_followup',
            questionCount: questionCountForContent(content),
          }),
        };
        trace.quality = qualityTrace;
        await this.finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
        return response;
      } catch (error) {
        await this.failTutorTrace(trace, error);
        throw error;
      }
    }

    if (state.current_phase === PASS_2) {
      if (sectionContext.pass2QuestionPending && !isInterrupt) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await this.startTutorTrace(buildTraceSeed(PASS_3, 'teaching', 'teaching_pass_3', true));
        try {
          const aiStartedAt = Date.now();
          const priorInteraction = isAutoContinue ? undefined : { question: state.pending_prompt || '', answer: trimmed };
          const passResult = await this.buildTeachingPass(section, 3, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', lessonPlan, relevantMaterialContext, sectionContext, qualityTrace, priorInteraction);
          const content = passResult.content;
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await this.persistRoadmap(state.id, roadmap, {
            current_phase: PASS_3,
            pending_prompt: content,
            section_context: {
              coveredConcepts: passResult.coveredConcepts,
            } as Prisma.InputJsonValue,
          });
          if (passResult.coveredConcepts.length) {
            console.log('covered_concepts_updated', { sessionId, sectionIndex: state.current_section_index, coveredConcepts: passResult.coveredConcepts });
          }
          const response = {
            content,
            metadata: await this.buildTurnMetadata(sessionId, 'teaching', {
              nextAction: 'continue_teaching',
              questionCount: questionCountForContent(content),
            }),
          };
          trace.quality = qualityTrace;
          await this.finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
          return response;
        } catch (error) {
          await this.failTutorTrace(trace, error);
          throw error;
        }
      }

      if (isInterrupt || !isAutoContinue) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await this.startTutorTrace(buildTraceSeed(PASS_2, 'checkpoint_question', 'interrupt_response', true));
        try {
          const aiStartedAt = Date.now();
          const content = await this.buildInterruptResponse(section, trimmed, teachingDecision, teacherBrainContext, contextMeta, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', relevantMaterialContext, qualityTrace);
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await this.persistRoadmap(state.id, roadmap, {
            current_phase: TEACHBACK_1,
            pending_prompt: content,
            section_context: {} as Prisma.InputJsonValue,
          });
          const response = {
            content,
            metadata: await this.buildTurnMetadata(sessionId, 'checkpoint_question', {
              nextAction: 'evaluate_answer',
              questionCount: 1,
            }),
          };
          trace.quality = qualityTrace;
          await this.finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
          return response;
        } catch (error) {
          await this.failTutorTrace(trace, error);
          throw error;
        }
      }
      const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
      const trace = await this.startTutorTrace(buildTraceSeed(PASS_2, 'teaching', 'teaching_pass_2', true));
      try {
        const aiStartedAt = Date.now();
        const passResult = await this.buildTeachingPass(section, 2, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', lessonPlan, relevantMaterialContext, sectionContext, qualityTrace);
        const content = passResult.content;
        trace.aiLatencyMs += Date.now() - aiStartedAt;
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: PASS_2,
          pending_prompt: content,
          section_context: {
            pass2QuestionPending: true,
            coveredConcepts: passResult.coveredConcepts,
          } as Prisma.InputJsonValue,
        });
        if (passResult.coveredConcepts.length) {
          console.log('covered_concepts_updated', { sessionId, sectionIndex: state.current_section_index, coveredConcepts: passResult.coveredConcepts });
        }
        const response = {
          content,
          metadata: await this.buildTurnMetadata(sessionId, 'teaching', {
            nextAction: 'ask_followup',
            questionCount: questionCountForContent(content),
          }),
        };
        trace.quality = qualityTrace;
        await this.finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
        return response;
      } catch (error) {
        await this.failTutorTrace(trace, error);
        throw error;
      }
    }

    if (state.current_phase === PASS_3) {
      if (isInterrupt || !isAutoContinue) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await this.startTutorTrace(buildTraceSeed(PASS_3, 'checkpoint_question', 'interrupt_response', true));
        try {
          const aiStartedAt = Date.now();
          const content = await this.buildInterruptResponse(section, trimmed, teachingDecision, teacherBrainContext, contextMeta, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', relevantMaterialContext, qualityTrace);
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await this.persistRoadmap(state.id, roadmap, {
            current_phase: TEACHBACK_1,
            pending_prompt: content,
            section_context: {} as Prisma.InputJsonValue,
          });
          const response = {
            content,
            metadata: await this.buildTurnMetadata(sessionId, 'checkpoint_question', {
              nextAction: 'evaluate_answer',
              questionCount: 1,
            }),
          };
          trace.quality = qualityTrace;
          await this.finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
          return response;
        } catch (error) {
          await this.failTutorTrace(trace, error);
          throw error;
        }
      }
      const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
      const trace = await this.startTutorTrace(buildTraceSeed(TEACHBACK_1, 'checkpoint_question', 'teachback_prompt_1', true));
      try {
        const aiStartedAt = Date.now();
        const content = await this.buildTeachBackPrompt(section, 1, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, lecturerConstraintContext?.promptContext || '', lessonPlan, qualityTrace);
        trace.aiLatencyMs += Date.now() - aiStartedAt;
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: TEACHBACK_1,
          pending_prompt: content,
          section_context: {
            coveredConcepts: safeStringArray(sectionContext.coveredConcepts),
          } as Prisma.InputJsonValue,
        });
        const response = {
          content,
          metadata: await this.buildTurnMetadata(sessionId, 'checkpoint_question', {
            nextAction: 'evaluate_answer',
            questionCount: 1,
          }),
        };
        trace.quality = qualityTrace;
        await this.finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
        return response;
      } catch (error) {
        await this.failTutorTrace(trace, error);
        throw error;
      }
    }

    if (state.current_phase === TEACHBACK_1) {
      if (isAutoContinue) {
        throw new Error('Akademi is waiting for your explanation before continuing.');
      }
      const trace = await this.startTutorTrace(buildTraceSeed(StudyCompanionPhase.TEACHBACK_1_EVALUATION, 'evaluation', 'evaluate_teachback_1', false));
      let evaluation;
      try {
        const aiStartedAt = Date.now();
        evaluation = await this.evaluateTeachBack(section, trimmed, 1, teacherBrainContext, contextMeta, teacherBrainSectionContext, lessonPlan, relevantMaterialContext);
        trace.aiLatencyMs += Date.now() - aiStartedAt;
      } catch (error) {
        await this.failTutorTrace(trace, error);
        throw error;
      }
      await prisma.teachBackAttempt.create({
        data: {
          session_id: sessionId,
          companion_state_id: state.id,
          user_id: state.user_id,
          material_id: state.material_id,
          section_index: state.current_section_index,
          attempt_number: 1,
          phase: StudyCompanionPhase.TEACHBACK_1_EVALUATION,
          prompt: state.pending_prompt || undefined,
          student_response: trimmed,
          evaluation: evaluation.evaluation,
          score: evaluation.score,
          passed: evaluation.score >= state.mastery_threshold,
        },
      });

      await this.persistRoadmap(state.id, roadmap, {
        current_phase: GAP_RETEACH,
        pending_prompt: evaluation.evaluation,
        section_context: {
          reteachDelivered: false,
          nextPromptKind: 'teachback_2',
          failedConcepts: evaluation.failedConcepts,
          coveredConcepts: safeStringArray(sectionContext.coveredConcepts),
        } as Prisma.InputJsonValue,
      });
      const response = {
        content: evaluation.evaluation,
        metadata: await this.buildTurnMetadata(sessionId, 'evaluation', {
          nextAction: 'continue_teaching',
          questionCount: questionCountForContent(evaluation.evaluation),
        }),
      };
      await this.finishTutorTrace(trace, { content: evaluation.evaluation, qualityGuardrailUsed: false });
      return response;
    }

    if (state.current_phase === TEACHBACK_2) {
      if (isAutoContinue) {
        throw new Error('Akademi is waiting for your second teach-back before continuing.');
      }
      const trace = await this.startTutorTrace(buildTraceSeed(StudyCompanionPhase.TEACHBACK_2_EVALUATION, 'evaluation', 'evaluate_teachback_2', false));
      let evaluation;
      try {
        const aiStartedAt = Date.now();
        evaluation = await this.evaluateTeachBack(section, trimmed, 2, teacherBrainContext, contextMeta, teacherBrainSectionContext, lessonPlan, relevantMaterialContext);
        trace.aiLatencyMs += Date.now() - aiStartedAt;
      } catch (error) {
        await this.failTutorTrace(trace, error);
        throw error;
      }
      await prisma.teachBackAttempt.create({
        data: {
          session_id: sessionId,
          companion_state_id: state.id,
          user_id: state.user_id,
          material_id: state.material_id,
          section_index: state.current_section_index,
          attempt_number: 2,
          phase: StudyCompanionPhase.TEACHBACK_2_EVALUATION,
          prompt: state.pending_prompt || undefined,
          student_response: trimmed,
          evaluation: evaluation.evaluation,
          score: evaluation.score,
          passed: evaluation.score >= state.mastery_threshold,
        },
      });

      await this.persistRoadmap(state.id, roadmap, {
        current_phase: MEMORY_DUMP,
        pending_prompt: evaluation.evaluation,
        section_context: {
          nextPromptKind: 'memory_dump',
          coveredConcepts: safeStringArray(sectionContext.coveredConcepts),
        } as Prisma.InputJsonValue,
      });
      const response = {
        content: evaluation.evaluation,
        metadata: await this.buildTurnMetadata(sessionId, 'evaluation', {
          nextAction: 'continue_teaching',
          questionCount: questionCountForContent(evaluation.evaluation),
        }),
      };
      await this.finishTutorTrace(trace, { content: evaluation.evaluation, qualityGuardrailUsed: false });
      return response;
    }

    if (state.current_phase === GAP_RETEACH) {
      if (sectionContext.repairMode === 'medium_prerequisite_repair' && !isAutoContinue) {
        const trace = await this.startTutorTrace(buildTraceSeed(GAP_RETEACH, 'evaluation', 'evaluate_prerequisite_repair', false));
        let repairEvaluation;
        try {
          const aiStartedAt = Date.now();
          repairEvaluation = await this.evaluatePrerequisiteRepair(
            section,
            trimmed,
            sectionContext.repairConcepts || [],
            sectionContext.repairReason || '',
            teacherBrainContext,
          );
          trace.aiLatencyMs += Date.now() - aiStartedAt;
        } catch (error) {
          await this.failTutorTrace(trace, error);
          throw error;
        }

        const repairAttemptCount = sectionContext.repairAttemptCount || 0;
        if (repairEvaluation.passed || repairAttemptCount >= 1 || isRepairRiskAcceptable({
          repairConcepts: sectionContext.repairConcepts || [],
          learningIntelligenceContext,
        })) {
          console.log('hybrid_mastery_repair_completed', {
            sessionId,
            sectionIndex: state.current_section_index,
            passed: repairEvaluation.passed,
            repairAttemptCount,
            repairConcepts: sectionContext.repairConcepts || [],
          });
          const hasNextSection = state.current_section_index < roadmap.length - 1;
          const content = repairEvaluation.passed
            ? `${repairEvaluation.evaluation} We can continue to the next section.`
            : `${repairEvaluation.evaluation} I will mark this prerequisite for remediation, and we will continue carefully.`;
          await this.persistRoadmap(state.id, roadmap, {
            current_phase: hasNextSection ? NEXT_SECTION : SESSION_DONE,
            last_completed_index: state.current_section_index,
            pending_prompt: content,
            section_context: {
              remediationRequired: !repairEvaluation.passed,
            } as Prisma.InputJsonValue,
          });
          await this.finishTutorTrace(trace, { content, qualityGuardrailUsed: false });
          return {
            content,
            metadata: await this.buildTurnMetadata(sessionId, 'evaluation', {
              autoContinue: false,
              waitForStudent: true,
              nextAction: 'move_next',
              questionCount: questionCountForContent(content),
            }),
          };
        }

        const retryContent = `${repairEvaluation.evaluation} We need one more short prerequisite repair before continuing.`;
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: GAP_RETEACH,
          pending_prompt: retryContent,
          section_context: {
            ...sectionContext,
            reteachDelivered: false,
            repairAttemptCount: repairAttemptCount + 1,
          } as Prisma.InputJsonValue,
        });
        await this.finishTutorTrace(trace, { content: retryContent, qualityGuardrailUsed: false });
        return {
          content: retryContent,
          metadata: await this.buildTurnMetadata(sessionId, 'evaluation', {
            nextAction: 'continue_teaching',
            questionCount: questionCountForContent(retryContent),
          }),
        };
      }

      if (isInterrupt || !isAutoContinue) {
        const content = await this.buildInterruptResponse(section, trimmed, teachingDecision, teacherBrainContext, contextMeta, '', lecturerConstraintContext?.promptContext || '', relevantMaterialContext);
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: TEACHBACK_1,
          pending_prompt: content,
          section_context: {} as Prisma.InputJsonValue,
        });
        return {
          content,
          metadata: await this.buildTurnMetadata(sessionId, 'checkpoint_question', {
            nextAction: 'evaluate_answer',
            questionCount: 1,
          }),
        };
      }

      if (!sectionContext.reteachDelivered) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await this.startTutorTrace(buildTraceSeed(GAP_RETEACH, 'reteach', 'gap_reteach', true));
        try {
          const aiStartedAt = Date.now();
          const content = await this.buildGapReteach(
            section,
            sectionContext.repairMode === 'medium_prerequisite_repair'
              ? (sectionContext.repairConcepts || [])
              : (sectionContext.failedConcepts || []),
            teachingDecision,
            teacherBrainContext,
            contextMeta,
            teacherBrainSectionContext,
            lecturerConstraintContext?.promptContext || '',
            lessonPlan,
            relevantMaterialContext,
            {
              repairMode: sectionContext.repairMode || 'full_section_reteach',
              repairReason: sectionContext.repairReason,
              repairAttemptCount: sectionContext.repairAttemptCount,
              reteachCycleCount: sectionContext.reteachCycleCount,
            },
            qualityTrace,
          );
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await this.persistRoadmap(state.id, roadmap, {
            current_phase: sectionContext.repairMode === 'medium_prerequisite_repair' ? GAP_RETEACH : GAP_RETEACH,
            pending_prompt: content,
            section_context: {
              ...sectionContext,
              reteachDelivered: true,
            } as Prisma.InputJsonValue,
          });
          const response = {
            content,
            metadata: await this.buildTurnMetadata(
              sessionId,
              sectionContext.repairMode === 'medium_prerequisite_repair' ? 'checkpoint_question' : 'reteach',
              {
                autoContinue: sectionContext.repairMode === 'medium_prerequisite_repair' ? false : undefined,
                waitForStudent: sectionContext.repairMode === 'medium_prerequisite_repair' ? true : undefined,
                nextAction: sectionContext.repairMode === 'medium_prerequisite_repair' ? 'evaluate_answer' : 'continue_teaching',
              questionCount: questionCountForContent(content),
              },
            ),
          };
          trace.quality = qualityTrace;
          await this.finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
          return response;
        } catch (error) {
          await this.failTutorTrace(trace, error);
          throw error;
        }
      }

      if (sectionContext.repairMode === 'medium_prerequisite_repair') {
        throw new Error('Akademi is waiting for your prerequisite repair answer before continuing.');
      }

      const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
      const trace = await this.startTutorTrace(buildTraceSeed(
        sectionContext.nextPromptKind === 'teachback_2' ? TEACHBACK_2 : MEMORY_DUMP,
        'checkpoint_question',
        sectionContext.nextPromptKind === 'teachback_2' ? 'teachback_prompt_2' : 'memory_dump_prompt',
        true,
      ));
      let content;
      try {
        const aiStartedAt = Date.now();
        content =
          sectionContext.nextPromptKind === 'teachback_2'
            ? await this.buildTeachBackPrompt(section, 2, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, lecturerConstraintContext?.promptContext || '', lessonPlan, qualityTrace)
            : await this.buildMemoryDumpPrompt(section, teachingDecision, teacherBrainContext, contextMeta, lecturerConstraintContext?.promptContext || '', lessonPlan, qualityTrace);
        trace.aiLatencyMs += Date.now() - aiStartedAt;
      } catch (error) {
        await this.failTutorTrace(trace, error);
        throw error;
      }

      await this.persistRoadmap(state.id, roadmap, {
        current_phase: sectionContext.nextPromptKind === 'teachback_2' ? TEACHBACK_2 : MEMORY_DUMP,
        pending_prompt: content,
        section_context: {} as Prisma.InputJsonValue,
      });
      const response = {
        content,
        metadata: await this.buildTurnMetadata(sessionId, 'checkpoint_question', {
          nextAction: 'evaluate_answer',
          questionCount: 1,
        }),
      };
      trace.quality = qualityTrace;
      await this.finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
      return response;
    }

    if (state.current_phase === MEMORY_DUMP) {
      if (sectionContext.nextPromptKind === 'memory_dump') {
        if (!isAutoContinue) {
          throw new Error('Akademi is preparing the next checkpoint. Wait one moment.');
        }

        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await this.startTutorTrace(buildTraceSeed(MEMORY_DUMP, 'checkpoint_question', 'memory_dump_prompt', true));
        let content;
        try {
          const aiStartedAt = Date.now();
          content = await this.buildMemoryDumpPrompt(section, teachingDecision, teacherBrainContext, contextMeta, lecturerConstraintContext?.promptContext || '', lessonPlan, qualityTrace);
          trace.aiLatencyMs += Date.now() - aiStartedAt;
        } catch (error) {
          await this.failTutorTrace(trace, error);
          throw error;
        }
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: MEMORY_DUMP,
          pending_prompt: content,
          section_context: {} as Prisma.InputJsonValue,
        });
        const response = {
          content,
          metadata: await this.buildTurnMetadata(sessionId, 'checkpoint_question', {
            nextAction: 'evaluate_answer',
            questionCount: 1,
          }),
        };
        trace.quality = qualityTrace;
        await this.finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
        return response;
      }

      if (isAutoContinue) {
        throw new Error('Akademi is waiting for your memory dump before continuing.');
      }
      const trace = await this.startTutorTrace(buildTraceSeed('MEMORY_DUMP_EVALUATION', 'evaluation', 'evaluate_memory_dump', false));
      let evaluation;
      try {
        const aiStartedAt = Date.now();
        evaluation = await this.evaluateMemoryDump(section, trimmed, teacherBrainContext, contextMeta, teacherBrainSectionContext, lessonPlan, relevantMaterialContext);
        trace.aiLatencyMs += Date.now() - aiStartedAt;
      } catch (error) {
        await this.failTutorTrace(trace, error);
        throw error;
      }
      await prisma.memoryDumpAttempt.create({
        data: {
          session_id: sessionId,
          companion_state_id: state.id,
          user_id: state.user_id,
          material_id: state.material_id,
          section_index: state.current_section_index,
          prompt: state.pending_prompt || undefined,
          student_response: trimmed,
          evaluation: evaluation.evaluation,
          score: evaluation.score,
        },
      });

      const teachBackRecords = await prisma.teachBackAttempt.findMany({
        where: {
          companion_state_id: state.id,
          section_index: state.current_section_index,
        },
        orderBy: { created_at: 'asc' },
      });
      const averageTeachBack =
        teachBackRecords.length > 0
          ? Math.round(teachBackRecords.reduce((sum, record) => sum + record.score, 0) / teachBackRecords.length)
          : evaluation.score;
      const finalScore = Math.round((averageTeachBack * 0.65) + (evaluation.score * 0.35));
      const passed = finalScore >= state.mastery_threshold;
      const failedConcepts = deriveFailedConcepts(section, trimmed);
      await prisma.masteryRecord.create({
        data: {
          session_id: sessionId,
          companion_state_id: state.id,
          user_id: state.user_id,
          material_id: state.material_id,
          course_code: state.course_code,
          section_index: state.current_section_index,
          section_title: section.title,
          score: finalScore,
          status: passed ? MasteryStatus.PASSED : MasteryStatus.FAILED,
          failed_concepts: failedConcepts as unknown as Prisma.InputJsonValue,
        },
      });

      const latestTeachBackAttempts = await prisma.teachBackAttempt.findMany({
        where: {
          companion_state_id: state.id,
          section_index: state.current_section_index,
        },
        orderBy: { created_at: 'asc' },
        select: {
          student_response: true,
          evaluation: true,
          score: true,
        },
      });

      const memoryDumpEvaluation = {
        studentResponse: trimmed,
        evaluation: evaluation.evaluation,
        score: evaluation.score,
      };

      let postAssessmentLearningIntelligenceContext = learningIntelligenceContext;
      try {
        postAssessmentLearningIntelligenceContext = await this.buildImmediateLearningIntelligenceContext({
          sessionId,
          sectionIndex: state.current_section_index,
          sectionTitle: section.title,
          sectionContent: section.content,
          score: finalScore,
          passed,
          failedConcepts,
          calculationContext: sectionCalculationContext,
          diagramContext: sectionDiagramContext,
          studentMemoryContext,
          latestStudentMemory: null,
          teachBackAttempts: latestTeachBackAttempts,
          memoryDumpEvaluation,
        });
      } catch (immediateIntelligenceError) {
        console.error('learning_intelligence_failed', {
          sessionId,
          sectionIndex: state.current_section_index,
          message: immediateIntelligenceError instanceof Error ? immediateIntelligenceError.message : 'Unknown immediate learning intelligence failure',
        });
      }

      console.log('post_assessment_intelligence_queued', {
        sessionId,
        sectionIndex: state.current_section_index,
        materialId: state.material_id,
      });
      void systemQueue.add(JOB_NAMES.POST_ASSESSMENT_INTELLIGENCE, {
        sessionId,
        companionStateId: state.id,
        userId: state.user_id,
        materialId: state.material_id,
        courseCode: state.course_code,
        sectionIndex: state.current_section_index,
        sectionTitle: section.title,
        masteryScore: finalScore,
        masteryStatus: passed ? 'PASSED' : 'FAILED',
        failedConcepts,
        teachingDecisionSnapshot: teachingDecision,
        calculationContextSnapshot: sectionCalculationContext.summary,
        diagramContextSnapshot: sectionDiagramContext.summary,
      }).catch((error: unknown) => {
        console.error('post_assessment_intelligence_failed', {
          sessionId,
          sectionIndex: state.current_section_index,
          materialId: state.material_id,
          message: error instanceof Error ? error.message : 'Unknown queue failure',
        });
      });

      const hasNextSection = state.current_section_index < roadmap.length - 1;
      const nextSection = hasNextSection ? this.sectionAt(roadmap, state.current_section_index + 1) : null;
      const nextTeacherBrainSectionContext = nextSection
        ? getTeacherBrainSectionContext(teacherBrain, state.current_section_index + 1, nextSection.title)
        : null;
      const nextTeacherBrainContext = nextSection
        ? buildTeacherBrainPromptContext(teacherBrain, state.current_section_index + 1, roadmap)
        : '';
      const nextSectionCalculationContext = nextSection && nextTeacherBrainSectionContext
        ? buildCalculationTeachingContext(nextSection, nextTeacherBrainSectionContext)
        : null;
      const nextSectionDiagramContext = nextSection && nextTeacherBrainSectionContext
        ? buildDiagramTeachingContext(nextSection, nextTeacherBrainSectionContext)
        : null;
      const nextStudentMemoryContext = nextSection
        ? await this.buildStudentMemoryContext(
          state.user_id,
          state.material_id,
          state.course_code,
          state.current_section_index + 1,
        )
        : null;
      const nextLessonPlan = nextSection && nextTeacherBrainSectionContext && nextSectionCalculationContext && nextSectionDiagramContext && nextStudentMemoryContext
        ? await this.getOrCreateLessonPlan({
          sessionId,
          companionStateId: state.id,
          userId: state.user_id,
          materialId: material.id,
          courseCode: state.course_code,
          section: nextSection,
          sectionIndex: state.current_section_index + 1,
          teacherBrainContext: nextTeacherBrainContext,
          calculationContext: nextSectionCalculationContext,
          diagramContext: nextSectionDiagramContext,
          studentMemoryPromptContext: nextStudentMemoryContext.promptContext,
        })
        : null;
      const hybridMasteryResult = evaluateHybridMastery({
        masteryScore: finalScore,
        masteryThreshold: state.mastery_threshold,
        failedConcepts,
        currentSection: section,
        nextSection,
        nextTeacherBrainSectionContext,
        nextLessonPlan,
        teacherBrainSectionContext,
        studentMemoryContext,
        learningIntelligenceContext: postAssessmentLearningIntelligenceContext,
      });

      try {
        await this.updateStudentLearningProfileAfterReflection(
          state.user_id,
          state.course_code,
          state.material_id,
        );
      } catch (profileError) {
        console.error('student_learning_profile_update_failed', {
          userId: state.user_id,
          courseCode: state.course_code,
          materialId: state.material_id,
          message: profileError instanceof Error ? profileError.message : 'Unknown profile update failure',
        });
      }

      if (hybridMasteryResult.shouldAdvance) {
        roadmap[state.current_section_index] = {
          ...section,
          status: StudyRoadmapStatus.MASTERED,
        };
        const content = await this.buildMasteryOutcome(section, finalScore, true, failedConcepts);
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: hasNextSection ? NEXT_SECTION : SESSION_DONE,
          last_completed_index: state.current_section_index,
          last_mastery_score: finalScore,
          pending_prompt: content,
          session_summary: hasNextSection ? null : `Completed all ${roadmap.length} sections.`,
          section_context: {} as Prisma.InputJsonValue,
        });
        const response = {
          content,
          metadata: await this.buildTurnMetadata(sessionId, 'transition', {
            autoContinue: false,
            waitForStudent: true,
            nextAction: 'move_next',
          }),
        };
        await this.finishTutorTrace(trace, { content, qualityGuardrailUsed: false });
        return response;
      }

      if (hybridMasteryResult.shouldRunRepair) {
        roadmap[state.current_section_index] = {
          ...section,
          status: StudyRoadmapStatus.MASTERED,
        };
        const outcome = `${await this.buildMasteryOutcome(section, finalScore, true, failedConcepts)} ${hybridMasteryResult.repairReason}`;
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: GAP_RETEACH,
          last_completed_index: state.current_section_index,
          last_mastery_score: finalScore,
          pending_prompt: outcome,
          section_context: {
            reteachDelivered: false,
            repairMode: 'medium_prerequisite_repair',
            repairConcepts: hybridMasteryResult.repairConcepts,
            repairReason: hybridMasteryResult.repairReason,
            repairAttemptCount: 0,
          } as Prisma.InputJsonValue,
        });
        const response = {
          content: outcome,
          metadata: await this.buildTurnMetadata(sessionId, 'evaluation', {
            nextAction: 'continue_teaching',
            questionCount: questionCountForContent(outcome),
          }),
        };
        await this.finishTutorTrace(trace, { content: outcome, qualityGuardrailUsed: false });
        return response;
      }

      roadmap[state.current_section_index] = {
        ...section,
        status: StudyRoadmapStatus.NEEDS_REVIEW,
      };
      const outcome = await this.buildMasteryOutcome(section, finalScore, false, failedConcepts);
      await this.persistRoadmap(state.id, roadmap, {
        current_phase: GAP_RETEACH,
        last_mastery_score: finalScore,
        pending_prompt: outcome,
        section_context: {
          reteachDelivered: false,
          repairMode: 'full_section_reteach',
          nextPromptKind: 'teachback_2',
          failedConcepts,
          reteachCycleCount: (sectionContext.reteachCycleCount || 0) + 1,
        } as Prisma.InputJsonValue,
      });
      const response = {
        content: outcome,
        metadata: await this.buildTurnMetadata(sessionId, 'evaluation', {
          nextAction: 'continue_teaching',
          questionCount: questionCountForContent(outcome),
        }),
      };
      await this.finishTutorTrace(trace, { content: outcome, qualityGuardrailUsed: false });
      return response;
    }

    if (state.current_phase === NEXT_SECTION) {
      if (/skip/i.test(trimmed)) {
        const nextIndex = Math.min(state.current_section_index + 1, roadmap.length - 1);
        const nextSection = this.sectionAt(roadmap, nextIndex);
        roadmap[nextIndex] = {
          ...nextSection,
          status: StudyRoadmapStatus.IN_PROGRESS,
        };
        const nextTeacherBrainContext = buildTeacherBrainPromptContext(teacherBrain, nextIndex, roadmap);
        const nextTeacherBrainSectionContext = getTeacherBrainSectionContext(
          teacherBrain,
          nextIndex,
          nextSection.title,
        );
        const nextSectionCalculationContext = buildCalculationTeachingContext(nextSection, nextTeacherBrainSectionContext);
        const nextSectionDiagramContext = buildDiagramTeachingContext(nextSection, nextTeacherBrainSectionContext);
        const nextStudentMemoryContext = await this.buildStudentMemoryContext(
          state.user_id,
          state.material_id,
          state.course_code,
          nextIndex,
        );
        const nextLearningIntelligenceContext = await this.loadLatestLearningIntelligenceContext(
          state.user_id,
          state.material_id,
          state.course_code,
          nextIndex,
        );
        const nextLessonPlan = await this.getOrCreateLessonPlan({
          sessionId,
          companionStateId: state.id,
          userId: state.user_id,
          materialId: material.id,
          courseCode: state.course_code,
          section: nextSection,
          sectionIndex: nextIndex,
          teacherBrainContext: nextTeacherBrainContext,
          calculationContext: nextSectionCalculationContext,
          diagramContext: nextSectionDiagramContext,
          studentMemoryPromptContext: nextStudentMemoryContext.promptContext,
        });
        const nextRelevantMaterialContext = await this.buildRelevantMaterialContext(
          material.id,
          nextSection,
          nextTeacherBrainContext,
          nextLessonPlan,
          nextTeacherBrainSectionContext,
          { sessionId, sectionIndex: nextIndex },
        );
        const nextLessonScope = buildLessonScope({
          sectionTitle: nextSection.title,
          sectionContent: nextSection.content,
          roadmap,
          currentSectionIndex: nextIndex,
          teacherBrainContext: nextTeacherBrainContext,
          teacherBrainSectionContext: nextTeacherBrainSectionContext,
          lessonPlan: nextLessonPlan,
          lessonPlanContext: nextLessonPlan.promptContext,
          relevantMaterialContext: nextRelevantMaterialContext,
          lecturerConstraintContext: lecturerConstraintContext?.promptContext || '',
          phase: PASS_1,
          passNumber: 1,
        });
        const nextTeachingDecision = this.createTeachingDecision({
          phase: PASS_1,
          section: nextSection,
          lessonScope: nextLessonScope,
          teacherBrainSectionContext: nextTeacherBrainSectionContext,
          teacherBrainContext: nextTeacherBrainContext,
          studentMemoryContext: nextStudentMemoryContext,
          lessonPlan: nextLessonPlan,
          calculationContext: nextSectionCalculationContext,
          diagramContext: nextSectionDiagramContext,
          relevantMaterialContext: nextRelevantMaterialContext,
          learningIntelligenceContext: nextLearningIntelligenceContext,
          studentLearningProfileContext,
          tutorSelfImprovementContext,
          lecturerConstraintContext,
          currentMasteryScore: state.last_mastery_score,
          lastMasteryScore: state.last_mastery_score,
        });
        const passResult = await this.buildTeachingPass(nextSection, 1, nextTeachingDecision, nextTeacherBrainContext, {
          sessionId,
          materialId: material.id,
          sectionIndex: nextIndex,
        }, nextTeacherBrainSectionContext, nextStudentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', nextLessonPlan, nextRelevantMaterialContext, {}, undefined);
        const content = passResult.content;
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: PASS_1,
          current_section_index: nextIndex,
          pending_prompt: content,
          section_context: {
            coveredConcepts: passResult.coveredConcepts,
          } as Prisma.InputJsonValue,
        });
        return {
          content,
          metadata: await this.buildTurnMetadata(sessionId, 'transition', {
            nextAction: 'continue_teaching',
          }),
        };
      }

      const affirmative = /(yes|continue|next|move on|go on|ready)/i.test(trimmed);
      if (affirmative && state.current_section_index < roadmap.length - 1) {
        const nextIndex = state.current_section_index + 1;
        const nextSection = this.sectionAt(roadmap, nextIndex);
        roadmap[nextIndex] = {
          ...nextSection,
          status: StudyRoadmapStatus.IN_PROGRESS,
        };
        const nextTeacherBrainContext = buildTeacherBrainPromptContext(teacherBrain, nextIndex, roadmap);
        const nextTeacherBrainSectionContext = getTeacherBrainSectionContext(
          teacherBrain,
          nextIndex,
          nextSection.title,
        );
        const nextSectionCalculationContext = buildCalculationTeachingContext(nextSection, nextTeacherBrainSectionContext);
        const nextSectionDiagramContext = buildDiagramTeachingContext(nextSection, nextTeacherBrainSectionContext);
        const nextStudentMemoryContext = await this.buildStudentMemoryContext(
          state.user_id,
          state.material_id,
          state.course_code,
          nextIndex,
        );
        const nextLearningIntelligenceContext = await this.loadLatestLearningIntelligenceContext(
          state.user_id,
          state.material_id,
          state.course_code,
          nextIndex,
        );
        const nextLessonPlan = await this.getOrCreateLessonPlan({
          sessionId,
          companionStateId: state.id,
          userId: state.user_id,
          materialId: material.id,
          courseCode: state.course_code,
          section: nextSection,
          sectionIndex: nextIndex,
          teacherBrainContext: nextTeacherBrainContext,
          calculationContext: nextSectionCalculationContext,
          diagramContext: nextSectionDiagramContext,
          studentMemoryPromptContext: nextStudentMemoryContext.promptContext,
        });
        const nextRelevantMaterialContext = await this.buildRelevantMaterialContext(
          material.id,
          nextSection,
          nextTeacherBrainContext,
          nextLessonPlan,
          nextTeacherBrainSectionContext,
          { sessionId, sectionIndex: nextIndex },
        );
        const nextLessonScope = buildLessonScope({
          sectionTitle: nextSection.title,
          sectionContent: nextSection.content,
          roadmap,
          currentSectionIndex: nextIndex,
          teacherBrainContext: nextTeacherBrainContext,
          teacherBrainSectionContext: nextTeacherBrainSectionContext,
          lessonPlan: nextLessonPlan,
          lessonPlanContext: nextLessonPlan.promptContext,
          relevantMaterialContext: nextRelevantMaterialContext,
          lecturerConstraintContext: lecturerConstraintContext?.promptContext || '',
          phase: PASS_1,
          passNumber: 1,
        });
        const nextTeachingDecision = this.createTeachingDecision({
          phase: PASS_1,
          section: nextSection,
          lessonScope: nextLessonScope,
          teacherBrainSectionContext: nextTeacherBrainSectionContext,
          teacherBrainContext: nextTeacherBrainContext,
          studentMemoryContext: nextStudentMemoryContext,
          lessonPlan: nextLessonPlan,
          calculationContext: nextSectionCalculationContext,
          diagramContext: nextSectionDiagramContext,
          relevantMaterialContext: nextRelevantMaterialContext,
          learningIntelligenceContext: nextLearningIntelligenceContext,
          studentLearningProfileContext,
          tutorSelfImprovementContext,
          lecturerConstraintContext,
          currentMasteryScore: state.last_mastery_score,
          lastMasteryScore: state.last_mastery_score,
        });
        const passResult = await this.buildTeachingPass(nextSection, 1, nextTeachingDecision, nextTeacherBrainContext, {
          sessionId,
          materialId: material.id,
          sectionIndex: nextIndex,
        }, nextTeacherBrainSectionContext, nextStudentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', nextLessonPlan, nextRelevantMaterialContext, {}, undefined);
        const content = passResult.content;
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: PASS_1,
          current_section_index: nextIndex,
          pending_prompt: content,
          section_context: {
            coveredConcepts: passResult.coveredConcepts,
          } as Prisma.InputJsonValue,
        });
        return {
          content,
          metadata: await this.buildTurnMetadata(sessionId, 'transition', {
            nextAction: 'continue_teaching',
          }),
        };
      }

      return {
        content: 'Reply with "continue" when you are ready for the next section, or tell me which section you want to revisit.',
        metadata: await this.buildTurnMetadata(sessionId, 'transition', {
          autoContinue: false,
          waitForStudent: true,
          nextAction: 'move_next',
        }),
      };
    }

    if (state.current_phase === SESSION_DONE) {
      return {
        content: 'You have completed this material roadmap. If you want, reply with the section name you want to review and I will reopen it for targeted revision.',
        metadata: await this.buildTurnMetadata(sessionId, 'transition', {
          autoContinue: false,
          waitForStudent: true,
          nextAction: 'move_next',
        }),
      };
    }

    const fallback = await this.buildTeachBackPrompt(section, 1, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, lecturerConstraintContext?.promptContext || '', lessonPlan);
    await this.persistRoadmap(state.id, roadmap, {
      current_phase: TEACHBACK_1,
      pending_prompt: fallback,
      section_context: {} as Prisma.InputJsonValue,
    });
    return {
      content: fallback,
      metadata: await this.buildTurnMetadata(sessionId, 'checkpoint_question', {
        nextAction: 'evaluate_answer',
        questionCount: 1,
      }),
    };
  }
}

export const studyCompanionService = new StudyCompanionService();

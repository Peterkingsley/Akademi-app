import {
  MasteryStatus,
  Prisma,
  Session,
  StudyCompanionPhase,
  StudyRoadmapStatus,
} from '@prisma/client';
import prisma from '../../config/db';
import { JOB_NAMES, systemQueue } from '../../config/queue';
import {
  RoadmapSection,
  StudyVisualPlan,
  TutorQualityTraceCapture,
  TutorTraceSeed,
  StudentMaterialMemoryRow,
  PostAssessmentIntelligencePayload,
  CompanionStartMode,
  PublicState,
} from './study-companion.types';
import {
  PASS_1,
  PASS_2,
  PASS_3,
  TEACHBACK_1,
  GAP_RETEACH,
  TEACHBACK_2,
  MEMORY_DUMP,
  NEXT_SECTION,
  SESSION_DONE,
  safeJsonArray,
  readSectionContext,
  buildLecturerStyleDirectives,
  planPrerequisiteRefresh,
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
  buildDiagramTeachingContext,
  mapDiagramTypeToSuggestedRenderer,
  buildTeacherBrainPromptContext,
} from './study-companion-teacher-brain';
import { isRepairRiskAcceptable, evaluateHybridMastery } from './study-companion-memory-mastery';
import { estimatePromptTokens, deriveFailedConcepts, generateText } from './study-companion-quality-relevance';
import {
  ensureState,
  getPublicState,
  buildTurnMetadata,
  persistRoadmap,
  loadSessionContext,
  sectionAt,
  companionSystemPrompt,
  buildRoadmapMessage,
} from './study-companion-session-state';
import {
  buildStudentMemoryContext,
  loadLatestLearningIntelligenceContext,
  selectThrowbackSection,
  createTeachingDecision,
} from './study-companion-context-builders';
import {
  compressStudentSectionMemory,
  createTeachingReflectionAfterSection,
  createLearningIntelligenceRecordAfterSection,
  buildImmediateLearningIntelligenceContext,
  parseTeachingDecisionSnapshot,
  updateStudentLearningProfileAfterReflection,
} from './study-companion-reflection';
import { getOrCreateLessonPlan, buildRelevantMaterialContext } from './study-companion-lesson-plan';
import { startTutorTrace, finishTutorTrace, failTutorTrace, enforceTutorMessageQuality } from './study-companion-tutor-trace';
import {
  buildTeachingPass,
  evaluateTeachBack,
  evaluateMemoryDump,
  evaluatePrerequisiteRepair,
  buildTeachBackPrompt,
  buildMemoryDumpPrompt,
  buildGapReteach,
  buildInterruptResponse,
  buildMasteryOutcome,
} from './study-companion-teaching-pass';

export class StudyCompanionService {
  async ensureState(sessionId: string) {
    return ensureState(sessionId);
  }

  async getPublicState(sessionId: string): Promise<PublicState | null> {
    return getPublicState(sessionId);
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
      const studentMemoryContext = await buildStudentMemoryContext(
        payload.userId,
        payload.materialId,
        payload.courseCode,
        payload.sectionIndex,
      );
      const teachingDecision = parseTeachingDecisionSnapshot(payload.teachingDecisionSnapshot);

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

      const latestStudentMemory = await compressStudentSectionMemory({
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
        ? await createTeachingReflectionAfterSection({
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

      await createLearningIntelligenceRecordAfterSection({
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

      await updateStudentLearningProfileAfterReflection(
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


  async getVisualPlan(sessionId: string): Promise<StudyVisualPlan> {
    console.log('visual_plan_requested', { sessionId });

    const { state, roadmap, teacherBrain } = await loadSessionContext(sessionId);
    const section = sectionAt(roadmap, state.current_section_index);
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
    } = await loadSessionContext(sessionId);
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
        const throwback = await selectThrowbackSection(
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
          companionSystemPrompt(),
          180,
        );
      }
    } else if (mode === 'specific' && sectionTitle) {
      const matchIndex = roadmap.findIndex((section) => section.title.toLowerCase() === sectionTitle.toLowerCase());
      nextIndex = matchIndex >= 0 ? matchIndex : 0;
    } else if (mode === 'roadmap') {
      const message = await buildRoadmapMessage(material.title, roadmap, Math.max(state.last_completed_index + 1, 0));
      await persistRoadmap(state.id, roadmap, {
        current_phase: StudyCompanionPhase.ROADMAP_GENERATED,
        pending_prompt: message,
        refresh_question: null,
        section_context: {} as Prisma.InputJsonValue,
      });
      return {
        content: message,
        metadata: await buildTurnMetadata(sessionId, 'transition', {
          autoContinue: false,
          waitForStudent: true,
          nextAction: 'move_next',
        }),
      };
    }

    nextIndex = findFirstRealTeachingSection(roadmap, nextIndex);

    const section = sectionAt(roadmap, nextIndex);
    const sectionContext = readSectionContext(state.section_context);

    if (!refreshQuestion) {
      refreshQuestion = await generateText(
        `Create one short prequestion about this upcoming section, to be asked before it is taught. A wrong guess is fine and expected, since the point is to prime attention toward the right idea. Base it on the section's core idea or a key prerequisite.\n\nSection title: ${section.title}\n\nSection content:\n${truncate(section.content, 2200)}`,
        companionSystemPrompt(),
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
    const lessonPlan = await getOrCreateLessonPlan({
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
    const relevantMaterialContext = await buildRelevantMaterialContext(
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
    const teachingDecision = createTeachingDecision({
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
    const introTrace = await startTutorTrace({
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
      const rawContent = await generateText(introPrompt, companionSystemPrompt());
      introTrace.aiLatencyMs += Date.now() - aiStartedAt;
      const content = await enforceTutorMessageQuality({
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
      await persistRoadmap(state.id, roadmap, {
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
        metadata: await buildTurnMetadata(sessionId, 'transition', {
          nextAction: 'continue_teaching',
          questionCount: questionCountForContent(content),
        }),
      };
      await finishTutorTrace(introTrace, {
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
      await failTutorTrace(introTrace, error);
      throw error;
    }
  }

  async handleTutorContinue(sessionId: string) {
    return this.handleStudentReply(sessionId, '__AUTO_CONTINUE__');
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
    } = await loadSessionContext(sessionId);
    const section = sectionAt(roadmap, state.current_section_index);
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
    const lessonPlan = await getOrCreateLessonPlan({
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
    const relevantMaterialContext = await buildRelevantMaterialContext(
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
    const teachingDecision = createTeachingDecision({
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
        const trace = await startTutorTrace(buildTraceSeed(PASS_1, 'teaching', 'teaching_pass_1', true));
        try {
          const aiStartedAt = Date.now();
          const passResult = await buildTeachingPass(section, 1, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', lessonPlan, relevantMaterialContext, sectionContext, qualityTrace, { question: state.refresh_question || '', answer: trimmed });
          const content = passResult.content;
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await persistRoadmap(state.id, roadmap, {
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
            metadata: await buildTurnMetadata(sessionId, 'teaching', {
              nextAction: 'ask_followup',
              questionCount: questionCountForContent(content),
            }),
          };
          trace.quality = qualityTrace;
          await finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
          return response;
        } catch (error) {
          await failTutorTrace(trace, error);
          throw error;
        }
      }

      if (sectionContext.pass1QuestionPending && !isInterrupt) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await startTutorTrace(buildTraceSeed(PASS_2, 'teaching', 'teaching_pass_2', true));
        try {
          const aiStartedAt = Date.now();
          const priorInteraction = isAutoContinue ? undefined : { question: state.pending_prompt || '', answer: trimmed };
          const passResult = await buildTeachingPass(section, 2, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', lessonPlan, relevantMaterialContext, sectionContext, qualityTrace, priorInteraction);
          const content = passResult.content;
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await persistRoadmap(state.id, roadmap, {
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
            metadata: await buildTurnMetadata(sessionId, 'teaching', {
              nextAction: 'ask_followup',
              questionCount: questionCountForContent(content),
            }),
          };
          trace.quality = qualityTrace;
          await finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
          return response;
        } catch (error) {
          await failTutorTrace(trace, error);
          throw error;
        }
      }

      if (isInterrupt || !isAutoContinue) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await startTutorTrace(buildTraceSeed(PASS_1, 'checkpoint_question', 'interrupt_response', true));
        try {
          const aiStartedAt = Date.now();
          const content = await buildInterruptResponse(section, trimmed, teachingDecision, teacherBrainContext, contextMeta, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', relevantMaterialContext, qualityTrace);
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await persistRoadmap(state.id, roadmap, {
            current_phase: TEACHBACK_1,
            pending_prompt: content,
            section_context: {} as Prisma.InputJsonValue,
          });
          const response = {
            content,
            metadata: await buildTurnMetadata(sessionId, 'checkpoint_question', {
              nextAction: 'evaluate_answer',
              questionCount: 1,
            }),
          };
          await finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
          return response;
        } catch (error) {
          await failTutorTrace(trace, error);
          throw error;
        }
      }
      const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
      const trace = await startTutorTrace(buildTraceSeed(PASS_1, 'teaching', 'teaching_pass_1', true));
      try {
        const aiStartedAt = Date.now();
        const passResult = await buildTeachingPass(section, 1, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', lessonPlan, relevantMaterialContext, sectionContext, qualityTrace);
        const content = passResult.content;
        trace.aiLatencyMs += Date.now() - aiStartedAt;
        await persistRoadmap(state.id, roadmap, {
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
          metadata: await buildTurnMetadata(sessionId, 'teaching', {
            nextAction: 'ask_followup',
            questionCount: questionCountForContent(content),
          }),
        };
        trace.quality = qualityTrace;
        await finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
        return response;
      } catch (error) {
        await failTutorTrace(trace, error);
        throw error;
      }
    }

    if (state.current_phase === PASS_2) {
      if (sectionContext.pass2QuestionPending && !isInterrupt) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await startTutorTrace(buildTraceSeed(PASS_3, 'teaching', 'teaching_pass_3', true));
        try {
          const aiStartedAt = Date.now();
          const priorInteraction = isAutoContinue ? undefined : { question: state.pending_prompt || '', answer: trimmed };
          const passResult = await buildTeachingPass(section, 3, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', lessonPlan, relevantMaterialContext, sectionContext, qualityTrace, priorInteraction);
          const content = passResult.content;
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await persistRoadmap(state.id, roadmap, {
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
            metadata: await buildTurnMetadata(sessionId, 'teaching', {
              nextAction: 'continue_teaching',
              questionCount: questionCountForContent(content),
            }),
          };
          trace.quality = qualityTrace;
          await finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
          return response;
        } catch (error) {
          await failTutorTrace(trace, error);
          throw error;
        }
      }

      if (isInterrupt || !isAutoContinue) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await startTutorTrace(buildTraceSeed(PASS_2, 'checkpoint_question', 'interrupt_response', true));
        try {
          const aiStartedAt = Date.now();
          const content = await buildInterruptResponse(section, trimmed, teachingDecision, teacherBrainContext, contextMeta, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', relevantMaterialContext, qualityTrace);
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await persistRoadmap(state.id, roadmap, {
            current_phase: TEACHBACK_1,
            pending_prompt: content,
            section_context: {} as Prisma.InputJsonValue,
          });
          const response = {
            content,
            metadata: await buildTurnMetadata(sessionId, 'checkpoint_question', {
              nextAction: 'evaluate_answer',
              questionCount: 1,
            }),
          };
          trace.quality = qualityTrace;
          await finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
          return response;
        } catch (error) {
          await failTutorTrace(trace, error);
          throw error;
        }
      }
      const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
      const trace = await startTutorTrace(buildTraceSeed(PASS_2, 'teaching', 'teaching_pass_2', true));
      try {
        const aiStartedAt = Date.now();
        const passResult = await buildTeachingPass(section, 2, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', lessonPlan, relevantMaterialContext, sectionContext, qualityTrace);
        const content = passResult.content;
        trace.aiLatencyMs += Date.now() - aiStartedAt;
        await persistRoadmap(state.id, roadmap, {
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
          metadata: await buildTurnMetadata(sessionId, 'teaching', {
            nextAction: 'ask_followup',
            questionCount: questionCountForContent(content),
          }),
        };
        trace.quality = qualityTrace;
        await finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
        return response;
      } catch (error) {
        await failTutorTrace(trace, error);
        throw error;
      }
    }

    if (state.current_phase === PASS_3) {
      if (isInterrupt || !isAutoContinue) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await startTutorTrace(buildTraceSeed(PASS_3, 'checkpoint_question', 'interrupt_response', true));
        try {
          const aiStartedAt = Date.now();
          const content = await buildInterruptResponse(section, trimmed, teachingDecision, teacherBrainContext, contextMeta, studentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', relevantMaterialContext, qualityTrace);
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await persistRoadmap(state.id, roadmap, {
            current_phase: TEACHBACK_1,
            pending_prompt: content,
            section_context: {} as Prisma.InputJsonValue,
          });
          const response = {
            content,
            metadata: await buildTurnMetadata(sessionId, 'checkpoint_question', {
              nextAction: 'evaluate_answer',
              questionCount: 1,
            }),
          };
          trace.quality = qualityTrace;
          await finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
          return response;
        } catch (error) {
          await failTutorTrace(trace, error);
          throw error;
        }
      }
      const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
      const trace = await startTutorTrace(buildTraceSeed(TEACHBACK_1, 'checkpoint_question', 'teachback_prompt_1', true));
      try {
        const aiStartedAt = Date.now();
        const content = await buildTeachBackPrompt(section, 1, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, lecturerConstraintContext?.promptContext || '', lessonPlan, qualityTrace);
        trace.aiLatencyMs += Date.now() - aiStartedAt;
        await persistRoadmap(state.id, roadmap, {
          current_phase: TEACHBACK_1,
          pending_prompt: content,
          section_context: {
            coveredConcepts: safeStringArray(sectionContext.coveredConcepts),
          } as Prisma.InputJsonValue,
        });
        const response = {
          content,
          metadata: await buildTurnMetadata(sessionId, 'checkpoint_question', {
            nextAction: 'evaluate_answer',
            questionCount: 1,
          }),
        };
        trace.quality = qualityTrace;
        await finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
        return response;
      } catch (error) {
        await failTutorTrace(trace, error);
        throw error;
      }
    }

    if (state.current_phase === TEACHBACK_1) {
      if (isAutoContinue) {
        throw new Error('Akademi is waiting for your explanation before continuing.');
      }
      const trace = await startTutorTrace(buildTraceSeed(StudyCompanionPhase.TEACHBACK_1_EVALUATION, 'evaluation', 'evaluate_teachback_1', false));
      let evaluation;
      try {
        const aiStartedAt = Date.now();
        evaluation = await evaluateTeachBack(section, trimmed, 1, teacherBrainContext, contextMeta, teacherBrainSectionContext, lessonPlan, relevantMaterialContext);
        trace.aiLatencyMs += Date.now() - aiStartedAt;
      } catch (error) {
        await failTutorTrace(trace, error);
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

      await persistRoadmap(state.id, roadmap, {
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
        metadata: await buildTurnMetadata(sessionId, 'evaluation', {
          nextAction: 'continue_teaching',
          questionCount: questionCountForContent(evaluation.evaluation),
        }),
      };
      await finishTutorTrace(trace, { content: evaluation.evaluation, qualityGuardrailUsed: false });
      return response;
    }

    if (state.current_phase === TEACHBACK_2) {
      if (isAutoContinue) {
        throw new Error('Akademi is waiting for your second teach-back before continuing.');
      }
      const trace = await startTutorTrace(buildTraceSeed(StudyCompanionPhase.TEACHBACK_2_EVALUATION, 'evaluation', 'evaluate_teachback_2', false));
      let evaluation;
      try {
        const aiStartedAt = Date.now();
        evaluation = await evaluateTeachBack(section, trimmed, 2, teacherBrainContext, contextMeta, teacherBrainSectionContext, lessonPlan, relevantMaterialContext);
        trace.aiLatencyMs += Date.now() - aiStartedAt;
      } catch (error) {
        await failTutorTrace(trace, error);
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

      await persistRoadmap(state.id, roadmap, {
        current_phase: MEMORY_DUMP,
        pending_prompt: evaluation.evaluation,
        section_context: {
          nextPromptKind: 'memory_dump',
          coveredConcepts: safeStringArray(sectionContext.coveredConcepts),
        } as Prisma.InputJsonValue,
      });
      const response = {
        content: evaluation.evaluation,
        metadata: await buildTurnMetadata(sessionId, 'evaluation', {
          nextAction: 'continue_teaching',
          questionCount: questionCountForContent(evaluation.evaluation),
        }),
      };
      await finishTutorTrace(trace, { content: evaluation.evaluation, qualityGuardrailUsed: false });
      return response;
    }

    if (state.current_phase === GAP_RETEACH) {
      if (sectionContext.repairMode === 'medium_prerequisite_repair' && !isAutoContinue) {
        const trace = await startTutorTrace(buildTraceSeed(GAP_RETEACH, 'evaluation', 'evaluate_prerequisite_repair', false));
        let repairEvaluation;
        try {
          const aiStartedAt = Date.now();
          repairEvaluation = await evaluatePrerequisiteRepair(
            section,
            trimmed,
            sectionContext.repairConcepts || [],
            sectionContext.repairReason || '',
            teacherBrainContext,
          );
          trace.aiLatencyMs += Date.now() - aiStartedAt;
        } catch (error) {
          await failTutorTrace(trace, error);
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
          await persistRoadmap(state.id, roadmap, {
            current_phase: hasNextSection ? NEXT_SECTION : SESSION_DONE,
            last_completed_index: state.current_section_index,
            pending_prompt: content,
            section_context: {
              remediationRequired: !repairEvaluation.passed,
            } as Prisma.InputJsonValue,
          });
          await finishTutorTrace(trace, { content, qualityGuardrailUsed: false });
          return {
            content,
            metadata: await buildTurnMetadata(sessionId, 'evaluation', {
              autoContinue: false,
              waitForStudent: true,
              nextAction: 'move_next',
              questionCount: questionCountForContent(content),
            }),
          };
        }

        const retryContent = `${repairEvaluation.evaluation} We need one more short prerequisite repair before continuing.`;
        await persistRoadmap(state.id, roadmap, {
          current_phase: GAP_RETEACH,
          pending_prompt: retryContent,
          section_context: {
            ...sectionContext,
            reteachDelivered: false,
            repairAttemptCount: repairAttemptCount + 1,
          } as Prisma.InputJsonValue,
        });
        await finishTutorTrace(trace, { content: retryContent, qualityGuardrailUsed: false });
        return {
          content: retryContent,
          metadata: await buildTurnMetadata(sessionId, 'evaluation', {
            nextAction: 'continue_teaching',
            questionCount: questionCountForContent(retryContent),
          }),
        };
      }

      if (isInterrupt || !isAutoContinue) {
        const content = await buildInterruptResponse(section, trimmed, teachingDecision, teacherBrainContext, contextMeta, '', lecturerConstraintContext?.promptContext || '', relevantMaterialContext);
        await persistRoadmap(state.id, roadmap, {
          current_phase: TEACHBACK_1,
          pending_prompt: content,
          section_context: {} as Prisma.InputJsonValue,
        });
        return {
          content,
          metadata: await buildTurnMetadata(sessionId, 'checkpoint_question', {
            nextAction: 'evaluate_answer',
            questionCount: 1,
          }),
        };
      }

      if (!sectionContext.reteachDelivered) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await startTutorTrace(buildTraceSeed(GAP_RETEACH, 'reteach', 'gap_reteach', true));
        try {
          const aiStartedAt = Date.now();
          const content = await buildGapReteach(
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
          await persistRoadmap(state.id, roadmap, {
            current_phase: sectionContext.repairMode === 'medium_prerequisite_repair' ? GAP_RETEACH : GAP_RETEACH,
            pending_prompt: content,
            section_context: {
              ...sectionContext,
              reteachDelivered: true,
            } as Prisma.InputJsonValue,
          });
          const response = {
            content,
            metadata: await buildTurnMetadata(
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
          await finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
          return response;
        } catch (error) {
          await failTutorTrace(trace, error);
          throw error;
        }
      }

      if (sectionContext.repairMode === 'medium_prerequisite_repair') {
        throw new Error('Akademi is waiting for your prerequisite repair answer before continuing.');
      }

      const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
      const trace = await startTutorTrace(buildTraceSeed(
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
            ? await buildTeachBackPrompt(section, 2, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, lecturerConstraintContext?.promptContext || '', lessonPlan, qualityTrace)
            : await buildMemoryDumpPrompt(section, teachingDecision, teacherBrainContext, contextMeta, lecturerConstraintContext?.promptContext || '', lessonPlan, qualityTrace);
        trace.aiLatencyMs += Date.now() - aiStartedAt;
      } catch (error) {
        await failTutorTrace(trace, error);
        throw error;
      }

      await persistRoadmap(state.id, roadmap, {
        current_phase: sectionContext.nextPromptKind === 'teachback_2' ? TEACHBACK_2 : MEMORY_DUMP,
        pending_prompt: content,
        section_context: {} as Prisma.InputJsonValue,
      });
      const response = {
        content,
        metadata: await buildTurnMetadata(sessionId, 'checkpoint_question', {
          nextAction: 'evaluate_answer',
          questionCount: 1,
        }),
      };
      trace.quality = qualityTrace;
      await finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
      return response;
    }

    if (state.current_phase === MEMORY_DUMP) {
      if (sectionContext.nextPromptKind === 'memory_dump') {
        if (!isAutoContinue) {
          throw new Error('Akademi is preparing the next checkpoint. Wait one moment.');
        }

        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await startTutorTrace(buildTraceSeed(MEMORY_DUMP, 'checkpoint_question', 'memory_dump_prompt', true));
        let content;
        try {
          const aiStartedAt = Date.now();
          content = await buildMemoryDumpPrompt(section, teachingDecision, teacherBrainContext, contextMeta, lecturerConstraintContext?.promptContext || '', lessonPlan, qualityTrace);
          trace.aiLatencyMs += Date.now() - aiStartedAt;
        } catch (error) {
          await failTutorTrace(trace, error);
          throw error;
        }
        await persistRoadmap(state.id, roadmap, {
          current_phase: MEMORY_DUMP,
          pending_prompt: content,
          section_context: {} as Prisma.InputJsonValue,
        });
        const response = {
          content,
          metadata: await buildTurnMetadata(sessionId, 'checkpoint_question', {
            nextAction: 'evaluate_answer',
            questionCount: 1,
          }),
        };
        trace.quality = qualityTrace;
        await finishTutorTrace(trace, { content, qualityGuardrailUsed: true });
        return response;
      }

      if (isAutoContinue) {
        throw new Error('Akademi is waiting for your memory dump before continuing.');
      }
      const trace = await startTutorTrace(buildTraceSeed('MEMORY_DUMP_EVALUATION', 'evaluation', 'evaluate_memory_dump', false));
      let evaluation;
      try {
        const aiStartedAt = Date.now();
        evaluation = await evaluateMemoryDump(section, trimmed, teacherBrainContext, contextMeta, teacherBrainSectionContext, lessonPlan, relevantMaterialContext);
        trace.aiLatencyMs += Date.now() - aiStartedAt;
      } catch (error) {
        await failTutorTrace(trace, error);
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
        postAssessmentLearningIntelligenceContext = await buildImmediateLearningIntelligenceContext({
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
      const nextSection = hasNextSection ? sectionAt(roadmap, state.current_section_index + 1) : null;
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
        ? await buildStudentMemoryContext(
          state.user_id,
          state.material_id,
          state.course_code,
          state.current_section_index + 1,
        )
        : null;
      const nextLessonPlan = nextSection && nextTeacherBrainSectionContext && nextSectionCalculationContext && nextSectionDiagramContext && nextStudentMemoryContext
        ? await getOrCreateLessonPlan({
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
        await updateStudentLearningProfileAfterReflection(
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
        const content = await buildMasteryOutcome(section, finalScore, true, failedConcepts);
        await persistRoadmap(state.id, roadmap, {
          current_phase: hasNextSection ? NEXT_SECTION : SESSION_DONE,
          last_completed_index: state.current_section_index,
          last_mastery_score: finalScore,
          pending_prompt: content,
          session_summary: hasNextSection ? null : `Completed all ${roadmap.length} sections.`,
          section_context: {} as Prisma.InputJsonValue,
        });
        const response = {
          content,
          metadata: await buildTurnMetadata(sessionId, 'transition', {
            autoContinue: false,
            waitForStudent: true,
            nextAction: 'move_next',
          }),
        };
        await finishTutorTrace(trace, { content, qualityGuardrailUsed: false });
        return response;
      }

      if (hybridMasteryResult.shouldRunRepair) {
        roadmap[state.current_section_index] = {
          ...section,
          status: StudyRoadmapStatus.MASTERED,
        };
        const outcome = `${await buildMasteryOutcome(section, finalScore, true, failedConcepts)} ${hybridMasteryResult.repairReason}`;
        await persistRoadmap(state.id, roadmap, {
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
          metadata: await buildTurnMetadata(sessionId, 'evaluation', {
            nextAction: 'continue_teaching',
            questionCount: questionCountForContent(outcome),
          }),
        };
        await finishTutorTrace(trace, { content: outcome, qualityGuardrailUsed: false });
        return response;
      }

      roadmap[state.current_section_index] = {
        ...section,
        status: StudyRoadmapStatus.NEEDS_REVIEW,
      };
      const outcome = await buildMasteryOutcome(section, finalScore, false, failedConcepts);
      await persistRoadmap(state.id, roadmap, {
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
        metadata: await buildTurnMetadata(sessionId, 'evaluation', {
          nextAction: 'continue_teaching',
          questionCount: questionCountForContent(outcome),
        }),
      };
      await finishTutorTrace(trace, { content: outcome, qualityGuardrailUsed: false });
      return response;
    }

    if (state.current_phase === NEXT_SECTION) {
      if (/skip/i.test(trimmed)) {
        const nextIndex = Math.min(state.current_section_index + 1, roadmap.length - 1);
        const nextSection = sectionAt(roadmap, nextIndex);
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
        const nextStudentMemoryContext = await buildStudentMemoryContext(
          state.user_id,
          state.material_id,
          state.course_code,
          nextIndex,
        );
        const nextLearningIntelligenceContext = await loadLatestLearningIntelligenceContext(
          state.user_id,
          state.material_id,
          state.course_code,
          nextIndex,
        );
        const nextLessonPlan = await getOrCreateLessonPlan({
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
        const nextRelevantMaterialContext = await buildRelevantMaterialContext(
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
        const nextTeachingDecision = createTeachingDecision({
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
        const passResult = await buildTeachingPass(nextSection, 1, nextTeachingDecision, nextTeacherBrainContext, {
          sessionId,
          materialId: material.id,
          sectionIndex: nextIndex,
        }, nextTeacherBrainSectionContext, nextStudentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', nextLessonPlan, nextRelevantMaterialContext, {}, undefined);
        const content = passResult.content;
        await persistRoadmap(state.id, roadmap, {
          current_phase: PASS_1,
          current_section_index: nextIndex,
          pending_prompt: content,
          section_context: {
            coveredConcepts: passResult.coveredConcepts,
          } as Prisma.InputJsonValue,
        });
        return {
          content,
          metadata: await buildTurnMetadata(sessionId, 'transition', {
            nextAction: 'continue_teaching',
          }),
        };
      }

      const affirmative = /(yes|continue|next|move on|go on|ready)/i.test(trimmed);
      if (affirmative && state.current_section_index < roadmap.length - 1) {
        const nextIndex = state.current_section_index + 1;
        const nextSection = sectionAt(roadmap, nextIndex);
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
        const nextStudentMemoryContext = await buildStudentMemoryContext(
          state.user_id,
          state.material_id,
          state.course_code,
          nextIndex,
        );
        const nextLearningIntelligenceContext = await loadLatestLearningIntelligenceContext(
          state.user_id,
          state.material_id,
          state.course_code,
          nextIndex,
        );
        const nextLessonPlan = await getOrCreateLessonPlan({
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
        const nextRelevantMaterialContext = await buildRelevantMaterialContext(
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
        const nextTeachingDecision = createTeachingDecision({
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
        const passResult = await buildTeachingPass(nextSection, 1, nextTeachingDecision, nextTeacherBrainContext, {
          sessionId,
          materialId: material.id,
          sectionIndex: nextIndex,
        }, nextTeacherBrainSectionContext, nextStudentMemoryContext.promptContext, lecturerConstraintContext?.promptContext || '', nextLessonPlan, nextRelevantMaterialContext, {}, undefined);
        const content = passResult.content;
        await persistRoadmap(state.id, roadmap, {
          current_phase: PASS_1,
          current_section_index: nextIndex,
          pending_prompt: content,
          section_context: {
            coveredConcepts: passResult.coveredConcepts,
          } as Prisma.InputJsonValue,
        });
        return {
          content,
          metadata: await buildTurnMetadata(sessionId, 'transition', {
            nextAction: 'continue_teaching',
          }),
        };
      }

      return {
        content: 'Reply with "continue" when you are ready for the next section, or tell me which section you want to revisit.',
        metadata: await buildTurnMetadata(sessionId, 'transition', {
          autoContinue: false,
          waitForStudent: true,
          nextAction: 'move_next',
        }),
      };
    }

    if (state.current_phase === SESSION_DONE) {
      return {
        content: 'You have completed this material roadmap. If you want, reply with the section name you want to review and I will reopen it for targeted revision.',
        metadata: await buildTurnMetadata(sessionId, 'transition', {
          autoContinue: false,
          waitForStudent: true,
          nextAction: 'move_next',
        }),
      };
    }

    const fallback = await buildTeachBackPrompt(section, 1, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, lecturerConstraintContext?.promptContext || '', lessonPlan);
    await persistRoadmap(state.id, roadmap, {
      current_phase: TEACHBACK_1,
      pending_prompt: fallback,
      section_context: {} as Prisma.InputJsonValue,
    });
    return {
      content: fallback,
      metadata: await buildTurnMetadata(sessionId, 'checkpoint_question', {
        nextAction: 'evaluate_answer',
        questionCount: 1,
      }),
    };
  }
}

export const studyCompanionService = new StudyCompanionService();

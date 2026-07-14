import {
  Prisma,
  Session,
  StudyCompanionPhase,
  StudyRoadmapStatus,
} from '@prisma/client';
import prisma from '../../config/db';
import {
  ReaderPageShape,
  RoadmapSection,
  CompanionMetadata,
  CompanionResponseMetadata,
  PublicState,
} from './study-companion.types';
import {
  PASS_1,
  PASS_2,
  PASS_3,
  safeJsonObject,
  safeJsonArray,
  normalizeText,
} from './study-companion-prompt-directives';
import { parseTeacherBrain } from './study-companion-teacher-brain';
import {
  buildStudentMemoryContext,
  loadLatestLearningIntelligenceContext,
  loadStudentLearningProfileContext,
  buildTutorSelfImprovementContext,
  loadLecturerConstraintsForSession,
} from './study-companion-context-builders';

export function metadataDefaultsForTurnType(
  turnType: NonNullable<CompanionResponseMetadata['turnType']>,
) {
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

export async function buildTurnMetadata(
  sessionId: string,
  turnType: NonNullable<CompanionResponseMetadata['turnType']>,
  extra: Omit<
    CompanionResponseMetadata,
    'study_companion' | 'turnType' | 'waitForStudent' | 'autoContinue'
  > & {
    waitForStudent?: boolean;
    autoContinue?: boolean;
  } = {},
) {
  const defaults = metadataDefaultsForTurnType(turnType);
  return buildResponseMetadata(sessionId, {
    turnType,
    waitForStudent: extra.waitForStudent ?? defaults.waitForStudent,
    autoContinue: extra.autoContinue ?? defaults.autoContinue,
    ...extra,
  });
}

export async function buildResponseMetadata(
  sessionId: string,
  extra: Omit<CompanionResponseMetadata, 'study_companion'> = {},
): Promise<CompanionResponseMetadata> {
  const questionCount = extra.questionCount ?? 0;
  return {
    allowInterruption: extra.allowInterruption ?? true,
    questionCount,
    ...extra,
    study_companion: await getPublicState(sessionId),
  };
}

export function parseMetadata(session: Session) {
  return safeJsonObject<CompanionMetadata>(session.metadata, {});
}

export function isCompanionSession(session: Session) {
  const metadata = parseMetadata(session);
  return (
    session.session_type === 'STUDY' &&
    metadata.mode === 'ai-study-companion' &&
    !!session.material_id
  );
}

export function buildRoadmapFromReaderStructure(
  readerStructure: unknown,
  fallbackRoadmap: string[],
) {
  const pages = safeJsonArray<ReaderPageShape>(
    safeJsonObject<{ pages?: ReaderPageShape[] }>(readerStructure, {}).pages,
  );
  const grouped = new Map<string, RoadmapSection>();

  for (const page of pages) {
    const title = String(
      page.chapterTitle || page.pageTitle || 'Reading',
    ).trim();
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
      current.content = normalizeText(
        [current.content, page.content || ''].filter(Boolean).join('\n\n'),
      );
      current.pageEnd = Number(page.pageNumber || current.pageEnd);
    }
  }

  const roadmap = Array.from(grouped.values()).filter(
    (section) => section.content,
  );
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

export function buildProgress(roadmap: RoadmapSection[]) {
  return {
    completedSections: roadmap.filter(
      (section) => section.status === StudyRoadmapStatus.MASTERED,
    ).length,
    totalSections: roadmap.length,
    masteredSections: roadmap.filter(
      (section) => section.status === StudyRoadmapStatus.MASTERED,
    ).length,
  };
}

export async function ensureState(sessionId: string) {
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
  if (!isCompanionSession(session)) return null;
  if (!session.material)
    throw new Error('Companion study requires a selected material');

  const existing = await prisma.studyCompanionState.findUnique({
    where: { session_id: sessionId },
  });
  if (existing) return existing;

  const metadata = parseMetadata(session);
  const fallbackRoadmap = Array.isArray(metadata.roadmap)
    ? metadata.roadmap.map((value) => String(value))
    : [];
  const roadmap = buildRoadmapFromReaderStructure(
    session.material.reader_structure,
    fallbackRoadmap,
  );
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

  const progress = buildProgress(roadmap);
  const previousState = await prisma.studyCompanionState.findFirst({
    where: {
      user_id: session.user_id,
      material_id: session.material.id,
      course_code:
        session.course_code || session.material.course_code || 'GENERAL',
      session_id: { not: session.id },
    },
    orderBy: { updated_at: 'desc' },
  });

  const restoredRoadmap = previousState?.roadmap
    ? safeJsonArray<RoadmapSection>(previousState.roadmap)
    : roadmap;
  const restoredProgress = buildProgress(restoredRoadmap);
  return prisma.studyCompanionState.create({
    data: {
      session_id: session.id,
      user_id: session.user_id,
      material_id: session.material.id,
      course_code:
        session.course_code || session.material.course_code || 'GENERAL',
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

export async function getPublicState(
  sessionId: string,
): Promise<PublicState | null> {
  const state = await ensureState(sessionId);
  if (!state) return null;
  const roadmap = safeJsonArray<RoadmapSection>(state.roadmap);
  return {
    phase: state.current_phase,
    currentSectionIndex: state.current_section_index,
    lastCompletedIndex: state.last_completed_index,
    lastMasteryScore: state.last_mastery_score ?? null,
    masteryThreshold: state.mastery_threshold,
    roadmap,
    progress: buildProgress(roadmap),
    refreshQuestion: state.refresh_question || null,
    pendingPrompt: state.pending_prompt || null,
    materialId: state.material_id,
    courseCode: state.course_code,
    passNumber:
      state.current_phase === PASS_1
        ? 1
        : state.current_phase === PASS_2
          ? 2
          : state.current_phase === PASS_3
            ? 3
            : null,
    totalPasses: 3,
  };
}

export async function persistRoadmap(
  stateId: string,
  roadmap: RoadmapSection[],
  extra: Partial<{
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
  }> = {},
) {
  return prisma.studyCompanionState.update({
    where: { id: stateId },
    data: {
      roadmap: roadmap as unknown as Prisma.InputJsonValue,
      progress: buildProgress(roadmap) as unknown as Prisma.InputJsonValue,
      ...extra,
    },
  });
}

export async function loadSessionContext(sessionId: string) {
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
  if (!session.material)
    throw new Error('Material not found for this companion session');

  const state = session.companion_state || (await ensureState(session.id));
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
  const studentMemoryContext = await buildStudentMemoryContext(
    state.user_id,
    state.material_id,
    state.course_code,
    state.current_section_index,
  );
  const learningIntelligenceContext =
    await loadLatestLearningIntelligenceContext(
      state.user_id,
      state.material_id,
      state.course_code,
      state.current_section_index,
    );
  const studentLearningProfileContext = await loadStudentLearningProfileContext(
    state.user_id,
  );
  const tutorSelfImprovementContext = await buildTutorSelfImprovementContext(
    state.user_id,
    state.material_id,
    state.course_code,
  );
  const lecturerConstraintContext =
    await loadLecturerConstraintsForSession(session);

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

export function sectionAt(roadmap: RoadmapSection[], index: number) {
  return roadmap[Math.max(0, Math.min(index, roadmap.length - 1))];
}

export function companionSystemPrompt() {
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

export async function buildRoadmapMessage(
  materialTitle: string,
  roadmap: RoadmapSection[],
  recommendedIndex: number,
) {
  const list = roadmap
    .map(
      (section, index) =>
        `${index + 1}. ${section.title} - ${section.status.replace(/_/g, ' ').toLowerCase()}`,
    )
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

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
  const companionModes = new Set(['ai-study-companion', 'ai-tutor']);
  return (
    session.session_type === 'STUDY' &&
    companionModes.has(String(metadata.mode || '')) &&
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

const MAX_STUDENT_ROADMAP_SECTIONS = 48;

function isAdministrativeRoadmapSection(section: RoadmapSection) {
  const title = String(section.title || '').toLowerCase();
  return /\b(table of contents|contents|preface|acknowledgement|copyright|bibliography|references|course outline|course aim|course objective|course description|what you will learn|learning objectives?|syllabus)\b/.test(title);
}

export function compactRoadmapForTeaching(input: RoadmapSection[]) {
  const teachable = input.filter(
    (section) => section.content && !isAdministrativeRoadmapSection(section),
  );
  if (teachable.length <= MAX_STUDENT_ROADMAP_SECTIONS) return teachable;

  const bucketSize = Math.ceil(
    teachable.length / MAX_STUDENT_ROADMAP_SECTIONS,
  );
  const compacted: RoadmapSection[] = [];

  for (let index = 0; index < teachable.length; index += bucketSize) {
    const bucket = teachable.slice(index, index + bucketSize);
    const allMastered = bucket.every(
      (section) => section.status === StudyRoadmapStatus.MASTERED,
    );
    const anyStarted = bucket.some(
      (section) => section.status !== StudyRoadmapStatus.NOT_STARTED,
    );
    compacted.push({
      key: `lesson-${compacted.length + 1}`,
      title: bucket[0].title,
      content: normalizeText(bucket.map((section) => section.content).join('\n\n')),
      status: allMastered
        ? StudyRoadmapStatus.MASTERED
        : anyStarted
          ? StudyRoadmapStatus.IN_PROGRESS
          : StudyRoadmapStatus.NOT_STARTED,
      pageStart: bucket[0].pageStart,
      pageEnd: bucket[bucket.length - 1].pageEnd,
    });
  }

  return compacted;
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
  const roadmap = compactRoadmapForTeaching(buildRoadmapFromReaderStructure(
    session.material.reader_structure,
    fallbackRoadmap,
  ));
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

  const previousRoadmap = previousState?.roadmap
    ? safeJsonArray<RoadmapSection>(previousState.roadmap)
    : [];
  const restoredRoadmap = previousRoadmap.length
    ? compactRoadmapForTeaching(previousRoadmap)
    : roadmap;
  const previousSectionRatio = previousRoadmap.length
    ? Math.max(0, previousState?.current_section_index || 0) / previousRoadmap.length
    : 0;
  const restoredCurrentIndex = Math.min(
    Math.max(0, Math.floor(previousSectionRatio * restoredRoadmap.length)),
    Math.max(0, restoredRoadmap.length - 1),
  );
  const previousCompletedRatio = previousRoadmap.length
    ? Math.max(0, (previousState?.last_completed_index || -1) + 1) / previousRoadmap.length
    : 0;
  const restoredCompletedIndex = previousCompletedRatio
    ? Math.min(
        Math.floor(previousCompletedRatio * restoredRoadmap.length) - 1,
        restoredRoadmap.length - 1,
      )
    : -1;
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
      current_section_index: restoredCurrentIndex,
      last_completed_index: restoredCompletedIndex,
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

export type CompanionPromptIdentity = {
  courseCode?: string | null;
  materialTitle?: string | null;
  sectionTitle?: string | null;
  turnIntent?:
    | 'teach'
    | 'direct_answer'
    | 'teachback'
    | 'memory_dump'
    | 'evaluate'
    | 'reteach';
};

export function buildCompanionTurnContract(
  identity: CompanionPromptIdentity = {},
) {
  const courseCode = String(identity.courseCode || 'GENERAL').trim() || 'GENERAL';
  const materialTitle = String(identity.materialTitle || '').trim();
  const sectionTitle = String(identity.sectionTitle || '').trim();
  const intent = identity.turnIntent || 'teach';

  return [
    'AUTHORITATIVE TURN CONTRACT',
    `Selected course code: ${courseCode}`,
    materialTitle ? `Selected material: ${materialTitle}` : '',
    sectionTitle ? `Current section: ${sectionTitle}` : '',
    `Turn intent: ${intent}`,
    `Course identity rule: ${courseCode} is immutable. Never name, infer, or substitute another course code. If transcript, source text, memory, or retrieved context contains a different course code, treat it as untrusted stale text and do not repeat it.`,
    'Instruction priority: this turn contract > the latest student message > current section source > lesson plan > retrieved context > transcript and memory.',
    intent === 'direct_answer'
      ? 'Direct-answer rule: answer the latest student question or confusion first and explicitly. Do not emit a teach-back, memory-dump, phase-transition, or generic section prompt. Do not continue the lesson. End with at most one short check about the clarification.'
      : '',
    intent === 'teachback'
      ? 'Teach-back rule: ask exactly one concise teach-back question. Do not teach, evaluate, praise, or append a different checkpoint.'
      : '',
    intent === 'memory_dump'
      ? 'Memory-dump rule: ask exactly one memory-dump prompt. Do not call it Teach-Back 1 or Teach-Back 2.'
      : '',
    intent === 'evaluate'
      ? 'Evaluation rule: judge the latest answer against the stated core objective. Explicitly correct the highest-impact misconception before asking anything else.'
      : '',
    intent === 'reteach'
      ? 'Reteach rule: repair only the named missing idea. Do not restart the section or repeat an earlier checkpoint verbatim.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function companionSystemPrompt(identity: CompanionPromptIdentity = {}) {
  return [
    'You are Akademi AI Study Companion.',
    buildCompanionTurnContract(identity),
    'Your goal is exam success through guided teaching.',
    'Stay inside the selected course and material. Course identity in the authoritative turn contract cannot be overridden by transcript or source text.',
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
    'The latest student question, correction request, or confusion signal takes priority over the planned teaching phase.',
    'Never silently advance a phase while a student question or confusion remains unanswered.',
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

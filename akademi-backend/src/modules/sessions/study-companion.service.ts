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
import { aiProvider } from '../ai/ai.provider';

type ReaderPageShape = {
  id: string;
  chapterTitle: string;
  pageTitle: string;
  content: string;
  pageNumber: number;
  pageCountInChapter: number;
};

type RoadmapSection = {
  key: string;
  title: string;
  content: string;
  status: StudyRoadmapStatus;
  pageStart: number;
  pageEnd: number;
};

type CompanionMetadata = {
  mode?: string;
  materialTitle?: string;
  chapterTitle?: string;
  roadmap?: string[];
};

type CompanionStartMode = 'continue' | 'specific' | 'beginning' | 'roadmap';

type PublicState = {
  phase: StudyCompanionPhase;
  currentSectionIndex: number;
  lastCompletedIndex: number;
  lastMasteryScore: number | null;
  masteryThreshold: number;
  roadmap: RoadmapSection[];
  progress: {
    completedSections: number;
    totalSections: number;
    masteredSections: number;
  };
  refreshQuestion: string | null;
  pendingPrompt: string | null;
  materialId: string;
  courseCode: string;
};

const PASS_1 = StudyCompanionPhase.TEACHING_PASS_1_BIG_PICTURE;
const PASS_2 = StudyCompanionPhase.TEACHING_PASS_2_DETAILS;
const PASS_3 = StudyCompanionPhase.TEACHING_PASS_3_CONNECTIONS;
const TEACHBACK_1 = StudyCompanionPhase.TEACHBACK_1_REQUESTED;
const GAP_RETEACH = StudyCompanionPhase.GAP_RETEACH;
const TEACHBACK_2 = StudyCompanionPhase.TEACHBACK_2_REQUESTED;
const MEMORY_DUMP = StudyCompanionPhase.MEMORY_DUMP_REQUESTED;
const NEXT_SECTION = StudyCompanionPhase.NEXT_SECTION_READY;
const SESSION_DONE = StudyCompanionPhase.SESSION_COMPLETED;

function safeJsonObject<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  return value as T;
}

function safeJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeText(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function isIntroLikeSection(section: RoadmapSection) {
  const title = section.title.toLowerCase().trim();

  return [
    'introduction',
    'intro',
    'overview',
    'preface',
    'course outline',
    'table of contents',
    'contents',
  ].some((keyword) => title.includes(keyword));
}

function hasEnoughTeachingContent(section: RoadmapSection) {
  const text = normalizeText(section.content || '');
  return text.length >= 500;
}

function findFirstRealTeachingSection(roadmap: RoadmapSection[], startIndex = 0) {
  for (let i = startIndex; i < roadmap.length; i++) {
    const section = roadmap[i];

    if (!isIntroLikeSection(section) && hasEnoughTeachingContent(section)) {
      return i;
    }
  }

  return startIndex;
}

function truncate(value: string, max = 900) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3).trimEnd()}...`;
}

function countKeywordHits(source: string, target: string) {
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

function deriveFailedConcepts(section: RoadmapSection, studentResponse: string) {
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

function computeCoverageScore(section: RoadmapSection, studentResponse: string) {
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

async function generateText(prompt: string, systemPrompt: string, maxTokens = 900) {
  return aiProvider.generateResponse(prompt, {
    systemPrompt,
    maxTokens,
  });
}

export class StudyCompanionService {
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

  private async loadSessionContext(sessionId: string) {
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
        companion_state: true,
      },
    });

    if (!session) throw new Error('Session not found');
    if (!session.material) throw new Error('Material not found for this companion session');

    const state = session.companion_state || (await this.ensureState(session.id));
    if (!state) throw new Error('Companion state is unavailable');

    const roadmap = safeJsonArray<RoadmapSection>(state.roadmap);
    return { session, material: session.material, state, roadmap };
  }

  private sectionAt(roadmap: RoadmapSection[], index: number) {
    return roadmap[Math.max(0, Math.min(index, roadmap.length - 1))];
  }

  private companionSystemPrompt() {
    return [
      'You are Akademi AI Study Companion.',
      'Your goal is exam success through guided teaching.',
      'Stay inside the selected course and material.',
      'Use external knowledge only when the uploaded material is incomplete or unclear, and label it as External support.',
      'Always be structured, clear, patient, and slightly demanding about recall.',
      'Keep replies practical, short, conversational, and ready for a Nigerian university student.',
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
    const { session, material, state, roadmap } = await this.loadSessionContext(sessionId);
    if (!roadmap.length) {
      throw new Error('This material does not have a usable roadmap yet.');
    }

    let nextIndex = 0;
    let nextPhase = PASS_1;
    let refreshQuestion: string | null = null;

    if (mode === 'continue') {
      nextIndex = Math.min(Math.max(state.last_completed_index + 1, 0), roadmap.length - 1);
      if (state.last_completed_index >= 0) {
        const previousSection = this.sectionAt(roadmap, state.last_completed_index);
        refreshQuestion = await generateText(
          `Create one short refresh question from this completed section.\n\nSection title: ${previousSection.title}\n\nSection content:\n${truncate(previousSection.content, 2200)}`,
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
      });
      return {
        content: message,
        metadata: {
          study_companion: await this.getPublicState(sessionId),
        },
      };
    }

    nextIndex = findFirstRealTeachingSection(roadmap, nextIndex);

    const section = this.sectionAt(roadmap, nextIndex);
    roadmap.forEach((item, index) => {
      if (index === nextIndex && item.status === StudyRoadmapStatus.NOT_STARTED) {
        item.status = StudyRoadmapStatus.IN_PROGRESS;
      }
    });

    const introPrompt = [
      `Material title: ${material.title}`,
      `Course code: ${session.course_code || material.course_code || 'GENERAL'}`,
      `Section title: ${section.title}`,
      refreshQuestion ? `Before we continue, ask this refresh question first: ${refreshQuestion}` : 'This is a fresh section start.',
      `Section content:\n${truncate(section.content, 3500)}`,
      'Task: Write the opening tutor message only. Keep it to 2 to 4 short sentences. Welcome the student, name the topic, state the learning goal, and end with a simple line like Ready? Let us begin. Do not teach the full lesson yet. Do not ask the student a question yet.',
    ].join('\n\n');

    const content = await generateText(introPrompt, this.companionSystemPrompt());
    await this.persistRoadmap(state.id, roadmap, {
      current_phase: PASS_1,
      current_section_index: nextIndex,
      pending_prompt: content,
      refresh_question: refreshQuestion,
      refresh_answer: null,
    });

    return {
      content,
      metadata: {
        study_companion: await this.getPublicState(sessionId),
      },
    };
  }

  private async buildTeachingPass(section: RoadmapSection, pass: 1 | 2 | 3) {
    const instructions =
      pass === 1
        ? 'Give Pass 1 only. Keep it focused on one core idea at a time. Explain what this section is about and why it matters for exams. Do not ask the student a question inside the teaching paragraph.'
        : pass === 2
          ? 'Give Pass 2 only. Explain definitions, formulas, steps, and one strong example from this section. Keep it clean and conversational. Do not use markdown.'
          : 'Give Pass 3 only. Connect this section to earlier ideas and likely exam use. Keep it short and natural.'

    const prompt = [
      `Section title: ${section.title}`,
      `Section content:\n${truncate(section.content, 3800)}`,
      instructions,
      'End with one short line that prepares the student for the next phase.',
    ].join('\n\n');

    return generateText(prompt, this.companionSystemPrompt(), 900);
  }

  private async evaluateTeachBack(section: RoadmapSection, studentResponse: string, attemptNumber: number) {
    const heuristicScore = computeCoverageScore(section, studentResponse);
    const prompt = [
      `Section title: ${section.title}`,
      `Section content:\n${truncate(section.content, 3000)}`,
      `Student teach-back attempt ${attemptNumber}:\n${studentResponse}`,
      'Task: Evaluate the teach-back. State what the student got right, what is missing, and what exact idea must be corrected next. Keep it concise and exam-focused.',
    ].join('\n\n');
    const evaluation = await generateText(prompt, this.companionSystemPrompt(), 500);
    return {
      evaluation,
      score: heuristicScore,
      failedConcepts: deriveFailedConcepts(section, studentResponse),
    };
  }

  private async evaluateMemoryDump(section: RoadmapSection, studentResponse: string) {
    const heuristicScore = Math.max(20, computeCoverageScore(section, studentResponse) - 5);
    const prompt = [
      `Section title: ${section.title}`,
      `Section content:\n${truncate(section.content, 3000)}`,
      `Student memory dump:\n${studentResponse}`,
      'Task: Compare the memory dump to the expected knowledge for this section. Briefly identify what was remembered well and what is still missing.',
    ].join('\n\n');
    const evaluation = await generateText(prompt, this.companionSystemPrompt(), 450);
    return {
      evaluation,
      score: heuristicScore,
      failedConcepts: deriveFailedConcepts(section, studentResponse),
    };
  }

  private async buildTeachBackPrompt(section: RoadmapSection, attemptNumber: 1 | 2) {
    const prompt = [
      `Section title: ${section.title}`,
      `Section content:\n${truncate(section.content, 2800)}`,
      attemptNumber === 1
        ? 'Ask the student for Teach-Back 1. Tell them to explain the section in their own words without copying.'
        : 'Ask the student for Teach-Back 2. Tell them to explain again, this time correcting the missing ideas from the first attempt.',
    ].join('\n\n');

    return generateText(prompt, this.companionSystemPrompt(), 220);
  }

  private async buildMemoryDumpPrompt(section: RoadmapSection) {
    return generateText(
      [
        `Section title: ${section.title}`,
        `Section content:\n${truncate(section.content, 2600)}`,
        'Ask the student for a memory dump. Tell them to write or say everything they remember from this section without checking notes.',
      ].join('\n\n'),
      this.companionSystemPrompt(),
      220,
    );
  }

  private async buildGapReteach(section: RoadmapSection, failedConcepts: string[]) {
    return generateText(
      [
        `Section title: ${section.title}`,
        `Section content:\n${truncate(section.content, 3000)}`,
        `Missing or weak ideas:\n${failedConcepts.join('\n') || 'The explanation was too thin.'}`,
        'Task: reteach this section in a simpler way with one easy analogy, then tell the student they will try the teach-back again.',
      ].join('\n\n'),
      this.companionSystemPrompt(),
      650,
    );
  }

  private async buildMasteryOutcome(section: RoadmapSection, score: number, passed: boolean, failedConcepts: string[]) {
    if (passed) {
      return [
        `Mastery check: ${score}%`,
        `You have mastered ${section.title}.`,
        'If you are ready, I will move us to the next section.',
      ].join('\n\n');
    }

    return [
      `Mastery check: ${score}%`,
      `This is below the 80% mastery threshold for ${section.title}.`,
      failedConcepts.length ? `Needs review:\n- ${failedConcepts.join('\n- ')}` : 'Some key ideas are still missing.',
      'I will reteach this section more simply before we test again.',
    ].join('\n\n');
  }

  async handleStudentReply(sessionId: string, studentResponse: string) {
    const { state, roadmap } = await this.loadSessionContext(sessionId);
    const section = this.sectionAt(roadmap, state.current_section_index);
    const trimmed = studentResponse.trim();

    if (!trimmed) {
      throw new Error('Please send a response so Akademi can continue the study flow.');
    }

    if (state.current_phase === PASS_1) {
      const content = await this.buildTeachingPass(section, 2);
      await this.persistRoadmap(state.id, roadmap, {
        current_phase: PASS_2,
        pending_prompt: content,
      });
      return { content, metadata: { study_companion: await this.getPublicState(sessionId) } };
    }

    if (state.current_phase === PASS_2) {
      const content = await this.buildTeachingPass(section, 3);
      await this.persistRoadmap(state.id, roadmap, {
        current_phase: PASS_3,
        pending_prompt: content,
      });
      return { content, metadata: { study_companion: await this.getPublicState(sessionId) } };
    }

    if (state.current_phase === PASS_3) {
      const content = await this.buildTeachBackPrompt(section, 1);
      await this.persistRoadmap(state.id, roadmap, {
        current_phase: TEACHBACK_1,
        pending_prompt: content,
      });
      return { content, metadata: { study_companion: await this.getPublicState(sessionId) } };
    }

    if (state.current_phase === TEACHBACK_1) {
      const evaluation = await this.evaluateTeachBack(section, trimmed, 1);
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

      const reteach = await this.buildGapReteach(section, evaluation.failedConcepts);
      const followUpPrompt = await this.buildTeachBackPrompt(section, 2);
      const content = [evaluation.evaluation, '', reteach, '', followUpPrompt].join('\n\n');
      await this.persistRoadmap(state.id, roadmap, {
        current_phase: TEACHBACK_2,
        pending_prompt: content,
      });
      return { content, metadata: { study_companion: await this.getPublicState(sessionId) } };
    }

    if (state.current_phase === TEACHBACK_2) {
      const evaluation = await this.evaluateTeachBack(section, trimmed, 2);
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

      const memoryDumpPrompt = await this.buildMemoryDumpPrompt(section);
      const content = [evaluation.evaluation, '', memoryDumpPrompt].join('\n\n');
      await this.persistRoadmap(state.id, roadmap, {
        current_phase: MEMORY_DUMP,
        pending_prompt: content,
      });
      return { content, metadata: { study_companion: await this.getPublicState(sessionId) } };
    }

    if (state.current_phase === MEMORY_DUMP) {
      const evaluation = await this.evaluateMemoryDump(section, trimmed);
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

      if (passed) {
        roadmap[state.current_section_index] = {
          ...section,
          status: StudyRoadmapStatus.MASTERED,
        };
        const hasNextSection = state.current_section_index < roadmap.length - 1;
        const content = await this.buildMasteryOutcome(section, finalScore, true, failedConcepts);
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: hasNextSection ? NEXT_SECTION : SESSION_DONE,
          last_completed_index: state.current_section_index,
          last_mastery_score: finalScore,
          pending_prompt: content,
          session_summary: hasNextSection ? null : `Completed all ${roadmap.length} sections.`,
        });
        return { content, metadata: { study_companion: await this.getPublicState(sessionId) } };
      }

      roadmap[state.current_section_index] = {
        ...section,
        status: StudyRoadmapStatus.NEEDS_REVIEW,
      };
      const outcome = await this.buildMasteryOutcome(section, finalScore, false, failedConcepts);
      const reteach = await this.buildGapReteach(section, failedConcepts);
      const teachBackAgain = await this.buildTeachBackPrompt(section, 2);
      const content = [outcome, '', reteach, '', teachBackAgain].join('\n\n');
      await this.persistRoadmap(state.id, roadmap, {
        current_phase: TEACHBACK_2,
        last_mastery_score: finalScore,
        pending_prompt: content,
      });
      return { content, metadata: { study_companion: await this.getPublicState(sessionId) } };
    }

    if (state.current_phase === NEXT_SECTION) {
      if (/skip/i.test(trimmed)) {
        const nextIndex = Math.min(state.current_section_index + 1, roadmap.length - 1);
        const nextSection = this.sectionAt(roadmap, nextIndex);
        roadmap[nextIndex] = {
          ...nextSection,
          status: StudyRoadmapStatus.IN_PROGRESS,
        };
        const content = await this.buildTeachingPass(nextSection, 1);
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: PASS_1,
          current_section_index: nextIndex,
          pending_prompt: content,
        });
        return { content, metadata: { study_companion: await this.getPublicState(sessionId) } };
      }

      const affirmative = /(yes|continue|next|move on|go on|ready)/i.test(trimmed);
      if (affirmative && state.current_section_index < roadmap.length - 1) {
        const nextIndex = state.current_section_index + 1;
        const nextSection = this.sectionAt(roadmap, nextIndex);
        roadmap[nextIndex] = {
          ...nextSection,
          status: StudyRoadmapStatus.IN_PROGRESS,
        };
        const content = await this.buildTeachingPass(nextSection, 1);
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: PASS_1,
          current_section_index: nextIndex,
          pending_prompt: content,
        });
        return { content, metadata: { study_companion: await this.getPublicState(sessionId) } };
      }

      return {
        content: 'Reply with "continue" when you are ready for the next section, or tell me which section you want to revisit.',
        metadata: { study_companion: await this.getPublicState(sessionId) },
      };
    }

    if (state.current_phase === SESSION_DONE) {
      return {
        content: 'You have completed this material roadmap. If you want, reply with the section name you want to review and I will reopen it for targeted revision.',
        metadata: { study_companion: await this.getPublicState(sessionId) },
      };
    }

    const fallback = await this.buildTeachBackPrompt(section, 1);
    await this.persistRoadmap(state.id, roadmap, {
      current_phase: TEACHBACK_1,
      pending_prompt: fallback,
    });
    return { content: fallback, metadata: { study_companion: await this.getPublicState(sessionId) } };
  }
}

export const studyCompanionService = new StudyCompanionService();

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

type TeacherBrainSummary = {
  material_title?: string;
  overall_summary?: string;
  main_learning_goal?: string;
  difficulty_level?: string;
  recommended_study_order?: string[];
};

type TeacherBrainChapterSummary = {
  section_index?: number;
  title?: string;
  summary?: string;
  key_points?: string[];
  why_it_matters?: string;
  connects_to?: string[];
};

type TeacherBrainConcept = {
  concept?: string;
  depends_on?: string[];
  leads_to?: string[];
  section_indexes?: number[];
  importance?: 'low' | 'medium' | 'high' | string;
};

type TeacherBrainPrerequisite = {
  concept?: string;
  needed_for?: string;
  section_index?: number;
  student_should_know?: string;
};

type TeacherBrainFormula = {
  name?: string;
  formula_latex?: string;
  variables?: string[];
  section_index?: number;
  when_to_use?: string;
};

type TeacherBrainCalculationMethod = {
  topic?: string;
  section_index?: number;
  method_steps?: string[];
  worked_example_summary?: string;
  common_mistakes?: string[];
  unit_or_answer_format?: string;
};

type TeacherBrainDiagram = {
  title?: string;
  section_index?: number;
  diagram_type?: string;
  description?: string;
  when_to_show?: string;
  student_should_notice?: string[];
};

type TeacherBrainMisconception = {
  misconception?: string;
  correction?: string;
  section_index?: number;
};

type TeacherBrainExamAngle = {
  section_index?: number;
  likely_question_type?: string;
  what_examiner_tests?: string;
  how_to_answer?: string;
};

type TeacherBrainNotes = {
  teaching_style?: string;
  best_analogies?: string[];
  sections_that_need_extra_care?: string[];
  calculation_heavy_sections?: number[];
  diagram_heavy_sections?: number[];
  recommended_teaching_sequence?: string[];
};

type ParsedTeacherBrain = {
  summary: TeacherBrainSummary;
  chapterSummaries: TeacherBrainChapterSummary[];
  conceptGraph: TeacherBrainConcept[];
  prerequisites: TeacherBrainPrerequisite[];
  formulas: TeacherBrainFormula[];
  calculationMethods: TeacherBrainCalculationMethod[];
  diagrams: TeacherBrainDiagram[];
  misconceptions: TeacherBrainMisconception[];
  examAngles: TeacherBrainExamAngle[];
  teacherNotes: TeacherBrainNotes;
  subjectFamily: string | null;
  confidence: number;
};

type TeacherBrainSectionContext = {
  currentChapterSummary?: TeacherBrainChapterSummary | null;
  previousChapterSummary?: TeacherBrainChapterSummary | null;
  nextChapterSummary?: TeacherBrainChapterSummary | null;
  concepts: TeacherBrainConcept[];
  prerequisites: TeacherBrainPrerequisite[];
  formulas: TeacherBrainFormula[];
  calculationMethods: TeacherBrainCalculationMethod[];
  diagrams: TeacherBrainDiagram[];
  misconceptions: TeacherBrainMisconception[];
  examAngles: TeacherBrainExamAngle[];
  teacherNotes: TeacherBrainNotes;
  subjectFamily?: string | null;
  confidence?: number;
};

type CalculationTeachingContext = {
  detected: boolean;
  formulas: TeacherBrainFormula[];
  calculationMethods: TeacherBrainCalculationMethod[];
  prerequisites: TeacherBrainPrerequisite[];
  likelyEquations: string[];
  commonMistakes: string[];
  unitFormats: string[];
  workedExamples: string[];
  subjectFamily: string | null;
  summary: string;
};

type DiagramTeachingContext = {
  detected: boolean;
  diagrams: TeacherBrainDiagram[];
  imageDescriptions: string[];
  subjectFamily: string | null;
  summary: string;
};

type CompanionMetadata = {
  mode?: string;
  materialTitle?: string;
  chapterTitle?: string;
  roadmap?: string[];
};

type CompanionResponseMetadata = {
  autoContinue?: boolean;
  waitForStudent?: boolean;
  nextAction?: 'continue_teaching' | 'evaluate_answer' | 'ask_followup' | 'move_next';
  turnType?: 'teaching' | 'checkpoint_question' | 'evaluation' | 'reteach' | 'transition';
  allowInterruption?: boolean;
  questionCount?: number;
  study_companion: PublicState | null;
};

type SectionContext = {
  pass3QuestionPending?: boolean;
  reteachDelivered?: boolean;
  nextPromptKind?: 'teachback_2' | 'memory_dump';
  failedConcepts?: string[];
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

function readSectionContext(value: unknown): SectionContext {
  return safeJsonObject<SectionContext>(value, {});
}

function questionCountForContent(content: string) {
  const matches = content.match(/\?/g);
  return matches ? matches.length : 0;
}

function trimAfterFirstQuestion(content: string) {
  const index = content.indexOf('?');
  if (index < 0) return content.trim();
  return content.slice(0, index + 1).trim();
}

function sanitizeSingleQuestionTurn(content: string) {
  return trimAfterFirstQuestion(normalizeText(content));
}

function removeAccidentalTeachingQuestions(content: string) {
  const normalized = normalizeText(content);
  if (!normalized.includes('?')) return normalized;

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => !sentence.includes('?'));

  return (sentences.join(' ') || normalized.slice(0, normalized.indexOf('?'))).trim();
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

function truncateList(items: string[], limit = 4, max = 180) {
  return items
    .map((item) => truncate(String(item || '').trim(), max))
    .filter(Boolean)
    .slice(0, limit);
}

function safeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function parseTeacherBrain(value: unknown): ParsedTeacherBrain | null {
  const source = safeJsonObject<Record<string, unknown> | null>(value, null);
  if (!source) return null;

  const summary = safeJsonObject<TeacherBrainSummary>(source.summary, {});
  const chapterSummaries = safeJsonArray<Record<string, unknown>>(source.chapter_summaries).map((item) => ({
    section_index: Number(item.section_index),
    title: String(item.title || ''),
    summary: String(item.summary || ''),
    key_points: safeStringArray(item.key_points),
    why_it_matters: String(item.why_it_matters || ''),
    connects_to: safeStringArray(item.connects_to),
  }));

  const conceptGraph = safeJsonArray<Record<string, unknown>>(source.concept_graph).map((item) => ({
    concept: String(item.concept || ''),
    depends_on: safeStringArray(item.depends_on),
    leads_to: safeStringArray(item.leads_to),
    section_indexes: Array.isArray(item.section_indexes)
      ? item.section_indexes.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
      : [],
    importance: String(item.importance || 'medium'),
  }));

  const prerequisites = safeJsonArray<Record<string, unknown>>(source.prerequisites).map((item) => ({
    concept: String(item.concept || ''),
    needed_for: String(item.needed_for || ''),
    section_index: Number(item.section_index),
    student_should_know: String(item.student_should_know || ''),
  }));

  const formulas = safeJsonArray<Record<string, unknown>>(source.formulas).map((item) => ({
    name: String(item.name || ''),
    formula_latex: String(item.formula_latex || ''),
    variables: safeStringArray(item.variables),
    section_index: Number(item.section_index),
    when_to_use: String(item.when_to_use || ''),
  }));

  const calculationMethods = safeJsonArray<Record<string, unknown>>(source.calculation_methods).map((item) => ({
    topic: String(item.topic || ''),
    section_index: Number(item.section_index),
    method_steps: safeStringArray(item.method_steps),
    worked_example_summary: String(item.worked_example_summary || ''),
    common_mistakes: safeStringArray(item.common_mistakes),
    unit_or_answer_format: String(item.unit_or_answer_format || ''),
  }));

  const diagrams = safeJsonArray<Record<string, unknown>>(source.diagrams).map((item) => ({
    title: String(item.title || ''),
    section_index: Number(item.section_index),
    diagram_type: String(item.diagram_type || ''),
    description: String(item.description || ''),
    when_to_show: String(item.when_to_show || ''),
    student_should_notice: safeStringArray(item.student_should_notice),
  }));

  const misconceptions = safeJsonArray<Record<string, unknown>>(source.misconceptions).map((item) => ({
    misconception: String(item.misconception || ''),
    correction: String(item.correction || ''),
    section_index: Number(item.section_index),
  }));

  const examAngles = safeJsonArray<Record<string, unknown>>(source.exam_angles).map((item) => ({
    section_index: Number(item.section_index),
    likely_question_type: String(item.likely_question_type || ''),
    what_examiner_tests: String(item.what_examiner_tests || ''),
    how_to_answer: String(item.how_to_answer || ''),
  }));

  const teacherNotesSource = safeJsonObject<Record<string, unknown>>(source.teacher_notes, {});
  const teacherNotes: TeacherBrainNotes = {
    teaching_style: String(teacherNotesSource.teaching_style || ''),
    best_analogies: safeStringArray(teacherNotesSource.best_analogies),
    sections_that_need_extra_care: safeStringArray(teacherNotesSource.sections_that_need_extra_care),
    calculation_heavy_sections: Array.isArray(teacherNotesSource.calculation_heavy_sections)
      ? teacherNotesSource.calculation_heavy_sections
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry))
      : [],
    diagram_heavy_sections: Array.isArray(teacherNotesSource.diagram_heavy_sections)
      ? teacherNotesSource.diagram_heavy_sections
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry))
      : [],
    recommended_teaching_sequence: safeStringArray(teacherNotesSource.recommended_teaching_sequence),
  };

  return {
    summary: {
      material_title: String(summary.material_title || ''),
      overall_summary: String(summary.overall_summary || ''),
      main_learning_goal: String(summary.main_learning_goal || ''),
      difficulty_level: String(summary.difficulty_level || ''),
      recommended_study_order: safeStringArray(summary.recommended_study_order),
    },
    chapterSummaries,
    conceptGraph,
    prerequisites,
    formulas,
    calculationMethods,
    diagrams,
    misconceptions,
    examAngles,
    teacherNotes,
    subjectFamily: source.subject_family ? String(source.subject_family) : null,
    confidence: Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : 50,
  };
}

function getTeacherBrainSectionContext(
  teacherBrain: ParsedTeacherBrain | null,
  sectionIndex: number,
  sectionTitle: string,
): TeacherBrainSectionContext {
  if (!teacherBrain) {
    return {
      currentChapterSummary: null,
      previousChapterSummary: null,
      nextChapterSummary: null,
      concepts: [],
      prerequisites: [],
      formulas: [],
      calculationMethods: [],
      diagrams: [],
      misconceptions: [],
      examAngles: [],
      teacherNotes: {
        teaching_style: '',
        best_analogies: [],
        sections_that_need_extra_care: [],
        calculation_heavy_sections: [],
        diagram_heavy_sections: [],
        recommended_teaching_sequence: [],
      },
    };
  }

  const normalizedCurrentTitle = normalizeTitle(sectionTitle);
  const chapterMatch = (entry: TeacherBrainChapterSummary) =>
    entry.section_index === sectionIndex ||
    normalizeTitle(String(entry.title || '')) === normalizedCurrentTitle;

  const currentChapterSummary = teacherBrain.chapterSummaries.find(chapterMatch) || null;
  const previousChapterSummary =
    teacherBrain.chapterSummaries.find((item) => item.section_index === sectionIndex - 1) || null;
  const nextChapterSummary =
    teacherBrain.chapterSummaries.find((item) => item.section_index === sectionIndex + 1) || null;

  const concepts = teacherBrain.conceptGraph.filter((item) =>
    (item.section_indexes || []).includes(sectionIndex),
  );

  const prerequisites = teacherBrain.prerequisites.filter((item) => item.section_index === sectionIndex);
  const formulas = teacherBrain.formulas.filter((item) => item.section_index === sectionIndex);
  const calculationMethods = teacherBrain.calculationMethods.filter((item) => item.section_index === sectionIndex);
  const diagrams = teacherBrain.diagrams.filter((item) => item.section_index === sectionIndex);
  const misconceptions = teacherBrain.misconceptions.filter((item) => item.section_index === sectionIndex);
  const examAngles = teacherBrain.examAngles.filter((item) => item.section_index === sectionIndex);

  return {
    currentChapterSummary,
    previousChapterSummary,
    nextChapterSummary,
    concepts,
    prerequisites,
    formulas,
    calculationMethods,
    diagrams,
    misconceptions,
    examAngles,
    teacherNotes: teacherBrain.teacherNotes,
    subjectFamily: teacherBrain.subjectFamily,
    confidence: teacherBrain.confidence,
  };
}

function hasMathNotation(text: string) {
  return /[=+\-*/^%<>]|\\\(|\\\[|\\frac|\\sum|\\int|≤|≥|≈|π|σ|μ|Δ|∑|√/.test(text);
}

function extractLikelyEquations(text: string) {
  const matches = text.match(/(?:\\\([^)]+\\\)|\\\[[^\]]+\\\]|[A-Za-z][A-Za-z0-9_\s]{0,12}=\s*[^,.;\n]{2,80}|\b\d+(?:\.\d+)?\s*(?:%|kg|g|mg|m|cm|mm|km|s|min|hr|hours|naira|n|pa|j|w|v|a|mol|l)\b)/g) || [];
  return truncateList(matches.map((item) => item.replace(/\s+/g, ' ').trim()), 5, 100);
}

function isCalculationHeavySection(section: RoadmapSection, teacherBrainContext: TeacherBrainSectionContext) {
  const subjectFamily = teacherBrainContext.subjectFamily || '';
  const calculationFamilies = new Set([
    'mathematics',
    'statistics',
    'engineering',
    'economics',
    'finance',
    'physics',
    'chemistry',
    'computer_science',
    'cybersecurity',
    'agriculture',
  ]);

  if (teacherBrainContext.formulas.length || teacherBrainContext.calculationMethods.length) {
    return true;
  }

  if (calculationFamilies.has(subjectFamily)) {
    return true;
  }

  const content = `${section.title}\n${section.content}`.toLowerCase();
  const quantitativePatterns = [
    /\bmean\b|\bmedian\b|\bmode\b|\bvariance\b|\bstandard deviation\b|\bprobability\b/,
    /\binterest\b|\bdiscount\b|\bpresent value\b|\bfuture value\b|\belasticity\b|\bcost\b|\brevenue\b/,
    /\bforce\b|\bvelocity\b|\bacceleration\b|\bdensity\b|\bmolar\b|\bconcentration\b|\bpressure\b/,
    /\balgorithmic complexity\b|\bbig o\b|\bhash\b|\bencryption\b|\bthroughput\b/,
    /\bpercentage\b|\bratio\b|\brate\b|\bunit\b|\bsolve\b|\bcalculate\b|\bsubstitute\b/,
    /\bkg\b|\bg\b|\bmg\b|\bmol\b|\blitre\b|\bl\b|\bcm\b|\bmm\b|\bkm\b|\bnaira\b|\bseconds?\b|\bminutes?\b/,
  ];

  return hasMathNotation(content) || quantitativePatterns.some((pattern) => pattern.test(content));
}

function buildCalculationTeachingContext(section: RoadmapSection, teacherBrainContext: TeacherBrainSectionContext): CalculationTeachingContext {
  const likelyEquations = extractLikelyEquations(section.content);
  const commonMistakes = truncateList(
    teacherBrainContext.calculationMethods.flatMap((item) => item.common_mistakes || []),
    5,
    100,
  );
  const unitFormats = truncateList(
    teacherBrainContext.calculationMethods
      .map((item) => item.unit_or_answer_format || '')
      .filter(Boolean),
    4,
    100,
  );
  const workedExamples = truncateList(
    teacherBrainContext.calculationMethods
      .map((item) => item.worked_example_summary || '')
      .filter(Boolean),
    4,
    140,
  );

  const lines: string[] = [];
  if (teacherBrainContext.formulas.length) {
    lines.push(`Formulas: ${truncateList(teacherBrainContext.formulas.map((item) => `${item.name}: ${item.formula_latex}; variables: ${(item.variables || []).join(', ')}; use: ${item.when_to_use}`), 4, 180).join(' | ')}`);
  }
  if (teacherBrainContext.calculationMethods.length) {
    lines.push(`Methods: ${truncateList(teacherBrainContext.calculationMethods.map((item) => `${item.topic}; steps: ${(item.method_steps || []).slice(0, 5).join(' -> ')}`), 4, 180).join(' | ')}`);
  }
  if (workedExamples.length) {
    lines.push(`Worked examples: ${workedExamples.join(' | ')}`);
  }
  if (commonMistakes.length) {
    lines.push(`Common mistakes: ${commonMistakes.join(' | ')}`);
  }
  if (unitFormats.length) {
    lines.push(`Unit or answer format: ${unitFormats.join(' | ')}`);
  }
  if (likelyEquations.length) {
    lines.push(`Likely equations from section: ${likelyEquations.join(' | ')}`);
  }
  if (teacherBrainContext.prerequisites.length) {
    lines.push(`Prerequisites before solving: ${truncateList(teacherBrainContext.prerequisites.map((item) => `${item.concept}: ${item.student_should_know}`), 4, 120).join(' | ')}`);
  }

  return {
    detected: isCalculationHeavySection(section, teacherBrainContext),
    formulas: teacherBrainContext.formulas,
    calculationMethods: teacherBrainContext.calculationMethods,
    prerequisites: teacherBrainContext.prerequisites,
    likelyEquations,
    commonMistakes,
    unitFormats,
    workedExamples,
    subjectFamily: teacherBrainContext.subjectFamily || null,
    summary: lines.join('\n'),
  };
}

function buildCalculationInstructions(pass: 1 | 2 | 3, calculationContext: CalculationTeachingContext) {
  if (!calculationContext.detected) return '';

  if (pass === 1) {
    return [
      'Calculation teaching mode: Pass 1.',
      'Explain the big idea behind the calculation.',
      'Explain what problem type the formula or method solves.',
      'Do not solve a full problem unless the section itself clearly requires it.',
      'Avoid asking questions.',
    ].join(' ');
  }

  if (pass === 2) {
    return [
      'Calculation teaching mode: Pass 2.',
      'Teach the formula or method step by step.',
      'Define each variable before substitution.',
      'Show the solving order clearly.',
      'Include one short worked example if possible.',
      'Preserve formulas using LaTeX delimiters.',
    ].join(' ');
  }

  return [
    'Calculation teaching mode: Pass 3.',
    'Connect the calculation to exam use.',
    'Explain common traps and how to recognize when to apply the method.',
    'Mention units, final answer format, or interpretation where relevant.',
    'Avoid asking questions.',
  ].join(' ');
}

function isDiagramHeavySection(section: RoadmapSection, teacherBrainContext: TeacherBrainSectionContext) {
  const subjectFamily = teacherBrainContext.subjectFamily || '';
  const diagramFamilies = new Set([
    'biology',
    'medicine',
    'engineering',
    'agriculture',
    'geography',
    'chemistry',
    'computer_science',
    'cybersecurity',
    'economics',
    'statistics',
  ]);

  if (teacherBrainContext.diagrams.length) {
    return true;
  }

  if (diagramFamilies.has(subjectFamily)) {
    return true;
  }

  const content = `${section.title}\n${section.content}`.toLowerCase();
  return /\bdiagram\b|\bfigure\b|\bchart\b|\btable\b|\bgraph\b|\bcurve\b|\bmap\b|\bflowchart\b|\bprocess\b|\baxis\b|\bx-axis\b|\by-axis\b|\barrow\b|\blabel\b|\bimage caption\b|\bimage description\b/.test(content);
}

function buildDiagramTeachingContext(section: RoadmapSection, teacherBrainContext: TeacherBrainSectionContext): DiagramTeachingContext {
  const imageDescriptions = truncateList(
    section.content
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => /^image (caption|description)|^alt text|^figure|^diagram|^chart|^graph/i.test(line)),
    5,
    160,
  );

  const lines: string[] = [];
  if (teacherBrainContext.diagrams.length) {
    lines.push(
      `Diagrams: ${truncateList(
        teacherBrainContext.diagrams.map((item) =>
          `${item.title} (${item.diagram_type}) | section ${Number(item.section_index) + 1} | ${item.description} | when: ${item.when_to_show} | notice: ${(item.student_should_notice || []).slice(0, 3).join(', ')}`,
        ),
        4,
        220,
      ).join(' | ')}`,
    );
  }
  if (imageDescriptions.length) {
    lines.push(`Image descriptions already in content: ${imageDescriptions.join(' | ')}`);
  }

  return {
    detected: isDiagramHeavySection(section, teacherBrainContext),
    diagrams: teacherBrainContext.diagrams,
    imageDescriptions,
    subjectFamily: teacherBrainContext.subjectFamily || null,
    summary: lines.join('\n'),
  };
}

function buildDiagramInstructions(pass: 1 | 2 | 3, diagramContext: DiagramTeachingContext) {
  if (!diagramContext.detected) return '';

  if (pass === 1) {
    return [
      'Diagram teaching mode: Pass 1.',
      'Introduce the visual idea.',
      'Explain why the diagram matters.',
      'Describe the big picture without too much detail.',
      'Use imagine or picture instead of claiming an image is on screen.',
    ].join(' ');
  }

  if (pass === 2) {
    return [
      'Diagram teaching mode: Pass 2.',
      'Walk through the diagram or process step by step.',
      'Explain labels, parts, arrows, axes, stages, or relationships.',
      'For graphs, explain x-axis, y-axis, trend, slope, peak, movement, or comparison where relevant.',
      'For anatomy or biology, explain parts and functions.',
      'For engineering or computer science, explain flow, components, inputs, outputs, or system behavior.',
    ].join(' ');
  }

  return [
    'Diagram teaching mode: Pass 3.',
    'Connect the diagram to exam use.',
    'Explain what examiners usually ask from the diagram.',
    'Highlight common visual mistakes or mislabeling.',
    'Explain how the student should reproduce or interpret the diagram.',
  ].join(' ');
}

function buildTeacherBrainPromptContext(
  teacherBrain: ParsedTeacherBrain | null,
  currentSectionIndex: number,
  roadmap: RoadmapSection[],
) {
  if (!teacherBrain) return '';

  const currentSection = roadmap[Math.max(0, Math.min(currentSectionIndex, roadmap.length - 1))];
  const sectionContext = getTeacherBrainSectionContext(teacherBrain, currentSectionIndex, currentSection?.title || '');
  const lines: string[] = [];

  if (teacherBrain.summary.overall_summary) {
    lines.push(`Overall material summary: ${truncate(teacherBrain.summary.overall_summary, 320)}`);
  }
  if (teacherBrain.summary.main_learning_goal) {
    lines.push(`Main learning goal: ${truncate(teacherBrain.summary.main_learning_goal, 180)}`);
  }
  if (teacherBrain.subjectFamily) {
    lines.push(`Subject family: ${teacherBrain.subjectFamily}`);
  }
  if (teacherBrain.summary.recommended_study_order?.length) {
    lines.push(`Recommended study order: ${truncateList(teacherBrain.summary.recommended_study_order, 6, 80).join(' | ')}`);
  }
  if (sectionContext.currentChapterSummary?.summary) {
    lines.push(`Current chapter summary: ${truncate(sectionContext.currentChapterSummary.summary, 220)}`);
  }
  if (sectionContext.previousChapterSummary?.summary) {
    lines.push(`Previous section bridge: ${truncate(sectionContext.previousChapterSummary.summary, 140)}`);
  }
  if (sectionContext.nextChapterSummary?.summary) {
    lines.push(`Next section preview: ${truncate(sectionContext.nextChapterSummary.summary, 140)}`);
  }
  if (sectionContext.concepts.length) {
    lines.push(`Connected concepts: ${truncateList(sectionContext.concepts.map((item) => `${item.concept} (${item.importance})`), 5, 90).join(' | ')}`);
  }
  if (sectionContext.prerequisites.length) {
    lines.push(`Prerequisites: ${truncateList(sectionContext.prerequisites.map((item) => `${item.concept}: ${item.student_should_know}`), 4, 120).join(' | ')}`);
  }
  if (sectionContext.formulas.length) {
    lines.push(`Formulas: ${truncateList(sectionContext.formulas.map((item) => `${item.name}: ${item.formula_latex} | use: ${item.when_to_use}`), 4, 140).join(' | ')}`);
  }
  if (sectionContext.calculationMethods.length) {
    lines.push(`Calculation methods: ${truncateList(sectionContext.calculationMethods.map((item) => `${item.topic} | steps: ${(item.method_steps || []).slice(0, 4).join(' -> ')} | mistakes: ${(item.common_mistakes || []).slice(0, 2).join(', ')}`), 3, 180).join(' | ')}`);
  }
  if (sectionContext.diagrams.length) {
    lines.push(`Diagrams: ${truncateList(sectionContext.diagrams.map((item) => `${item.title} (${item.diagram_type}) - ${item.description}`), 3, 140).join(' | ')}`);
  }
  if (sectionContext.misconceptions.length) {
    lines.push(`Common misconceptions: ${truncateList(sectionContext.misconceptions.map((item) => `${item.misconception} -> ${item.correction}`), 3, 140).join(' | ')}`);
  }
  if (sectionContext.examAngles.length) {
    lines.push(`Exam angles: ${truncateList(sectionContext.examAngles.map((item) => `${item.likely_question_type}: ${item.what_examiner_tests}`), 3, 140).join(' | ')}`);
  }

  const notes: string[] = [];
  if (sectionContext.teacherNotes.teaching_style) {
    notes.push(`style: ${truncate(sectionContext.teacherNotes.teaching_style, 120)}`);
  }
  if ((sectionContext.teacherNotes.best_analogies || []).length) {
    notes.push(`analogies: ${truncateList(sectionContext.teacherNotes.best_analogies || [], 2, 80).join(', ')}`);
  }
  if ((sectionContext.teacherNotes.sections_that_need_extra_care || []).some((item) => normalizeTitle(item) === normalizeTitle(currentSection?.title || ''))) {
    notes.push('this section needs extra care');
  }
  if ((sectionContext.teacherNotes.calculation_heavy_sections || []).includes(currentSectionIndex)) {
    notes.push('calculation-heavy section');
  }
  if ((sectionContext.teacherNotes.diagram_heavy_sections || []).includes(currentSectionIndex)) {
    notes.push('diagram-heavy section');
  }
  if (notes.length) {
    lines.push(`Teacher notes: ${notes.join(' | ')}`);
  }

  return lines.join('\n');
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
    return { session, material: session.material, state, roadmap, teacherBrain };
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
      'You understand the whole material through Teacher Brain context.',
      'Use the current section content as the source of truth.',
      'Use Teacher Brain for continuity, prerequisite awareness, exam angles, misconceptions, calculations, and diagram planning.',
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
    const { session, material, state, roadmap, teacherBrain } = await this.loadSessionContext(sessionId);
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
    const teacherBrainContext = buildTeacherBrainPromptContext(teacherBrain, nextIndex, roadmap);
    roadmap.forEach((item, index) => {
      if (index === nextIndex && item.status === StudyRoadmapStatus.NOT_STARTED) {
        item.status = StudyRoadmapStatus.IN_PROGRESS;
      }
    });

    const introPrompt = [
      `Material title: ${material.title}`,
      `Course code: ${session.course_code || material.course_code || 'GENERAL'}`,
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      refreshQuestion ? `Before we continue, ask this refresh question first: ${refreshQuestion}` : 'This is a fresh section start.',
      `Section content:\n${truncate(section.content, 3500)}`,
      'Task: Write the opening tutor message and begin the lesson naturally. Keep the opening to 2 to 4 short sentences. Welcome the student, name the topic, state the learning goal, then move straight into the first teaching idea. Do not ask for permission to begin. Do not say Ready? or Let us begin. Do not ask the student a question yet.',
    ].join('\n\n');

    if (teacherBrainContext) {
      console.log('teacher_brain_context_applied', {
        sessionId,
        materialId: material.id,
        sectionIndex: nextIndex,
        prompt: 'start_intro',
      });
    }
    const content = await generateText(introPrompt, this.companionSystemPrompt());
    await this.persistRoadmap(state.id, roadmap, {
      current_phase: PASS_1,
      current_section_index: nextIndex,
      pending_prompt: content,
      refresh_question: refreshQuestion,
      refresh_answer: null,
      section_context: {} as Prisma.InputJsonValue,
    });

    return {
      content,
      metadata: await this.buildTurnMetadata(sessionId, 'transition', {
        nextAction: 'continue_teaching',
        questionCount: questionCountForContent(content),
      }),
    };
  }

  async handleTutorContinue(sessionId: string) {
    return this.handleStudentReply(sessionId, '__AUTO_CONTINUE__');
  }

  private async buildTeachingPass(section: RoadmapSection, pass: 1 | 2 | 3, teacherBrainContext = '', contextMeta?: { sessionId: string; materialId: string; sectionIndex: number }, teacherBrainSectionContext?: TeacherBrainSectionContext) {
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
    const instructions =
      calculationContext.detected
        ? buildCalculationInstructions(pass, calculationContext)
        : diagramContext.detected
          ? buildDiagramInstructions(pass, diagramContext)
          : pass === 1
            ? 'Give Pass 1 only. Keep it focused on one core idea at a time. Explain what this section is about and why it matters for exams. Do not ask any question. Do not include a question mark. End with a statement.'
            : pass === 2
              ? 'Give Pass 2 only. Explain definitions, formulas, steps, and one strong example from this section. Keep it clean and conversational. Do not use markdown. Do not ask any question. Do not include a question mark. End with a statement.'
              : 'Give Pass 3 only. Connect this section to earlier ideas and likely exam use. Keep it short and natural. Do not ask any question. Do not include a question mark. End with a statement.'

    const prompt = [
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      calculationContext.detected ? `Calculation context:\n${calculationContext.summary}` : '',
      diagramContext.detected ? `Diagram context:\n${diagramContext.summary}` : '',
      `Section content:\n${truncate(section.content, 3800)}`,
      instructions,
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
    const content = await generateText(prompt, this.companionSystemPrompt(), 900);
    return removeAccidentalTeachingQuestions(content);
  }

  private async evaluateTeachBack(section: RoadmapSection, studentResponse: string, attemptNumber: number, teacherBrainContext = '', contextMeta?: { sessionId: string; materialId: string; sectionIndex: number }, teacherBrainSectionContext?: TeacherBrainSectionContext) {
    const heuristicScore = computeCoverageScore(section, studentResponse);
    const calculationContext = buildCalculationTeachingContext(
      section,
      teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
    );
    const diagramContext = buildDiagramTeachingContext(
      section,
      teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
    );
    const prompt = [
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      calculationContext.detected ? `Calculation context:\n${calculationContext.summary}` : '',
      diagramContext.detected ? `Diagram context:\n${diagramContext.summary}` : '',
      `Section content:\n${truncate(section.content, 3000)}`,
      `Student teach-back attempt ${attemptNumber}:\n${studentResponse}`,
      calculationContext.detected
        ? 'Task: Evaluate the teach-back. Check whether the student identified the correct formula or method, explained variables, explained solving order, mentioned units or interpretation, avoided common mistakes, and understood when to apply the method. State what was right, what is missing, and what exact idea must be corrected next.'
        : diagramContext.detected
          ? 'Task: Evaluate the teach-back. Check whether the student named the key parts, explained relationships, understood sequence or flow, explained functions, and avoided common label or process mistakes. State what was right, what is missing, and what exact idea must be corrected next.'
          : 'Task: Evaluate the teach-back. State what the student got right, what is missing, and what exact idea must be corrected next. Keep it concise and exam-focused.',
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
    const evaluation = await generateText(prompt, this.companionSystemPrompt(), 500);
    return {
      evaluation,
      score: heuristicScore,
      failedConcepts: deriveFailedConcepts(section, studentResponse),
    };
  }

  private async evaluateMemoryDump(section: RoadmapSection, studentResponse: string, teacherBrainContext = '', contextMeta?: { sessionId: string; materialId: string; sectionIndex: number }, teacherBrainSectionContext?: TeacherBrainSectionContext) {
    const heuristicScore = Math.max(20, computeCoverageScore(section, studentResponse) - 5);
    const calculationContext = buildCalculationTeachingContext(
      section,
      teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
    );
    const diagramContext = buildDiagramTeachingContext(
      section,
      teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
    );
    const prompt = [
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      calculationContext.detected ? `Calculation context:\n${calculationContext.summary}` : '',
      diagramContext.detected ? `Diagram context:\n${diagramContext.summary}` : '',
      `Section content:\n${truncate(section.content, 3000)}`,
      `Student memory dump:\n${studentResponse}`,
      calculationContext.detected
        ? 'Task: Compare the memory dump to the expected knowledge for this section. Check recall of the formula, variables, steps, common mistakes, when to use it, and final answer format. Briefly identify what was remembered well and what is still missing.'
        : diagramContext.detected
          ? 'Task: Compare the memory dump to the expected knowledge for this section. Check whether the student remembered labels or parts, sequence or stages, relationships, functions, and exam interpretation. Briefly identify what was remembered well and what is still missing.'
          : 'Task: Compare the memory dump to the expected knowledge for this section. Briefly identify what was remembered well and what is still missing.',
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
    const evaluation = await generateText(prompt, this.companionSystemPrompt(), 450);
    return {
      evaluation,
      score: heuristicScore,
      failedConcepts: deriveFailedConcepts(section, studentResponse),
    };
  }

  private async buildTeachBackPrompt(section: RoadmapSection, attemptNumber: 1 | 2, teacherBrainContext = '', contextMeta?: { sessionId: string; materialId: string; sectionIndex: number }, teacherBrainSectionContext?: TeacherBrainSectionContext) {
    const diagramContext = buildDiagramTeachingContext(
      section,
      teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
    );
    const prompt = [
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      diagramContext.detected ? `Diagram context:\n${diagramContext.summary}` : '',
      `Section content:\n${truncate(section.content, 2800)}`,
      diagramContext.detected
        ? attemptNumber === 1
          ? 'Ask the student for Teach-Back 1. Tell them to explain the diagram or process in their own words as if they are drawing it from memory.'
          : 'Ask the student for Teach-Back 2. Tell them to explain the visual again, this time correcting the missing labels, flow, or relationships from the first attempt.'
        : attemptNumber === 1
          ? 'Ask the student for Teach-Back 1. Tell them to explain the section in their own words without copying.'
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
    const content = await generateText(prompt, this.companionSystemPrompt(), 220);
    return sanitizeSingleQuestionTurn(content);
  }

  private async buildMemoryDumpPrompt(section: RoadmapSection, teacherBrainContext = '', contextMeta?: { sessionId: string; materialId: string; sectionIndex: number }) {
    if (teacherBrainContext && contextMeta) {
      console.log('teacher_brain_context_applied', {
        ...contextMeta,
        prompt: 'memory_dump_prompt',
      });
    }
    const content = await generateText(
      [
        `Section title: ${section.title}`,
        teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
        `Section content:\n${truncate(section.content, 2600)}`,
        'Ask the student for a memory dump. Tell them to write or say everything they remember from this section without checking notes.',
      ].join('\n\n'),
      this.companionSystemPrompt(),
      220,
    );
    return sanitizeSingleQuestionTurn(content);
  }

  private async buildGapReteach(section: RoadmapSection, failedConcepts: string[], teacherBrainContext = '', contextMeta?: { sessionId: string; materialId: string; sectionIndex: number }, teacherBrainSectionContext?: TeacherBrainSectionContext) {
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
    return generateText(
      [
        `Section title: ${section.title}`,
        teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
        calculationContext.detected ? `Calculation context:\n${calculationContext.summary}` : '',
        diagramContext.detected ? `Diagram context:\n${diagramContext.summary}` : '',
        `Section content:\n${truncate(section.content, 3000)}`,
        `Missing or weak ideas:\n${failedConcepts.join('\n') || 'The explanation was too thin.'}`,
        calculationContext.detected
          ? 'Task: reteach this section more simply. Use one small numeric example labelled simple example, explain the method step by step, and warn about one common calculation mistake. Then tell the student they will try the teach-back again.'
          : diagramContext.detected
            ? 'Task: reteach this section using a simple verbal visualization. Say things like imagine this as, start from the left or top or center, the arrow means, and this part connects to. Then tell the student they will try the teach-back again.'
            : 'Task: reteach this section in a simpler way with one easy analogy, then tell the student they will try the teach-back again.',
      ].join('\n\n'),
      this.companionSystemPrompt(),
      650,
    );
  }

  private async buildInterruptResponse(section: RoadmapSection, studentResponse: string, teacherBrainContext = '', contextMeta?: { sessionId: string; materialId: string; sectionIndex: number }) {
    const prompt = [
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      `Section content:\n${truncate(section.content, 2600)}`,
      `Student interruption:\n${truncate(studentResponse, 600)}`,
      'Task: Respond like a live tutor who was interrupted. Briefly acknowledge what the student said, answer or correct it directly, then ask exactly one short checkpoint question. Do not ask multiple questions. Do not continue into the next concept.',
    ].join('\n\n');

    if (teacherBrainContext && contextMeta) {
      console.log('teacher_brain_context_applied', {
        ...contextMeta,
        prompt: 'interrupt_response',
      });
    }
    const content = await generateText(prompt, this.companionSystemPrompt(), 320);
    return sanitizeSingleQuestionTurn(content);
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

  async handleStudentReply(sessionId: string, studentResponse: string, options?: { interrupted?: boolean }) {
    const { state, roadmap, material, teacherBrain } = await this.loadSessionContext(sessionId);
    const section = this.sectionAt(roadmap, state.current_section_index);
    const teacherBrainContext = buildTeacherBrainPromptContext(teacherBrain, state.current_section_index, roadmap);
    const teacherBrainSectionContext = getTeacherBrainSectionContext(
      teacherBrain,
      state.current_section_index,
      section.title,
    );
    const contextMeta = {
      sessionId,
      materialId: material.id,
      sectionIndex: state.current_section_index,
    };
    const sectionContext = readSectionContext(state.section_context);
    const trimmed = studentResponse.trim();
    const isAutoContinue = trimmed === '__AUTO_CONTINUE__';
    const isInterrupt = options?.interrupted === true;

    if (!trimmed) {
      throw new Error('Please send a response so Akademi can continue the study flow.');
    }

    if (state.current_phase === PASS_1) {
      if (isInterrupt || !isAutoContinue) {
        const content = await this.buildInterruptResponse(section, trimmed, teacherBrainContext, contextMeta);
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
      const content = await this.buildTeachingPass(section, 1, teacherBrainContext, contextMeta, teacherBrainSectionContext);
      await this.persistRoadmap(state.id, roadmap, {
        current_phase: PASS_2,
        pending_prompt: content,
        section_context: {} as Prisma.InputJsonValue,
      });
      return {
        content,
        metadata: await this.buildTurnMetadata(sessionId, 'teaching', {
          nextAction: 'continue_teaching',
          questionCount: questionCountForContent(content),
        }),
      };
    }

    if (state.current_phase === PASS_2) {
      if (isInterrupt || !isAutoContinue) {
        const content = await this.buildInterruptResponse(section, trimmed, teacherBrainContext, contextMeta);
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
      const content = await this.buildTeachingPass(section, 2, teacherBrainContext, contextMeta, teacherBrainSectionContext);
      await this.persistRoadmap(state.id, roadmap, {
        current_phase: PASS_3,
        pending_prompt: content,
        section_context: {} as Prisma.InputJsonValue,
      });
      return {
        content,
        metadata: await this.buildTurnMetadata(sessionId, 'teaching', {
          nextAction: 'continue_teaching',
          questionCount: questionCountForContent(content),
        }),
      };
    }

    if (state.current_phase === PASS_3) {
      if (isInterrupt || !isAutoContinue) {
        const content = await this.buildInterruptResponse(section, trimmed, teacherBrainContext, contextMeta);
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
      if (!sectionContext.pass3QuestionPending) {
        const content = await this.buildTeachingPass(section, 3, teacherBrainContext, contextMeta, teacherBrainSectionContext);
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: PASS_3,
          pending_prompt: content,
          section_context: { pass3QuestionPending: true } as Prisma.InputJsonValue,
        });
        return {
          content,
          metadata: await this.buildTurnMetadata(sessionId, 'teaching', {
            nextAction: 'ask_followup',
            questionCount: questionCountForContent(content),
          }),
        };
      }

      const content = await this.buildTeachBackPrompt(section, 1, teacherBrainContext, contextMeta, teacherBrainSectionContext);
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

    if (state.current_phase === TEACHBACK_1) {
      if (isAutoContinue) {
        throw new Error('Akademi is waiting for your explanation before continuing.');
      }
      const evaluation = await this.evaluateTeachBack(section, trimmed, 1, teacherBrainContext, contextMeta, teacherBrainSectionContext);
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
        } as Prisma.InputJsonValue,
      });
      return {
        content: evaluation.evaluation,
        metadata: await this.buildTurnMetadata(sessionId, 'evaluation', {
          nextAction: 'continue_teaching',
          questionCount: questionCountForContent(evaluation.evaluation),
        }),
      };
    }

    if (state.current_phase === TEACHBACK_2) {
      if (isAutoContinue) {
        throw new Error('Akademi is waiting for your second teach-back before continuing.');
      }
      const evaluation = await this.evaluateTeachBack(section, trimmed, 2, teacherBrainContext, contextMeta, teacherBrainSectionContext);
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
        } as Prisma.InputJsonValue,
      });
      return {
        content: evaluation.evaluation,
        metadata: await this.buildTurnMetadata(sessionId, 'evaluation', {
          nextAction: 'continue_teaching',
          questionCount: questionCountForContent(evaluation.evaluation),
        }),
      };
    }

    if (state.current_phase === GAP_RETEACH) {
      if (isInterrupt || !isAutoContinue) {
        const content = await this.buildInterruptResponse(section, trimmed, teacherBrainContext, contextMeta);
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
        const content = await this.buildGapReteach(section, sectionContext.failedConcepts || [], teacherBrainContext, contextMeta, teacherBrainSectionContext);
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: GAP_RETEACH,
          pending_prompt: content,
          section_context: {
            ...sectionContext,
            reteachDelivered: true,
          } as Prisma.InputJsonValue,
        });
        return {
          content,
          metadata: await this.buildTurnMetadata(sessionId, 'reteach', {
            nextAction: 'continue_teaching',
            questionCount: questionCountForContent(content),
          }),
        };
      }

      const content =
        sectionContext.nextPromptKind === 'teachback_2'
          ? await this.buildTeachBackPrompt(section, 2, teacherBrainContext, contextMeta, teacherBrainSectionContext)
          : await this.buildMemoryDumpPrompt(section, teacherBrainContext, contextMeta);

      await this.persistRoadmap(state.id, roadmap, {
        current_phase: sectionContext.nextPromptKind === 'teachback_2' ? TEACHBACK_2 : MEMORY_DUMP,
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

    if (state.current_phase === MEMORY_DUMP) {
      if (sectionContext.nextPromptKind === 'memory_dump') {
        if (!isAutoContinue) {
          throw new Error('Akademi is preparing the next checkpoint. Wait one moment.');
        }

        const content = await this.buildMemoryDumpPrompt(section, teacherBrainContext, contextMeta);
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: MEMORY_DUMP,
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

      if (isAutoContinue) {
        throw new Error('Akademi is waiting for your memory dump before continuing.');
      }
      const evaluation = await this.evaluateMemoryDump(section, trimmed, teacherBrainContext, contextMeta, teacherBrainSectionContext);
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
          section_context: {} as Prisma.InputJsonValue,
        });
        return {
          content,
          metadata: await this.buildTurnMetadata(sessionId, 'transition', {
            autoContinue: false,
            waitForStudent: true,
            nextAction: 'move_next',
          }),
        };
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
          nextPromptKind: 'teachback_2',
          failedConcepts,
        } as Prisma.InputJsonValue,
      });
      return {
        content: outcome,
        metadata: await this.buildTurnMetadata(sessionId, 'evaluation', {
          nextAction: 'continue_teaching',
          questionCount: questionCountForContent(outcome),
        }),
      };
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
        const content = await this.buildTeachingPass(nextSection, 1, nextTeacherBrainContext, {
          sessionId,
          materialId: material.id,
          sectionIndex: nextIndex,
        }, nextTeacherBrainSectionContext);
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: PASS_1,
          current_section_index: nextIndex,
          pending_prompt: content,
          section_context: {} as Prisma.InputJsonValue,
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
        const content = await this.buildTeachingPass(nextSection, 1, nextTeacherBrainContext, {
          sessionId,
          materialId: material.id,
          sectionIndex: nextIndex,
        }, nextTeacherBrainSectionContext);
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: PASS_1,
          current_section_index: nextIndex,
          pending_prompt: content,
          section_context: {} as Prisma.InputJsonValue,
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

    const fallback = await this.buildTeachBackPrompt(section, 1, teacherBrainContext, contextMeta, teacherBrainSectionContext);
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

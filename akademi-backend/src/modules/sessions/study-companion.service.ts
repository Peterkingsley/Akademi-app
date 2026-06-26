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
import { decideTeachingStrategy, TeachingDecision, TeachingPace, TeachingStrategy } from './teaching-decision-engine';

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

type StudyVisualSuggestedRenderer =
  | 'mental_model'
  | 'flowchart'
  | 'graph'
  | 'equation_breakdown'
  | 'labeled_diagram'
  | 'process_steps'
  | 'table'
  | 'future_image_generation';

type StudyVisualItem = {
  title: string;
  diagramType: string;
  description: string;
  whenToShow: string;
  studentShouldNotice: string[];
  suggestedRenderer: StudyVisualSuggestedRenderer;
  priority: number;
};

type StudyVisualPlan = {
  sectionIndex: number;
  sectionTitle: string;
  isDiagramHeavy: boolean;
  visuals: StudyVisualItem[];
};

type StudentMemoryRecord = {
  understood: string[];
  weakPoints: string[];
  misconceptions: string[];
  calculationIssues: string[];
  diagramIssues: string[];
  preferredExplanationStyle: string | null;
  revisitLater: string[];
  compressedSummary: string | null;
};

type StudySectionLessonPlanRecord = {
  lessonObjective: string;
  prerequisiteRefresh: string[];
  teachingSequence: string[];
  analogyPlan: string[];
  calculationPlan: string[];
  diagramPlan: string[];
  checkpointFocus: string[];
  examFocus: string[];
  fallbackPlan: string[];
  promptContext: string;
};

type StudentMemoryContext = {
  previousSectionMemory: StudentMemoryRecord | null;
  priorMemories: StudentMemoryRecord[];
  promptContext: string;
};

type RelevantMaterialChunk = {
  chunkIndex: number;
  excerpt: string;
  whyRelevant: string;
  score: number;
};

type RelevantMaterialContext = {
  chunks: RelevantMaterialChunk[];
  promptContext: string;
};

type TutorMessageQualityResult = {
  passed: boolean;
  issues: string[];
  correctedContent?: string;
};

type TutorMessageQualityArgs = {
  content: string;
  phase: StudyCompanionPhase | 'INTRO' | 'CHECKPOINT' | 'RETEACH';
  turnType: 'teaching' | 'checkpoint_question' | 'reteach' | 'transition';
  section: RoadmapSection;
  isCalculationHeavy: boolean;
  isDiagramHeavy: boolean;
  questionAllowed: boolean;
};

type TutorQualityTraceCapture = {
  issues: string[];
  regenerated: boolean;
  fallbackUsed: boolean;
  correctionApplied: boolean;
};

type TutorTraceRuntime = {
  id: string | null;
  startedAt: number;
  aiLatencyMs: number;
  quality: TutorQualityTraceCapture;
};

type TutorTraceSeed = {
  sessionId: string;
  userId: string;
  materialId?: string | null;
  courseCode?: string | null;
  sectionIndex?: number | null;
  sectionTitle?: string | null;
  phase: string;
  turnType?: string | null;
  action?: string | null;
  teacherBrainUsed: boolean;
  studentMemoryUsed: boolean;
  lessonPlanUsed: boolean;
  relevantMaterialUsed: boolean;
  calculationContextUsed: boolean;
  diagramContextUsed: boolean;
  qualityGuardrailUsed: boolean;
  promptTokensEstimate?: number | null;
  metadata?: Record<string, unknown>;
};

type StudentMaterialMemoryRow = {
  id: string;
  user_id: string;
  material_id: string;
  course_code: string;
  section_index: number;
  section_title: string;
  mastered: boolean;
  mastery_score: number | null;
  understood: unknown;
  weak_points: unknown;
  misconceptions: unknown;
  calculation_issues: unknown;
  diagram_issues: unknown;
  preferred_explanation_style: string | null;
  revisit_later: unknown;
  compressed_summary: string | null;
};

type StudySectionLessonPlanRow = {
  id: string;
  session_id: string;
  companion_state_id: string;
  user_id: string;
  material_id: string;
  course_code: string;
  section_index: number;
  section_title: string;
  lesson_objective: string;
  prerequisite_refresh: unknown;
  teaching_sequence: unknown;
  analogy_plan: unknown;
  calculation_plan: unknown;
  diagram_plan: unknown;
  checkpoint_focus: unknown;
  exam_focus: unknown;
  fallback_plan: unknown;
};

type TeachingReflectionRow = {
  id: string;
  session_id: string;
  companion_state_id: string;
  user_id: string;
  material_id: string;
  course_code: string;
  section_index: number;
  section_title: string;
  strategy_used: string | null;
  pace_used: string | null;
  repair_mode_used: string | null;
  analogy_used: boolean;
  worked_example_used: boolean;
  visual_explanation_used: boolean;
  calculation_steps_used: boolean;
  exam_framing_used: boolean;
  challenge_used: boolean;
  mastery_score: number | null;
  concept_understanding: number | null;
  procedural_accuracy: number | null;
  reasoning_quality: number | null;
  confidence: number | null;
  hidden_confusion_risk: number | null;
  what_worked: unknown;
  what_failed: unknown;
  recommended_next_strategy: string | null;
  recommended_next_pace: string | null;
  recommended_interventions: unknown;
  compressed_reflection: string | null;
};

type TeachingReflectionRecord = {
  conceptUnderstanding: number;
  proceduralAccuracy: number;
  reasoningQuality: number;
  confidence: number;
  hiddenConfusionRisk: number;
  whatWorked: string[];
  whatFailed: string[];
  recommendedNextStrategy: string | null;
  recommendedNextPace: string | null;
  recommendedInterventions: string[];
  compressedReflection: string | null;
};

type LearningIntelligenceRecordRow = {
  id: string;
  session_id: string;
  companion_state_id: string;
  user_id: string;
  material_id: string;
  course_code: string;
  section_index: number;
  section_title: string;
  mastery_score: number | null;
  concept_understanding: number;
  procedural_accuracy: number;
  reasoning_quality: number;
  confidence: number;
  hidden_confusion_risk: number;
  retention_risk: number;
  calculation_weakness: boolean;
  diagram_weakness: boolean;
  prerequisite_weakness: boolean;
  evidence: unknown;
  recommended_action: string | null;
};

type LearningIntelligenceContext = {
  masteryScore: number | null;
  conceptUnderstanding: number;
  proceduralAccuracy: number;
  reasoningQuality: number;
  confidence: number;
  hiddenConfusionRisk: number;
  retentionRisk: number;
  calculationWeakness: boolean;
  diagramWeakness: boolean;
  prerequisiteWeakness: boolean;
  recommendedAction: string | null;
  evidence: {
    mainReason: string | null;
    signals: string[];
  };
};

type StudentLearningProfileContext = {
  preferredTeachingStrategy: TeachingStrategy | null;
  preferredPace: TeachingPace | null;
  strategySuccessScores: Partial<Record<TeachingStrategy, number>>;
  calculationSupportNeeded: boolean;
  visualSupportNeeded: boolean;
  confidenceSupportNeeded: boolean;
};

type MaterialEmbeddingRow = {
  chunk_index: number;
  chunk_text: string;
  embedding: unknown;
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

function buildTeachingDecisionPromptLines(
  decision: TeachingDecision,
  options?: {
    pass?: 1 | 2 | 3;
    includeCheckpoint?: boolean;
    includeInterrupt?: boolean;
    includeReteach?: boolean;
    includeIntro?: boolean;
  },
) {
  const lines: string[] = [
    `Teaching decision strategy: ${decision.strategy}.`,
    `Teaching pace: ${decision.pace}.`,
  ];

  if (decision.shouldRepairPrerequisite) {
    lines.push(
      'There is a prerequisite weakness. Before teaching the main idea, insert a short prerequisite refresh.',
    );
  }

  if (decision.pace === 'slow') {
    lines.push('Teach slowly.');
    lines.push('Explain every important transition.');
    lines.push('Do not assume prior knowledge.');
  } else if (decision.pace === 'fast') {
    lines.push('Be concise.');
    lines.push('Avoid over-explaining.');
    lines.push('Move confidently.');
  }

  switch (decision.strategy) {
    case 'worked_example_first':
      lines.push('Preferred teaching order: worked example, then explanation, then definition.');
      break;
    case 'analogy_first':
      lines.push('Preferred teaching order: analogy, then intuition, then definition, then example.');
      break;
    case 'visual_first':
      lines.push('Preferred teaching order: mental visual, then explanation, then definition, then example.');
      break;
    case 'problem_first':
      lines.push('Preferred teaching order: problem, then curiosity, then explanation.');
      break;
    case 'story_first':
      lines.push('Preferred teaching order: short story, then insight, then explanation.');
      break;
    case 'exam_first':
      lines.push('Preferred teaching order: exam framing, then explanation, then application.');
      break;
    case 'definition_first':
      lines.push('Preferred teaching order: definition, then explanation, then example.');
      break;
    default:
      lines.push('Use a balanced hybrid teaching order.');
      break;
  }

  if (decision.shouldUseAnalogy) {
    lines.push('Use one simple analogy only if it genuinely improves understanding. Avoid forced analogies.');
  }
  if (decision.shouldUseVisualExplanation) {
    lines.push('Use mental imagery or a verbal diagram description. Do not generate images.');
  }
  if (decision.shouldUseWorkedExample) {
    lines.push('Use a worked example when it helps understanding.');
  }
  if (decision.shouldUseCalculationSteps) {
    lines.push('Show calculation steps clearly and explain variables before substitution.');
  }
  if (decision.shouldChallengeStudent) {
    lines.push('Slightly increase reasoning depth without making the task overwhelming.');
  }
  if (decision.shouldUseExamFraming) {
    lines.push('Include examiner expectations, common mistakes, or exam tricks where they fit naturally.');
  }

  if (options?.pass === 2 && decision.shouldUseWorkedExample) {
    lines.push('Pass 2 must include one worked example unless the section content already contains one.');
  }

  if (options?.pass === 3 && decision.shouldUseExamFraming) {
    lines.push('Pass 3 should naturally include examiner expectations, common mistakes, and exam tricks.');
  }

  if (options?.includeCheckpoint) {
    lines.push('Keep the checkpoint aligned with the teaching decision and current emphasis.');
  }

  if (options?.includeInterrupt) {
    lines.push('Answer the interruption using the same teaching strategy and pace, but stay brief.');
  }

  if (options?.includeReteach) {
    lines.push('For reteach, keep the same strategic direction but simplify the explanation further.');
  }

  if (options?.includeIntro) {
    lines.push('Let the opening immediately reflect the chosen strategy without delaying the lesson.');
  }

  if (decision.promptDirectives.length) {
    lines.push(`Decision directives: ${decision.promptDirectives.join(' | ')}`);
  }

  return lines;
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

function mapDiagramTypeToSuggestedRenderer(diagramType?: string): StudyVisualSuggestedRenderer {
  const normalized = String(diagramType || '').trim().toLowerCase();

  switch (normalized) {
    case 'flowchart':
      return 'flowchart';
    case 'graph':
      return 'graph';
    case 'equation_breakdown':
      return 'equation_breakdown';
    case 'anatomy':
      return 'labeled_diagram';
    case 'process':
      return 'process_steps';
    case 'table':
      return 'table';
    case 'map':
      return 'future_image_generation';
    default:
      return 'mental_model';
  }
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

function parseStudentMemoryRecord(value: {
  understood?: unknown;
  weak_points?: unknown;
  misconceptions?: unknown;
  calculation_issues?: unknown;
  diagram_issues?: unknown;
  preferred_explanation_style?: string | null;
  revisit_later?: unknown;
  compressed_summary?: string | null;
}): StudentMemoryRecord {
  return {
    understood: safeStringArray(value.understood),
    weakPoints: safeStringArray(value.weak_points),
    misconceptions: safeStringArray(value.misconceptions),
    calculationIssues: safeStringArray(value.calculation_issues),
    diagramIssues: safeStringArray(value.diagram_issues),
    preferredExplanationStyle: value.preferred_explanation_style || null,
    revisitLater: safeStringArray(value.revisit_later),
    compressedSummary: value.compressed_summary || null,
  };
}

function buildStudentMemoryPromptContext(
  previousSectionMemory: StudentMemoryRecord | null,
  priorMemories: StudentMemoryRecord[],
) {
  const aggregateWeakPoints = truncateList(priorMemories.flatMap((item) => item.weakPoints), 6, 100);
  const aggregateCalculationIssues = truncateList(priorMemories.flatMap((item) => item.calculationIssues), 5, 100);
  const aggregateDiagramIssues = truncateList(priorMemories.flatMap((item) => item.diagramIssues), 5, 100);
  const aggregateRevisit = truncateList(priorMemories.flatMap((item) => item.revisitLater), 6, 100);
  const preferredStyles = truncateList(
    priorMemories.map((item) => item.preferredExplanationStyle || '').filter(Boolean),
    3,
    80,
  );

  const lines: string[] = [];
  if (previousSectionMemory?.compressedSummary) {
    lines.push(`Previous section memory: ${truncate(previousSectionMemory.compressedSummary, 180)}`);
  }
  if (aggregateWeakPoints.length) {
    lines.push(`Earlier weak points to watch: ${aggregateWeakPoints.join(' | ')}`);
  }
  if (aggregateCalculationIssues.length) {
    lines.push(`Earlier calculation issues: ${aggregateCalculationIssues.join(' | ')}`);
  }
  if (aggregateDiagramIssues.length) {
    lines.push(`Earlier diagram issues: ${aggregateDiagramIssues.join(' | ')}`);
  }
  if (aggregateRevisit.length) {
    lines.push(`Revisit later list: ${aggregateRevisit.join(' | ')}`);
  }
  if (preferredStyles.length) {
    lines.push(`Preferred explanation style cues: ${preferredStyles.join(' | ')}`);
  }
  return lines.join('\n');
}

function buildDeterministicStudentMemoryFallback(args: {
  score: number;
  passed: boolean;
  failedConcepts: string[];
  calculationContext: CalculationTeachingContext;
  diagramContext: DiagramTeachingContext;
  sectionTitle: string;
}) {
  return {
    understood: args.passed ? [`Core ideas from ${args.sectionTitle} were recalled well.`] : [],
    weak_points: truncateList(args.failedConcepts, 5, 120),
    misconceptions: [],
    calculation_issues: args.calculationContext.detected ? truncateList(args.calculationContext.commonMistakes, 4, 100) : [],
    diagram_issues: args.diagramContext.detected
      ? truncateList(args.diagramContext.diagrams.flatMap((item) => item.student_should_notice || []), 4, 100)
      : [],
    preferred_explanation_style: args.calculationContext.detected
      ? 'Step-by-step formula explanation with careful substitution.'
      : args.diagramContext.detected
        ? 'Clear verbal visualization using simple spatial language.'
        : 'Short, structured explanation with one idea at a time.',
    revisit_later: args.passed ? [] : truncateList(args.failedConcepts, 4, 100),
    compressed_summary: args.passed
      ? `${args.sectionTitle} is mostly understood, but keep reinforcing application in later sections.`
      : `${args.sectionTitle} still needs support around ${truncateList(args.failedConcepts, 3, 80).join(', ') || 'core ideas'}.`,
  };
}

function clampReflectionScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseTeachingReflectionRecord(value: {
  concept_understanding?: number | null;
  procedural_accuracy?: number | null;
  reasoning_quality?: number | null;
  confidence?: number | null;
  hidden_confusion_risk?: number | null;
  what_worked?: unknown;
  what_failed?: unknown;
  recommended_next_strategy?: string | null;
  recommended_next_pace?: string | null;
  recommended_interventions?: unknown;
  compressed_reflection?: string | null;
}): TeachingReflectionRecord {
  return {
    conceptUnderstanding: clampReflectionScore(Number(value.concept_understanding ?? 0)),
    proceduralAccuracy: clampReflectionScore(Number(value.procedural_accuracy ?? 0)),
    reasoningQuality: clampReflectionScore(Number(value.reasoning_quality ?? 0)),
    confidence: clampReflectionScore(Number(value.confidence ?? 0)),
    hiddenConfusionRisk: clampReflectionScore(Number(value.hidden_confusion_risk ?? 0)),
    whatWorked: safeStringArray(value.what_worked),
    whatFailed: safeStringArray(value.what_failed),
    recommendedNextStrategy: value.recommended_next_strategy ? String(value.recommended_next_strategy) : null,
    recommendedNextPace: value.recommended_next_pace ? String(value.recommended_next_pace) : null,
    recommendedInterventions: safeStringArray(value.recommended_interventions),
    compressedReflection: value.compressed_reflection ? String(value.compressed_reflection) : null,
  };
}

function buildDeterministicTeachingReflectionFallback(args: {
  score: number;
  passed: boolean;
  failedConcepts: string[];
  decision: TeachingDecision;
  calculationContext: CalculationTeachingContext;
  diagramContext: DiagramTeachingContext;
  studentMemoryContext: StudentMemoryContext;
  sectionTitle: string;
}) {
  const confidencePenalty = args.failedConcepts.length * 8 + (args.passed ? 0 : 10);
  const proceduralPenalty = args.calculationContext.detected ? Math.max(8, args.studentMemoryContext.priorMemories.flatMap((item) => item.calculationIssues).length * 6) : 0;
  const conceptUnderstanding = clampReflectionScore(args.score);
  const proceduralAccuracy = clampReflectionScore(args.score - proceduralPenalty);
  const reasoningQuality = clampReflectionScore(args.score - args.failedConcepts.length * 6);
  const confidence = clampReflectionScore(args.score - confidencePenalty);
  const hiddenConfusionRisk = clampReflectionScore(
    (args.passed ? 25 : 55) +
    args.failedConcepts.length * 8 +
    (args.score < 85 ? 10 : 0) +
    (args.studentMemoryContext.priorMemories.flatMap((item) => item.weakPoints).length > 0 ? 8 : 0),
  );

  const whatWorked = [
    args.decision.shouldUseWorkedExample ? 'Worked example structure supported understanding.' : '',
    args.decision.shouldUseVisualExplanation ? 'Visual-style explanation helped with mental organization.' : '',
    args.decision.shouldUseAnalogy ? 'Analogy-based framing improved initial grasp.' : '',
    args.passed ? `The section ${args.sectionTitle} reached a usable mastery level.` : '',
  ].filter(Boolean);

  const whatFailed = [
    ...truncateList(args.failedConcepts, 4, 100),
    args.calculationContext.detected && proceduralAccuracy < conceptUnderstanding ? 'Procedural calculation accuracy remained weaker than concept recall.' : '',
    args.diagramContext.detected && hiddenConfusionRisk >= 55 ? 'Visual relationships likely still need reinforcement.' : '',
  ].filter(Boolean);

  return {
    concept_understanding: conceptUnderstanding,
    procedural_accuracy: proceduralAccuracy,
    reasoning_quality: reasoningQuality,
    confidence,
    hidden_confusion_risk: hiddenConfusionRisk,
    what_worked: truncateList(whatWorked, 5, 120),
    what_failed: truncateList(whatFailed, 5, 120),
    recommended_next_strategy: args.failedConcepts.length ? 'worked_example_first' : args.decision.strategy,
    recommended_next_pace: hiddenConfusionRisk >= 55 ? 'slow' : args.decision.pace,
    recommended_interventions: truncateList([
      args.decision.shouldRepairPrerequisite ? 'Add a short prerequisite refresh before the next related section.' : '',
      args.calculationContext.detected ? 'Reinforce calculation steps with one compact example.' : '',
      args.diagramContext.detected ? 'Use clearer verbal visualization for the next related topic.' : '',
    ].filter(Boolean), 4, 120),
    compressed_reflection: args.passed
      ? `${args.sectionTitle} responded reasonably well to ${args.decision.strategy} at ${args.decision.pace} pace, but keep watching ${truncateList(args.failedConcepts, 2, 80).join(', ') || 'application depth'}.`
      : `${args.sectionTitle} did not respond strongly enough to ${args.decision.strategy}; the next attempt should slow down and target ${truncateList(args.failedConcepts, 3, 80).join(', ') || 'the missing ideas'}.`,
  };
}

function parseLearningIntelligenceContext(value: LearningIntelligenceRecordRow): LearningIntelligenceContext {
  const evidence = safeJsonObject<{ main_reason?: string; signals?: unknown }>(value.evidence, {});
  return {
    masteryScore: value.mastery_score ?? null,
    conceptUnderstanding: clampReflectionScore(value.concept_understanding),
    proceduralAccuracy: clampReflectionScore(value.procedural_accuracy),
    reasoningQuality: clampReflectionScore(value.reasoning_quality),
    confidence: clampReflectionScore(value.confidence),
    hiddenConfusionRisk: clampReflectionScore(value.hidden_confusion_risk),
    retentionRisk: clampReflectionScore(value.retention_risk),
    calculationWeakness: Boolean(value.calculation_weakness),
    diagramWeakness: Boolean(value.diagram_weakness),
    prerequisiteWeakness: Boolean(value.prerequisite_weakness),
    recommendedAction: value.recommended_action || null,
    evidence: {
      mainReason: evidence.main_reason ? String(evidence.main_reason) : null,
      signals: safeStringArray(evidence.signals),
    },
  };
}

function inferPrerequisiteWeaknessFromFailedConcepts(failedConcepts: string[]) {
  return failedConcepts.some((item) => /\bprerequisite\b|\bbasic\b|\bfoundation\b|\bprior\b|\bbackground\b/i.test(item));
}

function isTeachingStrategy(value: string | null | undefined): value is TeachingStrategy {
  return [
    'definition_first',
    'analogy_first',
    'visual_first',
    'worked_example_first',
    'problem_first',
    'story_first',
    'exam_first',
    'hybrid',
  ].includes(String(value || ''));
}

function isTeachingPace(value: string | null | undefined): value is TeachingPace {
  return ['slow', 'normal', 'fast'].includes(String(value || ''));
}

function cosineSimilarity(a: number[], b: number[]) {
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

function parseEmbeddingVector(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
    : [];
}

function tokenOverlapScore(a: string, b: string) {
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

function explainChunkRelevance(chunkText: string, queryParts: string[]) {
  const lower = chunkText.toLowerCase();
  const matched = queryParts
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .find((part) => {
      const tokens = part.toLowerCase().split(/\s+/).filter((token) => token.length >= 4);
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

function hasStepLanguage(text: string) {
  return /\bstep\b|\bfirst\b|\bsecond\b|\bthen\b|\bnext\b|\bsubstitute\b|\bsolve\b|\bcalculate\b|\bapply\b/i.test(text);
}

function hasVisualLanguage(text: string) {
  return /\bimagine\b|\bpicture\b|\bvisual\b|\bflow\b|\barrow\b|\bgraph\b|\baxis\b|\blabel\b|\bpart\b|\bstage\b|\bprocess\b|\bcurve\b|\bdiagram\b/i.test(text);
}

function buildDeterministicTutorFallback(args: TutorMessageQualityArgs) {
  const firstSentence = normalizeText(args.section.content || '')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)[0];

  if (args.turnType === 'checkpoint_question') {
    return `Explain ${args.section.title} in your own words using one clear point at a time.`;
  }

  if (args.isCalculationHeavy && args.phase === PASS_2) {
    return `For ${args.section.title}, focus on the formula or method, define each variable clearly, and work through the steps in order with one simple example.`;
  }

  if (args.isDiagramHeavy) {
    return `Picture ${args.section.title} as a clear process or diagram. Start with the main parts, then explain how each part or stage connects to the next.`;
  }

  return firstSentence
    ? removeAccidentalTeachingQuestions(firstSentence)
    : `This part explains the core idea in ${args.section.title} and why it matters for the section.`;
}

function applyTutorMessageCorrections(
  content: string,
  issues: string[],
  context: TutorMessageQualityArgs,
) {
  let corrected = normalizeText(content);

  if (issues.includes('question_not_allowed') || !context.questionAllowed) {
    corrected = removeAccidentalTeachingQuestions(corrected);
  }

  if (issues.includes('too_long')) {
    corrected = truncate(corrected, context.turnType === 'checkpoint_question' ? 260 : 900);
  }

  if (issues.includes('too_short') || issues.includes('empty_content')) {
    corrected = buildDeterministicTutorFallback(context);
  }

  if (issues.includes('missing_calculation_steps') && context.phase === PASS_2) {
    corrected = `${corrected} State the formula, define the variables, then show the steps in order.`.trim();
  }

  if (issues.includes('missing_visual_language')) {
    corrected = `${corrected} Picture the process clearly and follow the main parts or stages in order.`.trim();
  }

  if (!context.questionAllowed) {
    corrected = removeAccidentalTeachingQuestions(corrected);
  } else if (context.turnType === 'checkpoint_question') {
    corrected = sanitizeSingleQuestionTurn(corrected);
  }

  return normalizeText(corrected);
}

function validateTutorMessageQuality(args: TutorMessageQualityArgs): TutorMessageQualityResult {
  const normalized = normalizeText(args.content || '');
  const issues: string[] = [];

  if (!normalized) {
    issues.push('empty_content');
  }

  if (normalized.length > (args.turnType === 'checkpoint_question' ? 320 : 1200)) {
    issues.push('too_long');
  }

  if (normalized.length < 40) {
    issues.push('too_short');
  }

  if (!args.questionAllowed && normalized.includes('?')) {
    issues.push('question_not_allowed');
  }

  if ((args.phase === PASS_1 || args.phase === PASS_2 || args.phase === PASS_3) && normalized.includes('?')) {
    if (!issues.includes('question_not_allowed')) {
      issues.push('question_not_allowed');
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

  const correctedContent = issues.length ? applyTutorMessageCorrections(normalized, issues, args) : undefined;
  return {
    passed: issues.length === 0,
    issues,
    correctedContent,
  };
}

function estimatePromptTokens(value: string) {
  return Math.max(1, Math.round(normalizeText(value).length / 4));
}

function parseStudySectionLessonPlanRecord(value: {
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
    lines.push(`Prerequisite refresh: ${truncateList(prerequisiteRefresh, 4, 110).join(' | ')}`);
  }
  if (teachingSequence.length) {
    lines.push(`Teaching sequence: ${truncateList(teachingSequence, 5, 110).join(' | ')}`);
  }
  if (analogyPlan.length) {
    lines.push(`Analogy plan: ${truncateList(analogyPlan, 3, 110).join(' | ')}`);
  }
  if (calculationPlan.length) {
    lines.push(`Calculation plan: ${truncateList(calculationPlan, 4, 120).join(' | ')}`);
  }
  if (diagramPlan.length) {
    lines.push(`Diagram plan: ${truncateList(diagramPlan, 4, 120).join(' | ')}`);
  }
  if (checkpointFocus.length) {
    lines.push(`Checkpoint focus: ${truncateList(checkpointFocus, 4, 110).join(' | ')}`);
  }
  if (examFocus.length) {
    lines.push(`Exam focus: ${truncateList(examFocus, 4, 110).join(' | ')}`);
  }
  if (fallbackPlan.length) {
    lines.push(`Fallback plan: ${truncateList(fallbackPlan, 4, 110).join(' | ')}`);
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

function buildFallbackLessonPlan(args: {
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
  const sectionGoal = firstParagraph[0] || `Understand the core idea in ${args.section.title}.`;
  const teachingSequence = firstParagraph.length
    ? firstParagraph.map((item) => truncate(item, 120))
    : [`Introduce ${args.section.title}`, 'Explain the main mechanism or idea clearly', 'Connect it to likely exam use'];
  const prerequisiteRefresh = args.teacherBrainContext
    ? truncateList(
      args.teacherBrainContext
        .split('\n')
        .filter((line) => /Prerequisites:|Previous section bridge:/i.test(line))
        .map((line) => line.replace(/^[^:]+:\s*/, '').trim()),
      3,
      110,
    )
    : [];
  const analogyPlan = truncateList(
    [
      args.studentMemoryPromptContext.includes('Preferred explanation style cues')
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
        ...args.calculationContext.formulas.map((item) => `${item.name || 'Formula'}: explain variables and when to use it.`),
        ...args.calculationContext.calculationMethods.map((item) => `${item.topic || 'Method'}: teach the solving order step by step.`),
        ...args.calculationContext.commonMistakes.map((item) => `Warn about: ${item}`),
      ],
      4,
      120,
    )
    : [];
  const diagramPlan = args.diagramContext.detected
    ? truncateList(
      [
        ...args.diagramContext.diagrams.map((item) => `${item.title || 'Diagram'}: explain ${item.diagram_type || 'visual'} using imagine language.`),
        ...args.diagramContext.imageDescriptions.map((item) => `Use existing visual cue: ${item}`),
      ],
      4,
      120,
    )
    : [];
  const checkpointFocus = truncateList(
    [
      args.calculationContext.detected ? 'Check formula or method selection and solving order.' : '',
      args.diagramContext.detected ? 'Check visual sequence, labels, and relationships.' : '',
      'Check whether the student can explain the core idea without copying.',
    ].filter(Boolean),
    4,
    110,
  );
  const examFocus = truncateList(
    [
      args.calculationContext.detected ? 'Connect the method to exam-style application and final answer format.' : '',
      args.diagramContext.detected ? 'Connect the visual to exam interpretation or reproduction.' : '',
      `Show why ${args.section.title} matters in an exam setting.`,
    ].filter(Boolean),
    4,
    110,
  );
  const fallbackPlan = truncateList(
    [
      'Reteach the weak idea in simpler words.',
      args.calculationContext.detected ? 'Use one small numeric simple example.' : '',
      args.diagramContext.detected ? 'Use one clean verbal visualization with parts or arrows.' : '',
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

  private createTeachingDecision(args: {
    phase: string;
    section: RoadmapSection;
    teacherBrainSectionContext: TeacherBrainSectionContext;
    teacherBrainContext: string;
    studentMemoryContext: StudentMemoryContext;
    lessonPlan: StudySectionLessonPlanRecord;
    calculationContext: CalculationTeachingContext;
    diagramContext: DiagramTeachingContext;
    relevantMaterialContext: RelevantMaterialContext;
    learningIntelligenceContext?: LearningIntelligenceContext | null;
    studentLearningProfileContext?: StudentLearningProfileContext | null;
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
      retentionRisk: args.learningIntelligenceContext?.retentionRisk ?? null,
      preferredTeachingStrategy: args.studentLearningProfileContext?.preferredTeachingStrategy ?? null,
      preferredPace: args.studentLearningProfileContext?.preferredPace ?? null,
      strategySuccessScores: args.studentLearningProfileContext?.strategySuccessScores ?? {},
      calculationSupportNeeded: args.studentLearningProfileContext?.calculationSupportNeeded ?? false,
      visualSupportNeeded: args.studentLearningProfileContext?.visualSupportNeeded ?? false,
      confidenceSupportNeeded: args.studentLearningProfileContext?.confidenceSupportNeeded ?? false,
      isCalculationHeavy: args.calculationContext.detected,
      isDiagramHeavy: args.diagramContext.detected,
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
    });

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

    const fallback = {
      concept_understanding: clampReflectionScore(args.score),
      procedural_accuracy: clampReflectionScore(args.score - (calculationIssues.length ? 15 : 0)),
      reasoning_quality: clampReflectionScore(averageTeachBack - Math.max(0, 70 - averageTeachBack) * 0.4),
      confidence: clampReflectionScore(args.score - Math.max(0, averageTeachBack - args.memoryDumpEvaluation.score) - (args.failedConcepts.length * 4)),
      hidden_confusion_risk: clampReflectionScore((args.passed ? 30 : 60) + args.failedConcepts.length * 8 + (shortAnswerRisk ? 10 : 0) + (args.score <= 84 ? 8 : 0)),
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
        ].filter(Boolean), 5, 140),
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

      const evidence = safeJsonObject<{ main_reason?: string; signals?: unknown }>(parsed.evidence, {});
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
            regenerated: trace.quality.regenerated,
            fallback_used: trace.quality.fallbackUsed,
            correction_applied: trace.quality.correctionApplied,
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
            regenerated: trace.quality.regenerated,
            fallback_used: trace.quality.fallbackUsed,
            correction_applied: trace.quality.correctionApplied,
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
      validation.issues.includes('missing_visual_language');

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
    if (args.qualityTrace) {
      args.qualityTrace.regenerated = true;
    }

    try {
      const regenerationPrompt = [
        args.prompt,
        'Quality fix required:',
        args.questionAllowed
          ? 'Keep exactly one short question if this turn is a checkpoint.'
          : 'Do not include any question mark or question.',
        args.isCalculationHeavy && args.phase === PASS_2
          ? 'This is a calculation-heavy Pass 2. Include the formula or method and the solving steps clearly.'
          : '',
        args.isDiagramHeavy
          ? 'Use clear visual language such as imagine, picture, parts, arrows, stages, flow, graph, axis, or labels.'
          : '',
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

    return { session, material: session.material, state, roadmap, teacherBrain, studentMemoryContext, learningIntelligenceContext, studentLearningProfileContext };
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
      'Use retrieved material context only to support the current section.',
      'Do not let retrieved material override current section content.',
      'If retrieved context conflicts with the section, trust current section.',
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
    const { session, material, state, roadmap, teacherBrain, studentMemoryContext, learningIntelligenceContext, studentLearningProfileContext } = await this.loadSessionContext(sessionId);
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
    const teachingDecision = this.createTeachingDecision({
      phase: PASS_1,
      section,
      teacherBrainSectionContext,
      teacherBrainContext,
      studentMemoryContext,
      lessonPlan,
      calculationContext: sectionCalculationContext,
      diagramContext: sectionDiagramContext,
      relevantMaterialContext,
      learningIntelligenceContext,
      studentLearningProfileContext,
      currentMasteryScore: state.last_mastery_score,
      lastMasteryScore: state.last_mastery_score,
    });
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
      studentMemoryContext.promptContext ? `Student memory context:\n${studentMemoryContext.promptContext}` : '',
      lessonPlan.promptContext ? `Lesson plan context:\n${lessonPlan.promptContext}` : '',
      relevantMaterialContext.promptContext ? `Relevant material context:\n${relevantMaterialContext.promptContext}` : '',
      refreshQuestion ? `Before we continue, ask this refresh question first: ${refreshQuestion}` : 'This is a fresh section start.',
      `Section content:\n${truncate(section.content, 3500)}`,
      lessonPlan.lessonObjective ? `Follow this lesson objective: ${lessonPlan.lessonObjective}` : '',
      lessonPlan.teachingSequence.length ? `Start with these opening sequence cues: ${truncateList(lessonPlan.teachingSequence, 2, 120).join(' | ')}` : '',
      `Teaching decision:\n${buildTeachingDecisionPromptLines(teachingDecision, { includeIntro: true, pass: 1 }).join('\n')}`,
      'Task: Write the opening tutor message and begin the lesson naturally. Keep the opening to 2 to 4 short sentences. Welcome the student, name the topic, state the learning goal, then move straight into the first teaching idea. If student memory shows a prerequisite weakness, briefly refresh it naturally and encouragingly. Do not ask for permission to begin. Do not say Ready? or Let us begin. Do not ask the student a question yet.',
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
      },
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
        questionAllowed: false,
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
        section_context: {} as Prisma.InputJsonValue,
      });

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
    lessonPlan?: StudySectionLessonPlanRecord,
    relevantMaterialContext?: RelevantMaterialContext,
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
    const modeInstructions = [
      calculationContext.detected ? buildCalculationInstructions(pass, calculationContext) : '',
      diagramContext.detected ? buildDiagramInstructions(pass, diagramContext) : '',
      ...buildTeachingDecisionPromptLines(decision, { pass }),
      pass === 1
        ? 'Give Pass 1 only. Keep it focused on one core idea at a time. Explain what this section is about and why it matters for exams. Do not ask any question. Do not include a question mark. End with a statement.'
        : pass === 2
          ? 'Give Pass 2 only. Explain definitions, formulas, steps, and one strong example from this section. Keep it clean and conversational. Do not use markdown. Do not ask any question. Do not include a question mark. End with a statement.'
          : 'Give Pass 3 only. Connect this section to earlier ideas and likely exam use. Keep it short and natural. Do not ask any question. Do not include a question mark. End with a statement.',
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = [
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      studentMemoryPromptContext ? `Student memory context:\n${studentMemoryPromptContext}` : '',
      lessonPlan?.promptContext ? `Lesson plan context:\n${lessonPlan.promptContext}` : '',
      relevantMaterialContext?.promptContext ? `Relevant material context:\n${relevantMaterialContext.promptContext}` : '',
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
    return this.enforceTutorMessageQuality({
      content: rawContent,
      prompt,
      maxTokens: 900,
      phase: pass === 1 ? PASS_1 : pass === 2 ? PASS_2 : PASS_3,
      turnType: 'teaching',
      section,
      isCalculationHeavy: calculationContext.detected,
      isDiagramHeavy: diagramContext.detected,
      questionAllowed: false,
      contextMeta: contextMeta ? { ...contextMeta, prompt: `teaching_pass_${pass}` } : undefined,
      qualityTrace,
    });
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
    const prompt = [
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      lessonPlan?.promptContext ? `Lesson plan context:\n${lessonPlan.promptContext}` : '',
      relevantMaterialContext?.promptContext ? `Relevant material context:\n${relevantMaterialContext.promptContext}` : '',
      calculationContext.detected ? `Calculation context:\n${calculationContext.summary}` : '',
      diagramContext.detected ? `Diagram context:\n${diagramContext.summary}` : '',
      `Section content:\n${truncate(section.content, 3000)}`,
      `Student teach-back attempt ${attemptNumber}:\n${studentResponse}`,
      lessonPlan?.checkpointFocus.length ? `Checkpoint focus: ${truncateList(lessonPlan.checkpointFocus, 4, 120).join(' | ')}` : '',
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
    if (relevantMaterialContext?.promptContext && contextMeta) {
      console.log('relevant_material_context_applied', {
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
    const prompt = [
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      lessonPlan?.promptContext ? `Lesson plan context:\n${lessonPlan.promptContext}` : '',
      relevantMaterialContext?.promptContext ? `Relevant material context:\n${relevantMaterialContext.promptContext}` : '',
      calculationContext.detected ? `Calculation context:\n${calculationContext.summary}` : '',
      diagramContext.detected ? `Diagram context:\n${diagramContext.summary}` : '',
      `Section content:\n${truncate(section.content, 3000)}`,
      `Student memory dump:\n${studentResponse}`,
      lessonPlan?.checkpointFocus.length ? `Memory checkpoint focus: ${truncateList(lessonPlan.checkpointFocus, 4, 120).join(' | ')}` : '',
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
    if (relevantMaterialContext?.promptContext && contextMeta) {
      console.log('relevant_material_context_applied', {
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

  private async buildTeachBackPrompt(
    section: RoadmapSection,
    attemptNumber: 1 | 2,
    decision: TeachingDecision,
    teacherBrainContext = '',
    contextMeta?: { sessionId: string; materialId: string; sectionIndex: number },
    teacherBrainSectionContext?: TeacherBrainSectionContext,
    lessonPlan?: StudySectionLessonPlanRecord,
    qualityTrace?: TutorQualityTraceCapture,
  ) {
    const diagramContext = buildDiagramTeachingContext(
      section,
      teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
    );
    const prompt = [
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      lessonPlan?.promptContext ? `Lesson plan context:\n${lessonPlan.promptContext}` : '',
      diagramContext.detected ? `Diagram context:\n${diagramContext.summary}` : '',
      `Section content:\n${truncate(section.content, 2800)}`,
      lessonPlan?.checkpointFocus.length ? `Ask around these checkpoint targets: ${truncateList(lessonPlan.checkpointFocus, 4, 120).join(' | ')}` : '',
      `Teaching decision:\n${buildTeachingDecisionPromptLines(decision, { includeCheckpoint: true }).join('\n')}`,
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
    if (contextMeta) {
      console.log('teaching_decision_applied', {
        ...contextMeta,
        prompt: `teachback_prompt_${attemptNumber}`,
        strategy: decision.strategy,
        pace: decision.pace,
        repairMode: decision.prerequisiteRepairMode,
      });
    }
    const rawContent = await generateText(prompt, this.companionSystemPrompt(), 220);
    return this.enforceTutorMessageQuality({
      content: rawContent,
      prompt,
      maxTokens: 220,
      phase: 'CHECKPOINT',
      turnType: 'checkpoint_question',
      section,
      isCalculationHeavy: false,
      isDiagramHeavy: diagramContext.detected,
      questionAllowed: true,
      contextMeta: contextMeta ? { ...contextMeta, prompt: `teachback_prompt_${attemptNumber}` } : undefined,
      qualityTrace,
    });
  }

  private async buildMemoryDumpPrompt(
    section: RoadmapSection,
    decision: TeachingDecision,
    teacherBrainContext = '',
    contextMeta?: { sessionId: string; materialId: string; sectionIndex: number },
    lessonPlan?: StudySectionLessonPlanRecord,
    qualityTrace?: TutorQualityTraceCapture,
  ) {
    if (teacherBrainContext && contextMeta) {
      console.log('teacher_brain_context_applied', {
        ...contextMeta,
        prompt: 'memory_dump_prompt',
      });
    }
    const prompt = [
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      lessonPlan?.promptContext ? `Lesson plan context:\n${lessonPlan.promptContext}` : '',
      `Section content:\n${truncate(section.content, 2600)}`,
      lessonPlan?.checkpointFocus.length ? `Memory dump should target these ideas: ${truncateList(lessonPlan.checkpointFocus, 4, 120).join(' | ')}` : '',
      `Teaching decision:\n${buildTeachingDecisionPromptLines(decision, { includeCheckpoint: true }).join('\n')}`,
      'Ask the student for a memory dump. Tell them to write or say everything they remember from this section without checking notes.',
    ].join('\n\n');
    if (contextMeta) {
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
    return this.enforceTutorMessageQuality({
      content: rawContent,
      prompt,
      maxTokens: 220,
      phase: 'CHECKPOINT',
      turnType: 'checkpoint_question',
      section,
      isCalculationHeavy: false,
      isDiagramHeavy: false,
      questionAllowed: true,
      contextMeta: contextMeta ? { ...contextMeta, prompt: 'memory_dump_prompt' } : undefined,
      qualityTrace,
    });
  }

  private async buildGapReteach(
    section: RoadmapSection,
    failedConcepts: string[],
    decision: TeachingDecision,
    teacherBrainContext = '',
    contextMeta?: { sessionId: string; materialId: string; sectionIndex: number },
    teacherBrainSectionContext?: TeacherBrainSectionContext,
    lessonPlan?: StudySectionLessonPlanRecord,
    relevantMaterialContext?: RelevantMaterialContext,
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
    const prompt = [
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      lessonPlan?.promptContext ? `Lesson plan context:\n${lessonPlan.promptContext}` : '',
      relevantMaterialContext?.promptContext ? `Relevant material context:\n${relevantMaterialContext.promptContext}` : '',
      calculationContext.detected ? `Calculation context:\n${calculationContext.summary}` : '',
      diagramContext.detected ? `Diagram context:\n${diagramContext.summary}` : '',
      `Section content:\n${truncate(section.content, 3000)}`,
      `Missing or weak ideas:\n${failedConcepts.join('\n') || 'The explanation was too thin.'}`,
      lessonPlan?.fallbackPlan.length ? `Use this fallback plan: ${truncateList(lessonPlan.fallbackPlan, 5, 120).join(' | ')}` : '',
      `Teaching decision:\n${buildTeachingDecisionPromptLines(decision, { includeReteach: true }).join('\n')}`,
      calculationContext.detected
        ? 'Task: reteach this section more simply. Use one small numeric example labelled simple example, explain the method step by step, and warn about one common calculation mistake. Then tell the student they will try the teach-back again.'
        : diagramContext.detected
          ? 'Task: reteach this section using a simple verbal visualization. Say things like imagine this as, start from the left or top or center, the arrow means, and this part connects to. Then tell the student they will try the teach-back again.'
          : 'Task: reteach this section in a simpler way with one easy analogy, then tell the student they will try the teach-back again.',
    ].join('\n\n');
    if (contextMeta) {
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
      turnType: 'reteach',
      section,
      isCalculationHeavy: calculationContext.detected,
      isDiagramHeavy: diagramContext.detected,
      questionAllowed: false,
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
    relevantMaterialContext?: RelevantMaterialContext,
    qualityTrace?: TutorQualityTraceCapture,
  ) {
    const prompt = [
      `Section title: ${section.title}`,
      teacherBrainContext ? `Teacher Brain context:\n${teacherBrainContext}` : '',
      studentMemoryPromptContext ? `Student memory context:\n${studentMemoryPromptContext}` : '',
      relevantMaterialContext?.promptContext ? `Relevant material context:\n${relevantMaterialContext.promptContext}` : '',
      `Section content:\n${truncate(section.content, 2600)}`,
      `Student interruption:\n${truncate(studentResponse, 600)}`,
      `Teaching decision:\n${buildTeachingDecisionPromptLines(decision, { includeInterrupt: true, includeCheckpoint: true }).join('\n')}`,
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
      contextMeta: contextMeta ? { ...contextMeta, prompt: 'interrupt_response' } : undefined,
      qualityTrace,
    });
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
    const { state, roadmap, material, teacherBrain, studentMemoryContext, learningIntelligenceContext, studentLearningProfileContext } = await this.loadSessionContext(sessionId);
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
    const teachingDecision = this.createTeachingDecision({
      phase: state.current_phase,
      section,
      teacherBrainSectionContext,
      teacherBrainContext,
      studentMemoryContext,
      lessonPlan,
      calculationContext: sectionCalculationContext,
      diagramContext: sectionDiagramContext,
      relevantMaterialContext,
      learningIntelligenceContext,
      studentLearningProfileContext,
      currentMasteryScore: state.last_mastery_score,
      lastMasteryScore: state.last_mastery_score,
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
      },
    });

    if (!trimmed) {
      throw new Error('Please send a response so Akademi can continue the study flow.');
    }

    if (state.current_phase === PASS_1) {
      if (isInterrupt || !isAutoContinue) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await this.startTutorTrace(buildTraceSeed(PASS_1, 'checkpoint_question', 'interrupt_response', true));
        try {
          const aiStartedAt = Date.now();
          const content = await this.buildInterruptResponse(section, trimmed, teachingDecision, teacherBrainContext, contextMeta, studentMemoryContext.promptContext, relevantMaterialContext, qualityTrace);
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
        const content = await this.buildTeachingPass(section, 1, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, studentMemoryContext.promptContext, lessonPlan, relevantMaterialContext, qualityTrace);
        trace.aiLatencyMs += Date.now() - aiStartedAt;
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: PASS_2,
          pending_prompt: content,
          section_context: {} as Prisma.InputJsonValue,
        });
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

    if (state.current_phase === PASS_2) {
      if (isInterrupt || !isAutoContinue) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await this.startTutorTrace(buildTraceSeed(PASS_2, 'checkpoint_question', 'interrupt_response', true));
        try {
          const aiStartedAt = Date.now();
          const content = await this.buildInterruptResponse(section, trimmed, teachingDecision, teacherBrainContext, contextMeta, studentMemoryContext.promptContext, relevantMaterialContext, qualityTrace);
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
        const content = await this.buildTeachingPass(section, 2, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, studentMemoryContext.promptContext, lessonPlan, relevantMaterialContext, qualityTrace);
        trace.aiLatencyMs += Date.now() - aiStartedAt;
        await this.persistRoadmap(state.id, roadmap, {
          current_phase: PASS_3,
          pending_prompt: content,
          section_context: {} as Prisma.InputJsonValue,
        });
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

    if (state.current_phase === PASS_3) {
      if (isInterrupt || !isAutoContinue) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await this.startTutorTrace(buildTraceSeed(PASS_3, 'checkpoint_question', 'interrupt_response', true));
        try {
          const aiStartedAt = Date.now();
          const content = await this.buildInterruptResponse(section, trimmed, teachingDecision, teacherBrainContext, contextMeta, studentMemoryContext.promptContext, relevantMaterialContext, qualityTrace);
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
      if (!sectionContext.pass3QuestionPending) {
        const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
        const trace = await this.startTutorTrace(buildTraceSeed(PASS_3, 'teaching', 'teaching_pass_3', true));
        try {
          const aiStartedAt = Date.now();
          const content = await this.buildTeachingPass(section, 3, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, studentMemoryContext.promptContext, lessonPlan, relevantMaterialContext, qualityTrace);
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await this.persistRoadmap(state.id, roadmap, {
            current_phase: PASS_3,
            pending_prompt: content,
            section_context: { pass3QuestionPending: true } as Prisma.InputJsonValue,
          });
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

      const qualityTrace: TutorQualityTraceCapture = { issues: [], regenerated: false, fallbackUsed: false, correctionApplied: false };
      const trace = await this.startTutorTrace(buildTraceSeed(TEACHBACK_1, 'checkpoint_question', 'teachback_prompt_1', true));
      try {
        const aiStartedAt = Date.now();
        const content = await this.buildTeachBackPrompt(section, 1, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, lessonPlan, qualityTrace);
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
      if (isInterrupt || !isAutoContinue) {
        const content = await this.buildInterruptResponse(section, trimmed, teachingDecision, teacherBrainContext, contextMeta, '', relevantMaterialContext);
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
          const content = await this.buildGapReteach(section, sectionContext.failedConcepts || [], teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, lessonPlan, relevantMaterialContext, qualityTrace);
          trace.aiLatencyMs += Date.now() - aiStartedAt;
          await this.persistRoadmap(state.id, roadmap, {
            current_phase: GAP_RETEACH,
            pending_prompt: content,
            section_context: {
              ...sectionContext,
              reteachDelivered: true,
            } as Prisma.InputJsonValue,
          });
          const response = {
            content,
            metadata: await this.buildTurnMetadata(sessionId, 'reteach', {
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
            ? await this.buildTeachBackPrompt(section, 2, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, lessonPlan, qualityTrace)
            : await this.buildMemoryDumpPrompt(section, teachingDecision, teacherBrainContext, contextMeta, lessonPlan, qualityTrace);
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
          content = await this.buildMemoryDumpPrompt(section, teachingDecision, teacherBrainContext, contextMeta, lessonPlan, qualityTrace);
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

      const latestStudentMemory = await this.compressStudentSectionMemory({
        userId: state.user_id,
        materialId: state.material_id,
        courseCode: state.course_code,
        sectionIndex: state.current_section_index,
        sectionTitle: section.title,
        sectionContent: section.content,
        passed,
        score: finalScore,
        failedConcepts,
        calculationContext: sectionCalculationContext,
        diagramContext: sectionDiagramContext,
        teachBackAttempts: latestTeachBackAttempts,
        memoryDumpEvaluation: {
          studentResponse: trimmed,
          evaluation: evaluation.evaluation,
          score: evaluation.score,
        },
      });

      let latestTeachingReflection: TeachingReflectionRow | null = null;
      try {
        latestTeachingReflection = await this.createTeachingReflectionAfterSection({
          sessionId,
          companionStateId: state.id,
          userId: state.user_id,
          materialId: state.material_id,
          courseCode: state.course_code,
          sectionIndex: state.current_section_index,
          sectionTitle: section.title,
          sectionContent: section.content,
          decision: teachingDecision,
          score: finalScore,
          passed,
          failedConcepts,
          calculationContext: sectionCalculationContext,
          diagramContext: sectionDiagramContext,
          studentMemoryContext,
          latestStudentMemory: latestStudentMemory as StudentMaterialMemoryRow,
          teachBackAttempts: latestTeachBackAttempts,
          memoryDumpEvaluation: {
            studentResponse: trimmed,
            evaluation: evaluation.evaluation,
            score: evaluation.score,
          },
        });
      } catch (reflectionError) {
        console.error('teaching_reflection_failed', {
          sessionId,
          sectionIndex: state.current_section_index,
          message: reflectionError instanceof Error ? reflectionError.message : 'Unknown reflection failure',
        });
      }

      try {
        await this.createLearningIntelligenceRecordAfterSection({
          sessionId,
          companionStateId: state.id,
          userId: state.user_id,
          materialId: state.material_id,
          courseCode: state.course_code,
          sectionIndex: state.current_section_index,
          sectionTitle: section.title,
          sectionContent: section.content,
          score: finalScore,
          passed,
          failedConcepts,
          calculationContext: sectionCalculationContext,
          diagramContext: sectionDiagramContext,
          studentMemoryContext,
          latestStudentMemory: latestStudentMemory as StudentMaterialMemoryRow,
          latestTeachingReflection,
          teachBackAttempts: latestTeachBackAttempts,
          memoryDumpEvaluation: {
            studentResponse: trimmed,
            evaluation: evaluation.evaluation,
            score: evaluation.score,
          },
        });
      } catch (learningIntelligenceError) {
        console.error('learning_intelligence_failed', {
          sessionId,
          sectionIndex: state.current_section_index,
          message: learningIntelligenceError instanceof Error ? learningIntelligenceError.message : 'Unknown learning intelligence failure',
        });
      }

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
        const nextTeachingDecision = this.createTeachingDecision({
          phase: PASS_1,
          section: nextSection,
          teacherBrainSectionContext: nextTeacherBrainSectionContext,
          teacherBrainContext: nextTeacherBrainContext,
          studentMemoryContext: nextStudentMemoryContext,
          lessonPlan: nextLessonPlan,
          calculationContext: nextSectionCalculationContext,
          diagramContext: nextSectionDiagramContext,
          relevantMaterialContext: nextRelevantMaterialContext,
          learningIntelligenceContext: nextLearningIntelligenceContext,
          studentLearningProfileContext,
          currentMasteryScore: state.last_mastery_score,
          lastMasteryScore: state.last_mastery_score,
        });
        const content = await this.buildTeachingPass(nextSection, 1, nextTeachingDecision, nextTeacherBrainContext, {
          sessionId,
          materialId: material.id,
          sectionIndex: nextIndex,
        }, nextTeacherBrainSectionContext, nextStudentMemoryContext.promptContext, nextLessonPlan, nextRelevantMaterialContext);
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
        const nextTeachingDecision = this.createTeachingDecision({
          phase: PASS_1,
          section: nextSection,
          teacherBrainSectionContext: nextTeacherBrainSectionContext,
          teacherBrainContext: nextTeacherBrainContext,
          studentMemoryContext: nextStudentMemoryContext,
          lessonPlan: nextLessonPlan,
          calculationContext: nextSectionCalculationContext,
          diagramContext: nextSectionDiagramContext,
          relevantMaterialContext: nextRelevantMaterialContext,
          learningIntelligenceContext: nextLearningIntelligenceContext,
          studentLearningProfileContext,
          currentMasteryScore: state.last_mastery_score,
          lastMasteryScore: state.last_mastery_score,
        });
        const content = await this.buildTeachingPass(nextSection, 1, nextTeachingDecision, nextTeacherBrainContext, {
          sessionId,
          materialId: material.id,
          sectionIndex: nextIndex,
        }, nextTeacherBrainSectionContext, nextStudentMemoryContext.promptContext, nextLessonPlan, nextRelevantMaterialContext);
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

    const fallback = await this.buildTeachBackPrompt(section, 1, teachingDecision, teacherBrainContext, contextMeta, teacherBrainSectionContext, lessonPlan);
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

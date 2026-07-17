import { StudyCompanionPhase, StudyRoadmapStatus } from '@prisma/client';
import { TeachingPace, TeachingStrategy } from './teaching-decision-engine';

export type ReaderPageShape = {
  id: string;
  chapterTitle: string;
  pageTitle: string;
  content: string;
  pageNumber: number;
  pageCountInChapter: number;
};

export type RoadmapSection = {
  key: string;
  title: string;
  content: string;
  status: StudyRoadmapStatus;
  pageStart: number;
  pageEnd: number;
};

export type TeacherBrainSummary = {
  material_title?: string;
  overall_summary?: string;
  main_learning_goal?: string;
  difficulty_level?: string;
  recommended_study_order?: string[];
};

export type TeacherBrainChapterSummary = {
  section_index?: number;
  title?: string;
  summary?: string;
  key_points?: string[];
  why_it_matters?: string;
  connects_to?: string[];
};

export type TeacherBrainConcept = {
  concept?: string;
  depends_on?: string[];
  leads_to?: string[];
  section_indexes?: number[];
  importance?: 'low' | 'medium' | 'high' | string;
};

export type TeacherBrainPrerequisite = {
  concept?: string;
  needed_for?: string;
  section_index?: number;
  student_should_know?: string;
};

export type TeacherBrainFormula = {
  name?: string;
  formula_latex?: string;
  variables?: string[];
  section_index?: number;
  when_to_use?: string;
};

export type TeacherBrainCalculationMethod = {
  topic?: string;
  section_index?: number;
  method_steps?: string[];
  worked_example_summary?: string;
  common_mistakes?: string[];
  unit_or_answer_format?: string;
};

export type TeacherBrainDiagram = {
  title?: string;
  section_index?: number;
  diagram_type?: string;
  description?: string;
  when_to_show?: string;
  student_should_notice?: string[];
};

export type TeacherBrainMisconception = {
  misconception?: string;
  correction?: string;
  section_index?: number;
};

export type TeacherBrainExamAngle = {
  section_index?: number;
  likely_question_type?: string;
  what_examiner_tests?: string;
  how_to_answer?: string;
};

export type TeacherBrainNotes = {
  teaching_style?: string;
  best_analogies?: string[];
  sections_that_need_extra_care?: string[];
  calculation_heavy_sections?: number[];
  diagram_heavy_sections?: number[];
  recommended_teaching_sequence?: string[];
};

export type ParsedTeacherBrain = {
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

export type TeacherBrainSectionContext = {
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

export type CalculationTeachingContext = {
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

export type DiagramTeachingContext = {
  detected: boolean;
  diagrams: TeacherBrainDiagram[];
  imageDescriptions: string[];
  subjectFamily: string | null;
  summary: string;
};

export type StudyVisualSuggestedRenderer =
  | 'mental_model'
  | 'flowchart'
  | 'graph'
  | 'equation_breakdown'
  | 'labeled_diagram'
  | 'process_steps'
  | 'table'
  | 'future_image_generation';

export type StudyVisualItem = {
  title: string;
  diagramType: string;
  description: string;
  whenToShow: string;
  studentShouldNotice: string[];
  suggestedRenderer: StudyVisualSuggestedRenderer;
  priority: number;
};

export type StudyVisualPlan = {
  sectionIndex: number;
  sectionTitle: string;
  isDiagramHeavy: boolean;
  visuals: StudyVisualItem[];
};

export type StudentMemoryRecord = {
  understood: string[];
  weakPoints: string[];
  misconceptions: string[];
  calculationIssues: string[];
  diagramIssues: string[];
  preferredExplanationStyle: string | null;
  revisitLater: string[];
  compressedSummary: string | null;
};

export type StudySectionLessonPlanRecord = {
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

export type StudentMemoryContext = {
  previousSectionMemory: StudentMemoryRecord | null;
  priorMemories: StudentMemoryRecord[];
  promptContext: string;
};

export type RelevantMaterialChunk = {
  chunkIndex: number;
  excerpt: string;
  whyRelevant: string;
  score: number;
};

export type RelevantMaterialContext = {
  chunks: RelevantMaterialChunk[];
  promptContext: string;
};

export type LessonScope = {
  primaryObjective: string;
  inScopeConcepts: string[];
  supportingConcepts: string[];
  prerequisiteConcepts: string[];
  previewOnlyConcepts: string[];
  outOfScopeConcepts: string[];
  allowedExamples: string[];
  forbiddenExpansions: string[];
  scopeDirectives: string[];
};

export type ScopeViolation = {
  violated: boolean;
  violations: string[];
  forbiddenConceptsFound: string[];
  previewConceptsOverExplained: string[];
};

export type TeachingDepthPlan = {
  targetDepth: 'basic' | 'standard' | 'deep';
  minimumUnderstanding: string[];
  allowedDepthConcepts: string[];
  deferredDepthConcepts: string[];
  forbiddenDepthExpansions: string[];
  allowedExampleTypes: string[];
  maxReasoningLayers: number;
  maxExamples: number;
  depthDirectives: string[];
};

export type DepthViolation = {
  violated: boolean;
  violations: string[];
  deferredConceptsExplained: string[];
  tooManyReasoningLayers: boolean;
  tooManyExamples: boolean;
  tooAdvancedForPass: boolean;
};

export type TutorMessageQualityResult = {
  passed: boolean;
  issues: string[];
  correctedContent?: string;
};

export type TutorMessageQualityArgs = {
  content: string;
  phase: StudyCompanionPhase | 'INTRO' | 'CHECKPOINT' | 'RETEACH';
  turnType: 'teaching' | 'checkpoint_question' | 'reteach' | 'transition';
  section: RoadmapSection;
  isCalculationHeavy: boolean;
  isDiagramHeavy: boolean;
  questionAllowed: boolean;
  microQuestionAllowed?: boolean;
  completionProblemCheckpoint?: boolean;
  coveredConcepts?: string[];
  isFirstIntro?: boolean;
  targetWordRange?: { min: number; max: number };
  lessonScope?: LessonScope | null;
  teachingDepthPlan?: TeachingDepthPlan | null;
};

export type TutorQualityTraceCapture = {
  issues: string[];
  regenerated: boolean;
  fallbackUsed: boolean;
  correctionApplied: boolean;
};

export type TutorTraceRuntime = {
  id: string | null;
  startedAt: number;
  aiLatencyMs: number;
  metadata: Record<string, unknown>;
  quality: TutorQualityTraceCapture;
};

export type TutorTraceSeed = {
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

export type StudentMaterialMemoryRow = {
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

export type StudySectionLessonPlanRow = {
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

export type TeachingReflectionRow = {
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

export type TeachingReflectionRecord = {
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

export type LearningIntelligenceRecordRow = {
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

export type LearningIntelligenceContext = {
  masteryScore: number | null;
  conceptUnderstanding: number;
  proceduralAccuracy: number;
  reasoningQuality: number;
  confidence: number;
  hiddenConfusionRisk: number;
  hiddenConfusionLevel: 'low' | 'medium' | 'high';
  hiddenConfusionSignals: string[];
  recommendedConfusionIntervention:
    | 'none'
    | 'slow_down'
    | 'short_clarification'
    | 'prerequisite_repair'
    | 'mini_example'
    | 'visual_explanation';
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

export type PostAssessmentIntelligencePayload = {
  sessionId: string;
  companionStateId: string;
  userId: string;
  materialId: string;
  courseCode: string;
  sectionIndex: number;
  sectionTitle: string;
  masteryScore: number;
  masteryStatus: 'PASSED' | 'FAILED';
  failedConcepts: string[];
  teachingDecisionSnapshot?: Record<string, unknown>;
  calculationContextSnapshot?: string;
  diagramContextSnapshot?: string;
};

export type StudentLearningProfileContext = {
  preferredTeachingStrategy: TeachingStrategy | null;
  preferredPace: TeachingPace | null;
  strategySuccessScores: Partial<Record<TeachingStrategy, number>>;
  calculationSupportNeeded: boolean;
  visualSupportNeeded: boolean;
  confidenceSupportNeeded: boolean;
};

export type TutorSelfImprovementContext = {
  bestStrategies: string[];
  weakStrategies: string[];
  effectiveInterventions: string[];
  ineffectiveInterventions: string[];
  recommendedStrategy?: string;
  recommendedPace?: string;
  avoidPatterns: string[];
  reason: string;
};

export type LecturerConstraintRecord = {
  id: string;
  material_id: string | null;
  course_code: string | null;
  university: string | null;
  faculty: string | null;
  department: string | null;
  level: number | null;
  semester: number | null;
  title: string;
  description: string | null;
  required_order: unknown;
  must_cover_topics: unknown;
  do_not_skip_topics: unknown;
  preferred_terminology: unknown;
  required_methods: unknown;
  forbidden_methods: unknown;
  assessment_focus: unknown;
  unit_policy: string | null;
  proof_policy: string | null;
  calculation_policy: string | null;
  diagram_policy: string | null;
  strictness: string;
  is_active: boolean;
};

export type LecturerConstraintContext = {
  constraints: LecturerConstraintRecord[];
  promptContext: string;
  strictness: 'low' | 'medium' | 'high';
  requiredMethods: string[];
  forbiddenMethods: string[];
  assessmentFocus: string[];
  mustCoverTopics: string[];
};

export type MaterialEmbeddingRow = {
  chunk_index: number;
  chunk_text: string;
  embedding: unknown;
};

export type CompanionMetadata = {
  mode?: string;
  materialTitle?: string;
  chapterTitle?: string;
  roadmap?: string[];
};

export type CompanionResponseMetadata = {
  autoContinue?: boolean;
  waitForStudent?: boolean;
  nextAction?:
    | 'continue_teaching'
    | 'evaluate_answer'
    | 'ask_followup'
    | 'move_next';
  turnType?:
    | 'teaching'
    | 'checkpoint_question'
    | 'evaluation'
    | 'reteach'
    | 'transition';
  allowInterruption?: boolean;
  questionCount?: number;
  study_companion: PublicState | null;
};

export type SectionContext = {
  pass1QuestionPending?: boolean;
  pass2QuestionPending?: boolean;
  reteachDelivered?: boolean;
  nextPromptKind?: 'teachback_2' | 'memory_dump';
  failedConcepts?: string[];
  coveredConcepts?: string[];
  repairMode?: 'medium_prerequisite_repair' | 'full_section_reteach';
  repairConcepts?: string[];
  repairReason?: string;
  repairAttemptCount?: number;
  repairCheckpointAsked?: boolean;
  remediationRequired?: boolean;
  reteachCycleCount?: number;
};

export type HybridMasteryResult = {
  passedMastery: boolean;
  prerequisiteHealthy: boolean;
  shouldAdvance: boolean;
  shouldRunRepair: boolean;
  repairConcepts: string[];
  repairReason: string;
};

export type CompanionStartMode =
  | 'continue'
  | 'specific'
  | 'beginning'
  | 'roadmap';

export type PublicState = {
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
  passNumber: number | null;
  totalPasses: number;
};

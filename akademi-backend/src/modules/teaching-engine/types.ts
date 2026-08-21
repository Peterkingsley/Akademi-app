import {
  EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION,
  EPISODE_TEACHING_ANALYSIS_CONTRACT_VERSION,
  EPISODE_TEACHING_BLUEPRINT_SCHEMA_VERSION,
  PRODUCTION_DIALOGUE_SCHEMA_VERSION,
} from './schema';
import type { ConversationalQualityReport } from './conversational-quality.validator';
import type { Host1OpeningRepair } from './host1-opening-repair';
import type { BlueprintQualityReport } from './blueprint-quality.validator';
import type { CertaintyDriftWarning } from './certainty-drift.validator';

export type ClaimType =
  | 'SOURCE_FACT'
  | 'SOURCE_SYNTHESIS'
  | 'SUPPORTED_INFERENCE'
  | 'PEDAGOGICAL_ANALOGY'
  | 'PEDAGOGICAL_QUESTION';

export type EpistemicStatus =
  | 'CONFIRMED'
  | 'CONTEXT_DEPENDENT'
  | 'SOURCE_DISAGREEMENT'
  | 'AMBIGUOUS'
  | 'LOW_CONFIDENCE';

export type Complexity = 'FAST' | 'STANDARD' | 'DEEP';
export type ConceptTier = 'CORE_PILLAR' | 'SUPPORTING_MECHANISM' | 'OPTIONAL_CONTEXT' | 'PRUNED';
export type Host = 'HOST_1' | 'HOST_2';

export interface NormalizedSourceSegment {
  segment_id: string;
  text: string;
  location?: { page?: number; section?: string; timestamp_start_ms?: number; timestamp_end_ms?: number };
}

export interface NormalizedSource {
  source_id: string;
  type: 'MATERIAL' | 'PASTED_TEXT' | 'WEB_PAGE' | 'TRANSCRIPT' | 'OTHER';
  title: string;
  segments: NormalizedSourceSegment[];
}

export interface Evidence {
  evidence_id: string;
  source_id: string;
  location?: NormalizedSourceSegment['location'];
  verbatim_span: string;
  normalized_claim: string;
}

export interface Invariant {
  invariant_id: string;
  statement: string;
  claim_type: ClaimType;
  evidence_ids: string[];
  epistemic_status: EpistemicStatus;
  forbidden_exaggerations: string[];
}

export interface Misconception {
  misconception_id: string;
  naive_assumption: string;
  why_it_feels_intuitive: string;
  correction_target: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  must_surface_in_dialogue: boolean;
}

export interface Analogy {
  analogy_id: string;
  vehicle: string;
  purpose: string;
  mapping: Array<{ vehicle_element: string; concept_element: string }>;
  preserves_invariant_ids: string[];
  breakdown_boundary: string;
  forbidden_inferences: string[];
  analogy_risk: number;
  teaching_value: number;
}

export interface TeachingConcept {
  concept_id: string;
  canonical_name: string;
  tier: ConceptTier;
  teaching_priority: number;
  epistemic_status: EpistemicStatus;
  prerequisite_concept_ids: string[];
  invariants: Invariant[];
  causal_relationships: Array<{
    relationship_type: 'CAUSES' | 'ENABLES' | 'REQUIRES' | 'PREVENTS' | 'MITIGATES' | 'LIMITS' | 'CONTRASTS_WITH' | 'EXEMPLIFIES' | 'PART_OF' | 'RESULTS_IN' | 'RESOLVES';
    statement: string;
    evidence_ids: string[];
  }>;
  misconceptions: Misconception[];
  target_mental_model: { description: string; essential_relationships: string[]; learner_success_condition: string };
  analogy_candidates: Analogy[];
  selected_analogy_id: string | null;
  evidence_ids: string[];
}

export interface EpisodeTeachingAnalysis {
  schema_version: typeof EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION;
  analysis_contract_version: typeof EPISODE_TEACHING_ANALYSIS_CONTRACT_VERSION;
  analysis_metadata: { target_learner_level: string; requested_duration_minutes: number; user_focus: string | null; prompt_version: string };
  episode_thesis: { statement: string; claim_type: ClaimType; evidence_ids: string[]; epistemic_status: EpistemicStatus };
  episode_epistemic_goal: { learner_should_understand: string; learner_should_be_able_to_explain: string; learner_should_not_leave_believing: string[] };
  evidence_registry: Evidence[];
  concepts: TeachingConcept[];
  source_disagreements: string[];
  pruning_manifest: Array<{ concept_id: string; reason: string }>;
}

export interface BlueprintTurn {
  turn_id: string;
  speaker: Host;
  intent: 'FRAME_FRICTION' | 'EXPLAIN' | 'DEDUCE' | 'CHALLENGE' | 'REFRAME' | 'TEST_ANALOGY' | 'SYNTHESIZE' | 'CHECK_UNDERSTANDING' | 'CLOSE_LOOP';
  core_epistemic_payload: string;
  concept_ids: string[];
  invariant_ids: string[];
  misconception_ids: string[];
  evidence_ids: string[];
  /** Runtime provenance added after Call 2 semantic references are validated. */
  evidence_provenance?: BlueprintEvidenceProvenance[];
  analogy_id?: string | null;
}

export type BlueprintEvidenceOrigin =
  | 'MODEL_EXPLICIT'
  | 'INHERITED_FROM_INVARIANT'
  | 'INHERITED_FROM_CONCEPT'
  | 'INHERITED_FROM_MISCONCEPTION';

export interface BlueprintEvidenceProvenance {
  evidence_id: string;
  origins: BlueprintEvidenceOrigin[];
}

export interface BlueprintProvenanceReport {
  provenance_fields_enriched: number;
  turns: Array<{
    turn_id: string;
    evidence_ids: string[];
    evidence_provenance: BlueprintEvidenceProvenance[];
  }>;
}

export interface EpisodeTeachingBlueprint {
  schema_version: typeof EPISODE_TEACHING_BLUEPRINT_SCHEMA_VERSION;
  generation_metadata: { blueprint_prompt_version: string; complexity: Complexity };
  turns: BlueprintTurn[];
}

export interface DialogueTurn extends BlueprintTurn {
  spoken_text: string;
}

export interface ProductionDialogueScript {
  schema_version: typeof PRODUCTION_DIALOGUE_SCHEMA_VERSION;
  generation_metadata: { dialogue_prompt_version: string; model?: string };
  turns: DialogueTurn[];
}

export interface CriticDefect {
  defect_id: string;
  type: 'BAD_ANALOGY' | 'ANALOGY_LEAKAGE' | 'MISSING_PREREQUISITE' | 'SOURCE_DRIFT' | 'CLAIM_EXAGGERATION' | 'PASSIVE_HOST2' | 'UNEARNED_AHA' | 'JARGON_OVERLOAD' | 'WEAK_MENTAL_MODEL' | 'UNRESOLVED_LOOP' | 'PEDAGOGICAL_REDUNDANCY' | 'WEAK_SYNTHESIS' | 'PAYLOAD_LOSS';
  severity: 'HARD_BLOCKER' | 'SOFT_WARNING';
  turn_ids: string[];
  concept_ids: string[];
  invariant_ids: string[];
  evidence_ids: string[];
  description: string;
  repair_directive: string;
}

export interface CriticReview {
  verdict: 'PASS' | 'REPAIR_REQUIRED';
  defects: CriticDefect[];
}

export type FidelityRepairStatus =
  | 'REPAIRED'
  | 'PATCH_NO_MEANINGFUL_CHANGE'
  | 'PATCH_REPEATED_BLOCKED_CLAIM'
  | 'PATCH_CREATED_NEW_HARD_BLOCKER'
  | 'PATCH_FAILED_DETERMINISTIC_VALIDATION'
  | 'FIDELITY_BLOCKER_SURVIVED';

/** A sanitized, per-attempt record used to make bounded local repair auditable. */
export interface FidelityRepairObservation {
  defect_id: string;
  turn_id: string;
  defect_type: CriticDefect['type'];
  repair_attempt: number;
  original_text: string;
  proposed_text: string;
  deterministic_post_patch_result: {
    verdict: 'PASS' | 'REPAIR_REQUIRED';
    codes: string[];
    certainty_hard_blocker_turn_ids: string[];
  };
  fidelity_post_patch_result?: CriticReview;
  final_status: FidelityRepairStatus;
}

export interface TeachingEpisodeRequest {
  materialId?: string;
  sources?: NormalizedSource[];
  learnerLevel?: string;
  durationMinutes?: number;
  focus?: string | null;
  complexity?: Complexity;
}

export interface TeachingEpisodeResult {
  episodeId: string;
  analysis: EpisodeTeachingAnalysis;
  blueprint: EpisodeTeachingBlueprint;
  blueprintProvenance: BlueprintProvenanceReport;
  blueprintQuality: BlueprintQualityReport;
  dialogue: ProductionDialogueScript;
  /** Present only when the fidelity gate required a targeted repair. */
  preRepairDialogue: ProductionDialogueScript | null;
  fidelity: CriticReview | null;
  /** First review and, when applicable, the review after the bounded repair. */
  fidelityHistory: CriticReview[];
  /** Raw Call 4 verdicts before deterministic certainty escalation is merged. */
  semanticFidelityHistory: CriticReview[];
  conversationalQuality: ConversationalQualityReport;
  rawConversationalQuality: ConversationalQualityReport;
  host1OpeningRepairs: Host1OpeningRepair[];
  /** Per-defect local-repair trace. Included in validation diagnostics on failure. */
  fidelityRepairObservations: FidelityRepairObservation[];
  /** Warnings supplied to the initial Call 4 review before any patch. */
  initialCertaintyDriftWarnings: CertaintyDriftWarning[];
  certaintyDriftWarnings: CertaintyDriftWarning[];
  tts_handoff: Array<{ turn_id: string; speaker: Host; spoken_text: string }>;
  cachedAnalysis: boolean;
  analysisCacheStatus: AnalysisCacheStatus;
  instrumentation: TeachingGenerationInstrumentation;
}

export interface TeachingStageInstrumentation {
  stage: 'analysis' | 'blueprint' | 'dialogue' | 'fidelity' | 'targeted_patch';
  latencyMs: number;
  model?: string;
  attempt: number;
  cacheHit?: boolean;
  cacheStatus?: AnalysisCacheStatus;
  retryCount?: number;
  validationFailureReason?: string;
  unknownReferenceIds?: string[];
  /** Providers currently do not expose usage through the shared interface. */
  tokenUsage?: { input?: number; output?: number; total?: number };
}

export type AnalysisCacheStatus = 'HIT_VALID' | 'HIT_INVALIDATED_SCHEMA' | 'HIT_INVALIDATED_CONTRACT' | 'MISS';

export interface TeachingGenerationInstrumentation {
  totalLatencyMs: number;
  sourceRoute: string;
  sourceTokenEstimate: number;
  stages: TeachingStageInstrumentation[];
}

/** Canonical artifact versions and provider-agnostic structured-output shapes. */
export const EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION = '0.1' as const;
export const EPISODE_TEACHING_BLUEPRINT_SCHEMA_VERSION = '0.1' as const;
export const PRODUCTION_DIALOGUE_SCHEMA_VERSION = '0.1' as const;

// This is deliberately an OpenAPI-compatible subset: it is accepted by
// Gemini's responseSchema and OpenAI's json_schema response format. Runtime
// validation remains the semantic authority after the provider enforces shape.
const string = { type: 'string' } as const;
const stringList = { type: 'array', items: string } as const;
const evidenceIdList = { type: 'array', items: string } as const;
const claimType = { type: 'string', enum: ['SOURCE_FACT', 'SOURCE_SYNTHESIS', 'SUPPORTED_INFERENCE', 'PEDAGOGICAL_ANALOGY', 'PEDAGOGICAL_QUESTION'] } as const;
const epistemicStatus = { type: 'string', enum: ['CONFIRMED', 'CONTEXT_DEPENDENT', 'SOURCE_DISAGREEMENT', 'AMBIGUOUS', 'LOW_CONFIDENCE'] } as const;
const conceptTier = { type: 'string', enum: ['CORE_PILLAR', 'SUPPORTING_MECHANISM', 'OPTIONAL_CONTEXT', 'PRUNED'] } as const;
const causalRelationshipType = { type: 'string', enum: ['CAUSES', 'ENABLES', 'REQUIRES', 'PREVENTS', 'MITIGATES', 'LIMITS', 'CONTRASTS_WITH', 'EXEMPLIFIES', 'PART_OF', 'RESULTS_IN', 'RESOLVES'] } as const;
const misconceptionSeverity = { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] } as const;

export const EPISODE_TEACHING_ANALYSIS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    schema_version: { type: 'string', enum: [EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION] },
    analysis_metadata: {
      type: 'object',
      properties: { target_learner_level: string, requested_duration_minutes: { type: 'number' }, user_focus: { type: 'string', nullable: true }, prompt_version: string },
      required: ['target_learner_level', 'requested_duration_minutes', 'user_focus', 'prompt_version'],
    },
    episode_thesis: {
      type: 'object',
      properties: { statement: string, claim_type: claimType, evidence_ids: evidenceIdList, epistemic_status: epistemicStatus },
      required: ['statement', 'claim_type', 'evidence_ids', 'epistemic_status'],
    },
    episode_epistemic_goal: {
      type: 'object',
      properties: { learner_should_understand: string, learner_should_be_able_to_explain: string, learner_should_not_leave_believing: stringList },
      required: ['learner_should_understand', 'learner_should_be_able_to_explain', 'learner_should_not_leave_believing'],
    },
    evidence_registry: {
      type: 'array',
      items: {
        type: 'object',
        properties: { evidence_id: string, source_id: string, verbatim_span: string, normalized_claim: string },
        required: ['evidence_id', 'source_id', 'verbatim_span', 'normalized_claim'],
      },
    },
    concepts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          concept_id: string, canonical_name: string, tier: conceptTier, teaching_priority: { type: 'number', minimum: 0, maximum: 1 }, epistemic_status: epistemicStatus,
          prerequisite_concept_ids: stringList, evidence_ids: evidenceIdList, selected_analogy_id: { type: 'string', nullable: true },
          invariants: {
            type: 'array', items: {
              type: 'object', properties: { invariant_id: string, statement: string, claim_type: claimType, evidence_ids: evidenceIdList, epistemic_status: epistemicStatus, forbidden_exaggerations: stringList },
              required: ['invariant_id', 'statement', 'claim_type', 'evidence_ids', 'epistemic_status', 'forbidden_exaggerations'],
            },
          },
          causal_relationships: { type: 'array', items: { type: 'object', properties: { relationship_type: causalRelationshipType, statement: string, evidence_ids: evidenceIdList }, required: ['relationship_type', 'statement', 'evidence_ids'] } },
          misconceptions: { type: 'array', items: { type: 'object', properties: { misconception_id: string, naive_assumption: string, why_it_feels_intuitive: string, correction_target: string, severity: misconceptionSeverity, must_surface_in_dialogue: { type: 'boolean' } }, required: ['misconception_id', 'naive_assumption', 'why_it_feels_intuitive', 'correction_target', 'severity', 'must_surface_in_dialogue'] } },
          target_mental_model: { type: 'object', properties: { description: string, essential_relationships: stringList, learner_success_condition: string }, required: ['description', 'essential_relationships', 'learner_success_condition'] },
          analogy_candidates: { type: 'array', items: { type: 'object', properties: { analogy_id: string, vehicle: string, purpose: string, mapping: { type: 'array', items: { type: 'object', properties: { vehicle_element: string, concept_element: string }, required: ['vehicle_element', 'concept_element'] } }, preserves_invariant_ids: stringList, breakdown_boundary: string, forbidden_inferences: stringList, analogy_risk: { type: 'number' }, teaching_value: { type: 'number' } }, required: ['analogy_id', 'vehicle', 'purpose', 'mapping', 'preserves_invariant_ids', 'breakdown_boundary', 'forbidden_inferences', 'analogy_risk', 'teaching_value'] } },
        },
        required: ['concept_id', 'canonical_name', 'tier', 'teaching_priority', 'epistemic_status', 'prerequisite_concept_ids', 'invariants', 'causal_relationships', 'misconceptions', 'target_mental_model', 'analogy_candidates', 'selected_analogy_id', 'evidence_ids'],
      },
    },
    source_disagreements: stringList,
    pruning_manifest: { type: 'array', items: { type: 'object', properties: { concept_id: string, reason: string }, required: ['concept_id', 'reason'] } },
  },
  required: ['schema_version', 'analysis_metadata', 'episode_thesis', 'episode_epistemic_goal', 'evidence_registry', 'concepts', 'source_disagreements', 'pruning_manifest'],
} as const;

export const ANALYSIS_STRUCTURED_OUTPUT = {
  name: 'episode_teaching_analysis',
  schema: EPISODE_TEACHING_ANALYSIS_RESPONSE_SCHEMA,
} as const;

export const EPISODE_TEACHING_BLUEPRINT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    schema_version: { type: 'string', enum: [EPISODE_TEACHING_BLUEPRINT_SCHEMA_VERSION] },
    generation_metadata: {
      type: 'object',
      properties: {
        blueprint_prompt_version: string,
        complexity: { type: 'string', enum: ['FAST', 'STANDARD', 'DEEP'] },
      },
      required: ['blueprint_prompt_version', 'complexity'],
    },
    turns: {
      type: 'array', minItems: 2,
      items: {
        type: 'object',
        properties: {
          turn_id: string,
          speaker: { type: 'string', enum: ['HOST_1', 'HOST_2'] },
          intent: { type: 'string', enum: ['FRAME_FRICTION', 'EXPLAIN', 'DEDUCE', 'CHALLENGE', 'REFRAME', 'TEST_ANALOGY', 'SYNTHESIZE', 'CHECK_UNDERSTANDING', 'CLOSE_LOOP'] },
          core_epistemic_payload: string,
          concept_ids: stringList,
          invariant_ids: stringList,
          misconception_ids: stringList,
          evidence_ids: evidenceIdList,
          analogy_id: { type: 'string', nullable: true },
        },
        required: ['turn_id', 'speaker', 'intent', 'core_epistemic_payload', 'concept_ids', 'invariant_ids', 'misconception_ids', 'evidence_ids', 'analogy_id'],
      },
    },
  },
  required: ['schema_version', 'generation_metadata', 'turns'],
} as const;

export const BLUEPRINT_STRUCTURED_OUTPUT = {
  name: 'episode_teaching_blueprint',
  schema: EPISODE_TEACHING_BLUEPRINT_RESPONSE_SCHEMA,
} as const;

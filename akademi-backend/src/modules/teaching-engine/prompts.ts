import { EpisodeTeachingAnalysis, EpisodeTeachingBlueprint, NormalizedSource, ProductionDialogueScript } from './types';

export const PROMPT_VERSIONS = {
  analysis: '0.1',
  blueprint: '0.1',
  dialogue: '0.1',
  fidelity: '0.1',
  patch: '0.1',
} as const;

const jsonOnly = 'Return one valid JSON object only. Do not use Markdown or reveal private reasoning.';

export const analysisSystemPrompt = `${jsonOnly}
You are Akademi's Teaching Intelligence Analyzer. You do not write dialogue.
Build a source-grounded teaching model before prose exists. The source is the factual boundary.
Every factual or synthesized claim must cite evidence IDs. Separate SOURCE_FACT, SOURCE_SYNTHESIS, SUPPORTED_INFERENCE, PEDAGOGICAL_ANALOGY, and PEDAGOGICAL_QUESTION.
For each core concept: expose learner friction before solution, give at least one invariant and forbidden exaggerations, identify misconception, define a predictive mental model, dependencies, and only use an analogy with explicit mapping, boundary, forbidden inferences, and risk 0..1.
Never turn “rare” into “impossible”, “reduces” into “eliminates”, or a source disagreement into consensus.`;

export const blueprintSystemPrompt = `${jsonOnly}
You are Akademi's Epistemic Conversation Director. You receive validated teaching analysis and create a teaching plan, not polished dialogue.
Host 2 is an intelligent novice: it must deduce, challenge, test an analogy, reframe, synthesize, or check understanding. At least 70% of Host 2 turns must perform one of those actions. No empty encouragement.
Order by conceptual dependency, create friction before explanation, surface high-severity misconceptions, preserve evidence IDs, and close the main loop. No more than two consecutive turns by one host.`;

export const dialogueSystemPrompt = `${jsonOnly}
You are Akademi's Dialogue Realizer. Realize the supplied blueprint into natural two-host educational speech.
Do not invent facts, evidence IDs, concepts, or teaching moves. Preserve each turn ID, speaker, intent, bindings, and core epistemic payload. Keep analogies within their explicit boundary. Host 2 must perform the planned reasoning, not cheerlead. Keep each turn under 220 words.`;

export const fidelitySystemPrompt = `${jsonOnly}
You are Akademi's Semantic Fidelity and Pedagogical Gate. Review the dialogue against analysis, blueprint, and evidence.
You are a constrained critic, not a rewriter. Return PASS or REPAIR_REQUIRED with actionable defects only.
Detect SOURCE_DRIFT, CLAIM_EXAGGERATION, ANALOGY_LEAKAGE, BAD_ANALOGY, MISSING_PREREQUISITE, PASSIVE_HOST2, UNEARNED_AHA, JARGON_OVERLOAD, WEAK_MENTAL_MODEL, UNRESOLVED_LOOP, PEDAGOGICAL_REDUNDANCY, WEAK_SYNTHESIS, and PAYLOAD_LOSS. HARD_BLOCKER defects prevent TTS.`;

export const patchSystemPrompt = `${jsonOnly}
You are Akademi's Targeted Dialogue Repair Engine. Replace only the affected dialogue turns.
Preserve turn IDs, speaker assignments, intent, evidence bindings, invariant bindings, misconception bindings, and conversational continuity. Do not introduce facts. Do not regenerate unrelated turns.`;

export function analysisPrompt(sources: NormalizedSource[], learnerLevel: string, durationMinutes: number, focus: string | null) {
  return JSON.stringify({
    task: 'Create EpisodeTeachingAnalysis',
    schema_version: '0.1',
    analysis_metadata: { target_learner_level: learnerLevel, requested_duration_minutes: durationMinutes, user_focus: focus, prompt_version: PROMPT_VERSIONS.analysis },
    required_shape: {
      episode_thesis: { statement: 'string', claim_type: 'SOURCE_SYNTHESIS', evidence_ids: ['EV_001'], epistemic_status: 'CONFIRMED' },
      episode_epistemic_goal: {}, evidence_registry: [], concepts: [], source_disagreements: [], pruning_manifest: [],
    },
    sources,
  });
}

export function blueprintPrompt(analysis: EpisodeTeachingAnalysis, complexity: string) {
  return JSON.stringify({
    task: 'Create EpisodeTeachingBlueprint', schema_version: '0.1',
    generation_metadata: { blueprint_prompt_version: PROMPT_VERSIONS.blueprint, complexity },
    required_turn_fields: ['turn_id', 'speaker', 'intent', 'core_epistemic_payload', 'concept_ids', 'invariant_ids', 'misconception_ids', 'evidence_ids', 'analogy_id'],
    analysis,
  });
}

export function dialoguePrompt(analysis: EpisodeTeachingAnalysis, blueprint: EpisodeTeachingBlueprint) {
  return JSON.stringify({
    task: 'Create ProductionDialogueScript', schema_version: '0.1',
    generation_metadata: { dialogue_prompt_version: PROMPT_VERSIONS.dialogue },
    required_turn_fields: ['turn_id', 'speaker', 'intent', 'core_epistemic_payload', 'concept_ids', 'invariant_ids', 'misconception_ids', 'evidence_ids', 'analogy_id', 'spoken_text'],
    analysis, blueprint,
  });
}

export function fidelityPrompt(analysis: EpisodeTeachingAnalysis, blueprint: EpisodeTeachingBlueprint, dialogue: ProductionDialogueScript) {
  return JSON.stringify({ task: 'Create CriticReview', analysis, blueprint, dialogue });
}

export function patchPrompt(analysis: EpisodeTeachingAnalysis, blueprint: EpisodeTeachingBlueprint, dialogue: ProductionDialogueScript, defects: unknown[]) {
  return JSON.stringify({ task: 'Return only replacement dialogue turns', analysis, blueprint, dialogue, defects });
}

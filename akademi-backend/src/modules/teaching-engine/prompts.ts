import { EpisodeTeachingAnalysis, EpisodeTeachingBlueprint, NormalizedSource, ProductionDialogueScript } from './types';
import type { CertaintyDriftWarning } from './certainty-drift.validator';
import {
  EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION,
  EPISODE_TEACHING_ANALYSIS_CONTRACT_VERSION,
  EPISODE_TEACHING_BLUEPRINT_SCHEMA_VERSION,
  PRODUCTION_DIALOGUE_SCHEMA_VERSION,
} from './schema';

export const PROMPT_VERSIONS = {
  analysis: '0.1',
  blueprint: '0.3',
  dialogue: '0.2',
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
Prefer inference from established premises, partial hypotheses, predictions, and concise statements over answer-shaped confirmation questions. Do not make Host 2 merely say “So what you're saying is X?”, “So basically X, right?”, or “So the answer is X?” when X is the intended payload. Let Host 2 reason forward with uncertainty; it does not need to end every reasoning move with a question mark.
For every Host 2 turn—especially DEDUCE, REFRAME, SYNTHESIZE, and CHECK_UNDERSTANDING—plan exactly one primary epistemic operation: infer one consequence, test one boundary, challenge one assumption, connect two concepts, predict one outcome, or rephrase one invariant. Give Host 2 one primary relationship and no more than two tightly coupled claims; a second claim is allowed only to complete that same inference. Mechanism plus its directly attached qualification is acceptable (“randomness lowers collision risk, but does not eliminate it”). Do not assign Host 2 a combination of mechanism, downstream consequence, recovery, exception, and global conclusion in one payload. Never give Host 2 broad conclusions about reliability, robustness, availability, efficiency, or stable operation unless that global relationship is the specific concept being taught. Spread multi-layer reasoning across speakers: let Host 2 make a partial discovery, then let Host 1 add the remaining qualification, recovery behavior, or global takeaway. A late Host 2 turn is still a learner move, not a narrator summary; it may remain tentative or unresolved.
Order by conceptual dependency, create friction before explanation, surface high-severity misconceptions, preserve evidence IDs, and close the main loop. No more than two consecutive turns by one host.`;

export const dialogueSystemPrompt = `${jsonOnly}
You are Akademi's Dialogue Realizer. Realize the supplied blueprint into natural two-host educational speech.
Do not invent facts, evidence IDs, concepts, or teaching moves. Preserve each turn ID, speaker, intent, bindings, and core epistemic payload. Keep analogies within their explicit boundary. Host 2 must perform the planned reasoning, not cheerlead.
For Host 2, the blueprint specifies the insight that must occur; it does not require a polished recital of every implication in that insight. Realize one clear cognitive move at a time: a concise observation, partial inference, tentative consequence, targeted challenge, boundary question, connection, or prediction. Usually use one or two light spoken sentences and favor the lower end of the turn budget unless elaboration is essential. Preserve the planned relationship, but do not restate its premise, mechanism, consequence, and takeaway all in one turn.
Host 2 should sound like understanding is arriving in the conversation: “Wait—once those votes split, they cannot reshuffle them in that term?”, “Then retrying does not solve it if everybody retries together.”, or “Oh, so the random part is who gets a head start.” Prefer direct cognition over formal recap language such as “So, essentially”, “So, if I’m understanding this”, “In other words”, “What this means is”, “So the key point is”, “Therefore”, or “So, to summarize”. Do not turn every active move into a question; concise statements are welcome. Use “Wait—”, “Oh—”, “But then—”, or “Hang on—” only for a real reasoning transition. Never add fake human noise, stuttering, filler, or random laughter.
Host 1 should leave the next planned Host 2 deduction available to discover. When Host 2 is scheduled to infer a consequence, Host 1 may establish the prerequisite but must not state that inference first. The full dialogue across turns must still teach the complete source-grounded mechanism.
Host 1 responds to the idea, not by grading Host 2. Do not open Host 1 turns with teacher praise, approval, or learner validation unless it is necessary for meaning. Prefer the explanation, correction, consequence, or boundary directly. Avoid educational-demo commentary such as “brilliant piece of engineering”, “beautiful solution”, “perfect illustration”, “excellent observation”, or declaring an idea clever or important; explain why it matters instead. Brief natural acknowledgements such as “Right—”, “Okay, then—”, or “Wait—” are fine when they immediately lead into reasoning. Keep each turn under 220 words.`;

export const fidelitySystemPrompt = `${jsonOnly}
You are Akademi's Semantic Fidelity and Pedagogical Gate. Review the dialogue against analysis, blueprint, and evidence.
You are a constrained critic, not a rewriter. Return PASS or REPAIR_REQUIRED with actionable defects only.
Detect SOURCE_DRIFT, CLAIM_EXAGGERATION, ANALOGY_LEAKAGE, BAD_ANALOGY, MISSING_PREREQUISITE, PASSIVE_HOST2, UNEARNED_AHA, JARGON_OVERLOAD, WEAK_MENTAL_MODEL, UNRESOLVED_LOOP, PEDAGOGICAL_REDUNDANCY, WEAK_SYNTHESIS, and PAYLOAD_LOSS. HARD_BLOCKER defects prevent TTS.
Recovery capability does not imply guaranteed eventual success. Distinguish carefully between another attempt, high probability, mitigation, rare failure, and an eventual guarantee. If a deterministic POSSIBLE_CERTAINTY_DRIFT warning is supplied, audit that turn against its bound evidence explicitly. Unless the supplied source establishes the same certainty, wording such as “ensures”, “guarantees”, “always”, “will eventually succeed”, “cannot fail”, or “prevents” must produce a CLAIM_EXAGGERATION HARD_BLOCKER. A source saying that a system can retry or gets another opportunity supports another chance, not a guarantee of recovery.`;

export const patchSystemPrompt = `${jsonOnly}
You are Akademi's Targeted Dialogue Repair Engine. Replace only the affected dialogue turns.
Preserve turn IDs, speaker assignments, intent, evidence bindings, invariant bindings, misconception bindings, and conversational continuity. Do not introduce facts. Do not regenerate unrelated turns.`;

export function analysisPrompt(sources: NormalizedSource[], learnerLevel: string, durationMinutes: number, focus: string | null) {
  return JSON.stringify({
    task: 'Create EpisodeTeachingAnalysis',
    schema_version: EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION,
    analysis_contract_version: EPISODE_TEACHING_ANALYSIS_CONTRACT_VERSION,
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
    task: 'Create EpisodeTeachingBlueprint', schema_version: EPISODE_TEACHING_BLUEPRINT_SCHEMA_VERSION,
    generation_metadata: { blueprint_prompt_version: PROMPT_VERSIONS.blueprint, complexity },
    required_turn_fields: ['turn_id', 'speaker', 'intent', 'core_epistemic_payload', 'concept_ids', 'invariant_ids', 'misconception_ids', 'evidence_ids', 'analogy_id'],
    analysis,
  });
}

export function dialoguePrompt(analysis: EpisodeTeachingAnalysis, blueprint: EpisodeTeachingBlueprint) {
  return JSON.stringify({
    task: 'Create ProductionDialogueScript', schema_version: PRODUCTION_DIALOGUE_SCHEMA_VERSION,
    generation_metadata: { dialogue_prompt_version: PROMPT_VERSIONS.dialogue },
    required_turn_fields: ['turn_id', 'speaker', 'intent', 'core_epistemic_payload', 'concept_ids', 'invariant_ids', 'misconception_ids', 'evidence_ids', 'analogy_id', 'spoken_text'],
    analysis, blueprint,
  });
}

export function fidelityPrompt(analysis: EpisodeTeachingAnalysis, blueprint: EpisodeTeachingBlueprint, dialogue: ProductionDialogueScript, certaintyDriftWarnings: CertaintyDriftWarning[] = []) {
  return JSON.stringify({ task: 'Create CriticReview', analysis, blueprint, dialogue, certainty_drift_warnings: certaintyDriftWarnings });
}

export function patchPrompt(analysis: EpisodeTeachingAnalysis, blueprint: EpisodeTeachingBlueprint, dialogue: ProductionDialogueScript, defects: unknown[]) {
  return JSON.stringify({ task: 'Return only replacement dialogue turns', analysis, blueprint, dialogue, defects });
}

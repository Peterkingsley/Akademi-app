import { detectPossibleCertaintyDrift } from '../src/modules/teaching-engine/certainty-drift.validator';
import type { EpisodeTeachingAnalysis, ProductionDialogueScript } from '../src/modules/teaching-engine/types';

const analysis = (claim: string): EpisodeTeachingAnalysis => ({
  schema_version: '0.1',
  analysis_metadata: { target_learner_level: 'INTELLIGENT_BEGINNER', requested_duration_minutes: 8, user_focus: null, prompt_version: '0.1' },
  episode_thesis: { statement: claim, claim_type: 'SOURCE_SYNTHESIS', evidence_ids: ['EV_1'], epistemic_status: 'CONFIRMED' },
  episode_epistemic_goal: { learner_should_understand: claim, learner_should_be_able_to_explain: claim, learner_should_not_leave_believing: [] },
  evidence_registry: [{ evidence_id: 'EV_1', source_id: 'SRC_1', verbatim_span: claim, normalized_claim: claim }],
  concepts: [{
    concept_id: 'CON_1', canonical_name: 'Recovery', tier: 'CORE_PILLAR', teaching_priority: 1, epistemic_status: 'CONFIRMED', prerequisite_concept_ids: [], evidence_ids: ['EV_1'],
    invariants: [{ invariant_id: 'INV_1', statement: claim, claim_type: 'SOURCE_SYNTHESIS', evidence_ids: ['EV_1'], epistemic_status: 'CONFIRMED', forbidden_exaggerations: [] }],
    causal_relationships: [], misconceptions: [], target_mental_model: { description: claim, essential_relationships: [], learner_success_condition: claim }, analogy_candidates: [], selected_analogy_id: null,
  }],
  source_disagreements: [], pruning_manifest: [],
});

const dialogue = (spoken_text: string): ProductionDialogueScript => ({
  schema_version: '0.1', generation_metadata: { dialogue_prompt_version: '0.2' },
  turns: [{ turn_id: 'T1', speaker: 'HOST_1', intent: 'EXPLAIN', core_epistemic_payload: spoken_text, concept_ids: ['CON_1'], invariant_ids: ['INV_1'], misconception_ids: [], evidence_ids: ['EV_1'], analogy_id: null, spoken_text }],
});

describe('certainty-drift validator', () => {
  it.each([
    ['Randomized election timeouts ensure leader elections eventually succeed.', 'ensure'],
    ['The retry mechanism guarantees recovery.', 'guarantee'],
    ['Randomization prevents split votes.', 'prevent'],
    ['The protocol will always elect a leader eventually.', 'always'],
  ])('warns when %s exceeds retry/probability evidence', (spoken, phrase) => {
    const warnings = detectPossibleCertaintyDrift(dialogue(spoken), analysis('The system can retry. Randomization makes split votes rare.'));
    expect(warnings).toMatchObject([{ type: 'POSSIBLE_CERTAINTY_DRIFT', turn_id: 'T1', phrase }]);
  });

  it.each([
    'The system gets another opportunity to elect a leader.',
    'Randomization makes another collision less likely.',
  ])('does not warn on source-faithful uncertainty: %s', (spoken) => {
    expect(detectPossibleCertaintyDrift(dialogue(spoken), analysis('The system can retry. Randomization makes split votes rare.'))).toEqual([]);
  });

  it('permits strong certainty only when the bound source uses equivalent certainty', () => {
    expect(detectPossibleCertaintyDrift(dialogue('The protocol always elects a leader.'), analysis('The protocol always elects a leader.'))).toEqual([]);
  });
});

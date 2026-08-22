import { detectPossibleCertaintyDrift } from '../src/modules/teaching-engine/certainty-drift.validator';
import type { EpisodeTeachingAnalysis, ProductionDialogueScript } from '../src/modules/teaching-engine/types';
import { EPISODE_TEACHING_ANALYSIS_CONTRACT_VERSION } from '../src/modules/teaching-engine/schema';

const analysis = (claim: string): EpisodeTeachingAnalysis => ({
  schema_version: '0.1',
  analysis_contract_version: EPISODE_TEACHING_ANALYSIS_CONTRACT_VERSION,
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

const dialogue = (spoken_text: string, speaker: 'HOST_1' | 'HOST_2' = 'HOST_1'): ProductionDialogueScript => ({
  schema_version: '0.1', generation_metadata: { dialogue_prompt_version: '0.2' },
  turns: [{ turn_id: 'T1', speaker, intent: speaker === 'HOST_1' ? 'EXPLAIN' : 'CHALLENGE', core_epistemic_payload: spoken_text, concept_ids: ['CON_1'], invariant_ids: ['INV_1'], misconception_ids: [], evidence_ids: ['EV_1'], analogy_id: null, spoken_text }],
});

describe('certainty-drift validator', () => {
  it.each([
    ['Randomized election timeouts ensure leader elections eventually succeed.', 'ensure'],
    ['The retry mechanism guarantees recovery.', 'guarantee'],
    ['Randomization prevents split votes.', 'prevent'],
    ['The protocol will always elect a leader eventually.', 'always'],
  ])('hard-blocks asserted %s when it exceeds retry/probability evidence', (spoken, phrase) => {
    const warnings = detectPossibleCertaintyDrift(dialogue(spoken), analysis('The system can retry. Randomization makes split votes rare.'));
    expect(warnings).toMatchObject([{ type: 'CERTAINTY_DRIFT_HARD_BLOCKER', turn_id: 'T1', phrase, speaker_function: 'ASSERTED_CERTAINTY', support: 'CERTAINTY_UNSUPPORTED' }]);
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

  it('permits an absolute one-vote constraint when the source explicitly establishes it', () => {
    expect(detectPossibleCertaintyDrift(dialogue('A server cannot cast two votes in the same term.'), analysis('Each server grants at most one vote in a term.'))).toEqual([]);
  });

  it('does not hard-block a learner hypothesis about a guarantee', () => {
    const warnings = detectPossibleCertaintyDrift(dialogue('Does this guarantee a leader?', 'HOST_2'), analysis('The system can retry.'));
    expect(warnings).toMatchObject([{ type: 'POSSIBLE_CERTAINTY_DRIFT', speaker_function: 'LEARNER_HYPOTHESIS_CERTAINTY' }]);
  });

  it('understands negated certainty', () => {
    const warnings = detectPossibleCertaintyDrift(dialogue("It doesn't guarantee a leader."), analysis('The system can retry.'));
    expect(warnings).toMatchObject([{ type: 'POSSIBLE_CERTAINTY_DRIFT', speaker_function: 'NEGATED_CERTAINTY' }]);
  });

  it('does not treat a negated absolute-elimination boundary as a hard certainty claim', () => {
    for (const spoken of [
      'Randomized election timeouts make split votes rare, but they cannot completely eliminate them.',
      "Randomized election timeouts make split votes rare, but they don't completely eliminate them.",
    ]) {
      const warnings = detectPossibleCertaintyDrift(
        dialogue(spoken),
        analysis('Randomized timeouts make split votes rare but do not make them impossible.'),
      );

      expect(warnings).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ severity: 'HARD_BLOCKER' }),
      ]));
    }
  });

  it('does not mistake a Host 2 declarative negation for a learner hypothesis', () => {
    const warnings = detectPossibleCertaintyDrift(dialogue("It's not a perfect guarantee.", 'HOST_2'), analysis('The system can retry.'));
    expect(warnings).toMatchObject([{ type: 'POSSIBLE_CERTAINTY_DRIFT', speaker_function: 'NEGATED_CERTAINTY' }]);
  });

  it('hard-blocks “always a tiny chance” but distinguishes it from failure always occurring', () => {
    const warnings = detectPossibleCertaintyDrift(dialogue("There's always a tiny chance the timeouts collide."), analysis('Randomized timeouts make split votes rare but do not make them impossible.'));
    expect(warnings).toMatchObject([{ type: 'CERTAINTY_DRIFT_HARD_BLOCKER', phrase: 'always', support: 'CERTAINTY_UNSUPPORTED' }]);
  });
});

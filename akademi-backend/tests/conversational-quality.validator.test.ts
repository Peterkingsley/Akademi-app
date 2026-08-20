import { validateConversationalQuality } from '../src/modules/teaching-engine/conversational-quality.validator';
import { EpisodeTeachingAnalysis, ProductionDialogueScript } from '../src/modules/teaching-engine/types';

const analysis = { evidence_registry: [{ evidence_id: 'EV_1', source_id: 'SRC', verbatim_span: 'Randomized timeouts make split votes rare.', normalized_claim: 'Randomization reduces split votes.' }] } as EpisodeTeachingAnalysis;
const dialogue = (turns: any[]): ProductionDialogueScript => ({ schema_version: '0.1', generation_metadata: { dialogue_prompt_version: '0.1' }, turns });
const turn = (turn_id: string, speaker: 'HOST_1' | 'HOST_2', spoken_text: string, intent = 'EXPLAIN') => ({ turn_id, speaker, spoken_text, intent, core_epistemic_payload: spoken_text, concept_ids: [], invariant_ids: [], misconception_ids: [], evidence_ids: ['EV_1'] });

describe('conversational quality validator', () => {
  it('flags empty praise but permits acknowledgement that adds reasoning', () => {
    const bad = validateConversationalQuality(dialogue([turn('1', 'HOST_1', "That's excellent. You're exactly right.")]), analysis);
    expect(bad.issues.some((issue) => issue.type === 'REPETITIVE_AFFIRMATION')).toBe(true);
    const good = validateConversationalQuality(dialogue([turn('2', 'HOST_1', 'Right—and that changes what happens next because fewer candidates begin together.')]), analysis);
    expect(good.issues.some((issue) => issue.type === 'REPETITIVE_AFFIRMATION')).toBe(false);
  });

  it('flags leading Host 2 restatement but not a causal deduction', () => {
    const report = validateConversationalQuality(dialogue([
      turn('1', 'HOST_2', 'So randomized timeouts reduce collisions, right?', 'DEDUCE'),
      turn('2', 'HOST_2', "If their timers differ, wouldn't one candidate usually get a head start?", 'DEDUCE'),
    ]), analysis);
    expect(report.issues.filter((issue) => issue.type === 'HOST2_LEADING_QUESTION').map((issue) => issue.turn_id)).toEqual(['1']);
  });

  it('flags Host 2 echo and unsupported intensity, while allowing supported wording', () => {
    const report = validateConversationalQuality(dialogue([
      turn('1', 'HOST_1', 'Randomization reduces simultaneous candidacy.'),
      turn('2', 'HOST_2', 'So randomization makes simultaneous candidacy less likely.', 'SYNTHESIZE'),
      turn('3', 'HOST_1', 'That would cripple the cluster.'),
      turn('4', 'HOST_1', 'Randomized timeouts make split votes rare.'),
    ]), analysis);
    expect(report.issues.some((issue) => issue.type === 'HOST2_ECHO')).toBe(true);
    expect(report.issues.some((issue) => issue.type === 'UNSUPPORTED_INTENSITY' && issue.phrase === 'cripple')).toBe(true);
    expect(report.issues.some((issue) => issue.type === 'UNSUPPORTED_INTENSITY' && issue.phrase === 'rare')).toBe(false);
  });
});

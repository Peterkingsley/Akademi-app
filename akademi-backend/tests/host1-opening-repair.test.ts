import { repairHost1ValidationOpenings } from '../src/modules/teaching-engine/host1-opening-repair';
import { ProductionDialogueScript } from '../src/modules/teaching-engine/types';

const turn = (turn_id: string, speaker: 'HOST_1' | 'HOST_2', spoken_text: string) => ({ turn_id, speaker, spoken_text, intent: 'EXPLAIN' as const, core_epistemic_payload: 'payload', concept_ids: ['C'], invariant_ids: ['I'], misconception_ids: ['M'], evidence_ids: ['E'], analogy_id: null });
const script = (turns: any[]): ProductionDialogueScript => ({ schema_version: '0.1', generation_metadata: { dialogue_prompt_version: '0.1' }, turns });

describe('Host 1 validation-opening repair', () => {
  it.each([
    ['Exactly. Randomized timeouts reduce simultaneous candidacy.', 'Randomized timeouts reduce simultaneous candidacy.'],
    ['Precisely. Randomized timeouts reduce simultaneous candidacy.', 'Randomized timeouts reduce simultaneous candidacy.'],
    ["That's a very helpful way to think about it. Randomized timers reduce simultaneous candidacy.", 'Randomized timers reduce simultaneous candidacy.'],
    ["You've highlighted a critical point. Split votes are rare, not impossible.", 'Split votes are rare, not impossible.'],
    ["That's a comprehensive summary. Randomization reduces split votes without eliminating them.", 'Randomization reduces split votes without eliminating them.'],
  ])('removes %s', (original, expected) => {
    const input = script([turn('T1', 'HOST_1', original), turn('T2', 'HOST_2', 'Question')]);
    const result = repairHost1ValidationOpenings(input);
    expect(result.dialogue.turns[0].spoken_text).toBe(expected);
    expect(result.dialogue.turns[0]).toMatchObject({ turn_id: 'T1', evidence_ids: ['E'], intent: 'EXPLAIN' });
    expect(result.repairs[0]).toMatchObject({ turn_id: 'T1', repair_type: 'HOST1_VALIDATION_PREFIX_REMOVAL', original_text: original, repaired_text: expected, applied: true });
  });

  it('preserves contrastive responsiveness and refuses to create an empty turn', () => {
    const result = repairHost1ValidationOpenings(script([turn('T1', 'HOST_1', 'Right—but that still leaves another problem.'), turn('T2', 'HOST_1', 'Exactly.')]));
    expect(result.dialogue.turns[0].spoken_text).toBe('Right—but that still leaves another problem.');
    expect(result.dialogue.turns[1].spoken_text).toBe('Exactly.');
    expect(result.repairs[0]).toMatchObject({ applied: false, warning: expect.any(String) });
  });
});

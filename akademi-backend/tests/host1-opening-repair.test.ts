import { repairHost1ValidationOpenings } from '../src/modules/teaching-engine/host1-opening-repair';
import { ProductionDialogueScript } from '../src/modules/teaching-engine/types';

const turn = (turn_id: string, speaker: 'HOST_1' | 'HOST_2', spoken_text: string) => ({ turn_id, speaker, spoken_text, intent: 'EXPLAIN' as const, core_epistemic_payload: 'payload', concept_ids: ['C'], invariant_ids: ['I'], misconception_ids: ['M'], evidence_ids: ['E'], analogy_id: null });
const script = (turns: any[]): ProductionDialogueScript => ({ schema_version: '0.1', generation_metadata: { dialogue_prompt_version: '0.1' }, turns });

describe('Host 1 teacher-validation repair', () => {
  it.each([
    ["That's precisely how it works. A candidate needs a majority.", 'A candidate needs a majority.', 'IDEA_VALIDATION'],
    ["You've hit on a crucial point. Split votes are rare, not impossible.", 'Split votes are rare, not impossible.', 'LEARNER_EVALUATION'],
    ['That analogy captures the core idea. Randomized timers stagger election starts.', 'Randomized timers stagger election starts.', 'IDEA_VALIDATION'],
    ["That's an excellent way to put it. Randomized timers reduce simultaneous candidacy.", 'Randomized timers reduce simultaneous candidacy.', 'META_PRAISE'],
    ["You've highlighted a critical point. Split votes are rare, not impossible.", 'Split votes are rare, not impossible.', 'LEARNER_EVALUATION'],
  ])('removes the evaluative prefix from %s', (original, expected, category) => {
    const result = repairHost1ValidationOpenings(script([turn('T1', 'HOST_1', original), turn('T2', 'HOST_2', 'Question')]));
    expect(result.dialogue.turns[0].spoken_text).toBe(expected);
    expect(result.dialogue.turns[0]).toMatchObject({ turn_id: 'T1', evidence_ids: ['E'], intent: 'EXPLAIN' });
    expect(result.repairs[0]).toMatchObject({ turn_id: 'T1', repair_type: 'HOST1_TEACHER_VALIDATION_REMOVAL', category, original_text: original, repaired_text: expected, applied: true });
  });

  it('uses a minimal grammatical bridge for a learner-evaluation colon', () => {
    const result = repairHost1ValidationOpenings(script([turn('T1', 'HOST_1', "You've identified a critical problem: a split vote. If multiple candidates divide the votes, no one has a majority.")]));
    expect(result.dialogue.turns[0].spoken_text).toBe("That's a split vote. If multiple candidates divide the votes, no one has a majority.");
    expect(result.repairs[0]).toMatchObject({ category: 'LEARNER_EVALUATION', removed_text: "You've identified a critical problem:", applied: true });
  });

  it('preserves reasoning acknowledgements and does not create an empty turn', () => {
    const result = repairHost1ValidationOpenings(script([
      turn('T1', 'HOST_1', 'Right—but that only solves the timing problem.'),
      turn('T2', 'HOST_1', 'No, because a new term gives the cluster another attempt.'),
      turn('T3', 'HOST_1', 'That analogy works very well.'),
    ]));
    expect(result.dialogue.turns[0].spoken_text).toBe('Right—but that only solves the timing problem.');
    expect(result.dialogue.turns[1].spoken_text).toBe('No, because a new term gives the cluster another attempt.');
    expect(result.dialogue.turns[2].spoken_text).toBe('That analogy works very well.');
    expect(result.repairs).toEqual([expect.objectContaining({ turn_id: 'T3', category: 'IDEA_VALIDATION', applied: false, warning: 'HOST1_UNREPAIRABLE_VALIDATION_ONLY' })]);
  });

  it('catches the previously missed V0.7 blind-spot families', () => {
    const result = repairHost1ValidationOpenings(script([
      turn('007', 'HOST_1', "That observation highlights a critical design aspect of Raft. It doesn't use fixed timeouts."),
      turn('009', 'HOST_1', 'That analogy works very well for the initiation part. It does not model the vote itself.'),
    ]));
    expect(result.dialogue.turns.map((item) => item.spoken_text)).toEqual([
      "It doesn't use fixed timeouts.",
      'It does not model the vote itself.',
    ]);
    expect(result.repairs.map((repair) => repair.category)).toEqual(['META_PRAISE', 'IDEA_VALIDATION']);
  });
});

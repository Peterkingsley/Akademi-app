import { validateBlueprintQuality } from '../src/modules/teaching-engine/blueprint-quality.validator';
import { EpisodeTeachingBlueprint } from '../src/modules/teaching-engine/types';

const turn = (turn_id: string, speaker: 'HOST_1' | 'HOST_2', intent: any, core_epistemic_payload: string) => ({
  turn_id, speaker, intent, core_epistemic_payload, concept_ids: ['C'], invariant_ids: ['I'], misconception_ids: [], evidence_ids: ['E'], analogy_id: null,
});

const blueprint = (turns: any[]): EpisodeTeachingBlueprint => ({
  schema_version: '0.1', generation_metadata: { blueprint_prompt_version: '0.2', complexity: 'STANDARD' }, turns,
});

describe('blueprint quality validator', () => {
  it('flags a Host 2 payload that packages the whole lesson', () => {
    const report = validateBlueprintQuality(blueprint([
      turn('1', 'HOST_1', 'EXPLAIN', 'Equal timeout expiry can create simultaneous candidates.'),
      turn('2', 'HOST_2', 'DEDUCE', 'If candidates begin together, their votes can split.'),
      turn('3', 'HOST_1', 'EXPLAIN', 'Randomization makes simultaneous starts less likely.'),
      turn('4', 'HOST_2', 'SYNTHESIZE', 'Summarize that randomized timeouts reduce simultaneous elections, make a majority more likely, do not eliminate split votes, and let the system retry if one occurs.'),
    ]));
    expect(report.issues[0]).toMatchObject({ turn_id: '4', type: 'HOST2_OVERCOMPLETE_PAYLOAD', signals: expect.arrayContaining(['SUMMARY_LANGUAGE', 'MULTI_CONCLUSION']) });
    expect(report.metrics.host2_overcomplete_payload_count).toBe(1);
    expect(report.metrics.host2_agency_ratio).toBe(1);
  });

  it('accepts local learner insights and keeps agency measurable', () => {
    const report = validateBlueprintQuality(blueprint([
      turn('1', 'HOST_1', 'EXPLAIN', 'A split vote leaves no leader for that term.'),
      turn('2', 'HOST_2', 'DEDUCE', 'Infer that randomization lowers simultaneous candidacy without eliminating it.'),
      turn('3', 'HOST_1', 'EXPLAIN', 'A collision can still happen, followed by another election.'),
      turn('4', 'HOST_2', 'SYNTHESIZE', 'Connect the new-election retry mechanism to the earlier split-vote failure.'),
    ]));
    expect(report.issues).toEqual([]);
    expect(report.metrics.host2_overcomplete_payload_rate).toBe(0);
    expect(report.metrics.host2_agency_ratio).toBe(1);
  });
});

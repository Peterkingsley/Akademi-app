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

  it('flags the exact V0.5 terminal synthesis as mechanism plus qualification plus global outcome', () => {
    const report = validateBlueprintQuality(blueprint([
      turn('1', 'HOST_1', 'EXPLAIN', 'Randomized timeouts stagger when candidates begin.'),
      turn('2', 'HOST_2', 'DEDUCE', 'Different timeout values make simultaneous starts less likely.'),
      turn('3', 'HOST_1', 'EXPLAIN', 'Randomization does not remove every split vote.'),
      turn('12', 'HOST_2', 'SYNTHESIZE', "Randomized election timeouts are critical because they make split votes much less common by staggering when servers try to become candidates. They don't make split votes impossible, but they do make the election process far more efficient and reliable by reducing contention."),
    ]));
    expect(report.issues[0]).toMatchObject({
      turn_id: '12',
      signals: expect.arrayContaining(['MULTI_CONCLUSION', 'MECHANISM_PLUS_QUALIFICATION', 'QUALIFICATION_CLAUSE', 'GLOBAL_OUTCOME_CLAUSE', 'HIGH_PAYLOAD_DENSITY']),
    });
  });

  it('flags the V0.4 terminal recap more strongly than the V0.5 version', () => {
    const v04 = validateBlueprintQuality(blueprint([
      turn('1', 'HOST_1', 'EXPLAIN', 'Randomized timeouts stagger starts.'),
      turn('2', 'HOST_2', 'DEDUCE', 'That reduces collision risk.'),
      turn('3', 'HOST_1', 'EXPLAIN', 'A retry can follow a split vote.'),
      turn('14', 'HOST_2', 'SYNTHESIZE', "So, randomized election timeouts are a key design in Raft. They're not a silver bullet to prevent every single split vote, but they dramatically reduce their frequency. This helps ensure that the system can reliably elect a leader over multiple terms, even if an occasional retry is still needed."),
    ]));
    const v05 = validateBlueprintQuality(blueprint([
      turn('1', 'HOST_1', 'EXPLAIN', 'Randomized timeouts stagger starts.'),
      turn('2', 'HOST_2', 'DEDUCE', 'That reduces collision risk.'),
      turn('3', 'HOST_1', 'EXPLAIN', 'A retry can follow a split vote.'),
      turn('12', 'HOST_2', 'SYNTHESIZE', "Randomized election timeouts are critical because they make split votes much less common by staggering when servers try to become candidates. They don't make split votes impossible, but they do make the election process far more efficient and reliable by reducing contention."),
    ]));
    expect(v04.issues[0].signals).toEqual(expect.arrayContaining(['RECOVERY_CLAUSE', 'EXCEPTION_CLAUSE', 'GLOBAL_OUTCOME_CLAUSE', 'TERMINAL_GLOBAL_RECAP']));
    expect(v05.issues[0].signals).toEqual(expect.arrayContaining(['MECHANISM_PLUS_QUALIFICATION', 'GLOBAL_OUTCOME_CLAUSE']));
    expect(v04.issues[0].signals.length).toBeGreaterThan(v05.issues[0].signals.length);
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

  it.each([
    "Randomization doesn't eliminate collisions; it just makes them less likely.",
    "If everyone retries together, couldn't the same collision happen again?",
    'The next term gives the nodes another attempt.',
  ])('does not flag a single local relationship: %s', (payload) => {
    const report = validateBlueprintQuality(blueprint([
      turn('1', 'HOST_1', 'EXPLAIN', 'An election can fail when candidates collide.'),
      turn('2', 'HOST_2', 'SYNTHESIZE', payload),
    ]));
    expect(report.issues).toEqual([]);
  });
});

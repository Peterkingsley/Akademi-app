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
      turn('0', 'HOST_1', 'Randomized timeouts reduce split votes by separating candidate starts.'),
      turn('1', 'HOST_2', "So what you're saying is randomized timeouts reduce split votes, right?", 'DEDUCE'),
      turn('2', 'HOST_2', "If their timers differ, wouldn't one candidate usually get a head start?", 'DEDUCE'),
    ]), analysis);
    expect(report.issues.filter((issue) => issue.type === 'HOST2_LEADING_QUESTION').map((issue) => issue.turn_id)).toEqual(['1']);
  });

  it('classifies learner-question and negated intensity separately from asserted inflation', () => {
    const report = validateConversationalQuality(dialogue([
      turn('1', 'HOST_2', 'Does that permanently break the cluster?', 'CHALLENGE'),
      turn('2', 'HOST_1', "It isn't completely impossible."),
      turn('3', 'HOST_1', 'That permanently breaks the cluster.'),
    ]), analysis);
    expect(report.issues.find((issue) => issue.turn_id === '1')?.intensity_context).toBe('HYPOTHESIS_INTENSITY');
    expect(report.issues.find((issue) => issue.turn_id === '2')?.intensity_context).toBe('NEGATED_INTENSITY');
    expect(report.issues.find((issue) => issue.turn_id === '3')?.intensity_context).toBe('ASSERTED_INTENSITY');
    expect(report.metrics.asserted_intensity_count).toBe(1);
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

  it('flags a polished Host 2 recap that bundles established conclusions', () => {
    const report = validateConversationalQuality(dialogue([
      turn('0', 'HOST_1', 'Randomized election timeouts stagger candidates and reduce split votes.'),
      turn('1', 'HOST_1', 'That makes a majority more likely, but split votes remain possible and a new election can try again.'),
      turn('2', 'HOST_2', 'Okay, so randomized election timeouts reduce split votes, stagger candidates, improve majority chances, and still allow another election if a collision happens.', 'SYNTHESIZE'),
    ]), analysis);
    const issue = report.issues.find((item) => item.type === 'HOST2_PREPACKAGED_SYNTHESIS');
    expect(issue).toMatchObject({ turn_id: '2', signals: expect.arrayContaining(['SUMMARY_OPENER', 'MULTI_CONCLUSION', 'HIGH_PRIOR_TURN_OVERLAP']) });
    expect(report.metrics.host2_prepackaged_synthesis_rate).toBe(1);
  });

  it('flags the actual V0.3 Raft Host 2 recap and leaves its earlier turns alone', () => {
    const report = validateConversationalQuality(dialogue([
      turn('0', 'HOST_1', 'Raft elects one leader for a term, and a candidate needs a majority.'),
      turn('1', 'HOST_2', 'Could simultaneous candidates split the vote?', 'DEDUCE'),
      turn('2', 'HOST_1', 'A split vote gives no leader for that term, but another election can happen.'),
      turn('3', 'HOST_2', 'Would that permanently break the cluster?', 'CHALLENGE'),
      turn('4', 'HOST_1', 'No. Election timeouts create another chance to elect a leader.'),
      turn('5', 'HOST_2', 'How does Raft reduce repeated collisions?', 'DEDUCE'),
      turn('6', 'HOST_1', 'Randomized election timeouts reduce simultaneous candidacy and split votes.'),
      turn('7', 'HOST_2', 'Would equal timeouts cause another collision?', 'DEDUCE'),
      turn('8', 'HOST_1', 'Different timer values stagger election starts and make a majority more likely.'),
      turn('9', 'HOST_2', 'Does randomization make split votes impossible?', 'TEST_ANALOGY'),
      turn('10', 'HOST_1', 'No. Split votes remain possible, and another election can try again.'),
      turn('11', 'HOST_2', "Okay, so randomized election timeouts are a clever mechanism to reduce the chance of split votes. They stagger when servers initiate elections, which makes it more likely for one candidate to secure a majority. However, there's still a small possibility of a split vote, and if it occurs, Raft doesn't fail completely; it just starts a new election to try again.", 'SYNTHESIZE'),
    ]), analysis);
    const prepackaged = report.issues.filter((item) => item.type === 'HOST2_PREPACKAGED_SYNTHESIS');
    expect(prepackaged).toHaveLength(1);
    expect(prepackaged[0]).toMatchObject({ turn_id: '11', signals: expect.arrayContaining(['SUMMARY_OPENER', 'LONG_COMPARED_TO_HOST2_TURNS', 'MULTI_CONCLUSION', 'MULTIPLE_DISCOURSE_CONNECTORS']) });
  });

  it('flags the alternate live phrasing when it still bundles the whole lesson', () => {
    const report = validateConversationalQuality(dialogue([
      turn('001', 'HOST_1', 'A candidate needs a majority, and a split vote leaves no leader for that term.'),
      turn('002', 'HOST_2', 'Could a new election give the cluster another chance?', 'DEDUCE'),
      turn('003', 'HOST_1', 'Yes. Election timeouts permit new attempts after a split vote.'),
      turn('004', 'HOST_2', 'What prevents every server from starting together again?', 'DEDUCE'),
      turn('005', 'HOST_1', 'Randomized election timeouts make simultaneous starts and split votes less likely.'),
      turn('006', 'HOST_2', 'Would identical timeouts cause another collision?', 'DEDUCE'),
      turn('007', 'HOST_1', 'Randomization makes a leader more likely to be elected, but cannot make split votes impossible.'),
      turn('008', 'HOST_2', 'Does that keep a collision possible?', 'CHALLENGE'),
      turn('009', 'HOST_1', 'It does, and another election can try again.'),
      turn('012', 'HOST_2', 'So, randomized election timeouts are a probabilistic mitigation for split votes. They make it much more likely a leader will be elected, allow the system to recover from a split vote by trying again, but still acknowledge that a split vote could rarely occur.', 'SYNTHESIZE'),
    ]), analysis);
    expect(report.issues.find((item) => item.type === 'HOST2_PREPACKAGED_SYNTHESIS')).toMatchObject({ turn_id: '012', signals: expect.arrayContaining(['LONG_COMPARED_TO_HOST2_TURNS', 'MULTI_CONCLUSION', 'MULTIPLE_DISCOURSE_CONNECTORS']) });
  });

  it('does not flag concise new relationships, predictions, or a compact callback', () => {
    const report = validateConversationalQuality(dialogue([
      turn('0', 'HOST_1', 'Randomized timers make candidates less likely to start together.'),
      turn('1', 'HOST_2', "Then the timeout randomness isn't removing the collision—it just makes the collision less likely.", 'REFRAME'),
      turn('2', 'HOST_2', "Wait, if the timers are rerandomized after a failed election, wouldn't the next collision pattern probably be different?", 'DEDUCE'),
      turn('3', 'HOST_2', 'So the retry is another chance, not a guarantee.', 'SYNTHESIZE'),
    ]), analysis);
    expect(report.issues.some((item) => item.type === 'HOST2_PREPACKAGED_SYNTHESIS')).toBe(false);
    expect(report.metrics.host2_prepackaged_synthesis_count).toBe(0);
  });
});

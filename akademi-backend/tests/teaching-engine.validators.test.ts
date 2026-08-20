import {
  TeachingValidationError,
  validateAnalysis,
  validateBlueprint,
  validateDialogue,
} from '../src/modules/teaching-engine/validators';
import { EpisodeTeachingAnalysis, EpisodeTeachingBlueprint, ProductionDialogueScript } from '../src/modules/teaching-engine/types';
import {
  EPISODE_TEACHING_ANALYSIS_RESPONSE_SCHEMA,
  EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION,
} from '../src/modules/teaching-engine/schema';

const analysisFixture = (): EpisodeTeachingAnalysis => ({
  schema_version: EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION,
  analysis_metadata: { target_learner_level: 'INTELLIGENT_BEGINNER', requested_duration_minutes: 8, user_focus: null, prompt_version: '0.1' },
  episode_thesis: { statement: 'Randomized election timeouts reduce simultaneous candidacies.', claim_type: 'SOURCE_SYNTHESIS', evidence_ids: ['EV_001'], epistemic_status: 'CONFIRMED' },
  episode_epistemic_goal: { learner_should_understand: 'Temporal asymmetry reduces split-vote risk.', learner_should_be_able_to_explain: 'why equal timers can collide', learner_should_not_leave_believing: ['Randomization makes split votes impossible.'] },
  evidence_registry: [{ evidence_id: 'EV_001', source_id: 'SRC_001', verbatim_span: 'Raft uses randomized election timeouts to ensure split votes are rare and resolved quickly.', normalized_claim: 'Randomized election timeouts make split votes less likely and help resolve them quickly.' }],
  concepts: [{
    concept_id: 'CON_TIMEOUTS', canonical_name: 'Randomized election timeouts', tier: 'CORE_PILLAR', teaching_priority: 0.95,
    epistemic_status: 'CONFIRMED', prerequisite_concept_ids: [], evidence_ids: ['EV_001'],
    invariants: [{ invariant_id: 'INV_ASYMMETRY', statement: 'Temporal asymmetry reduces simultaneous candidacy.', claim_type: 'SOURCE_SYNTHESIS', evidence_ids: ['EV_001'], epistemic_status: 'CONFIRMED', forbidden_exaggerations: ['Randomized timers make split votes impossible.'] }],
    causal_relationships: [],
    misconceptions: [{ misconception_id: 'MISC_SYNC', naive_assumption: 'Tighter synchronization is safer.', why_it_feels_intuitive: 'Precision usually improves engineering systems.', correction_target: 'Identical expiry times increase simultaneous candidacy risk.', severity: 'HIGH', must_surface_in_dialogue: true }],
    target_mental_model: { description: 'Independent staggered countdowns.', essential_relationships: ['different timers reduce collisions'], learner_success_condition: 'Predict why equal timers collide.' },
    analogy_candidates: [{ analogy_id: 'ANLG_ALARMS', vehicle: 'Staggered alarms', purpose: 'Make asymmetry intuitive.', mapping: [{ vehicle_element: 'alarm times', concept_element: 'election timeouts' }], preserves_invariant_ids: ['INV_ASYMMETRY'], breakdown_boundary: 'An early alarm does not guarantee leadership.', forbidden_inferences: ['First timeout always wins.'], analogy_risk: 0.2, teaching_value: 0.9 }],
    selected_analogy_id: 'ANLG_ALARMS',
  }],
  source_disagreements: [], pruning_manifest: [],
});

const blueprintFixture = (): EpisodeTeachingBlueprint => ({
  schema_version: '0.1', generation_metadata: { blueprint_prompt_version: '0.1', complexity: 'STANDARD' },
  turns: [
    { turn_id: 'T1', speaker: 'HOST_1', intent: 'FRAME_FRICTION', core_epistemic_payload: 'Equal timers can expire together.', concept_ids: ['CON_TIMEOUTS'], invariant_ids: ['INV_ASYMMETRY'], misconception_ids: [], evidence_ids: ['EV_001'] },
    { turn_id: 'T2', speaker: 'HOST_2', intent: 'DEDUCE', core_epistemic_payload: 'Equal timers create simultaneous candidates.', concept_ids: ['CON_TIMEOUTS'], invariant_ids: ['INV_ASYMMETRY'], misconception_ids: ['MISC_SYNC'], evidence_ids: ['EV_001'] },
    { turn_id: 'T3', speaker: 'HOST_1', intent: 'REFRAME', core_epistemic_payload: 'Randomness breaks timing symmetry; it does not guarantee a winner.', concept_ids: ['CON_TIMEOUTS'], invariant_ids: ['INV_ASYMMETRY'], misconception_ids: ['MISC_SYNC'], evidence_ids: ['EV_001'], analogy_id: 'ANLG_ALARMS' },
    { turn_id: 'T4', speaker: 'HOST_2', intent: 'SYNTHESIZE', core_epistemic_payload: 'The randomness is purposeful asymmetry.', concept_ids: ['CON_TIMEOUTS'], invariant_ids: ['INV_ASYMMETRY'], misconception_ids: [], evidence_ids: ['EV_001'] },
  ],
});

const dialogueFixture = (): ProductionDialogueScript => ({
  schema_version: '0.1', generation_metadata: { dialogue_prompt_version: '0.1' },
  turns: blueprintFixture().turns.map((turn) => ({ ...turn, spoken_text: {
    T1: 'If every node waited exactly the same amount of time, several could time out together.',
    T2: 'Then they could all become candidates together, so the votes could split rather than settle.',
    T3: 'Exactly. Different timeouts stagger that race. They make simultaneous elections less likely, but do not make a split vote impossible.',
    T4: 'So the randomness is not noise; it deliberately breaks the symmetry that creates the collision.',
  }[turn.turn_id] || '' })),
});

describe('teaching engine deterministic validation', () => {
  it('accepts the canonical analysis schema version', () => {
    expect(validateAnalysis(analysisFixture()).schema_version).toBe(EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION);
  });

  it('rejects an analysis with no schema version', () => {
    const fixture: any = analysisFixture();
    delete fixture.schema_version;
    expect(() => validateAnalysis(fixture)).toThrow('missing schema_version');
  });

  it('rejects unsupported analysis schema versions without normalizing them', () => {
    const fixture: any = analysisFixture();
    fixture.schema_version = 'v0.1';
    expect(() => validateAnalysis(fixture)).toThrow('Unsupported analysis schema_version "v0.1"; expected 0.1.');
  });

  it('requires the canonical schema version in the Call 1 structured-output contract', () => {
    expect(EPISODE_TEACHING_ANALYSIS_RESPONSE_SCHEMA.required).toContain('schema_version');
    expect(EPISODE_TEACHING_ANALYSIS_RESPONSE_SCHEMA.properties.schema_version.enum)
      .toEqual([EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION]);
  });

  it('accepts a source-grounded Raft teaching plan and dialogue', () => {
    const analysis = validateAnalysis(analysisFixture());
    const blueprint = validateBlueprint(blueprintFixture(), analysis);
    expect(validateDialogue(dialogueFixture(), blueprint, analysis).turns).toHaveLength(4);
  });

  it('rejects a selected analogy above the configured risk threshold', () => {
    const fixture = analysisFixture();
    fixture.concepts[0].analogy_candidates[0].analogy_risk = 0.5;
    expect(() => validateAnalysis(fixture)).toThrow(TeachingValidationError);
  });

  it('rejects circular prerequisites', () => {
    const fixture = analysisFixture();
    fixture.concepts[0].prerequisite_concept_ids = ['CON_TIMEOUTS'];
    expect(() => validateAnalysis(fixture)).toThrow('cannot depend on itself');
  });

  it('rejects analysis that binds a concept to missing evidence', () => {
    const fixture = analysisFixture();
    fixture.concepts[0].evidence_ids = ['EV_MISSING'];
    expect(() => validateAnalysis(fixture)).toThrow('missing evidence');
  });

  it('rejects an invalid epistemic status', () => {
    const fixture = analysisFixture();
    fixture.concepts[0].epistemic_status = 'CERTAIN' as any;
    expect(() => validateAnalysis(fixture)).toThrow('invalid tier, epistemic status');
  });

  it('rejects a blueprint that omits a core concept', () => {
    const analysis = validateAnalysis(analysisFixture());
    const blueprint = blueprintFixture();
    blueprint.turns.forEach((turn) => { turn.concept_ids = []; });
    expect(() => validateBlueprint(blueprint, analysis)).toThrow('Core concept');
  });

  it('rejects a blueprint with passive Host 2 planning', () => {
    const analysis = validateAnalysis(analysisFixture());
    const blueprint = blueprintFixture();
    blueprint.turns.filter((turn) => turn.speaker === 'HOST_2').forEach((turn) => { turn.intent = 'EXPLAIN'; });
    expect(() => validateBlueprint(blueprint, analysis)).toThrow('Host 2 agency');
  });

  it('rejects the Raft split-vote exaggeration regression', () => {
    const analysis = validateAnalysis(analysisFixture());
    const blueprint = validateBlueprint(blueprintFixture(), analysis);
    const dialogue = dialogueFixture();
    dialogue.turns[2].spoken_text = 'Randomized timers make split votes impossible.';
    expect(() => validateDialogue(dialogue, blueprint, analysis)).toThrow('forbidden exaggeration');
  });

  it('rejects passive Host 2 cheerleading', () => {
    const analysis = validateAnalysis(analysisFixture());
    const blueprint = validateBlueprint(blueprintFixture(), analysis);
    const dialogue = dialogueFixture();
    dialogue.turns[1].spoken_text = "Wow, that's fascinating! Tell me more.";
    expect(() => validateDialogue(dialogue, blueprint, analysis)).toThrow('passive banter');
  });

  it('rejects dialogue that changes a planned speaker', () => {
    const analysis = validateAnalysis(analysisFixture());
    const blueprint = validateBlueprint(blueprintFixture(), analysis);
    const dialogue = dialogueFixture();
    dialogue.turns[0].speaker = 'HOST_2';
    expect(() => validateDialogue(dialogue, blueprint, analysis)).toThrow('wrong speaker');
  });

  it('requires an analogy boundary to prevent leakage', () => {
    const fixture = analysisFixture();
    fixture.concepts[0].analogy_candidates[0].breakdown_boundary = '';
    expect(() => validateAnalysis(fixture)).toThrow('invalid analogy');
  });
});

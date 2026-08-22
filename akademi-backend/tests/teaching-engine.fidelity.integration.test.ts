jest.mock('../src/config/db', () => ({
  __esModule: true,
  default: {
    material: { findUnique: jest.fn() },
    teachingAnalysisCache: { findUnique: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
    teachingEpisode: { create: jest.fn() },
  },
}));

jest.mock('../src/modules/ai/ai.provider', () => ({
  aiProvider: { generateResponseWithModel: jest.fn() },
}));

import prisma from '../src/config/db';
import { aiProvider } from '../src/modules/ai/ai.provider';
import { TeachingEngineService, TeachingFidelityGateError } from '../src/modules/teaching-engine/teaching-engine.service';
import { EpisodeTeachingAnalysis, EpisodeTeachingBlueprint, ProductionDialogueScript } from '../src/modules/teaching-engine/types';
import { EPISODE_TEACHING_ANALYSIS_CONTRACT_VERSION, EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION } from '../src/modules/teaching-engine/schema';

const analysis: EpisodeTeachingAnalysis = {
  schema_version: EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION,
  analysis_contract_version: EPISODE_TEACHING_ANALYSIS_CONTRACT_VERSION,
  analysis_metadata: { target_learner_level: 'INTELLIGENT_BEGINNER', requested_duration_minutes: 8, user_focus: null, prompt_version: '0.1' },
  episode_thesis: { statement: 'Randomized timeouts reduce split-vote likelihood.', claim_type: 'SOURCE_SYNTHESIS', evidence_ids: ['EV_001'], epistemic_status: 'CONFIRMED' },
  episode_epistemic_goal: { learner_should_understand: 'Asymmetry reduces collisions.', learner_should_be_able_to_explain: 'why equal timeouts collide', learner_should_not_leave_believing: ['Randomization prevents every split vote.'] },
  evidence_registry: [{ evidence_id: 'EV_001', source_id: 'SRC_001', verbatim_span: 'Without preventative measures, split votes can repeat indefinitely. Randomized election timeouts make split votes rare and resolve them quickly.', normalized_claim: 'Split votes can repeat; randomized timeouts reduce their likelihood.' }],
  concepts: [{
    concept_id: 'CON_001', canonical_name: 'Timeout asymmetry', tier: 'CORE_PILLAR', teaching_priority: 0.9, epistemic_status: 'CONFIRMED', prerequisite_concept_ids: [], evidence_ids: ['EV_001'],
    invariants: [{ invariant_id: 'INV_001', statement: 'Temporal asymmetry reduces simultaneous candidacy.', claim_type: 'SOURCE_SYNTHESIS', evidence_ids: ['EV_001'], epistemic_status: 'CONFIRMED', forbidden_exaggerations: ['Randomized timers make split votes impossible.'] }],
    causal_relationships: [],
    misconceptions: [{ misconception_id: 'MISC_001', naive_assumption: 'Identical timers are safer.', why_it_feels_intuitive: 'Precision is usually desirable.', correction_target: 'Equal timers can collide.', severity: 'HIGH', must_surface_in_dialogue: true }],
    target_mental_model: { description: 'Staggered independent countdowns.', essential_relationships: ['different expiry times reduce collisions'], learner_success_condition: 'Predict collision risk.' },
    analogy_candidates: [], selected_analogy_id: null,
  }], source_disagreements: [], pruning_manifest: [],
};

const blueprint: EpisodeTeachingBlueprint = {
  schema_version: '0.1', generation_metadata: { blueprint_prompt_version: '0.1', complexity: 'STANDARD' },
  turns: [
    { turn_id: 'T1', speaker: 'HOST_1', intent: 'FRAME_FRICTION', core_epistemic_payload: 'Equal timers collide.', concept_ids: ['CON_001'], invariant_ids: ['INV_001'], misconception_ids: [], evidence_ids: ['EV_001'] },
    { turn_id: 'T2', speaker: 'HOST_2', intent: 'DEDUCE', core_epistemic_payload: 'Equal timeouts create simultaneous candidates.', concept_ids: ['CON_001'], invariant_ids: ['INV_001'], misconception_ids: ['MISC_001'], evidence_ids: ['EV_001'] },
    { turn_id: 'T3', speaker: 'HOST_1', intent: 'REFRAME', core_epistemic_payload: 'Randomness reduces, rather than eliminates, collisions.', concept_ids: ['CON_001'], invariant_ids: ['INV_001'], misconception_ids: ['MISC_001'], evidence_ids: ['EV_001'] },
    { turn_id: 'T4', speaker: 'HOST_2', intent: 'SYNTHESIZE', core_epistemic_payload: 'Randomness breaks symmetry.', concept_ids: ['CON_001'], invariant_ids: ['INV_001'], misconception_ids: [], evidence_ids: ['EV_001'] },
  ],
};

const script = (claim: string): ProductionDialogueScript => ({
  schema_version: '0.1', generation_metadata: { dialogue_prompt_version: '0.1' },
  turns: blueprint.turns.map((turn) => ({
    ...turn,
    spoken_text: { T1: 'If every timer expires together, several nodes can enter the election at once.', T2: 'Then they may split the vote because they became candidates together.', T3: claim, T4: 'So randomness is doing work: it makes the collision less likely by breaking symmetry.' }[turn.turn_id] || '',
  })),
});

describe('TeachingEngineService fidelity path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.teachingAnalysisCache.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.teachingAnalysisCache.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.teachingAnalysisCache.upsert as jest.Mock).mockResolvedValue({});
    (prisma.teachingEpisode.create as jest.Mock).mockResolvedValue({ id: 'episode-test-1' });
  });

  it('routes semantic exaggeration through the critic, patches only the defective turn, and rechecks it', async () => {
    const firstScript = script('Randomized timers prevent split votes, so a collision cannot happen again.');
    const repairedTurn = { ...script('Randomized timers make simultaneous elections less likely, so split votes are rarer and can resolve quickly.').turns[2] };
    const responses = [
      analysis,
      blueprint,
      firstScript,
      {
        verdict: 'REPAIR_REQUIRED',
        defects: [{ defect_id: 'DEF_001', type: 'CLAIM_EXAGGERATION', severity: 'HARD_BLOCKER', turn_ids: ['T3'], concept_ids: ['CON_001'], invariant_ids: ['INV_001'], evidence_ids: ['EV_001'], description: 'The dialogue changes reduces into prevents.', repair_directive: 'Use probabilistic source-faithful language.' }],
      },
      [repairedTurn],
      { verdict: 'PASS', defects: [] },
    ];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    const result = await new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: 'Randomized election timeouts make split votes rare and resolve them quickly.' }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    });

    expect(aiProvider.generateResponseWithModel).toHaveBeenCalledTimes(6);
    expect((aiProvider.generateResponseWithModel as jest.Mock).mock.calls[0][1].jsonSchema.schema.required)
      .toContain('schema_version');
    expect((aiProvider.generateResponseWithModel as jest.Mock).mock.calls[1][1].jsonSchema.schema.required)
      .toContain('schema_version');
    expect((aiProvider.generateResponseWithModel as jest.Mock).mock.calls[2][1].jsonSchema.schema.required)
      .toContain('schema_version');
    expect(result.fidelity).toEqual({ verdict: 'PASS', defects: [] });
    expect(result.dialogue.turns.find((turn) => turn.turn_id === 'T3')?.spoken_text).toContain('less likely');
    expect(result.dialogue.turns.find((turn) => turn.turn_id === 'T1')?.spoken_text).toBe(firstScript.turns[0].spoken_text);
  });

  it('repairs “can repeat indefinitely” when dialogue distorts it into permanent stuckness', async () => {
    const firstScript = script('A split vote becomes permanently stuck once it happens.');
    const repairedTurn = { ...script('A split vote can repeat across election rounds, which is why the timeout design matters.').turns[2] };
    const responses = [
      analysis,
      blueprint,
      firstScript,
      {
        verdict: 'REPAIR_REQUIRED',
        defects: [{ defect_id: 'DEF_002', type: 'SOURCE_DRIFT', severity: 'HARD_BLOCKER', turn_ids: ['T3'], concept_ids: ['CON_001'], invariant_ids: ['INV_001'], evidence_ids: ['EV_001'], description: 'The source permits repeated rounds; it does not assert a permanently stuck state.', repair_directive: 'Replace permanence with repeatability across rounds.' }],
      },
      { turns: [repairedTurn] },
      { verdict: 'PASS', defects: [] },
    ];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    const result = await new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: analysis.evidence_registry[0].verbatim_span }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    });

    expect(result.dialogue.turns.find((turn) => turn.turn_id === 'T3')?.spoken_text).toContain('can repeat');
    expect(result.fidelity?.verdict).toBe('PASS');
    expect(result.fidelityRepairObservations).toEqual([
      expect.objectContaining({ repair_attempt: 1, call4_invoked: true, no_op_retry_triggered: false, final_status: 'REPAIRED' }),
    ]);
  });

  it('routes eventual-success certainty drift through a hard-blocker repair', async () => {
    const firstScript = script('Randomized election timeouts ensure leader elections eventually succeed.');
    const repairedTurn = { ...script('Randomized election timeouts reduce repeated collisions and give later election rounds another opportunity to succeed.').turns[2] };
    const responses = [
      analysis,
      blueprint,
      firstScript,
      {
        verdict: 'REPAIR_REQUIRED',
        defects: [{ defect_id: 'DEF_003', type: 'CLAIM_EXAGGERATION', severity: 'HARD_BLOCKER', turn_ids: ['T3'], concept_ids: ['CON_001'], invariant_ids: ['INV_001'], evidence_ids: ['EV_001'], description: 'The dialogue changes another opportunity into guaranteed eventual success.', repair_directive: 'Replace the guaranteed-success claim with wording that randomization reduces repeated collisions and gives later election rounds another chance.' }],
      },
      { turns: [repairedTurn] },
      { verdict: 'PASS', defects: [] },
    ];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    const result = await new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: analysis.evidence_registry[0].verbatim_span }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    });

    const firstFidelityPrompt = JSON.parse((aiProvider.generateResponseWithModel as jest.Mock).mock.calls[3][0]);
    expect(firstFidelityPrompt.certainty_drift_warnings).toMatchObject([{ type: 'CERTAINTY_DRIFT_HARD_BLOCKER', turn_id: 'T3', phrase: 'ensure' }]);
    expect(result.fidelityHistory[0]).toMatchObject({ verdict: 'REPAIR_REQUIRED' });
    expect(result.fidelityHistory[0].defects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'CLAIM_EXAGGERATION', severity: 'HARD_BLOCKER', turn_ids: ['T3'] }),
    ]));
    expect(result.preRepairDialogue?.turns.find((turn) => turn.turn_id === 'T3')?.spoken_text).toBe(firstScript.turns[2].spoken_text);
    expect(result.dialogue.turns.find((turn) => turn.turn_id === 'T3')?.spoken_text).toContain('another opportunity');
    expect(result.fidelityHistory[1]).toEqual({ verdict: 'PASS', defects: [] });
  });

  it('invalidates an old analysis contract cache row and regenerates Call 1', async () => {
    const staleAnalysis: any = { ...analysis };
    delete staleAnalysis.analysis_contract_version;
    (prisma.teachingAnalysisCache.findFirst as jest.Mock).mockResolvedValue({ analysis: staleAnalysis });
    const responses = [analysis, blueprint, script('Randomized timers make split votes less likely.'), { verdict: 'PASS', defects: [] }];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    const result = await new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: analysis.evidence_registry[0].verbatim_span }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    });

    expect(result.analysisCacheStatus).toBe('HIT_INVALIDATED_CONTRACT');
    expect(result.cachedAnalysis).toBe(false);
    expect(aiProvider.generateResponseWithModel).toHaveBeenCalledTimes(4);
    expect(prisma.teachingAnalysisCache.upsert).toHaveBeenCalled();
  });

  it('retries Call 2 when it invents an invariant reference and records the failure', async () => {
    const invalidBlueprint: any = JSON.parse(JSON.stringify(blueprint));
    invalidBlueprint.turns[1].invariant_ids = ['INV_DOES_NOT_EXIST'];
    const responses = [analysis, invalidBlueprint, blueprint, script('Randomized timers make split votes less likely.'), { verdict: 'PASS', defects: [] }];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    const result = await new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: analysis.evidence_registry[0].verbatim_span }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    });

    const blueprintTrace = result.instrumentation.stages.find((stage) => stage.stage === 'blueprint');
    expect(aiProvider.generateResponseWithModel).toHaveBeenCalledTimes(5);
    expect(blueprintTrace).toMatchObject({ retryCount: 1, unknownReferenceIds: ['INV_DOES_NOT_EXIST'] });
    expect(blueprintTrace?.validationFailureReason).toContain('UNKNOWN_INVARIANT_REFERENCE');
  });

  it('does not retry Call 2 merely to restore six derivable evidence bindings', async () => {
    const omittedEvidenceBlueprint: any = JSON.parse(JSON.stringify(blueprint));
    omittedEvidenceBlueprint.turns.forEach((turn: any) => { turn.evidence_ids = []; });
    omittedEvidenceBlueprint.turns.push(
      { ...omittedEvidenceBlueprint.turns[0], turn_id: 'T5', evidence_ids: [] },
      { ...omittedEvidenceBlueprint.turns[1], turn_id: 'T6', intent: 'CHECK_UNDERSTANDING', evidence_ids: [] },
    );
    const dialogueWithSixTurns: any = {
      ...script('Randomized timers make split votes less likely.'),
      turns: [
        ...script('Randomized timers make split votes less likely.').turns,
        { ...script('Randomized timers make split votes less likely.').turns[0], turn_id: 'T5', spoken_text: 'The timing remains deliberately uneven.' },
        { ...script('Randomized timers make split votes less likely.').turns[1], turn_id: 'T6', intent: 'CHECK_UNDERSTANDING', spoken_text: 'So the staggered timers are the important part?' },
      ],
    };
    const responses = [analysis, omittedEvidenceBlueprint, dialogueWithSixTurns, { verdict: 'PASS', defects: [] }];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    const result = await new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: analysis.evidence_registry[0].verbatim_span }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    });

    const blueprintTrace = result.instrumentation.stages.find((stage) => stage.stage === 'blueprint');
    expect(aiProvider.generateResponseWithModel).toHaveBeenCalledTimes(4);
    expect(blueprintTrace).toMatchObject({ retryCount: 0, unknownReferenceIds: undefined });
    expect(result.blueprintProvenance.provenance_fields_enriched).toBeGreaterThanOrEqual(6);
    expect(result.blueprint.turns.every((turn) => turn.evidence_ids.includes('EV_001'))).toBe(true);
  });

  it('repairs a deterministic certainty blocker even when Call 4 initially returns PASS', async () => {
    const firstScript = script("There's always a tiny chance that the timeouts collide.");
    const repairedTurn = { ...script("There's still a small chance that the timeouts collide.").turns[2] };
    const responses = [
      analysis,
      blueprint,
      firstScript,
      { verdict: 'PASS', defects: [] },
      { turns: [repairedTurn] },
      { verdict: 'PASS', defects: [] },
    ];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    const result = await new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: analysis.evidence_registry[0].verbatim_span }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    });

    expect(result.semanticFidelityHistory).toEqual([{ verdict: 'PASS', defects: [] }, { verdict: 'PASS', defects: [] }]);
    expect(result.fidelityHistory[0]).toMatchObject({ verdict: 'REPAIR_REQUIRED', defects: [expect.objectContaining({ description: expect.stringContaining('CERTAINTY_DRIFT_HARD_BLOCKER') })] });
    expect(result.dialogue.turns.find((turn) => turn.turn_id === 'T3')?.spoken_text).toContain('still a small chance');
    expect(result.certaintyDriftWarnings.filter((warning) => warning.type === 'CERTAINTY_DRIFT_HARD_BLOCKER')).toEqual([]);
  });

  it('rejects a no-op certainty patch before another fidelity call, then succeeds with one bounded retry', async () => {
    const original = script('Randomized election timeouts ensure leader elections eventually succeed.');
    const repairedTurn = { ...script('Randomized election timeouts make collisions less likely and give the cluster another chance to elect a leader.').turns[2] };
    const defect = {
      defect_id: 'DEF_NOOP', type: 'CLAIM_EXAGGERATION', severity: 'HARD_BLOCKER', turn_ids: ['T3'], concept_ids: ['CON_001'], invariant_ids: ['INV_001'], evidence_ids: ['EV_001'],
      description: 'The claim turns another chance into a guarantee.', repair_directive: 'Use conditional wording; do not promise eventual success.',
    };
    const responses = [analysis, blueprint, original, { verdict: 'REPAIR_REQUIRED', defects: [defect] }, { turns: [original.turns[2]] }, { turns: [repairedTurn] }, { verdict: 'PASS', defects: [] }];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    const result = await new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: analysis.evidence_registry[0].verbatim_span }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    });

    expect(aiProvider.generateResponseWithModel).toHaveBeenCalledTimes(7);
    const secondPatchPrompt = JSON.parse((aiProvider.generateResponseWithModel as jest.Mock).mock.calls[5][0]);
    expect(secondPatchPrompt.repair_context.repair_attempt).toBe(2);
    expect(secondPatchPrompt.repair_context.prior_failure[0].deterministic_result.codes).toEqual(expect.arrayContaining(['PATCH_NO_MEANINGFUL_CHANGE']));
    expect(secondPatchPrompt.repair_context.retry_instruction).toContain('did not materially remove the blocked claim');
    expect(result.fidelity?.verdict).toBe('PASS');
    expect(result.fidelityRepairObservations.map((item) => item.final_status)).toEqual(expect.arrayContaining(['PATCH_NO_MEANINGFUL_CHANGE', 'REPAIRED']));
    expect(result.fidelityRepairObservations).toEqual(expect.arrayContaining([
      expect.objectContaining({ repair_attempt: 1, call4_invoked: false, call4_result: null, no_op_retry_triggered: true, rejection_reason: expect.stringContaining('PATCH_IDENTICAL_TEXT') }),
      expect.objectContaining({ repair_attempt: 2, call4_invoked: true, no_op_retry_triggered: false, final_status: 'REPAIRED' }),
    ]));
    expect(result.dialogue.turns.find((turn) => turn.turn_id === 'T3')?.spoken_text).toContain('another chance');
  });

  it('treats a wording change that preserves unsupported certainty as a semantic no-op before retrying once', async () => {
    const original = script('Randomized election timeouts ensure leader elections eventually succeed.');
    const certaintyNoOp = { ...script('Randomized election timeouts always allow a leader election to eventually succeed.').turns[2] };
    const repairedTurn = { ...script('Randomized election timeouts reduce repeated collisions and give later election rounds another opportunity to succeed.').turns[2] };
    const defect = {
      defect_id: 'DEF_SEMANTIC_NOOP', type: 'CLAIM_EXAGGERATION', severity: 'HARD_BLOCKER', turn_ids: ['T3'], concept_ids: ['CON_001'], invariant_ids: ['INV_001'], evidence_ids: ['EV_001'],
      description: 'The claim promises eventual success beyond the source.', repair_directive: 'Use probabilistic wording and do not guarantee a leader.',
    };
    const responses = [analysis, blueprint, original, { verdict: 'REPAIR_REQUIRED', defects: [defect] }, { turns: [certaintyNoOp] }, { turns: [repairedTurn] }, { verdict: 'PASS', defects: [] }];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    const result = await new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: analysis.evidence_registry[0].verbatim_span }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    });

    expect(aiProvider.generateResponseWithModel).toHaveBeenCalledTimes(7);
    expect(result.fidelityRepairObservations[0]).toMatchObject({
      repair_attempt: 1,
      call4_invoked: false,
      no_op_retry_triggered: true,
      deterministic_post_patch_result: { codes: expect.arrayContaining(['PATCH_SEMANTIC_NO_OP', 'PATCH_INSUFFICIENT_CERTAINTY_REDUCTION']) },
    });
    expect(result.fidelity?.verdict).toBe('PASS');
  });

  it('fails with a precise bounded diagnostic after two no-op local patches', async () => {
    const original = script('Randomized election timeouts ensure leader elections eventually succeed.');
    const defect = {
      defect_id: 'DEF_EXHAUSTED', type: 'CLAIM_EXAGGERATION', severity: 'HARD_BLOCKER', turn_ids: ['T3'], concept_ids: ['CON_001'], invariant_ids: ['INV_001'], evidence_ids: ['EV_001'],
      description: 'The claim promises eventual success beyond the source.', repair_directive: 'Use probabilistic wording and do not guarantee a leader.',
    };
    const responses = [analysis, blueprint, original, { verdict: 'REPAIR_REQUIRED', defects: [defect] }, { turns: [original.turns[2]] }, { turns: [original.turns[2]] }];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    await expect(new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: analysis.evidence_registry[0].verbatim_span }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    })).rejects.toMatchObject({
      name: 'TeachingFidelityGateError',
      diagnostic: expect.objectContaining({
        failure_type: 'REPAIR_ATTEMPTS_EXHAUSTED',
        repair_attempt_count: 2,
        repair_observations: expect.arrayContaining([
          expect.objectContaining({ repair_attempt: 1, final_status: 'PATCH_NO_MEANINGFUL_CHANGE', no_op_retry_triggered: true, call4_invoked: false }),
          expect.objectContaining({ repair_attempt: 2, final_status: 'PATCH_NO_MEANINGFUL_CHANGE', no_op_retry_triggered: false, call4_invoked: false }),
        ]),
      }),
    } as Partial<TeachingFidelityGateError>);
  });

  it('hard-blocks an absolute completely-prevents claim even when Call 4 returns PASS', async () => {
    const original = script('Randomized election timeouts completely prevent split votes.');
    const repairedTurn = { ...script('Randomized election timeouts make simultaneous elections and split votes less likely.').turns[2] };
    const responses = [analysis, blueprint, original, { verdict: 'PASS', defects: [] }, { turns: [repairedTurn] }, { verdict: 'PASS', defects: [] }];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    const result = await new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: analysis.evidence_registry[0].verbatim_span }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    });

    expect(result.fidelityHistory[0].defects).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'HARD_BLOCKER', description: expect.stringContaining('CERTAINTY_DRIFT_HARD_BLOCKER') }),
    ]));
    expect(result.publicationFidelity).toMatchObject({ engine_verdict: 'PASS', publishable_for_audio: true, hard_blocker_count: 0 });
  });

  it('repairs a material intensity defect but does not confuse a soft review with a publication blocker', async () => {
    const original = script('Randomized timeouts dramatically reduce split votes.');
    const repairedTurn = { ...script('Randomized timeouts reduce split votes by making simultaneous starts less likely.').turns[2] };
    const material = {
      defect_id: 'DEF_MATERIAL', type: 'UNSUPPORTED_INTENSITY', severity: 'MATERIAL_REPAIR', turn_ids: ['T3'], concept_ids: ['CON_001'], invariant_ids: ['INV_001'], evidence_ids: ['EV_001'],
      description: '“Dramatically” materially strengthens the source claim.', repair_directive: 'Use the source-supported reduction claim without an unsupported intensity modifier.',
    };
    const responses = [analysis, blueprint, original, { verdict: 'REPAIR_REQUIRED', defects: [material] }, { verdict: 'PASS', defects: [] }];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    const repaired = await new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: analysis.evidence_registry[0].verbatim_span }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    });
    expect(repaired.fidelityRepairObservations).toEqual(expect.arrayContaining([expect.objectContaining({ defect_id: 'DEF_MATERIAL', final_status: 'REPAIRED' })]));
    expect(repaired.fidelityRepairObservations).toEqual(expect.arrayContaining([expect.objectContaining({ repair_method: 'DETERMINISTIC_INTENSITY_REMOVAL' })]));
    expect(aiProvider.generateResponseWithModel).toHaveBeenCalledTimes(5);
    expect(repaired.publicationFidelity).toMatchObject({ engine_verdict: 'PASS', publishable_for_audio: true });

    const soft = {
      defect_id: 'DEF_SOFT', type: 'PEDAGOGICAL_REDUNDANCY', severity: 'SOFT_WARNING', turn_ids: ['T3'], concept_ids: ['CON_001'], invariant_ids: ['INV_001'], evidence_ids: ['EV_001'],
      description: 'The wording repeats an already-established point.', repair_directive: 'Optional: tighten the phrasing.',
    };
    const softResponses = [analysis, blueprint, script('Randomized timers make split votes less likely.'), { verdict: 'REPAIR_REQUIRED', defects: [soft] }];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(softResponses.shift()), model: 'test-model' }));
    const warningOnly = await new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: analysis.evidence_registry[0].verbatim_span }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    });
    expect(warningOnly.fidelityRepairObservations).toEqual([]);
    expect(warningOnly.publicationFidelity).toMatchObject({
      provider_verdict: 'REPAIR_REQUIRED', engine_verdict: 'PASS_WITH_WARNINGS', publishable_for_audio: true,
      normalization_reason: 'ONLY_NON_BLOCKING_SOFT_DEFECTS_REMAIN', soft_warning_count: 1,
    });
    expect(prisma.teachingEpisode.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'READY_FOR_TTS' }) }));
  });

  it('compiles a capability-only target and rejects a necessity-preserving first patch before Call 4', async () => {
    const original = script('The system must have a way to handle these rare cases after a split vote.');
    const stillNecessary = { ...script('The system needs to handle these rare cases after a split vote.').turns[2] };
    const capabilityRepair = { ...script('After a split vote, the cluster can start another election and get another opportunity to elect a leader.').turns[2] };
    const defect = {
      defect_id: 'DEF_CAPABILITY', type: 'CLAIM_EXAGGERATION', severity: 'MATERIAL_REPAIR', turn_ids: ['T3'], concept_ids: ['CON_001'], invariant_ids: ['INV_001'], evidence_ids: ['EV_001'],
      description: '“Must have a way” asserts required guaranteed handling beyond the source-supported recovery capability.',
      repair_directive: 'Use only the supported capability that another election can occur.',
    };
    const responses = [analysis, blueprint, original, { verdict: 'REPAIR_REQUIRED', defects: [defect] }, { turns: [stillNecessary] }, { turns: [capabilityRepair] }, { verdict: 'PASS', defects: [] }];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    const result = await new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: 'After a split vote, another election can occur and give the cluster another opportunity to elect a leader.' }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    });

    const secondPatchPrompt = JSON.parse((aiProvider.generateResponseWithModel as jest.Mock).mock.calls[5][0]);
    expect(secondPatchPrompt.repair_context.prior_failure[0].deterministic_result.target_codes)
      .toEqual(expect.arrayContaining(['PATCH_EXCEEDS_ALLOWED_MODALITY', 'PATCH_PRESERVES_MATERIAL_OVERSTATEMENT']));
    expect(secondPatchPrompt.repair_context.affected_turns[0].repair_target).toMatchObject({
      detected_original_modality: 'NECESSITY', allowed_modality: expect.arrayContaining(['CAPABILITY']),
    });
    expect(secondPatchPrompt.repair_targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ allowed_modality: expect.arrayContaining(['CAPABILITY']) }),
    ]));
    expect(result.fidelityRepairObservations).toEqual(expect.arrayContaining([
      expect.objectContaining({ repair_attempt: 1, call4_invoked: false, rejection_reason: expect.stringContaining('PATCH_EXCEEDS_ALLOWED_MODALITY') }),
      expect.objectContaining({ repair_attempt: 2, call4_invoked: true, final_status: 'REPAIRED' }),
    ]));
  });

  it('escalates invariant-bound payload loss even when the critic calls it a soft warning', async () => {
    const original = script('A server becomes a candidate and asks for votes.');
    const repairedTurn = { ...script('A server increments its term, becomes a candidate, votes for itself, and asks for votes.').turns[2] };
    const payloadLoss = {
      defect_id: 'DEF_PAYLOAD', type: 'PAYLOAD_LOSS', severity: 'SOFT_WARNING', turn_ids: ['T3'], concept_ids: ['CON_001'], invariant_ids: ['INV_001'], evidence_ids: ['EV_001'],
      description: 'The turn omits a core invariant-bound candidate action.', repair_directive: 'Restore the omitted candidate action without changing the turn bindings.',
    };
    const responses = [analysis, blueprint, original, { verdict: 'REPAIR_REQUIRED', defects: [payloadLoss] }, { turns: [repairedTurn] }, { verdict: 'PASS', defects: [] }];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    const result = await new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: analysis.evidence_registry[0].verbatim_span }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    });

    expect(result.fidelityRepairObservations).toEqual(expect.arrayContaining([expect.objectContaining({ defect_id: 'DEF_PAYLOAD', final_status: 'REPAIRED' })]));
    expect(result.publicationFidelity).toMatchObject({ engine_verdict: 'PASS', publishable_for_audio: true });
  });

  it('returns a controlled diagnostic when the second local repair still leaves a fidelity blocker', async () => {
    const original = script('A split vote becomes permanently stuck once it happens.');
    const changedButStillWrong = { ...script('A split vote stays permanently stuck, so no leader can be chosen.').turns[2] };
    const secondChangedButStillWrong = { ...script('That means the cluster can never escape a split vote once it occurs.').turns[2] };
    const defect = {
      defect_id: 'DEF_SURVIVES', type: 'SOURCE_DRIFT', severity: 'HARD_BLOCKER', turn_ids: ['T3'], concept_ids: ['CON_001'], invariant_ids: ['INV_001'], evidence_ids: ['EV_001'],
      description: 'The source allows another election; it does not say the system is permanently stuck.', repair_directive: 'Replace permanence with a new election opportunity.',
    };
    const responses = [
      analysis, blueprint, original, { verdict: 'REPAIR_REQUIRED', defects: [defect] }, { turns: [changedButStillWrong] }, { verdict: 'REPAIR_REQUIRED', defects: [defect] },
      { turns: [secondChangedButStillWrong] }, { verdict: 'REPAIR_REQUIRED', defects: [defect] },
    ];
    (aiProvider.generateResponseWithModel as jest.Mock).mockImplementation(async () => ({ text: JSON.stringify(responses.shift()), model: 'test-model' }));

    await expect(new TeachingEngineService().generate('admin-user', {
      sources: [{ source_id: 'SRC_001', type: 'PASTED_TEXT', title: 'Raft excerpt', segments: [{ segment_id: 'SEG_001', text: analysis.evidence_registry[0].verbatim_span }] }],
      complexity: 'STANDARD', durationMinutes: 8,
    })).rejects.toMatchObject({
      name: 'TeachingFidelityGateError',
      diagnostic: expect.objectContaining({
        final_hard_defects: [expect.objectContaining({ defect_id: 'DEF_SURVIVES' })],
        repair_observations: [
          expect.objectContaining({ repair_attempt: 1, final_status: 'FIDELITY_BLOCKER_SURVIVED' }),
          expect.objectContaining({ repair_attempt: 2, final_status: 'PATCH_FAILED_DETERMINISTIC_VALIDATION', rejection_reason: expect.stringContaining('PATCH_EXCEEDS_ALLOWED_MODALITY') }),
        ],
      }),
    } as Partial<TeachingFidelityGateError>);
  });
});

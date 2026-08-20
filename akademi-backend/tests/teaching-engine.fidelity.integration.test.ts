jest.mock('../src/config/db', () => ({
  __esModule: true,
  default: {
    material: { findUnique: jest.fn() },
    teachingAnalysisCache: { findUnique: jest.fn(), upsert: jest.fn() },
    teachingEpisode: { create: jest.fn() },
  },
}));

jest.mock('../src/modules/ai/ai.provider', () => ({
  aiProvider: { generateResponseWithModel: jest.fn() },
}));

import prisma from '../src/config/db';
import { aiProvider } from '../src/modules/ai/ai.provider';
import { TeachingEngineService } from '../src/modules/teaching-engine/teaching-engine.service';
import { EpisodeTeachingAnalysis, EpisodeTeachingBlueprint, ProductionDialogueScript } from '../src/modules/teaching-engine/types';
import { EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION } from '../src/modules/teaching-engine/schema';

const analysis: EpisodeTeachingAnalysis = {
  schema_version: EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION,
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
      { turns: [repairedTurn] },
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
  });
});

/*
 * Development-only, model-backed validation for the Teaching Engine.
 *
 * This deliberately invokes POST /teaching/episodes through the Express app.
 * It never starts a listener and refuses production even when pointed at a
 * production-looking database URL.
 */
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DEV_ADMIN_EMAIL = 'teaching-engine.validation@local.invalid';
const DEV_MATERIAL_REF = 'development://teaching-engine-validation/raft-leader-election-v1';
const OUTPUT_ROOT = path.resolve(process.cwd(), '.teaching-engine-runs');
const ACTIVE_INTENTS = new Set(['DEDUCE', 'CHALLENGE', 'STRESS_TEST', 'PREDICT_CONSEQUENCE', 'PARTIAL_INFERENCE', 'AHA_REPHRASE', 'CALLBACK_CONNECT', 'COMPARE', 'GENERATE_EXAMPLE']);

const raftFixture = `Development-only fixture: Raft leader election

Raft elects a leader one term at a time. When a server starts an election, it increments its term, votes for itself, and requests votes from the other servers. Each server grants at most one vote in a term. A candidate becomes leader only after receiving a majority of votes.

If two candidates split the votes so neither gains a majority, the cluster can have no leader for that term. Split votes can repeat in later terms. Randomized election timeouts make split votes rare because servers are less likely to begin elections together; randomized timeouts do not make split votes impossible. A new election after a timeout gives the cluster another chance to elect a leader.`;

function present(value: string | undefined) {
  if (!value?.trim()) return false;
  return !['your_', 'replace_me', 'api_key', 'dummy', 'placeholder'].some((marker) => value.toLowerCase().includes(marker));
}

function printChecklist() {
  const providerKey = present(process.env.OPENAI_API_KEY) || present(process.env.GEMINI_API_KEY) || present(process.env.GOOGLE_GENERATIVE_AI_API_KEY) || present(process.env.GOOGLE_API_KEY);
  // The provider owns a safe default model when a provider key is configured;
  // stage overrides remain optional rather than becoming hidden requirements.
  const fallbackModel = present(process.env.OPENAI_MODEL) || present(process.env.GEMINI_MODEL) || providerKey;
  const modelReady = (override: string | undefined) => present(override) || fallbackModel;
  const rows: Array<[string, boolean]> = [
    ['DATABASE_URL', present(process.env.DATABASE_URL)],
    ['JWT_SECRET', present(process.env.JWT_SECRET)],
    ['AI_PROVIDER_KEY', providerKey],
    ['ANALYSIS_MODEL', modelReady(process.env.TEACHING_ANALYSIS_MODEL)],
    ['BLUEPRINT_MODEL', modelReady(process.env.TEACHING_BLUEPRINT_MODEL)],
    ['DIALOGUE_MODEL', modelReady(process.env.TEACHING_DIALOGUE_MODEL)],
    ['FIDELITY_MODEL', modelReady(process.env.TEACHING_FIDELITY_MODEL)],
  ];
  console.log('Teaching Engine live-validation configuration (values are never printed):');
  rows.forEach(([key, ok]) => console.log(`${key.padEnd(20)} ${ok ? 'PRESENT' : 'MISSING'}`));
  return rows.filter(([, ok]) => !ok).map(([key]) => key);
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function markdownEscape(value: unknown) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function host2Category(turn: any) {
  const text = String(turn.spoken_text || '').toLowerCase();
  if (turn.intent === 'DEDUCE') return 'DEDUCE';
  if (turn.intent === 'CHALLENGE') return 'CHALLENGE';
  if (turn.intent === 'TEST_ANALOGY') return 'STRESS_TEST';
  if (turn.intent === 'REFRAME') return 'AHA_REPHRASE';
  if (turn.intent === 'SYNTHESIZE' || turn.intent === 'CLOSE_LOOP') return 'CALLBACK_CONNECT';
  if (/\bif\b.*\bthen\b|\bwould\b.*\bhappen\b/.test(text)) return 'PREDICT_CONSEQUENCE';
  if (/\bfor example\b|\bimagine\b/.test(text)) return 'GENERATE_EXAMPLE';
  if (/\bcompare\b|\bversus\b/.test(text)) return 'COMPARE';
  if (/\bso .+ means\b|\bthat means\b/.test(text)) return 'PARTIAL_INFERENCE';
  return 'OTHER';
}

function reportFor(result: any) {
  const { analysis, blueprint, dialogue, fidelity, fidelityHistory = [], preRepairDialogue, instrumentation, conversationalQuality, rawConversationalQuality, host1OpeningRepairs = [] } = result;
  const core = analysis.concepts.filter((concept: any) => concept.tier === 'CORE_PILLAR');
  const host2Turns = dialogue.turns.filter((turn: any) => turn.speaker === 'HOST_2');
  const host2 = host2Turns.map((turn: any) => ({ turn, category: host2Category(turn) }));
  const activeHost2 = host2.filter(({ category }: any) => ACTIVE_INTENTS.has(category));
  const grouped = ['DEDUCE', 'CHALLENGE', 'STRESS_TEST', 'PREDICT_CONSEQUENCE', 'PARTIAL_INFERENCE', 'AHA_REPHRASE', 'CALLBACK_CONNECT', 'COMPARE', 'GENERATE_EXAMPLE', 'OTHER']
    .map((category) => `- ${category}: ${host2.filter((entry: any) => entry.category === category).map((entry: any) => entry.turn.turn_id).join(', ') || 'none'}`)
    .join('\n');
  const evidenceTraces = dialogue.turns
    .filter((turn: any) => turn.evidence_ids?.length)
    .slice(0, 3)
    .map((turn: any) => {
      const evidence = turn.evidence_ids.map((id: string) => analysis.evidence_registry.find((item: any) => item.evidence_id === id)).filter(Boolean);
      return `### ${turn.turn_id}\n- Dialogue: ${turn.spoken_text}\n- Blueprint evidence IDs: ${turn.evidence_ids.join(', ')}\n${evidence.map((item: any) => `- ${item.evidence_id}: ${item.normalized_claim}\n  - Source span: ${item.verbatim_span}`).join('\n')}`;
    }).join('\n\n') || 'No evidence-bound dialogue turns were returned.';
  const analogies = analysis.concepts.flatMap((concept: any) => concept.analogy_candidates || [])
    .filter((analogy: any) => analysis.concepts.some((concept: any) => concept.selected_analogy_id === analogy.analogy_id))
    .map((analogy: any) => {
      const turns = dialogue.turns.filter((turn: any) => turn.analogy_id === analogy.analogy_id).map((turn: any) => turn.turn_id);
      return `### ${analogy.analogy_id}: ${analogy.vehicle}\n- Mapping: ${analogy.mapping.map((item: any) => `${item.vehicle_element} → ${item.concept_element}`).join('; ')}\n- Breakdown boundary: ${analogy.breakdown_boundary}\n- Forbidden inferences: ${analogy.forbidden_inferences.join('; ') || 'none'}\n- Dialogue turns: ${turns.join(', ') || 'not used'}`;
    }).join('\n\n') || 'No analogy was selected.';
  const stageLines = (instrumentation?.stages || []).map((stage: any) => `- ${stage.stage}: ${stage.cacheHit ? 'cache hit' : `${stage.latencyMs}ms`} | model: ${stage.model || 'not exposed'} | provider token usage: ${stage.tokenUsage ? json(stage.tokenUsage).trim() : 'not exposed'}`).join('\n');
  const originalDefects = fidelityHistory[0]?.defects || [];
  const repairedDefects = fidelityHistory[1]?.defects || [];

  return `# Akademi Teaching Engine live validation\n\n- Integration: **HTTP_INTEGRATION** (` + '`POST /teaching/episodes`' + ` through normal JWT + admin middleware)\n- Episode: ${result.episodeId}\n- Analysis cache: ${result.cachedAnalysis ? 'HIT' : 'MISS'}\n- Total generation latency: ${instrumentation?.totalLatencyMs ?? 'not exposed'}ms\n- Source route: ${instrumentation?.sourceRoute ?? 'not exposed'} (${instrumentation?.sourceTokenEstimate ?? 'not exposed'} estimated tokens)\n\n## Latencies\n${stageLines || 'No stage instrumentation returned.'}\n\n## Analysis summary — Call 1\n\n### Central thesis\n${analysis.episode_thesis.statement}\n\n### Core concepts\n${core.map((concept: any) => `- ${concept.concept_id}: ${concept.canonical_name}`).join('\n') || 'None'}\n\n### Invariants\n${core.flatMap((concept: any) => concept.invariants).map((item: any) => `- ${item.invariant_id}: ${item.statement} (forbidden: ${item.forbidden_exaggerations.join('; ') || 'none'})`).join('\n') || 'None'}\n\n### Misconceptions and correction targets\n${core.flatMap((concept: any) => concept.misconceptions).map((item: any) => `- ${item.misconception_id}: ${item.naive_assumption} → ${item.correction_target}`).join('\n') || 'None'}\n\n### Mental models\n${core.map((concept: any) => `- ${concept.concept_id}: ${concept.target_mental_model.description}`).join('\n') || 'None'}\n\n### Selected analogies and boundaries\n${analogies}\n\n## Blueprint summary — Call 2\n\n### Concept sequence and open loops\n${blueprint.turns.map((turn: any) => `- ${turn.turn_id} | ${turn.speaker} | ${turn.intent} | concepts: ${turn.concept_ids.join(', ') || 'none'} | payload: ${turn.core_epistemic_payload}`).join('\n')}\n\n### Host 2 intents\n${blueprint.turns.filter((turn: any) => turn.speaker === 'HOST_2').map((turn: any) => `- ${turn.turn_id}: ${turn.intent}`).join('\n') || 'None'}\n\n### Misconception → turn map\n${blueprint.turns.flatMap((turn: any) => turn.misconception_ids.map((id: string) => `- ${id} → ${turn.turn_id}`)).join('\n') || 'None'}\n\n### Invariant → turn map\n${blueprint.turns.flatMap((turn: any) => turn.invariant_ids.map((id: string) => `- ${id} → ${turn.turn_id}`)).join('\n') || 'None'}\n\n## Full generated dialogue — Call 3\n\n${dialogue.turns.map((turn: any) => `**${turn.turn_id} · ${turn.speaker} · ${turn.intent}:** ${turn.spoken_text}`).join('\n\n')}\n\n## Host 2 agency report\n\n- Total Host 2 turns: ${host2.length}\n- Active Host 2 turns: ${activeHost2.length}\n- Agency ratio: ${host2.length ? (activeHost2.length / host2.length).toFixed(2) : '0.00'}\n- Method: intent/semantic classification only; a question mark does not make a turn active.\n\n${grouped}\n\n## Fidelity result\n\n- Final result: **${fidelity?.verdict || 'SKIPPED'}**\n- First pass: **${fidelityHistory[0]?.verdict || 'SKIPPED'}**\n- Second pass: **${fidelityHistory[1]?.verdict || 'not needed'}**\n- Original defects: ${originalDefects.map((item: any) => `${item.defect_id} (${item.severity}): ${item.description}`).join('; ') || 'none'}\n\n## Repairs performed\n\n- Repaired defects: ${repairedDefects.map((item: any) => `${item.defect_id} (${item.severity}): ${item.description}`).join('; ') || (preRepairDialogue ? 'no remaining defects reported' : 'no repair needed')}\n- Original repaired turn IDs: ${preRepairDialogue ? preRepairDialogue.turns.filter((turn: any, index: number) => turn.spoken_text !== dialogue.turns[index]?.spoken_text).map((turn: any) => turn.turn_id).join(', ') || 'none detected' : 'no repair needed'}\n\n## Evidence traces\n\n${evidenceTraces}\n\n## Analogy audit\n\n${analogies}\n`;
}

async function main() {
  const missing = printChecklist();
  const requestedEnvironment = process.env.NODE_ENV || 'development';
  if (requestedEnvironment === 'production' && process.env.TEACHING_ENGINE_LIVE_VALIDATION_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing production validation. Set TEACHING_ENGINE_LIVE_VALIDATION_ALLOW_PRODUCTION=true only on the intended non-customer validation deployment.');
  }
  if (process.env.TEACHING_ENGINE_LIVE_VALIDATION !== 'true') {
    throw new Error('Set TEACHING_ENGINE_LIVE_VALIDATION=true in a non-production environment before running this command.');
  }
  if (missing.length) {
    throw new Error(`Configure the missing variable(s) above before running a live model validation: ${missing.join(', ')}.`);
  }

  // Set this only after the safety check. The test host mounts the actual
  // production teaching router, including its JWT/admin middleware, without
  // importing unrelated application modules or opening a listener.
  process.env.NODE_ENV = 'test';
  const [{ default: prisma }, { config }, expressModule, teachingRoutesModule, jwtModule, supertestModule] = await Promise.all([
    import('../config/db'), import('../config/env'), import('express'), import('../modules/teaching-engine/teaching-engine.routes'), import('jsonwebtoken'), import('supertest'),
  ]);
  const express = expressModule.default;
  const teachingRoutes = teachingRoutesModule.default;
  const app = express();
  app.use(express.json());
  app.use('/teaching', teachingRoutes);
  const jwt = jwtModule.default;
  const request = supertestModule.default;
  let connected = false;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(OUTPUT_ROOT, timestamp);
  try {
    await fs.mkdir(runDir, { recursive: true });
    await prisma.$connect();
    connected = true;
    await Promise.all([prisma.teachingAnalysisCache.count(), prisma.teachingEpisode.count()]);
    console.log('DATABASE              CONNECTED; Teaching Engine Prisma tables are present');

    const user = await prisma.user.upsert({
      where: { email: DEV_ADMIN_EMAIL },
      create: { name: 'Teaching Engine Validation', email: DEV_ADMIN_EMAIL, password_hash: 'development-only-no-login', university: 'Development Only', faculty: 'Engineering', department: 'Distributed Systems', level: 400, is_verified: true },
      update: { is_deleted: false, is_banned: false, is_verified: true },
    });
    await prisma.admin.upsert({
      where: { email: DEV_ADMIN_EMAIL },
      create: { name: 'Teaching Engine Validation', email: DEV_ADMIN_EMAIL, password_hash: 'development-only-no-login', role: 'SUPER_ADMIN', status: 'active' },
      update: { status: 'active' },
    });
    let material = await prisma.material.findFirst({ where: { file_ref: DEV_MATERIAL_REF }, select: { id: true } });
    if (material) {
      material = await prisma.material.update({ where: { id: material.id }, data: { content: raftFixture, title: '[DEV ONLY] Raft leader election validation fixture' }, select: { id: true } });
    } else {
      material = await prisma.material.create({
        data: { title: '[DEV ONLY] Raft leader election validation fixture', course_code: 'DEV-RAFT', university: 'Development Only', faculty: 'Engineering', department: 'Distributed Systems', level: 400, file_ref: DEV_MATERIAL_REF, file_type: 'DOC', uploaded_by: user.id, content: raftFixture },
        select: { id: true },
      });
    }
    const token = jwt.sign({ userId: user.id, email: DEV_ADMIN_EMAIL }, config.jwtSecret, { expiresIn: '10m' });
    const response = await request(app)
      .post('/teaching/episodes')
      .set('Authorization', `Bearer ${token}`)
      .send({ materialId: material.id, learnerLevel: 'INTELLIGENT_BEGINNER', durationMinutes: 8, focus: 'Explain why randomized timeouts reduce split votes without making them impossible.', complexity: 'STANDARD' });
    if (response.status !== 201) {
      const diagnostic = response.body?.diagnostic;
      const rawResponse = response.body?.raw_response;
      await Promise.all([
        fs.writeFile(path.join(runDir, 'failure-diagnostic.json'), json({ status: response.status, message: response.body?.message || 'unknown error', diagnostic })),
        ...(typeof rawResponse === 'string' ? [fs.writeFile(path.join(runDir, 'call-1-raw-response.json'), json({ raw_response: rawResponse }))] : []),
      ]);
      if (diagnostic) console.error('CALL_1_SANITIZED_DIAGNOSTIC', json(diagnostic));
      throw new Error(`HTTP_INTEGRATION failed with ${response.status}: ${response.body?.message || 'unknown error'}`);
    }

    const result = response.body;
    const qualityReport = result.conversationalQuality
      ? `\n## Conversational quality — soft validation\n\n- Verdict: **${result.conversationalQuality.verdict}**\n- Raw metrics: ${json(result.rawConversationalQuality?.metrics).trim()}\n- Final metrics: ${json(result.conversationalQuality.metrics).trim()}\n- Host 1 opening repairs: ${result.host1OpeningRepairs?.filter((repair: any) => repair.applied).map((repair: any) => `${repair.turn_id}: ${repair.removed_text}`).join('; ') || 'none'}\n\n${result.conversationalQuality.issues.map((issue: any) => `- ${issue.type} | ${issue.turn_id} | “${issue.phrase}” | ${issue.reason}`).join('\n') || 'No soft-quality warnings.'}\n`
      : '';
    const report = `${reportFor(result)}${qualityReport}`;
    await Promise.all([
      fs.writeFile(path.join(runDir, 'analysis.json'), json(result.analysis)),
      fs.writeFile(path.join(runDir, 'blueprint.json'), json(result.blueprint)),
      fs.writeFile(path.join(runDir, 'dialogue.json'), json(result.dialogue)),
      fs.writeFile(path.join(runDir, 'fidelity.json'), json({ final: result.fidelity, history: result.fidelityHistory, instrumentation: result.instrumentation })),
      fs.writeFile(path.join(runDir, 'conversational-quality.json'), json(result.conversationalQuality)),
      fs.writeFile(path.join(runDir, 'conversational-quality-raw.json'), json(result.rawConversationalQuality)),
      fs.writeFile(path.join(runDir, 'host1-opening-repairs.json'), json(result.host1OpeningRepairs)),
      fs.writeFile(path.join(runDir, 'repaired-dialogue.json'), json(result.preRepairDialogue ? { original: result.preRepairDialogue, repaired: result.dialogue } : { repaired: false, dialogue: result.dialogue })),
      fs.writeFile(path.join(runDir, 'report.md'), report),
    ]);
    console.log(`HTTP_INTEGRATION      PASS`);
    console.log(`Artifacts written to  ${runDir}`);
    // Render disks are ephemeral. The same sanitized report is printed so a
    // complete run can be recovered from service logs without exposing secrets.
    console.log('\n===== AKADEMI TEACHING ENGINE LIVE VALIDATION =====\n');
    console.log('Environment check\nRequired variables: PRESENT (values redacted)');
    console.log('\nProvider/model information\nSee Instrumentation below; no provider credentials are emitted.');
    console.log(report);
    console.log('\nFinal teaching-quality assessment\nAutomated baseline captured. Review the generated dialogue, fidelity result, evidence traces, and analogy audit above before changing prompts.');
    console.log('\n===== END VALIDATION =====');
  } finally {
    if (connected) await prisma.$disconnect();
  }
}

async function exitAfterFlush(code: number) {
  // Supertest and provider SDKs can retain short-lived handles. This is a
  // one-off process; the DB disconnect in main's finally has already run.
  await new Promise((resolve) => setTimeout(resolve, 25));
  process.exit(code);
}

main().then(
  () => exitAfterFlush(0),
  async (error) => {
    console.error(`Teaching Engine live validation stopped: ${error instanceof Error ? error.message : String(error)}`);
    await exitAfterFlush(1);
  },
);

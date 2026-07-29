import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';
import { withTransientRetry } from '../shared/ai/retryTransient';

// ─── GATE A: Model Validation Function (unchanged — validates KCs/ItemModels/etc. that the
// archetype-only phase below does not yet produce; not called from modelTopicKnowledgeJob) ──────

export async function runGateAValidation(modelId: string, attempt: number = 1): Promise<boolean> {
  const model = await prisma.knowledgeModel.findUnique({
    where: { id: modelId },
    include: {
      kcs: { include: { dependsOn: true } },
      archetypes: true,
      difficultyFactors: true,
      misconceptions: true,
      itemModels: { include: { branches: true, supportRungs: true, distractorRules: true } },
      jitBlocks: true,
      teachingBlocks: true
    }
  });

  if (!model) throw new Error(`Model ${modelId} not found for Gate A validation`);

  const findings: { checkId: string; severity: 'HARD' | 'SOFT' | 'WARN'; detail: string; subjectId?: string }[] = [];

  // A1: KC granularity
  for (const kc of model.kcs) {
    const wordCount = kc.statement.trim().split(/\s+/).length;
    if (wordCount < 6 || wordCount > 14) {
      findings.push({ checkId: 'A1', severity: 'HARD', detail: `KC ${kc.publicId} word count ${wordCount} out of bounds (6-14)`, subjectId: kc.id });
    }
  }

  // A2: Trace evidence
  for (const kc of model.kcs) {
    if (kc.traceEvidence < 2) {
      findings.push({ checkId: 'A2', severity: 'HARD', detail: `KC ${kc.publicId} trace evidence ${kc.traceEvidence} < 2`, subjectId: kc.id });
    }
  }

  // A3: Outcome coverage
  if (model.kcs.length === 0) {
    findings.push({ checkId: 'A3', severity: 'HARD', detail: 'Outcome coverage failed: no KCs present in model' });
  }

  // A4: Gaps resolved
  const allDeps = model.kcs.flatMap(k => k.dependsOn);
  const unresolvedGaps = allDeps.filter(d => d.resolution === 'UNRESOLVED');
  if (unresolvedGaps.length > 0) {
    findings.push({ checkId: 'A4', severity: 'HARD', detail: `Found ${unresolvedGaps.length} unresolved KC dependencies` });
  }

  // A5: Acyclic dependency graph (Tarjan / DFS)
  const adj = new Map<string, string[]>();
  model.kcs.forEach(k => adj.set(k.id, k.dependsOn.map(d => d.prerequisiteId).filter(Boolean) as string[]));
  const visited = new Set<string>();
  const recStack = new Set<string>();
  let cycleFound = false;

  function dfs(nodeId: string): boolean {
    if (recStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    recStack.add(nodeId);
    for (const neighbor of (adj.get(nodeId) || [])) {
      if (dfs(neighbor)) return true;
    }
    recStack.delete(nodeId);
    return false;
  }
  for (const kc of model.kcs) {
    if (dfs(kc.id)) { cycleFound = true; break; }
  }
  if (cycleFound) {
    findings.push({ checkId: 'A5', severity: 'HARD', detail: 'Cycle detected in KC prerequisite graph' });
  }

  // A7: Archetype distinctness
  for (const arch of model.archetypes) {
    if (!arch.distinctBecause) {
      findings.push({ checkId: 'A7', severity: 'SOFT', detail: `Archetype ${arch.publicId} missing distinctBecause justification`, subjectId: arch.id });
    }
  }

  // A8: Radical validity
  for (const df of model.difficultyFactors) {
    if (df.perturbationResult === 'INCONCLUSIVE') {
      findings.push({ checkId: 'A8', severity: 'HARD', detail: `Difficulty factor ${df.publicId} has INCONCLUSIVE result`, subjectId: df.id });
    }
  }

  // A9: Tier spread
  const hasTier1 = model.itemModels.some(im => im.tier === 1);
  const hasTier3Plus = model.itemModels.some(im => im.tier >= 3);
  if (!hasTier1 || !hasTier3Plus) {
    findings.push({ checkId: 'A9', severity: 'HARD', detail: `Tier spread failed: Tier1=${hasTier1}, Tier3+=${hasTier3Plus}` });
  }

  // A10: Tier-3 provenance
  for (const im of model.itemModels) {
    if (im.tier >= 3 && !im.harvestedStemRef) {
      findings.push({ checkId: 'A10', severity: 'HARD', detail: `Item model ${im.publicId} (Tier ${im.tier}) missing harvestedStemRef`, subjectId: im.id });
    }
  }

  // A11: Branch declaration
  for (const im of model.itemModels) {
    if (im.branches.length > 0 && !im.branchCoverageRequired) {
      findings.push({ checkId: 'A11', severity: 'HARD', detail: `Item model ${im.publicId} has branches but branchCoverageRequired is false`, subjectId: im.id });
    }
  }

  // A12: Concept non-examples
  const conceptKCs = model.kcs.filter(k => k.type === 'CONCEPT');
  for (const cKc of conceptKCs) {
    const hasNonExample = model.itemModels.some(im => im.kind === 'NON_EXAMPLE' && im.targetKCIds.includes(cKc.publicId));
    if (!hasNonExample) {
      findings.push({ checkId: 'A12', severity: 'HARD', detail: `Concept KC ${cKc.publicId} has no corresponding NON_EXAMPLE item model`, subjectId: cKc.id });
    }
  }

  // A13: Selection taught
  const selectionKCs = model.kcs.filter(k => k.isSelection);
  for (const sKc of selectionKCs) {
    const hasTeachingBlock = model.teachingBlocks.some(tb => tb.kind === 'SELECTION_TABLE' && tb.forKCId === sKc.publicId);
    if (!hasTeachingBlock) {
      findings.push({ checkId: 'A13', severity: 'HARD', detail: `Selection KC ${sKc.publicId} missing SELECTION_TABLE teaching block`, subjectId: sKc.id });
    }
  }

  // A14: Erroneous coverage
  const intuitiveConfrontable = model.misconceptions.filter(m => m.kind === 'INTUITIVE_THEORY' && m.confrontable);
  for (const mc of intuitiveConfrontable) {
    const hasErroneousModel = model.itemModels.some(im => im.kind === 'ERRONEOUS' && im.erroneousSourceId === mc.id);
    if (!hasErroneousModel) {
      findings.push({ checkId: 'A14', severity: 'SOFT', detail: `Confrontable misconception ${mc.publicId} missing ERRONEOUS item model`, subjectId: mc.id });
    }
  }

  // A16: Variability staging
  for (const im of model.itemModels) {
    if (im.tier === 1 && im.variability !== 'LOW') {
      findings.push({ checkId: 'A16', severity: 'HARD', detail: `Tier 1 Item Model ${im.publicId} has variability ${im.variability} (must be LOW)`, subjectId: im.id });
    }
  }

  // Record Validation Run
  const passed = !findings.some(f => f.severity === 'HARD');

  const valRun = await prisma.validationRun.create({
    data: {
      modelId: model.id,
      gate: 'A',
      attempt,
      passed,
      findings: {
        create: findings.map(f => ({
          checkId: f.checkId,
          severity: f.severity,
          subjectId: f.subjectId,
          detail: f.detail
        }))
      }
    }
  });

  // Update Model status
  await prisma.knowledgeModel.update({
    where: { id: model.id },
    data: { status: passed ? 'READY' : 'FAILED' }
  });

  return passed;
}

// ─── ARCHETYPE LAYER (v6 method) ────────────────────────────────────────────────────────────────
// Course-wide worked-example archetype extraction, validated as v1-v7 of the standalone experiment
// scripts (docs/archetype-experiment-mth102-v6.md). This is the production version of that method:
// same extraction/labeling/vocabulary pipeline, writing to OperationVocabulary + Archetype instead
// of a markdown report. Scope is deliberately archetype-layer only — no KC extraction, item
// generation, misconceptions, or difficulty factors. Gate A is not invoked here for that reason.

const CHUNK_SIZE = 8000;
const CHUNK_OVERLAP = 500;
// Was 2. Repeated failures today traced to this specifically: a 2-chunk batch (up to 16,000 input
// chars) asks for a verbatim-text JSON response large enough to hit maxOutputTokens=8000, the
// provider's own truncation-retry then exceeds the per-attempt timeout, and the whole batch fails.
// 1 chunk per call roughly doubles the call count but keeps each individual call's output small
// enough to actually complete on the fallback model.
const CHUNKS_PER_EXTRACTION_CALL = 1;
const LABEL_BATCH_SIZE = 5;
const MIN_MS_BETWEEN_CALLS = 4500; // confirmed fallback-model per-minute cap (v3)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const LABEL_TEMPERATURE = 0.7;
const NORMALIZE_TEMPERATURE = 0.2;
const SPLIT_TEMPERATURE = 0.3;
const NORMALIZE_CHUNK_SIZE = 40;
const VOCAB_CHUNK_SIZE = 40;
const VOCAB_TARGET_MIN = 40;
const VOCAB_TARGET_MAX = 80;
const DIRECT_EVALUATION = 'DIRECT_EVALUATION';
// A vocabulary entry gets auto-flagged as a catch-all needing a split if its alias count clears
// this bar — matches the empirical pattern from both courses this method has been run on so far
// (MTH102's six catch-alls ran 10-63 aliases; PHY102's one ran 30; every clean, already-specific
// entry on both courses stayed under 15).
const CATCHALL_ALIAS_THRESHOLD = 15;
const MAX_CATCHALLS_PER_RUN = 8;

type SourceChunk = { chunkId: string; chunkIndex: number; text: string };
type ExtractedExample = { exampleId: string; problemText: string; solutionSteps: string[] };
type LabeledExample = { exampleId: string; actionLabels: string[] };
type Classification = 'DISCRIMINATING' | 'GENERIC';
type VocabEntry = { name: string; classification: Classification; aliases: string[] };
type ModelUsage = Record<string, Record<string, number>>;

function recordUsage(usage: ModelUsage, phase: string, model: string) {
  usage[phase] = usage[phase] || {};
  usage[phase][model] = (usage[phase][model] || 0) + 1;
}

function sanitizeJsonEscapes(text: string): string {
  const validEscapeChars = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
  let result = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString && ch === '\\') {
      const next = text[i + 1];
      if (next !== undefined && validEscapeChars.has(next)) {
        result += ch + next;
        i += 1;
      } else {
        result += '\\\\';
      }
      continue;
    }
    result += ch;
  }
  return result;
}

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(sanitizeJsonEscapes(cleaned));
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(sanitizeJsonEscapes(cleaned.slice(start, end + 1)));
    throw new Error('AI did not return valid JSON');
  }
}

function chunkText(text: string, size: number, overlap: number): string[] {
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

function tokens(sig: string): string[] {
  return sig ? sig.split(' -> ').map((s) => s.trim()).filter(Boolean) : [];
}

// ─── Step 3: density gate — reads Material.extracted_example_count (compute-material-example-
// density.ts), zero AI calls. Refuses to guess: a course with any unscored material fails closed. ──

async function checkCourseDensity(courseCode: string): Promise<{ classification: 'DENSE' | 'MODERATE' | 'SPARSE'; charsPerExample: number | null; reason: string }> {
  const materials = await prisma.material.findMany({
    where: { is_akademi_generated: false, verification_status: { not: 'TAKEN_DOWN' }, course_code: courseCode },
    select: { content: true, extracted_example_count: true },
  });
  const nonEmpty = materials.filter((m) => (m.content?.trim().length || 0) > 0);
  if (nonEmpty.length === 0) {
    return { classification: 'SPARSE', charsPerExample: null, reason: `No real, non-empty materials found for ${courseCode}.` };
  }
  const unscored = nonEmpty.filter((m) => m.extracted_example_count === null);
  if (unscored.length > 0) {
    return {
      classification: 'SPARSE',
      charsPerExample: null,
      reason: `${unscored.length} of ${nonEmpty.length} materials for ${courseCode} have no extracted_example_count yet — run compute-material-example-density.ts before attempting archetype extraction.`,
    };
  }
  const totalChars = nonEmpty.reduce((sum, m) => sum + m.content!.length, 0);
  const totalExamples = nonEmpty.reduce((sum, m) => sum + (m.extracted_example_count || 0), 0);
  if (totalExamples === 0) {
    return { classification: 'SPARSE', charsPerExample: null, reason: `${courseCode} has 0 extracted examples across ${nonEmpty.length} materials.` };
  }
  const charsPerExample = totalChars / totalExamples;
  const classification = charsPerExample < 1000 ? 'DENSE' : charsPerExample <= 3000 ? 'MODERATE' : 'SPARSE';
  return { classification, charsPerExample, reason: `${totalChars} chars / ${totalExamples} examples = ${Math.round(charsPerExample)} chars/example (${classification}).` };
}

// ─── Step a-b: read materials, extract every worked example verbatim ───────────────────────────

async function loadCourseMaterials(courseCode: string): Promise<Array<{ title: string; content: string }>> {
  const materials = await prisma.material.findMany({
    where: { is_akademi_generated: false, verification_status: { not: 'TAKEN_DOWN' }, course_code: courseCode },
    select: { title: true, content: true },
  });
  return materials.filter((m) => (m.content?.trim().length || 0) > 0).map((m) => ({ title: m.title, content: m.content!.trim() }));
}

function buildChunks(sources: Array<{ title: string; content: string }>): SourceChunk[] {
  const chunks: SourceChunk[] = [];
  for (const source of sources) {
    const pieces = chunkText(source.content, CHUNK_SIZE, CHUNK_OVERLAP);
    pieces.forEach((text, i) => chunks.push({ chunkId: `${source.title}__chunk${i}`, chunkIndex: i, text }));
  }
  return chunks;
}

async function extractFromChunkBatch(batch: SourceChunk[], usage: ModelUsage): Promise<Map<string, { problemText: string; solutionSteps: string[] }[]>> {
  const prompt = `You are extracting worked examples from real teaching material text chunks. Do NOT interpret, generalize, summarize, or name anything at this stage — extract exactly what is present in the text, verbatim.

For EACH chunk below, extract every worked example, solved problem, or illustrative problem present in that chunk's text (verbatim, as written). If a chunk genuinely contains no worked examples, include it in the output with an empty "examples" array — do not skip it, and do not invent examples that are not actually present.

For each example found, record:
- problemText: the problem statement, verbatim from the text
- solutionSteps: the solution/working, split into an ordered array of individual steps, verbatim from the text

CHUNKS:
${batch.map((c) => `=== chunk_id: ${c.chunkId} ===\n${c.text}`).join('\n\n')}

Format as JSON: { "chunkResults": [ { "chunkId": string, "examples": [ { "problemText": string, "solutionSteps": string[] } ] } ] }
Include an entry in "chunkResults" for every chunk_id given above, even if its "examples" array is empty.`;

  // Parsing happens INSIDE the retry closure, not after it — a call that returns 200 but with
  // truncated/malformed JSON (hits maxOutputTokens mid-object) must also trigger a fresh retry,
  // not crash the job. Confirmed necessary by a real failure: a truncated response parsed outside
  // the wrapper threw SyntaxError and killed a run that had otherwise gotten further than any
  // previous attempt.
  const { parsed, model } = await withTransientRetry(
    async () => {
      const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
        systemPrompt: 'You are a precise text-extraction tool. You extract worked examples verbatim from source text — you never interpret, generalize, or paraphrase. Return ONLY valid JSON, no prose outside the JSON object.',
        maxTokens: 8000,
        extendedTimeouts: true,
        temperature: 0.7,
      });
      return { parsed: parseJsonObject(text), model };
    },
    { label: 'extract' },
  );
  recordUsage(usage, 'extract', model);

  const results = new Map<string, { problemText: string; solutionSteps: string[] }[]>();
  const chunkResults = Array.isArray(parsed?.chunkResults) ? parsed.chunkResults : [];
  for (const cr of chunkResults) {
    const chunkId = String(cr?.chunkId || '');
    const examples = Array.isArray(cr?.examples) ? cr.examples : [];
    results.set(
      chunkId,
      examples
        .map((e: any) => ({
          problemText: String(e?.problemText || '').trim(),
          solutionSteps: Array.isArray(e?.solutionSteps) ? e.solutionSteps.map((s: any) => String(s).trim()).filter(Boolean) : [],
        }))
        .filter((e: any) => e.problemText),
    );
  }
  for (const c of batch) if (!results.has(c.chunkId)) results.set(c.chunkId, []);
  return results;
}

async function extractAllExamples(courseCode: string, usage: ModelUsage): Promise<ExtractedExample[]> {
  const sources = await loadCourseMaterials(courseCode);
  if (sources.length === 0) throw new Error(`No real materials found for ${courseCode}`);
  const chunks = buildChunks(sources);
  console.log(`[model-topic-knowledge] ${courseCode}: ${sources.length} materials, ${chunks.length} chunks.`);

  const examples: ExtractedExample[] = [];
  let runningIndex = 0;
  for (let i = 0; i < chunks.length; i += CHUNKS_PER_EXTRACTION_CALL) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const batch = chunks.slice(i, i + CHUNKS_PER_EXTRACTION_CALL);
    const batchResults = await extractFromChunkBatch(batch, usage);
    for (const c of batch) {
      for (const f of batchResults.get(c.chunkId) || []) {
        examples.push({ exampleId: `ex${runningIndex}`, problemText: f.problemText, solutionSteps: f.solutionSteps });
        runningIndex += 1;
      }
    }
  }
  console.log(`[model-topic-knowledge] ${courseCode}: ${examples.length} examples extracted.`);
  return examples;
}

// ─── Step c: label each solution step with an action phrase ────────────────────────────────────

async function labelBatch(batch: ExtractedExample[], usage: ModelUsage): Promise<LabeledExample[]> {
  if (batch.length > LABEL_BATCH_SIZE) throw new Error(`labelBatch received ${batch.length} > ${LABEL_BATCH_SIZE}`);
  const prompt = `For each example below, label EVERY solution step with a short action phrase describing WHAT OPERATION was performed on that step — not what the answer was, and not the topic.

RULES:
- The label names the operation only, e.g. "apply power rule", "factor numerator", "apply Coulomb's law".
- Never label a step with its topic or outcome. Too broad to distinguish anything.
- One operation per label. If a single step performs two distinct operations, emit two separate labels for it, in order.

EXAMPLES:
${batch.map((e) => `=== exampleId: ${e.exampleId} ===\nPROBLEM: ${e.problemText}\nSTEPS:\n${e.solutionSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`).join('\n\n')}

Format as JSON: { "results": [ { "exampleId": string, "actionLabels": string[] } ] }
"actionLabels" is the flattened, ordered list of operation labels across all steps of that example. Include an entry for every exampleId above.`;

  const { parsed, model } = await withTransientRetry(
    async () => {
      const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
        systemPrompt: 'You label solution steps with short, precise operation names only. Never describe the topic or the result. Return ONLY valid JSON, no prose outside the JSON object.',
        maxTokens: 2000,
        extendedTimeouts: true,
        temperature: LABEL_TEMPERATURE,
      });
      return { parsed: parseJsonObject(text), model };
    },
    { label: 'label' },
  );
  recordUsage(usage, 'label', model);

  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  return results.map((r: any) => ({ exampleId: String(r?.exampleId || ''), actionLabels: Array.isArray(r?.actionLabels) ? r.actionLabels.map((l: any) => String(l).trim()).filter(Boolean) : [] }));
}

async function labelAllExamples(examples: ExtractedExample[], usage: ModelUsage): Promise<LabeledExample[]> {
  const labeled: LabeledExample[] = [];
  for (let i = 0; i < examples.length; i += LABEL_BATCH_SIZE) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    labeled.push(...(await labelBatch(examples.slice(i, i + LABEL_BATCH_SIZE), usage)));
  }
  return labeled;
}

// ─── Step d(i): normalize raw labels to canonical (merge exact synonyms only) ───────────────────

async function normalizeChunk(labels: string[], usage: ModelUsage, phase: string): Promise<Record<string, string>> {
  const prompt = `Below is a list of action-operation labels produced by labeling solution steps in worked examples.

Merge two labels ONLY IF they name the IDENTICAL operation in different words. If in any doubt, do NOT merge — keep the labels separate.

LABELS:
${labels.map((l, i) => `${i}. ${l}`).join('\n')}

Format as JSON: { "mapping": [ { "raw": string, "canonical": string } ] }
Include an entry for every label above. If a label doesn't merge with anything, its "canonical" value should just be a cleaned-up version of itself (never a different operation).`;

  const { parsed, model } = await withTransientRetry(
    async () => {
      const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
        systemPrompt: 'You are a strict vocabulary normalizer merging only exact-same-operation synonyms. Return ONLY valid JSON, no prose outside the JSON object.',
        maxTokens: 4000,
        extendedTimeouts: true,
        temperature: NORMALIZE_TEMPERATURE,
      });
      return { parsed: parseJsonObject(text), model };
    },
    { label: phase },
  );
  recordUsage(usage, phase, model);

  const mappingArr = Array.isArray(parsed?.mapping) ? parsed.mapping : [];
  const mapping: Record<string, string> = {};
  for (const m of mappingArr) {
    const raw = String(m?.raw || '').trim();
    const canonical = String(m?.canonical || '').trim();
    if (raw) mapping[raw] = canonical || raw;
  }
  for (const raw of labels) if (!mapping[raw]) mapping[raw] = raw;
  return mapping;
}

async function normalizeVocabulary(rawLabels: string[], usage: ModelUsage): Promise<Record<string, string>> {
  const distinctRaw = Array.from(new Set(rawLabels));
  const tier1Mapping: Record<string, string> = {};
  for (let i = 0; i < distinctRaw.length; i += NORMALIZE_CHUNK_SIZE) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    Object.assign(tier1Mapping, await normalizeChunk(distinctRaw.slice(i, i + NORMALIZE_CHUNK_SIZE), usage, 'normalize-tier1'));
  }
  const tier1Distinct = Array.from(new Set(Object.values(tier1Mapping)));
  let tier2Mapping: Record<string, string> = {};
  if (tier1Distinct.length > NORMALIZE_CHUNK_SIZE) {
    for (let i = 0; i < tier1Distinct.length; i += NORMALIZE_CHUNK_SIZE) {
      if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
      Object.assign(tier2Mapping, await normalizeChunk(tier1Distinct.slice(i, i + NORMALIZE_CHUNK_SIZE), usage, 'normalize-tier2'));
    }
  } else if (tier1Distinct.length > 1) {
    await sleep(MIN_MS_BETWEEN_CALLS);
    tier2Mapping = await normalizeChunk(tier1Distinct, usage, 'normalize-tier2');
  } else {
    tier2Mapping = Object.fromEntries(tier1Distinct.map((l) => [l, l]));
  }
  const mapping: Record<string, string> = {};
  for (const raw of distinctRaw) {
    const t1 = tier1Mapping[raw] || raw;
    mapping[raw] = tier2Mapping[t1] || t1;
  }
  return mapping;
}

// ─── Step d(ii): consolidate canonical labels into an initial closed vocabulary ─────────────────

async function vocabChunkCall(items: string[], usage: ModelUsage, phase: string, extraInstruction: string): Promise<VocabEntry[]> {
  const prompt = `Below is a list of operation labels used to describe individual steps in worked solutions.

Consolidate these into a small set of canonical OPERATION entries. Merge two labels ONLY if they name the IDENTICAL operation in different words. If in doubt, do NOT merge.
${extraInstruction}
LABELS:
${items.map((l, i) => `${i}. ${l}`).join('\n')}

Format as JSON: { "entries": [ { "name": string, "aliases": string[] } ] }
"aliases" must list every label above that maps to this entry. Every label above must appear in exactly one entry's aliases — do not drop any.`;

  const { parsed, model } = await withTransientRetry(
    async () => {
      const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
        systemPrompt: 'You are a strict vocabulary consolidator merging only exact-same-operation synonyms. Return ONLY valid JSON, no prose outside the JSON object.',
        maxTokens: 4000,
        extendedTimeouts: true,
        temperature: NORMALIZE_TEMPERATURE,
      });
      return { parsed: parseJsonObject(text), model };
    },
    { label: phase },
  );
  recordUsage(usage, phase, model);

  const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  return entries
    .map((e: any) => ({ name: String(e?.name || '').trim(), classification: 'DISCRIMINATING' as Classification, aliases: Array.isArray(e?.aliases) ? e.aliases.map((a: any) => String(a).trim()).filter(Boolean) : [] }))
    .filter((e: VocabEntry) => e.name);
}

function dedupeEntriesByName(entries: VocabEntry[]): VocabEntry[] {
  const byKey = new Map<string, VocabEntry>();
  for (const e of entries) {
    const key = e.name.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { name: e.name, classification: e.classification, aliases: [...e.aliases] });
    else byKey.get(key)!.aliases.push(...e.aliases);
  }
  for (const e of byKey.values()) e.aliases = Array.from(new Set(e.aliases));
  return Array.from(byKey.values());
}

function reconcileDropped(inputNames: string[], byName: Map<string, VocabEntry>, produced: VocabEntry[]): VocabEntry[] {
  const covered = new Set(produced.flatMap((e) => e.aliases));
  const result = [...produced];
  for (const name of inputNames) {
    const original = byName.get(name);
    if (!original) continue;
    const stillMissing = original.aliases.filter((a) => !covered.has(a));
    if (stillMissing.length > 0) result.push({ name: original.name, classification: original.classification, aliases: stillMissing });
  }
  return result;
}

async function consolidateVocabulary(rawLabels: string[], usage: ModelUsage): Promise<VocabEntry[]> {
  let entries: VocabEntry[] = [];
  for (let i = 0; i < rawLabels.length; i += VOCAB_CHUNK_SIZE) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    entries.push(...(await vocabChunkCall(rawLabels.slice(i, i + VOCAB_CHUNK_SIZE), usage, 'vocab-tier1', '')));
  }
  {
    const byName = new Map(rawLabels.map((l) => [l, { name: l, classification: 'DISCRIMINATING' as Classification, aliases: [l] }]));
    entries = dedupeEntriesByName(reconcileDropped(rawLabels, byName, entries));
  }

  let round = 2;
  while (entries.length > VOCAB_CHUNK_SIZE * 2 && round <= 6) {
    const byName = new Map(entries.map((e) => [e.name, e]));
    const names = entries.map((e) => e.name);
    const merged: VocabEntry[] = [];
    for (let i = 0; i < names.length; i += VOCAB_CHUNK_SIZE) {
      if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
      const chunkEntries = await vocabChunkCall(names.slice(i, i + VOCAB_CHUNK_SIZE), usage, `vocab-tier${round}`, '');
      for (const ce of chunkEntries) merged.push({ name: ce.name, classification: ce.classification, aliases: ce.aliases.flatMap((n) => byName.get(n)?.aliases || [n]) });
    }
    entries = dedupeEntriesByName(reconcileDropped(names, byName, merged));
    round += 1;
  }

  await sleep(MIN_MS_BETWEEN_CALLS);
  const byNameFinal = new Map(entries.map((e) => [e.name, e]));
  const finalNames = entries.map((e) => e.name);
  const finalInstruction = `\nIMPORTANT: Consolidate these into a CLOSED vocabulary of between ${VOCAB_TARGET_MIN} and ${VOCAB_TARGET_MAX} total entries. Merge more aggressively across near-duplicate operations if needed, but NEVER merge two entries that are genuinely different operations just to hit the count.\n`;
  const finalChunkEntries = await vocabChunkCall(finalNames, usage, 'vocab-final', finalInstruction);
  const finalMerged = finalChunkEntries.map((ce) => ({ name: ce.name, classification: ce.classification, aliases: ce.aliases.flatMap((n) => byNameFinal.get(n)?.aliases || [n]) }));
  return dedupeEntriesByName(reconcileDropped(finalNames, byNameFinal, finalMerged));
}

// ─── Step d(iii): split any catch-all entry into real sub-techniques ────────────────────────────
// Catch-all identification is automatic (no human review, unlike the original v5/v6 experiment
// runs) — an entry whose alias count clears CATCHALL_ALIAS_THRESHOLD is assumed to be hiding
// multiple techniques under one vague label, same empirical pattern observed on both courses this
// method has run on so far.

async function splitCatchAll(entryName: string, aliases: string[], usage: ModelUsage): Promise<VocabEntry[]> {
  const prompt = `Below is the full alias list currently grouped under one overly-broad vocabulary entry, "${entryName}". This single entry is a catch-all hiding multiple genuinely distinct techniques.

Split these aliases into multiple distinct sub-operations, each naming ONE real, specific technique. Merge two aliases into the same sub-operation ONLY if they name the literal same technique in different words. If in doubt, keep them separate — under-splitting is the exact mistake being fixed here.

ALIASES CURRENTLY UNDER "${entryName}":
${aliases.map((a, i) => `${i}. ${a}`).join('\n')}

Format as JSON: { "entries": [ { "name": string, "aliases": string[] } ] }
Every alias above must appear in exactly one entry's aliases — do not drop any.`;

  const { parsed, model } = await withTransientRetry(
    async () => {
      const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
        systemPrompt: 'You split an overly-broad catch-all operation label into distinct, real, named techniques. Return ONLY valid JSON, no prose outside the JSON object.',
        maxTokens: 4000,
        extendedTimeouts: true,
        temperature: SPLIT_TEMPERATURE,
      });
      return { parsed: parseJsonObject(text), model };
    },
    { label: `split[${entryName}]` },
  );
  recordUsage(usage, `split[${entryName}]`, model);

  const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  const result: VocabEntry[] = entries
    .map((e: any) => ({ name: String(e?.name || '').trim(), classification: 'DISCRIMINATING' as Classification, aliases: Array.isArray(e?.aliases) ? e.aliases.map((a: any) => String(a).trim()).filter(Boolean) : [] }))
    .filter((e: VocabEntry) => e.name);
  const covered = new Set(result.flatMap((e) => e.aliases));
  const missing = aliases.filter((a) => !covered.has(a));
  if (missing.length > 0) result.push(...missing.map((a) => ({ name: a, classification: 'DISCRIMINATING' as Classification, aliases: [a] })));
  return result;
}

async function splitCatchAlls(entries: VocabEntry[], usage: ModelUsage): Promise<VocabEntry[]> {
  const catchAlls = entries
    .filter((e) => e.aliases.length >= CATCHALL_ALIAS_THRESHOLD)
    .sort((a, b) => b.aliases.length - a.aliases.length)
    .slice(0, MAX_CATCHALLS_PER_RUN);
  if (catchAlls.length === 0) return entries;

  console.log(`[model-topic-knowledge] splitting ${catchAlls.length} catch-all entr${catchAlls.length === 1 ? 'y' : 'ies'}: ${catchAlls.map((c) => `${c.name} (${c.aliases.length})`).join(', ')}`);

  const catchAllNames = new Set(catchAlls.map((c) => c.name));
  const result = entries.filter((e) => !catchAllNames.has(e.name));
  for (let i = 0; i < catchAlls.length; i += 1) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    result.push(...(await splitCatchAll(catchAlls[i].name, catchAlls[i].aliases, usage)));
  }
  return dedupeEntriesByName(result);
}

// ─── Step d(iv): classify DISCRIMINATING / GENERIC by fixed rule — no model call ────────────────
// Automated version of the judgment applied by hand across the v6/v7 experiment runs. The default
// direction matters more than the exact word lists: v6's manual pass treated GENERIC as the
// default (routine bookkeeping unless it names something specific) and DISCRIMINATING as the
// thing you had to find positive evidence for — not the other way around. An earlier version of
// this function defaulted to DISCRIMINATING and required every word to match a generic-word list
// to fall back to GENERIC; on a real MTH 102 run that produced 350/391 entries classified
// DISCRIMINATING (entries like "identify domain", "compose functions", "define inverse",
// "integrate function" all wrongly kept as discriminating) and 300 archetypes, 3.4x v6's 87 —
// confirming the bias, not the method, was the problem. This version defaults to GENERIC and
// requires a positive named-technique signal to become DISCRIMINATING.

const NAMED_TECHNIQUE_MARKERS = /\b(law|rule|theorem|identity|principle|definition|formula|property|test|method|technique|criterion)\b/i;
// Specific, well-known named techniques that don't happen to contain any of the marker words
// above — a small, deliberately narrow list (broadening this is exactly the whack-a-mole that
// motivated flipping the default in the first place; only add an entry here if it's a genuinely
// specific, recognizable technique, never a generic verb+object combination).
const KNOWN_TECHNIQUE_PHRASES = [
  'u-substitution', 'by parts', 'partial fraction', 'synthetic division', 'long division',
  'completing the square', 'cancel common factor', 'cancel term', 'cartesian product',
  'injectiv', 'surjectiv', 'bijectiv', "l'hopital", "l'hôpital", 'squeeze theorem',
];

function isNamedTechnique(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (/'s\b/.test(lower)) return true; // possessive: "Coulomb's", "Newton's", "Gauss's" — a named law
  if (NAMED_TECHNIQUE_MARKERS.test(lower)) return true;
  return KNOWN_TECHNIQUE_PHRASES.some((p) => lower.includes(p));
}

function classifyEntry(entry: VocabEntry, splitFromName: string | null): Classification {
  if (splitFromName && entry.name.toLowerCase() === splitFromName.toLowerCase()) return 'GENERIC'; // kept the catch-all's own name
  if (entry.name.toLowerCase().trim().startsWith('general ')) return 'GENERIC';
  return isNamedTechnique(entry.name) ? 'DISCRIMINATING' : 'GENERIC';
}

async function buildVocabulary(examples: ExtractedExample[], labeled: LabeledExample[], usage: ModelUsage): Promise<{ entries: VocabEntry[]; mapping: Record<string, string> }> {
  const allRawLabels = labeled.flatMap((l) => l.actionLabels);
  console.log(`[model-topic-knowledge] ${allRawLabels.length} raw labels (${new Set(allRawLabels).size} distinct).`);

  const normalizeMapping = await normalizeVocabulary(allRawLabels, usage);
  const canonicalLabels = Array.from(new Set(Object.values(normalizeMapping)));
  console.log(`[model-topic-knowledge] normalized to ${canonicalLabels.length} canonical labels.`);

  await sleep(MIN_MS_BETWEEN_CALLS);
  const consolidated = await consolidateVocabulary(canonicalLabels, usage);
  console.log(`[model-topic-knowledge] consolidated to ${consolidated.length} entries.`);

  // Track which entries were split from which catch-all, so classifyEntry can apply the
  // "kept the parent's exact name" rule.
  const preSplitNames = new Map(consolidated.map((e) => [e.name, e.aliases.length >= CATCHALL_ALIAS_THRESHOLD ? e.name : null]));
  const split = await splitCatchAlls(consolidated, usage);
  console.log(`[model-topic-knowledge] ${split.length} entries after catch-all splitting.`);

  const classified = split.map((e) => {
    // If this entry's own name matches a pre-split catch-all's name exactly, it's the unsplit
    // leftover core of that catch-all (didn't get real sub-operations extracted from it).
    const parentIfUnsplitCore = preSplitNames.has(e.name) ? preSplitNames.get(e.name) ?? null : null;
    return { ...e, classification: classifyEntry(e, parentIfUnsplitCore) };
  });

  // Compose raw-label -> final-entry-name mapping.
  const canonicalToEntry: Record<string, string> = {};
  for (const e of classified) for (const alias of e.aliases) canonicalToEntry[alias] = e.name;
  const mapping: Record<string, string> = {};
  for (const [raw, canonical] of Object.entries(normalizeMapping)) mapping[raw] = canonicalToEntry[canonical] || canonical;

  const discCount = classified.filter((e) => e.classification === 'DISCRIMINATING').length;
  console.log(`[model-topic-knowledge] final vocabulary: ${classified.length} entries (${discCount} DISCRIMINATING, ${classified.length - discCount} GENERIC).`);

  return { entries: classified, mapping };
}

// ─── Step e-f: signatures, grouping, DIRECT_EVALUATION, UNMAPPED flagging (deterministic) ───────

type MemberExample = { problemText: string; solutionSteps: string[] };
type ArchetypeGroup = { signature: string; memberCount: number; canonicalStem: string; memberExamples: MemberExample[] };

function buildSignature(actionLabels: string[], mapping: Record<string, string>, vocabByName: Map<string, VocabEntry>): { signature: string | null; unmapped: string[] } {
  const unmapped: string[] = [];
  const discLabels: string[] = [];
  for (const raw of actionLabels) {
    const canonical = mapping[raw];
    if (!canonical || !vocabByName.has(canonical)) {
      unmapped.push(raw);
      continue;
    }
    if (vocabByName.get(canonical)!.classification === 'DISCRIMINATING') discLabels.push(canonical);
  }
  if (unmapped.length > 0) return { signature: null, unmapped };
  return { signature: discLabels.length > 0 ? discLabels.join(' -> ') : DIRECT_EVALUATION, unmapped: [] };
}

function buildArchetypeGroups(
  examples: ExtractedExample[],
  labeled: LabeledExample[],
  mapping: Record<string, string>,
  vocabByName: Map<string, VocabEntry>,
): { groups: ArchetypeGroup[]; flaggedCount: number } {
  const examplesById = new Map(examples.map((e) => [e.exampleId, e]));
  const groups = new Map<string, { memberCount: number; canonicalStem: string; memberExamples: MemberExample[] }>();
  let flaggedCount = 0;

  for (const le of labeled) {
    const { signature, unmapped } = buildSignature(le.actionLabels, mapping, vocabByName);
    if (signature === null) {
      flaggedCount += 1;
      console.warn(`[model-topic-knowledge] ${le.exampleId} has UNMAPPED step label(s), excluded from archetype grouping: ${unmapped.join(', ')}`);
      continue;
    }
    const example = examplesById.get(le.exampleId);
    if (!groups.has(signature)) groups.set(signature, { memberCount: 0, canonicalStem: example?.problemText || '', memberExamples: [] });
    const g = groups.get(signature)!;
    g.memberCount += 1;
    if (signature !== DIRECT_EVALUATION && example && (g.canonicalStem === '' || example.problemText.length < g.canonicalStem.length)) {
      g.canonicalStem = example.problemText;
    }
    if (example) g.memberExamples.push({ problemText: example.problemText, solutionSteps: example.solutionSteps });
  }

  const result = Array.from(groups.entries())
    .map(([signature, g]) => ({ signature, memberCount: g.memberCount, canonicalStem: g.canonicalStem || '(many different trivial problems)', memberExamples: g.memberExamples }))
    .sort((a, b) => b.memberCount - a.memberCount);
  return { groups: result, flaggedCount };
}

// ─── main entry point ────────────────────────────────────────────────────────────────────────

export type ModelTopicKnowledgeResult = {
  modelId: string;
  status: 'DRAFT' | 'FAILED';
  reason?: string;
  archetypeCount?: number;
  singletonCount?: number;
  directEvaluationCount?: number;
  vocabularyEntryCount?: number;
  discriminatingCount?: number;
  genericCount?: number;
  flaggedExampleCount?: number;
};

export async function modelTopicKnowledgeJob(payload: { courseCode: string; nodeId?: string }): Promise<ModelTopicKnowledgeResult> {
  const { courseCode } = payload;

  // Idempotent at the course level, regardless of which node's fan-out triggered this call —
  // the archetype layer is course-wide, not per-topic (see ModelScope). Postgres does not enforce
  // uniqueness among NULLs for the (courseCode, topicId) constraint, so this check is what
  // actually prevents duplicate COURSE-scoped rows, not the DB constraint alone.
  const existing = await prisma.knowledgeModel.findFirst({ where: { courseCode, scope: 'COURSE', topicId: null } });
  if (existing) {
    console.log(`[model-topic-knowledge] course-scoped model already exists for ${courseCode} (${existing.id}, status=${existing.status}); skipping.`);
    return { modelId: existing.id, status: existing.status === 'FAILED' ? 'FAILED' : 'DRAFT' };
  }

  const level = await deriveAcademicLevel(courseCode);
  const ccmasVersion = await deriveCcmasVersion(courseCode);

  // Step 3: density gate.
  const density = await checkCourseDensity(courseCode);
  if (density.classification !== 'DENSE') {
    const km = await prisma.knowledgeModel.create({
      data: {
        topicId: null,
        scope: 'COURSE',
        courseCode,
        academicLevel: level,
        learningOutcome: 'N/A — course-scoped archetype layer, not yet decomposed into topics.',
        ccmasVersion,
        status: 'FAILED',
      },
    });
    console.error(`[model-topic-knowledge] density gate failed for ${courseCode} (${density.classification}): ${density.reason}`);
    return { modelId: km.id, status: 'FAILED', reason: density.reason };
  }
  console.log(`[model-topic-knowledge] ${courseCode} density gate passed: ${density.reason}`);

  const usage: ModelUsage = {};

  // Steps a-b: extract every worked example verbatim.
  const examples = await extractAllExamples(courseCode, usage);

  // Step c: label solution steps.
  const labeled = await labelAllExamples(examples, usage);

  // Step d: build the operation vocabulary and freeze it.
  const { entries: vocabEntries, mapping } = await buildVocabulary(examples, labeled, usage);
  const vocabByName = new Map(vocabEntries.map((e) => [e.name, e]));

  await prisma.operationVocabulary.upsert({
    where: { courseCode },
    create: { courseCode, entries: vocabEntries as any },
    update: { entries: vocabEntries as any, frozenAt: new Date() },
  });

  // Steps e-f: signatures, grouping, DIRECT_EVALUATION, UNMAPPED flagging.
  const { groups, flaggedCount } = buildArchetypeGroups(examples, labeled, mapping, vocabByName);
  const singletonCount = groups.filter((g) => g.memberCount === 1).length;
  const directEval = groups.find((g) => g.signature === DIRECT_EVALUATION);

  // Step g: write Archetype records under one course-scoped KnowledgeModel.
  const km = await prisma.knowledgeModel.create({
    data: {
      topicId: null,
      scope: 'COURSE',
      courseCode,
      academicLevel: level,
      learningOutcome: 'N/A — course-scoped archetype layer, not yet decomposed into topics.',
      ccmasVersion,
      status: 'DRAFT',
    },
  });

  for (const [index, g] of groups.entries()) {
    const isDirectEval = g.signature === DIRECT_EVALUATION;
    const sigTokens = tokens(g.signature === DIRECT_EVALUATION ? '' : g.signature);
    await prisma.archetype.create({
      data: {
        modelId: km.id,
        publicId: `ARCH-${String(index + 1).padStart(3, '0')}`,
        trigger: isDirectEval ? DIRECT_EVALUATION : sigTokens[0],
        method: g.signature,
        canonicalStem: g.canonicalStem,
        sourcedFrom: 'harvested',
        distinctBecause: isDirectEval
          ? 'No discriminating operation present — requires no distinctive technique beyond generic bookkeeping.'
          : `Unique ordered sequence of DISCRIMINATING operations: ${g.signature}`,
        actionSignature: g.signature,
        memberCount: g.memberCount,
        memberExamples: g.memberExamples as any,
      },
    });
  }

  await prisma.knowledgeModel.update({ where: { id: km.id }, data: { status: 'DRAFT' } });

  console.log(`[model-topic-knowledge] ${courseCode}: wrote ${groups.length} archetypes (${singletonCount} singletons, DIRECT_EVALUATION=${directEval?.memberCount || 0}) under model ${km.id}. Model usage: ${JSON.stringify(usage)}`);
  if (flaggedCount > 0) console.warn(`[model-topic-knowledge] ${courseCode}: ${flaggedCount} examples had UNMAPPED steps and were excluded from any archetype.`);

  return {
    modelId: km.id,
    status: 'DRAFT',
    archetypeCount: groups.length,
    singletonCount,
    directEvaluationCount: directEval?.memberCount || 0,
    vocabularyEntryCount: vocabEntries.length,
    discriminatingCount: vocabEntries.filter((e) => e.classification === 'DISCRIMINATING').length,
    genericCount: vocabEntries.filter((e) => e.classification === 'GENERIC').length,
    flaggedExampleCount: flaggedCount,
  };
}

async function deriveAcademicLevel(courseCode: string): Promise<number> {
  const doc = await prisma.disciplineDocument.findFirst({ where: { course_code: courseCode, source_type: 'CCMAS', level: { not: null } }, select: { level: true } });
  if (doc?.level) return doc.level;
  const material = await prisma.material.findFirst({ where: { course_code: courseCode, level: { not: undefined } }, select: { level: true } });
  if (material?.level) return material.level;
  const digitMatch = courseCode.match(/\d/);
  return digitMatch ? Number(digitMatch[0]) * 100 : 100;
}

async function deriveCcmasVersion(courseCode: string): Promise<string> {
  const doc = await prisma.disciplineDocument.findFirst({ where: { course_code: courseCode, source_type: 'CCMAS' }, select: { version: true } });
  return doc ? String(doc.version) : '1';
}

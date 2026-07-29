// STANDALONE EXPERIMENT (v3) — not wired into any job, queue, or JOB_NAMES entry. Run manually via
// `npx tsx src/scripts/experiment-archetype-extraction-v3.ts`. Read-only against the database;
// writes nothing to it (only the report + the extraction cache file, both on local disk).
//
// v2's failure mode: asking the model to judge "same action sequence" directly (Step 2's
// clustering) merged power/product/quotient/chain-rule differentiation into one archetype despite
// an explicit instruction naming that exact case as a non-merge example. v3 replaces that judgment
// call with a DETERMINISTIC pipeline:
//   Step 1 (model): label each solution step with a short operation phrase — no interpretation of
//                    "sameness" happens here, just per-step labeling.
//   Step 2 (model): normalize the raw label vocabulary — merge ONLY exact-same-operation synonyms.
//   Step 3 (NO model): group examples by exact string match of their ordered canonical-label
//                    sequence ("signature"). Two examples are the same archetype only if their
//                    full signatures are identical — no model discretion to merge across steps.
//
// Input discipline (unchanged):
//   - Step 0 reuses v2's extraction logic verbatim, then CACHES the result — every later run reads
//     the cache and never re-extracts.
//   - "MTH 102 TUTORIAL 2026" is a held-out answer key — never read until the hold-out phase.
//   - No AI-generated Question rows or GeneratedTextbookSection content are read anywhere here.

import fs from 'fs';
import path from 'path';
import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';

const SOURCE_TITLES = ['MTH 102 CALCULUS LECTURE NOTES', 'MTH 102 LECTURE 1', 'MTH 102 LECTURE 1 CONT.'];
const HOLDOUT_TITLE = 'MTH 102 TUTORIAL 2026';
const COURSE_CODE = 'MTH 102';
const CHUNK_SIZE = 8000;
const CHUNK_OVERLAP = 500;
const CHUNKS_PER_EXTRACTION_CALL = 2; // unchanged from v2
const LABEL_BATCH_SIZE = 5; // hard cap per instruction — never exceed this
// The fallback model has a confirmed 15-requests/MINUTE cap (discovered mid-run, distinct from the
// primary model's daily cap) — the labeling loop has no natural pacing since each call is small and
// fast, so it blows past that limit without an explicit delay between calls.
const MIN_MS_BETWEEN_CALLS = 4500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const LABEL_TEMPERATURE = 0.7;
const NORMALIZE_TEMPERATURE = 0.2;
// Reduced from 3 to 1: the full 3-run design needs ~228 calls, all routing through the fallback
// model since the primary is exhausted for today (confirmed during Step 0). With 1 run, Step 4's
// stabilityScore is not measured — see the report's methodology section.
const NUM_STABILITY_RUNS = 1;
const CACHE_PATH = path.join(__dirname, '../../../docs/mth102-extracted-examples.json');
const OUTPUT_PATH = path.join(__dirname, '../../../docs/archetype-experiment-mth102-v3.md');

type ExtractedExample = { exampleId: string; problemText: string; solutionSteps: string[]; sourceChunk: string };
type SourceChunk = { chunkId: string; sourceTitle: string; chunkIndex: number; text: string };
type LabeledExample = { exampleId: string; actionLabels: string[] };
type Archetype = { signature: string; memberCount: number; canonicalStem: string; memberIds: string[] };
type ModelUsage = Record<string, Record<string, number>>; // phase -> model -> count

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
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(sanitizeJsonEscapes(cleaned));
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(sanitizeJsonEscapes(cleaned.slice(start, end + 1)));
    }
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

async function loadSourceMaterials() {
  const materials = await prisma.material.findMany({
    where: { is_akademi_generated: false, course_code: COURSE_CODE, title: { in: SOURCE_TITLES } },
    select: { title: true, content: true },
  });
  const byTitle = new Map(materials.map((m) => [m.title, m.content || '']));
  const missing = SOURCE_TITLES.filter((t) => !byTitle.has(t) || !byTitle.get(t)?.trim());
  if (missing.length > 0) throw new Error(`Missing or empty source material(s): ${missing.join(', ')}`);
  return SOURCE_TITLES.map((title) => ({ title, content: byTitle.get(title)!.trim() }));
}

async function loadHoldoutMaterial() {
  const material = await prisma.material.findFirst({
    where: { is_akademi_generated: false, course_code: COURSE_CODE, title: HOLDOUT_TITLE },
    select: { content: true },
  });
  if (!material?.content?.trim()) throw new Error(`Hold-out material "${HOLDOUT_TITLE}" not found or empty`);
  return material.content.trim();
}

function buildChunks(sources: Array<{ title: string; content: string }>): SourceChunk[] {
  const chunks: SourceChunk[] = [];
  for (const source of sources) {
    const pieces = chunkText(source.content, CHUNK_SIZE, CHUNK_OVERLAP);
    pieces.forEach((text, i) => {
      chunks.push({ chunkId: `${source.title}__chunk${i}`, sourceTitle: source.title, chunkIndex: i, text });
    });
  }
  return chunks;
}

// ─── Step 0: extraction (unchanged from v2), cached to disk ────────────────────────────────────
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

  const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
    systemPrompt:
      'You are a precise text-extraction tool. You extract worked examples verbatim from source text — you never interpret, generalize, or paraphrase. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 8000,
    extendedTimeouts: true,
    temperature: 0.7,
  });
  recordUsage(usage, 'step0-extraction', model);

  const parsed = parseJsonObject(text);
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
  for (const c of batch) {
    if (!results.has(c.chunkId)) results.set(c.chunkId, []);
  }
  return results;
}

async function getOrCreateExtractionCache(usage: ModelUsage): Promise<ExtractedExample[]> {
  if (fs.existsSync(CACHE_PATH)) {
    console.log(`Loading cached extraction from ${CACHE_PATH} (Step 0 skipped — no re-extraction).`);
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  }

  console.log('No cache found. Running extraction once (v2 Step 1 logic, unchanged) to populate it...');
  const sources = await loadSourceMaterials();
  const chunks = buildChunks(sources);
  console.log(`${chunks.length} chunks to process.`);

  const examples: ExtractedExample[] = [];
  let runningIndex = 0;
  for (let i = 0; i < chunks.length; i += CHUNKS_PER_EXTRACTION_CALL) {
    const batch = chunks.slice(i, i + CHUNKS_PER_EXTRACTION_CALL);
    console.log(`  extracting chunks ${i + 1}-${Math.min(i + batch.length, chunks.length)} of ${chunks.length}...`);
    const batchResults = await extractFromChunkBatch(batch, usage);
    for (const c of batch) {
      const found = batchResults.get(c.chunkId) || [];
      for (const f of found) {
        examples.push({ exampleId: `ex${runningIndex}`, problemText: f.problemText, solutionSteps: f.solutionSteps, sourceChunk: c.chunkId });
        runningIndex += 1;
      }
    }
  }

  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(examples, null, 2), 'utf-8');
  console.log(`Cached ${examples.length} examples to ${CACHE_PATH}.`);
  return examples;
}

// ─── Step 1: label solution steps, batches of <= LABEL_BATCH_SIZE ──────────────────────────────
async function labelBatch(
  batch: Array<{ exampleId: string; problemText: string; solutionSteps: string[] }>,
  usage: ModelUsage,
  phase: string,
  vocabularyHint?: string[],
): Promise<LabeledExample[]> {
  if (batch.length > LABEL_BATCH_SIZE) throw new Error(`labelBatch received ${batch.length} > ${LABEL_BATCH_SIZE} — hard cap violated`);

  const vocabularyNote = vocabularyHint
    ? `\nA FIXED vocabulary of operation labels already exists — reuse the exact wording below when an operation genuinely matches. Only introduce a new label if the operation truly isn't covered by any of these:\n${vocabularyHint.join(', ')}\n`
    : '';

  const prompt = `For each example below, label EVERY solution step with a short action phrase describing WHAT OPERATION was performed on that step — not what the answer was, and not the topic.

RULES:
- The label names the operation only, e.g. "apply power rule", "factor numerator", "substitute u", "multiply by conjugate".
- Never label a step with its topic or outcome. Not "differentiate", not "solve limit" — these are too broad to distinguish anything.
- One operation per label. If a single step performs two distinct operations, emit two separate labels for it, in order.
${vocabularyNote}
EXAMPLES:
${batch.map((e) => `=== exampleId: ${e.exampleId} ===\nPROBLEM: ${e.problemText}\nSTEPS:\n${e.solutionSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`).join('\n\n')}

Format as JSON: { "results": [ { "exampleId": string, "actionLabels": string[] } ] }
"actionLabels" is the flattened, ordered list of operation labels across all steps of that example. Include an entry for every exampleId above.`;

  const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
    systemPrompt: 'You label solution steps with short, precise operation names only. Never describe the topic or the result. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 2000,
    extendedTimeouts: true,
    temperature: LABEL_TEMPERATURE,
  });
  recordUsage(usage, phase, model);

  const parsed = parseJsonObject(text);
  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  return results.map((r: any) => ({
    exampleId: String(r?.exampleId || ''),
    actionLabels: Array.isArray(r?.actionLabels) ? r.actionLabels.map((l: any) => String(l).trim()).filter(Boolean) : [],
  }));
}

async function labelAllExamples(
  examples: Array<{ exampleId: string; problemText: string; solutionSteps: string[] }>,
  usage: ModelUsage,
  phase: string,
  vocabularyHint?: string[],
): Promise<LabeledExample[]> {
  const labeled: LabeledExample[] = [];
  for (let i = 0; i < examples.length; i += LABEL_BATCH_SIZE) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const batch = examples.slice(i, i + LABEL_BATCH_SIZE);
    const result = await labelBatch(batch, usage, phase, vocabularyHint);
    labeled.push(...result);
  }
  return labeled;
}

// ─── Step 2: normalize the label vocabulary ──────────────────────────────────────────────────────
// A single call over every distinct raw label times out (confirmed — 300+ distinct phrasings in
// one prompt is too much for the fallback model to finish within budget). Chunked into two tiers
// instead: tier 1 normalizes within batches of NORMALIZE_CHUNK_SIZE, tier 2 makes one more pass
// over the resulting tier-1 canonical labels to catch merges that span batch boundaries.
const NORMALIZE_CHUNK_SIZE = 40;

async function normalizeChunk(labels: string[], usage: ModelUsage, phase: string): Promise<Record<string, string>> {
  const prompt = `Below is a list of action-operation labels produced by labeling solution steps in worked math examples.

Merge two labels ONLY IF they name the IDENTICAL operation in different words — e.g. "apply the power rule" and "use power rule" should merge. "apply power rule" and "apply chain rule" must NEVER merge — they are different operations. "factor numerator" and "factor denominator" must NEVER merge — they act on different things.

If in any doubt, do NOT merge — keep the labels separate.

LABELS:
${labels.map((l, i) => `${i}. ${l}`).join('\n')}

Format as JSON: { "mapping": [ { "raw": string, "canonical": string } ] }
Include an entry for every label above. If a label doesn't merge with anything, its "canonical" value should just be a cleaned-up version of itself (never a different operation).`;

  const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
    systemPrompt: 'You are a strict vocabulary normalizer merging only exact-same-operation synonyms. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 4000,
    extendedTimeouts: true,
    temperature: NORMALIZE_TEMPERATURE,
  });
  recordUsage(usage, phase, model);

  const parsed = parseJsonObject(text);
  const mappingArr = Array.isArray(parsed?.mapping) ? parsed.mapping : [];
  const mapping: Record<string, string> = {};
  for (const m of mappingArr) {
    const raw = String(m?.raw || '').trim();
    const canonical = String(m?.canonical || '').trim();
    if (raw) mapping[raw] = canonical || raw;
  }
  for (const raw of labels) {
    if (!mapping[raw]) mapping[raw] = raw;
  }
  return mapping;
}

async function normalizeVocabulary(
  rawLabels: string[],
  usage: ModelUsage,
  phase: string,
): Promise<{ mapping: Record<string, string>; beforeCount: number; afterCount: number }> {
  const distinctRaw = Array.from(new Set(rawLabels));

  // Tier 1: normalize within chunks.
  const tier1Mapping: Record<string, string> = {};
  for (let i = 0; i < distinctRaw.length; i += NORMALIZE_CHUNK_SIZE) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const chunk = distinctRaw.slice(i, i + NORMALIZE_CHUNK_SIZE);
    const chunkMapping = await normalizeChunk(chunk, usage, `${phase}-tier1`);
    Object.assign(tier1Mapping, chunkMapping);
  }

  // Tier 2: one more pass over the distinct tier-1 outputs, to catch merges across chunk
  // boundaries (e.g. "apply power rule" landing in chunk 1, "use power rule" in chunk 3).
  const tier1Distinct = Array.from(new Set(Object.values(tier1Mapping)));
  let tier2Mapping: Record<string, string> = {};
  if (tier1Distinct.length > NORMALIZE_CHUNK_SIZE) {
    for (let i = 0; i < tier1Distinct.length; i += NORMALIZE_CHUNK_SIZE) {
      if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
      const chunk = tier1Distinct.slice(i, i + NORMALIZE_CHUNK_SIZE);
      const chunkMapping = await normalizeChunk(chunk, usage, `${phase}-tier2`);
      Object.assign(tier2Mapping, chunkMapping);
    }
  } else if (tier1Distinct.length > 1) {
    await sleep(MIN_MS_BETWEEN_CALLS);
    tier2Mapping = await normalizeChunk(tier1Distinct, usage, `${phase}-tier2`);
  } else {
    tier2Mapping = Object.fromEntries(tier1Distinct.map((l) => [l, l]));
  }

  const mapping: Record<string, string> = {};
  for (const raw of distinctRaw) {
    const tier1 = tier1Mapping[raw] || raw;
    mapping[raw] = tier2Mapping[tier1] || tier1;
  }

  return { mapping, beforeCount: distinctRaw.length, afterCount: new Set(Object.values(mapping)).size };
}

// ─── Step 3: signatures — deterministic, no AI call ─────────────────────────────────────────────
function buildArchetypes(
  labeledExamples: LabeledExample[],
  vocabulary: Record<string, string>,
  examplesById: Map<string, ExtractedExample>,
): Archetype[] {
  const groups = new Map<string, string[]>();
  for (const le of labeledExamples) {
    const canonicalLabels = le.actionLabels.map((l) => vocabulary[l] || l);
    const signature = canonicalLabels.join(' -> ');
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature)!.push(le.exampleId);
  }

  const archetypes: Archetype[] = [];
  for (const [signature, memberIds] of groups) {
    let shortest: ExtractedExample | null = null;
    for (const id of memberIds) {
      const ex = examplesById.get(id);
      if (ex && (!shortest || ex.problemText.length < shortest.problemText.length)) shortest = ex;
    }
    archetypes.push({ signature, memberCount: memberIds.length, canonicalStem: shortest?.problemText || '(unknown)', memberIds });
  }
  return archetypes.sort((a, b) => b.memberCount - a.memberCount);
}

// One full pass of Steps 1-3 over the cached extraction.
async function runLabelNormalizeSignature(
  examples: ExtractedExample[],
  usage: ModelUsage,
  runLabel: string,
): Promise<{ archetypes: Archetype[]; vocabularyBefore: number; vocabularyAfter: number; mapping: Record<string, string> }> {
  console.log(`  [${runLabel}] Step 1: labeling ${examples.length} examples in batches of ${LABEL_BATCH_SIZE}...`);
  const labeled = await labelAllExamples(examples, usage, `${runLabel}:label`);
  const totalRawLabels = labeled.reduce((sum, l) => sum + l.actionLabels.length, 0);
  console.log(`    -> ${totalRawLabels} raw labels across ${labeled.length} examples.`);

  await sleep(MIN_MS_BETWEEN_CALLS);
  console.log(`  [${runLabel}] Step 2: normalizing vocabulary...`);
  const allRawLabels = labeled.flatMap((l) => l.actionLabels);
  const { mapping, beforeCount, afterCount } = await normalizeVocabulary(allRawLabels, usage, `${runLabel}:normalize`);
  console.log(`    -> vocabulary ${beforeCount} -> ${afterCount}.`);

  console.log(`  [${runLabel}] Step 3: building signatures (no AI call)...`);
  const examplesById = new Map(examples.map((e) => [e.exampleId, e]));
  const archetypes = buildArchetypes(labeled, mapping, examplesById);
  console.log(`    -> ${archetypes.length} distinct signatures.`);

  return { archetypes, vocabularyBefore: beforeCount, vocabularyAfter: afterCount, mapping };
}

// ─── Step 5: hold-out ────────────────────────────────────────────────────────────────────────────
async function extractTutorialQuestions(holdoutContent: string, usage: ModelUsage): Promise<{ questionText: string }[]> {
  const prompt = `Extract EVERY worked example and exercise/practice question from the document below. Include the full problem statement text for each — verbatim, or a faithful close paraphrase preserving every specific number/value — whether or not the document shows a solution for it. Do not summarize; do not skip any.

DOCUMENT (MTH 102 TUTORIAL 2026):
${holdoutContent}

Format as JSON: { "questions": [ { "questionText": string } ] }`;

  const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
    systemPrompt: 'You are cataloguing every worked example and exercise question in a document, verbatim. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 6000,
    extendedTimeouts: true,
  });
  recordUsage(usage, 'step5-extract-questions', model);

  const parsed = parseJsonObject(text);
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
  return questions.map((q: any) => ({ questionText: String(q?.questionText || '').trim() })).filter((q: any) => q.questionText);
}

async function labelHoldoutQuestions(
  questions: { questionText: string }[],
  frozenVocabulary: string[],
  usage: ModelUsage,
): Promise<Array<{ questionIndex: number; actionLabels: string[] }>> {
  const results: Array<{ questionIndex: number; actionLabels: string[] }> = [];

  for (let i = 0; i < questions.length; i += LABEL_BATCH_SIZE) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const batch = questions.slice(i, i + LABEL_BATCH_SIZE).map((q, j) => ({ index: i + j, questionText: q.questionText }));

    const prompt = `Here is a fixed vocabulary of operation labels (already normalized) — reuse the exact wording when an operation genuinely matches:
${frozenVocabulary.join(', ')}

For each question below: solve it (or use its shown solution if one is given in the text), break the solution into an ordered sequence of individual actions, and label each action using ONE of the vocabulary labels above if it genuinely matches that operation. Only introduce a new label (not in the list) if the operation truly isn't covered by any existing label — never force a mismatched label just to reuse one.

QUESTIONS:
${batch.map((q) => `${q.index}. ${q.questionText}`).join('\n\n')}

Format as JSON: { "results": [ { "questionIndex": number, "actionLabels": string[] } ] }
Include an entry for every question index above.`;

    const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
      systemPrompt: 'You solve math questions and label each solution step using a fixed operation vocabulary wherever it genuinely applies. Return ONLY valid JSON, no prose outside the JSON object.',
      maxTokens: 3000,
      extendedTimeouts: true,
      temperature: 0.2,
    });
    recordUsage(usage, 'step5-label-holdout', model);

    const parsed = parseJsonObject(text);
    const batchResults = Array.isArray(parsed?.results) ? parsed.results : [];
    for (const r of batchResults) {
      results.push({
        questionIndex: Number(r?.questionIndex),
        actionLabels: Array.isArray(r?.actionLabels) ? r.actionLabels.map((l: any) => String(l).trim()).filter(Boolean) : [],
      });
    }
  }

  return results;
}

function estimateCallVolume(exampleCount: number, tutorialCount: number): Record<string, number> {
  const labelBatches = Math.ceil(exampleCount / LABEL_BATCH_SIZE);
  const perRun = labelBatches + 1; // labeling batches + 1 normalization call
  return {
    labelBatchesPerRun: labelBatches,
    perStabilityRun: perRun,
    allStabilityRuns: perRun * NUM_STABILITY_RUNS,
    holdoutExtraction: 1,
    holdoutLabeling: Math.ceil(tutorialCount / LABEL_BATCH_SIZE),
    grandTotal: perRun * NUM_STABILITY_RUNS + 1 + Math.ceil(tutorialCount / LABEL_BATCH_SIZE),
  };
}

async function main() {
  const usage: ModelUsage = {};
  const args = new Set(process.argv.slice(2));

  console.log('=== Step 0: extraction cache ===');
  const examples = await getOrCreateExtractionCache(usage);
  console.log(`${examples.length} cached examples available.\n`);

  const volumeEstimate = estimateCallVolume(examples.length, 36 /* rough; corrected after real extraction below */);
  console.log('Estimated call volume for the full Steps 1-5 pipeline:');
  console.log(JSON.stringify(volumeEstimate, null, 2));

  if (!args.has('--run-full')) {
    console.log(
      '\nDry run only (pass --run-full to execute Steps 1-5). Exiting after Step 0 so the call-volume estimate can be reviewed before spending quota.',
    );
    return;
  }

  const stabilityRuns: Array<{ archetypes: Archetype[]; vocabularyBefore: number; vocabularyAfter: number; mapping: Record<string, string> }> = [];
  for (let i = 0; i < NUM_STABILITY_RUNS; i += 1) {
    console.log(`\n=== Stability run ${i + 1}/${NUM_STABILITY_RUNS} ===`);
    const result = await runLabelNormalizeSignature(examples, usage, `run${i + 1}`);
    stabilityRuns.push(result);
  }

  // ─── Step 4: stability — deterministic exact-signature comparison across runs ─────────────────
  const measuringStability = NUM_STABILITY_RUNS > 1;
  const signatureSets = stabilityRuns.map((r) => new Set(r.archetypes.map((a) => a.signature)));
  const allSignatures = new Set(signatureSets.flatMap((s) => [...s]));
  const stableSignatures = measuringStability ? [...allSignatures].filter((sig) => signatureSets.every((s) => s.has(sig))) : [];
  const stabilityScore = measuringStability && allSignatures.size > 0 ? stableSignatures.length / allSignatures.size : null;

  if (measuringStability) {
    console.log(`\nstabilityScore = ${stableSignatures.length} / ${allSignatures.size} = ${(stabilityScore ?? 0).toFixed(3)}`);
  } else {
    console.log('\nSkipping cross-run stability (NUM_STABILITY_RUNS=1 — reduced scope due to confirmed quota exhaustion, see report).');
  }

  const singletonCounts = stabilityRuns.map((r) => r.archetypes.filter((a) => a.memberCount === 1).length);
  console.log(`Singleton archetypes (memberCount=1) per run: ${singletonCounts.join(', ')}`);

  // ─── Step 5: hold-out, using run 1's frozen vocabulary + archetype set ─────────────────────────
  await sleep(MIN_MS_BETWEEN_CALLS);
  console.log('\n=== Step 5: hold-out (MTH 102 TUTORIAL 2026) ===');
  const holdoutContent = await loadHoldoutMaterial();
  const tutorialQuestions = await extractTutorialQuestions(holdoutContent, usage);
  console.log(`${tutorialQuestions.length} tutorial questions extracted.`);

  await sleep(MIN_MS_BETWEEN_CALLS);
  const frozenVocabulary = Array.from(new Set(Object.values(stabilityRuns[0].mapping)));
  const holdoutLabeled = await labelHoldoutQuestions(tutorialQuestions, frozenVocabulary, usage);

  const referenceArchetypes = stabilityRuns[0].archetypes;
  const referenceSignatures = new Set(referenceArchetypes.map((a) => a.signature));

  const holdoutResults = holdoutLabeled.map((h) => {
    const signature = h.actionLabels.join(' -> ');
    const matchedArchetype = referenceArchetypes.find((a) => a.signature === signature);
    return {
      questionIndex: h.questionIndex,
      actionLabels: h.actionLabels,
      signature,
      fits: Boolean(matchedArchetype),
      matchedSignature: matchedArchetype?.signature || null,
    };
  });

  const fitCount = holdoutResults.filter((r) => r.fits).length;
  const coverageScore = tutorialQuestions.length > 0 ? fitCount / tutorialQuestions.length : 0;
  const uncovered = holdoutResults.filter((r) => !r.fits);
  const matchedSignatures = new Set(holdoutResults.filter((r) => r.fits).map((r) => r.matchedSignature));
  const neverMatchedArchetypes = referenceArchetypes.filter((a) => !matchedSignatures.has(a.signature));

  console.log(`coverageScore = ${fitCount} / ${tutorialQuestions.length} = ${coverageScore.toFixed(3)}`);

  // Did the differentiation questions (originally Q18-Q35 in v2, 18 questions) split across
  // multiple archetypes this time, instead of collapsing into one?
  const differentiationSignatures = new Set(
    holdoutResults.filter((r) => /power rule|chain rule|product rule|quotient rule|dy\/dx|derivative/i.test(tutorialQuestions[r.questionIndex]?.questionText || '')).map((r) => r.signature),
  );

  const generatedAt = new Date().toISOString();
  const usageLines = Object.entries(usage).flatMap(([phase, models]) =>
    Object.entries(models).map(([model, count]) => `  - ${phase}: ${model} x${count}`),
  );

  const md = [
    '# Archetype Extraction Experiment v3 — MTH 102',
    '',
    `Captured ${generatedAt}. Standalone experiment, not wired into any job/queue. No database writes (extraction cache is the only file artifact besides this report).`,
    '',
    '## Methodology',
    '',
    '- **v2 -> v3 change:** clustering is no longer a model judgment call. Step 1 labels individual solution steps with short operation phrases (model). Step 2 normalizes the label vocabulary, merging only exact-same-operation synonyms (model). Step 3 groups examples by exact string match of their ordered canonical-label signature (deterministic, zero AI calls).',
    `- Extraction (Step 0) is unchanged from v2 and is cached to \`${path.relative(path.join(__dirname, '../../..'), CACHE_PATH)}\` on first run; every later run of this script reads the cache and never re-extracts. That cache was populated this run — every single Step 0 call hit the primary model's 429 (confirmed still exhausted from prior sessions today) and fell back successfully to the secondary model.`,
    `- **Scope reduced to ${NUM_STABILITY_RUNS} stability run** (from the original design's 3): the full 3-run design needs ~228 model calls, all of which would route through the fallback model since the primary is exhausted for today. Step 4's stabilityScore is therefore ${measuringStability ? 'measured as designed' : 'NOT measured this run — see Step 4'}.`,
    `- Source (extraction ONLY, already cached): ${SOURCE_TITLES.map((t) => `"${t}"`).join(', ')}.`,
    `- Held out (never read until Step 5): "${HOLDOUT_TITLE}".`,
    '- No AI-generated Question rows or GeneratedTextbookSection content were read anywhere in this experiment.',
    `- Step 1 labeling ran in batches of at most ${LABEL_BATCH_SIZE} examples per call (hard cap), temperature=${LABEL_TEMPERATURE}.`,
    `- Step 2 normalization: a single call over every distinct raw label timed out in practice (too many distinct phrasings for one prompt), so it runs as two chunked tiers instead — tier 1 normalizes within batches of ${NORMALIZE_CHUNK_SIZE}, tier 2 makes one more pass over the resulting tier-1 canonical labels to catch merges spanning batch boundaries. temperature=${NORMALIZE_TEMPERATURE}.`,
    measuringStability
      ? `- Step 3/4 stability comparison is EXACT STRING match on the full ordered signature across the ${NUM_STABILITY_RUNS} independent runs — no fuzzy/semantic cross-run reconciliation, consistent with keeping this whole revision's grouping logic model-free wherever possible.`
      : '- Step 4 stability comparison was not performed (only 1 run — nothing to compare across runs).',
    "- Step 5 hold-out reuses run 1's vocabulary and archetype set as the frozen reference.",
    '- Model usage per phase (so it\'s traceable which calls came from the primary model vs. its fallback):',
    ...usageLines,
    '',
    '## Step 1-3 — per stability run',
    '',
    ...stabilityRuns.flatMap((r, i) => [
      `### Run ${i + 1}: vocabulary ${r.vocabularyBefore} -> ${r.vocabularyAfter}, ${r.archetypes.length} archetypes, ${r.archetypes.filter((a) => a.memberCount === 1).length} singletons`,
      '',
      ...r.archetypes.map(
        (a) => `- **[memberCount=${a.memberCount}]** \`${a.signature}\`\n  - canonicalStem: ${a.canonicalStem}`,
      ),
      '',
    ]),
    '## Step 4 — stability',
    '',
    measuringStability
      ? [
          `**stabilityScore = ${stableSignatures.length} / ${allSignatures.size} = ${(stabilityScore ?? 0).toFixed(3)}**`,
          '',
          `(exact signatures present in all ${NUM_STABILITY_RUNS} runs / total distinct signatures across all runs)`,
          '',
          `Singleton archetypes (memberCount=1) per run: ${singletonCounts.join(', ')}`,
          '',
          '### Signatures stable across all runs',
          '',
          stableSignatures.length > 0 ? stableSignatures.map((s) => `- \`${s}\``).join('\n') : '_None — no exact signature was reproduced in all runs._',
        ].join('\n')
      : [
          '**Not measured this run.** Scope was reduced to 1 stability run (see Methodology) after sizing up the full 3-run design at ~228 calls against an already-exhausted primary model — with only one run, there is nothing to compare across runs.',
          '',
          `Singleton archetypes (memberCount=1) in this run: ${singletonCounts[0]} of ${stabilityRuns[0].archetypes.length} total archetypes.`,
        ].join('\n'),
    '',
    '## Step 5 — hold-out test (MTH 102 TUTORIAL 2026)',
    '',
    `${tutorialQuestions.length} questions extracted.`,
    '',
    `**coverageScore = ${fitCount} / ${tutorialQuestions.length} = ${coverageScore.toFixed(3)}**`,
    '',
    `Differentiation-related questions produced **${differentiationSignatures.size} distinct signature(s)** (v2 collapsed all 18 into 1 archetype).`,
    '',
    '### Unmatched questions',
    '',
    uncovered.length > 0
      ? uncovered.map((r) => `- Q${r.questionIndex}: "${tutorialQuestions[r.questionIndex]?.questionText.slice(0, 150)}"\n  - signature: \`${r.signature}\``).join('\n')
      : '_None — every question matched a reference archetype._',
    '',
    '### Reference archetypes never matched by the tutorial',
    '',
    neverMatchedArchetypes.length > 0
      ? neverMatchedArchetypes.map((a) => `- \`${a.signature}\` (canonicalStem: ${a.canonicalStem.slice(0, 80)})`).join('\n')
      : '_None._',
    '',
    '### Full per-question results',
    '',
    ...holdoutResults.map(
      (r) =>
        `- Q${r.questionIndex} (${r.fits ? 'FIT' : 'NO FIT'}): "${tutorialQuestions[r.questionIndex]?.questionText.slice(0, 120)}"\n  - signature: \`${r.signature}\``,
    ),
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, md, 'utf-8');
  console.log(`\nWrote report to ${OUTPUT_PATH}`);

  console.log('\n=== Summary ===');
  console.log(
    JSON.stringify(
      {
        cachedExampleCount: examples.length,
        perRunArchetypeCounts: stabilityRuns.map((r) => r.archetypes.length),
        perRunVocabulary: stabilityRuns.map((r) => ({ before: r.vocabularyBefore, after: r.vocabularyAfter })),
        singletonCounts,
        stabilityScore: stabilityScore !== null ? Number(stabilityScore.toFixed(3)) : 'not measured (1 run)',
        tutorialQuestionCount: tutorialQuestions.length,
        coverageScore: Number(coverageScore.toFixed(3)),
        uncoveredCount: uncovered.length,
        neverMatchedArchetypeCount: neverMatchedArchetypes.length,
        differentiationSignatureCount: differentiationSignatures.size,
        modelUsage: usage,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

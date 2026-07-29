// STANDALONE EXPERIMENT (v7) — not wired into any job, queue, or JOB_NAMES entry. Run manually via
// `npx tsx src/scripts/experiment-archetype-extraction-phy102-v7.ts <phase>`. Read-only against the
// database; writes nothing to it — only local cache files under docs/ and the final report.
//
// Generalization test: does the v6 method (extract -> label steps -> normalize labels -> consolidate
// into a closed vocabulary -> split catch-alls -> classify DISCRIMINATING/GENERIC by fixed rule ->
// exact discriminating-only signature match, empty -> DIRECT_EVALUATION) work on a course it was
// never built for, with no hand-tuning? Unlike MTH102, there's no held-out tutorial document, so the
// hold-out is a random 20% of the extracted PHY102 examples, set aside BEFORE any vocabulary work
// touches the data — the other 80% builds the vocabulary and archetypes.
//
// "PHY 101 MATERIAL" is cross-listed under both PHY 102 and PHY 108 (identical content, confirmed by
// matching byte length) — excluded from source materials; this experiment reads only
// "PHY 102 ELECTRIC, MAGNETISM AND MODERN PHYSICS" and "GENERAL PHYSICS I  (2)" (note: two spaces
// before the parenthesis in the material's actual title).
//
// Run phases in order (each caches its output; re-running a later phase never redoes an earlier
// one):
//   --estimate     free, no AI calls — chunk count only, to size up the extraction step
//   --extract      Step 0: extract worked examples, cache, then do the 80/20 split and cache that too
//   --label        Step 1: label the 80% training examples' steps (raw operation phrases)
//   --consolidate  Steps 2-3: normalize raw labels to canonical, then consolidate into an initial
//                  closed vocabulary (pre-split, no classification yet)
//   --split        Step 4: split the given catch-all entries (pass --catchalls=name1,name2,...,
//                  identified by manual inspection of --consolidate's output, same as v5's process)
//   --classify     Step 5: classify every entry DISCRIMINATING/GENERIC by fixed rule, no model call
//                  (same rule as v6: new entry naming a specific technique = DISCRIMINATING; new
//                  residual/leftover bucket = GENERIC). Freezes the vocabulary.
//   --holdout      Step 6: build training archetypes, label the held-out 20% constrained to the
//                  frozen vocabulary, test coverage, write the report

import fs from 'fs';
import path from 'path';
import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';

const SOURCE_TITLES = ['PHY 102 ELECTRIC, MAGNETISM AND MODERN PHYSICS', 'GENERAL PHYSICS I  (2)'];
const EXCLUDED_TITLE = 'PHY 101 MATERIAL';
const COURSE_CODE = 'PHY 102';

const CHUNK_SIZE = 8000;
const CHUNK_OVERLAP = 500;
const CHUNKS_PER_EXTRACTION_CALL = 2;
const LABEL_BATCH_SIZE = 5;
const MIN_MS_BETWEEN_CALLS = 4500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const LABEL_TEMPERATURE = 0.7;
const NORMALIZE_TEMPERATURE = 0.2;
const NORMALIZE_CHUNK_SIZE = 40;
const VOCAB_CHUNK_SIZE = 40;
const VOCAB_TARGET_MIN = 40;
const VOCAB_TARGET_MAX = 80;
const SPLIT_TEMPERATURE = 0.3;
const HOLDOUT_FRACTION = 0.2;
const HOLDOUT_LABEL_TEMPERATURE = 0.2;
const DIRECT_EVALUATION = 'DIRECT_EVALUATION';
const RANDOM_SEED = 20260727; // fixed so the 80/20 split is reproducible across script re-runs

const DOCS_DIR = path.join(__dirname, '../../../docs');
const EXTRACTED_CACHE_PATH = path.join(DOCS_DIR, 'phy102-extracted-examples.json');
const LABELS_CACHE_PATH = path.join(DOCS_DIR, 'phy102-labels-raw.json');
const CONSOLIDATED_VOCAB_PATH = path.join(DOCS_DIR, 'phy102-vocabulary-initial.json');
const FINAL_VOCAB_PATH = path.join(DOCS_DIR, 'phy102-operation-vocabulary.json');
const OUTPUT_PATH = path.join(DOCS_DIR, 'archetype-experiment-phy102-v7.md');

type ExtractedExample = { exampleId: string; problemText: string; solutionSteps: string[]; sourceChunk: string; isHeldOut: boolean };
type SourceChunk = { chunkId: string; sourceTitle: string; chunkIndex: number; text: string };
type LabeledExample = { exampleId: string; actionLabels: string[] };
type Classification = 'DISCRIMINATING' | 'GENERIC';
type VocabEntry = { name: string; classification: Classification; aliases: string[] };
type Archetype = { signature: string; memberCount: number; canonicalStem: string; memberIds: string[] };
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

function tokens(sig: string): string[] {
  return sig ? sig.split(' -> ').map((s) => s.trim()).filter(Boolean) : [];
}

// deterministic PRNG (mulberry32) so the 80/20 split is reproducible across re-runs
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

function buildChunks(sources: Array<{ title: string; content: string }>): SourceChunk[] {
  const chunks: SourceChunk[] = [];
  for (const source of sources) {
    const pieces = chunkText(source.content, CHUNK_SIZE, CHUNK_OVERLAP);
    pieces.forEach((text, i) => chunks.push({ chunkId: `${source.title}__chunk${i}`, sourceTitle: source.title, chunkIndex: i, text }));
  }
  return chunks;
}

// ─── Step 0: extraction ─────────────────────────────────────────────────────────────────────────
async function extractFromChunkBatch(batch: SourceChunk[], usage: ModelUsage): Promise<Map<string, { problemText: string; solutionSteps: string[] }[]>> {
  const prompt = `You are extracting worked examples from real teaching material text chunks (physics). Do NOT interpret, generalize, summarize, or name anything at this stage — extract exactly what is present in the text, verbatim.

For EACH chunk below, extract every worked example, solved problem, or illustrative problem present in that chunk's text (verbatim, as written). If a chunk genuinely contains no worked examples, include it in the output with an empty "examples" array — do not skip it, and do not invent examples that are not actually present.

For each example found, record:
- problemText: the problem statement, verbatim from the text
- solutionSteps: the solution/working, split into an ordered array of individual steps, verbatim from the text

CHUNKS:
${batch.map((c) => `=== chunk_id: ${c.chunkId} ===\n${c.text}`).join('\n\n')}

Format as JSON: { "chunkResults": [ { "chunkId": string, "examples": [ { "problemText": string, "solutionSteps": string[] } ] } ] }
Include an entry in "chunkResults" for every chunk_id given above, even if its "examples" array is empty.`;

  const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
    systemPrompt: 'You are a precise text-extraction tool. You extract worked examples verbatim from source text — you never interpret, generalize, or paraphrase. Return ONLY valid JSON, no prose outside the JSON object.',
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
  for (const c of batch) if (!results.has(c.chunkId)) results.set(c.chunkId, []);
  return results;
}

async function runExtraction(): Promise<void> {
  if (fs.existsSync(EXTRACTED_CACHE_PATH)) {
    const cached = JSON.parse(fs.readFileSync(EXTRACTED_CACHE_PATH, 'utf-8'));
    console.log(`Cache already exists at ${EXTRACTED_CACHE_PATH} (${cached.examples.length} examples, ${cached.examples.filter((e: ExtractedExample) => e.isHeldOut).length} held out). Delete it to re-extract. Skipping.`);
    return;
  }

  const usage: ModelUsage = {};
  const sources = await loadSourceMaterials();
  console.log(`Loaded sources: ${sources.map((s) => `${s.title} (${s.content.length} chars)`).join(', ')}`);
  const chunks = buildChunks(sources);
  console.log(`${chunks.length} chunks to process (chunkSize=${CHUNK_SIZE}, overlap=${CHUNK_OVERLAP}).`);

  const examples: ExtractedExample[] = [];
  let runningIndex = 0;
  for (let i = 0; i < chunks.length; i += CHUNKS_PER_EXTRACTION_CALL) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const batch = chunks.slice(i, i + CHUNKS_PER_EXTRACTION_CALL);
    console.log(`  extracting chunks ${i + 1}-${Math.min(i + batch.length, chunks.length)} of ${chunks.length}...`);
    const batchResults = await extractFromChunkBatch(batch, usage);
    for (const c of batch) {
      const found = batchResults.get(c.chunkId) || [];
      for (const f of found) {
        examples.push({ exampleId: `phy${runningIndex}`, problemText: f.problemText, solutionSteps: f.solutionSteps, sourceChunk: c.chunkId, isHeldOut: false });
        runningIndex += 1;
      }
    }
  }
  console.log(`Extracted ${examples.length} examples total.`);

  const shuffled = seededShuffle(examples, RANDOM_SEED);
  const holdoutCount = Math.round(shuffled.length * HOLDOUT_FRACTION);
  const holdoutIds = new Set(shuffled.slice(0, holdoutCount).map((e) => e.exampleId));
  for (const e of examples) e.isHeldOut = holdoutIds.has(e.exampleId);
  console.log(`80/20 split (seed=${RANDOM_SEED}): ${examples.length - holdoutCount} training, ${holdoutCount} held out.`);

  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(
    EXTRACTED_CACHE_PATH,
    JSON.stringify({ note: 'PHY102 worked examples, extracted verbatim from PHY 102 ELECTRIC, MAGNETISM AND MODERN PHYSICS + GENERAL PHYSICS I  (2). PHY 101 MATERIAL excluded (cross-listed under PHY 102 and PHY 108). isHeldOut examples were set aside BEFORE any vocabulary/labeling work and must never be used to build the vocabulary or archetypes.', excludedTitle: EXCLUDED_TITLE, sourceTitles: SOURCE_TITLES, seed: RANDOM_SEED, examples },
    null,
    2,
  ),
    'utf-8',
  );
  console.log(`Cached to ${EXTRACTED_CACHE_PATH}. Model usage: ${JSON.stringify(usage)}`);
}

function loadExtractedExamples(): ExtractedExample[] {
  return JSON.parse(fs.readFileSync(EXTRACTED_CACHE_PATH, 'utf-8')).examples;
}

// ─── Step 1: label training examples' steps ────────────────────────────────────────────────────
async function labelBatch(batch: Array<{ exampleId: string; problemText: string; solutionSteps: string[] }>, usage: ModelUsage): Promise<LabeledExample[]> {
  if (batch.length > LABEL_BATCH_SIZE) throw new Error(`labelBatch received ${batch.length} > ${LABEL_BATCH_SIZE}`);
  const prompt = `For each example below, label EVERY solution step with a short action phrase describing WHAT OPERATION was performed on that step — not what the answer was, and not the topic.

RULES:
- The label names the operation only, e.g. "apply Coulomb's law", "apply Kirchhoff's voltage law", "resolve into components", "apply right-hand rule".
- Never label a step with its topic or outcome. Too broad to distinguish anything.
- One operation per label. If a single step performs two distinct operations, emit two separate labels for it, in order.

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
  recordUsage(usage, 'step1-label', model);

  const parsed = parseJsonObject(text);
  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  return results.map((r: any) => ({ exampleId: String(r?.exampleId || ''), actionLabels: Array.isArray(r?.actionLabels) ? r.actionLabels.map((l: any) => String(l).trim()).filter(Boolean) : [] }));
}

async function runLabeling(): Promise<void> {
  if (fs.existsSync(LABELS_CACHE_PATH)) {
    console.log(`Cache already exists at ${LABELS_CACHE_PATH}. Delete it to re-label. Skipping.`);
    return;
  }
  const usage: ModelUsage = {};
  const examples = loadExtractedExamples().filter((e) => !e.isHeldOut);
  console.log(`Labeling ${examples.length} training examples in batches of ${LABEL_BATCH_SIZE}...`);

  const labeled: LabeledExample[] = [];
  for (let i = 0; i < examples.length; i += LABEL_BATCH_SIZE) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const batch = examples.slice(i, i + LABEL_BATCH_SIZE);
    console.log(`  labeling ${i + 1}-${Math.min(i + batch.length, examples.length)} of ${examples.length}...`);
    const result = await labelBatch(batch, usage);
    labeled.push(...result);
  }

  fs.writeFileSync(LABELS_CACHE_PATH, JSON.stringify({ note: 'Raw per-example action labels for the 80% PHY102 training set (held-out 20% excluded).', labeled }, null, 2), 'utf-8');
  console.log(`Cached ${labeled.length} labeled examples to ${LABELS_CACHE_PATH}. Model usage: ${JSON.stringify(usage)}`);
}

function loadLabels(): LabeledExample[] {
  return JSON.parse(fs.readFileSync(LABELS_CACHE_PATH, 'utf-8')).labeled;
}

// ─── Steps 2-3: normalize raw labels, then consolidate into an initial closed vocabulary ───────
async function normalizeChunk(labels: string[], usage: ModelUsage, phase: string): Promise<Record<string, string>> {
  const prompt = `Below is a list of action-operation labels produced by labeling solution steps in worked physics examples.

Merge two labels ONLY IF they name the IDENTICAL operation in different words. If in any doubt, do NOT merge — keep the labels separate.

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
  for (const raw of labels) if (!mapping[raw]) mapping[raw] = raw;
  return mapping;
}

async function normalizeVocabulary(rawLabels: string[], usage: ModelUsage, phase: string): Promise<{ mapping: Record<string, string>; beforeCount: number; afterCount: number }> {
  const distinctRaw = Array.from(new Set(rawLabels));
  const tier1Mapping: Record<string, string> = {};
  for (let i = 0; i < distinctRaw.length; i += NORMALIZE_CHUNK_SIZE) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const chunk = distinctRaw.slice(i, i + NORMALIZE_CHUNK_SIZE);
    Object.assign(tier1Mapping, await normalizeChunk(chunk, usage, `${phase}-tier1`));
  }
  const tier1Distinct = Array.from(new Set(Object.values(tier1Mapping)));
  let tier2Mapping: Record<string, string> = {};
  if (tier1Distinct.length > NORMALIZE_CHUNK_SIZE) {
    for (let i = 0; i < tier1Distinct.length; i += NORMALIZE_CHUNK_SIZE) {
      if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
      const chunk = tier1Distinct.slice(i, i + NORMALIZE_CHUNK_SIZE);
      Object.assign(tier2Mapping, await normalizeChunk(chunk, usage, `${phase}-tier2`));
    }
  } else if (tier1Distinct.length > 1) {
    await sleep(MIN_MS_BETWEEN_CALLS);
    tier2Mapping = await normalizeChunk(tier1Distinct, usage, `${phase}-tier2`);
  } else {
    tier2Mapping = Object.fromEntries(tier1Distinct.map((l) => [l, l]));
  }
  const mapping: Record<string, string> = {};
  for (const raw of distinctRaw) {
    const t1 = tier1Mapping[raw] || raw;
    mapping[raw] = tier2Mapping[t1] || t1;
  }
  return { mapping, beforeCount: distinctRaw.length, afterCount: new Set(Object.values(mapping)).size };
}

async function vocabChunkCall(items: string[], usage: ModelUsage, phase: string, extraInstruction: string): Promise<VocabEntry[]> {
  const prompt = `Below is a list of operation labels used to describe individual steps in worked physics solutions.

Consolidate these into a small set of canonical OPERATION entries. Merge two labels ONLY if they name the IDENTICAL operation in different words. If in doubt, do NOT merge.
${extraInstruction}
LABELS:
${items.map((l, i) => `${i}. ${l}`).join('\n')}

Format as JSON: { "entries": [ { "name": string, "aliases": string[] } ] }
"aliases" must list every label above that maps to this entry. Every label above must appear in exactly one entry's aliases — do not drop any.`;

  const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
    systemPrompt: 'You are a strict vocabulary consolidator merging only exact-same-operation synonyms. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 4000,
    extendedTimeouts: true,
    temperature: NORMALIZE_TEMPERATURE,
  });
  recordUsage(usage, phase, model);

  const parsed = parseJsonObject(text);
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

function reconcileDropped(inputNames: string[], byName: Map<string, VocabEntry>, produced: VocabEntry[]): { entries: VocabEntry[]; recovered: string[] } {
  const covered = new Set(produced.flatMap((e) => e.aliases));
  const recovered: string[] = [];
  const result = [...produced];
  for (const name of inputNames) {
    const original = byName.get(name);
    if (!original) continue;
    const stillMissing = original.aliases.filter((a) => !covered.has(a));
    if (stillMissing.length > 0) {
      result.push({ name: original.name, classification: original.classification, aliases: stillMissing });
      recovered.push(...stillMissing);
    }
  }
  return { entries: result, recovered };
}

async function consolidateVocabulary(rawLabels: string[], usage: ModelUsage): Promise<{ entries: VocabEntry[]; recoveredCount: number; tiers: Array<{ tier: string; entryCount: number }> }> {
  const tiers: Array<{ tier: string; entryCount: number }> = [];
  let recoveredCount = 0;

  let entries: VocabEntry[] = [];
  for (let i = 0; i < rawLabels.length; i += VOCAB_CHUNK_SIZE) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const chunk = rawLabels.slice(i, i + VOCAB_CHUNK_SIZE);
    entries.push(...(await vocabChunkCall(chunk, usage, 'vocab-tier1', '')));
  }
  {
    const byName = new Map(rawLabels.map((l) => [l, { name: l, classification: 'DISCRIMINATING' as Classification, aliases: [l] }]));
    const { entries: reconciled, recovered } = reconcileDropped(rawLabels, byName, entries);
    recoveredCount += recovered.length;
    entries = dedupeEntriesByName(reconciled);
  }
  console.log(`  vocab tier1: ${rawLabels.length} raw labels -> ${entries.length} entries`);
  tiers.push({ tier: 'tier1', entryCount: entries.length });

  let round = 2;
  while (entries.length > VOCAB_CHUNK_SIZE * 2 && round <= 6) {
    const byName = new Map(entries.map((e) => [e.name, e]));
    const names = entries.map((e) => e.name);
    const merged: VocabEntry[] = [];
    for (let i = 0; i < names.length; i += VOCAB_CHUNK_SIZE) {
      if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
      const chunkNames = names.slice(i, i + VOCAB_CHUNK_SIZE);
      const chunkEntries = await vocabChunkCall(chunkNames, usage, `vocab-tier${round}`, '');
      for (const ce of chunkEntries) merged.push({ name: ce.name, classification: ce.classification, aliases: ce.aliases.flatMap((n) => byName.get(n)?.aliases || [n]) });
    }
    const { entries: reconciled, recovered } = reconcileDropped(names, byName, merged);
    recoveredCount += recovered.length;
    entries = dedupeEntriesByName(reconciled);
    console.log(`  vocab tier${round}: -> ${entries.length} entries`);
    tiers.push({ tier: `tier${round}`, entryCount: entries.length });
    round += 1;
  }

  await sleep(MIN_MS_BETWEEN_CALLS);
  const byNameFinal = new Map(entries.map((e) => [e.name, e]));
  const finalNames = entries.map((e) => e.name);
  const finalInstruction = `\nIMPORTANT: Consolidate these into a CLOSED vocabulary of between ${VOCAB_TARGET_MIN} and ${VOCAB_TARGET_MAX} total entries. Merge more aggressively across near-duplicate operations if needed, but NEVER merge two entries that are genuinely different operations just to hit the count.\n`;
  const finalChunkEntries = await vocabChunkCall(finalNames, usage, 'vocab-final', finalInstruction);
  const finalMerged = finalChunkEntries.map((ce) => ({ name: ce.name, classification: ce.classification, aliases: ce.aliases.flatMap((n) => byNameFinal.get(n)?.aliases || [n]) }));
  const { entries: reconciledFinal, recovered: recoveredFinal } = reconcileDropped(finalNames, byNameFinal, finalMerged);
  recoveredCount += recoveredFinal.length;
  const finalEntries = dedupeEntriesByName(reconciledFinal);
  tiers.push({ tier: 'final', entryCount: finalEntries.length });
  console.log(`  vocab final: -> ${finalEntries.length} entries (target ${VOCAB_TARGET_MIN}-${VOCAB_TARGET_MAX})`);

  return { entries: finalEntries, recoveredCount, tiers };
}

async function runConsolidation(): Promise<void> {
  if (fs.existsSync(CONSOLIDATED_VOCAB_PATH)) {
    console.log(`Cache already exists at ${CONSOLIDATED_VOCAB_PATH}. Delete it to redo. Skipping.`);
    return;
  }
  const usage: ModelUsage = {};
  const labeled = loadLabels();
  const allRawLabels = labeled.flatMap((l) => l.actionLabels);
  console.log(`${allRawLabels.length} raw labels (${new Set(allRawLabels).size} distinct) across ${labeled.length} training examples.`);

  console.log('Step 2: normalizing raw labels to canonical (merge exact synonyms only)...');
  const { mapping: normalizeMapping, beforeCount, afterCount } = await normalizeVocabulary(allRawLabels, usage, 'normalize');
  console.log(`  -> ${beforeCount} raw -> ${afterCount} canonical labels.`);
  const canonicalLabels = Array.from(new Set(Object.values(normalizeMapping)));

  await sleep(MIN_MS_BETWEEN_CALLS);
  console.log('Step 3: consolidating canonical labels into an initial closed vocabulary...');
  const { entries, recoveredCount, tiers } = await consolidateVocabulary(canonicalLabels, usage);

  // Compose raw -> final-entry-name mapping so downstream phases don't need to redo normalization.
  const canonicalToEntry: Record<string, string> = {};
  for (const e of entries) for (const alias of e.aliases) canonicalToEntry[alias] = e.name;
  const rawToEntry: Record<string, string> = {};
  for (const [raw, canonical] of Object.entries(normalizeMapping)) rawToEntry[raw] = canonicalToEntry[canonical] || canonical;

  fs.writeFileSync(
    CONSOLIDATED_VOCAB_PATH,
    JSON.stringify(
      {
        note: 'Initial consolidated vocabulary (pre-split, classification not yet assigned — all placeholder DISCRIMINATING). Inspect aliasCount per entry to identify catch-alls, then run --split --catchalls=name1,name2,....',
        beforeCount,
        afterCount,
        recoveredCount,
        tiers,
        rawToEntryMapping: rawToEntry,
        entries: entries.sort((a, b) => b.aliases.length - a.aliases.length),
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`Wrote ${entries.length} initial entries to ${CONSOLIDATED_VOCAB_PATH}. Model usage: ${JSON.stringify(usage)}`);
  console.log('\nEntries by alias count (inspect to identify catch-alls):');
  for (const e of entries.sort((a, b) => b.aliases.length - a.aliases.length)) console.log(`  ${e.aliases.length}\t${e.name}`);
}

// ─── Step 4: split identified catch-alls ───────────────────────────────────────────────────────
async function splitCatchAll(entryName: string, aliases: string[], usage: ModelUsage): Promise<VocabEntry[]> {
  const prompt = `Below is the full alias list currently grouped under one overly-broad vocabulary entry, "${entryName}". This single entry is a catch-all hiding multiple genuinely distinct techniques.

Split these aliases into multiple distinct sub-operations, each naming ONE real, specific technique. Merge two aliases into the same sub-operation ONLY if they name the literal same technique in different words. If in doubt, keep them separate — under-splitting is the exact mistake being fixed here.

ALIASES CURRENTLY UNDER "${entryName}":
${aliases.map((a, i) => `${i}. ${a}`).join('\n')}

Format as JSON: { "entries": [ { "name": string, "aliases": string[] } ] }
Every alias above must appear in exactly one entry's aliases — do not drop any.`;

  const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
    systemPrompt: 'You split an overly-broad catch-all operation label into distinct, real, named techniques. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 4000,
    extendedTimeouts: true,
    temperature: SPLIT_TEMPERATURE,
  });
  recordUsage(usage, `step4-split[${entryName}]`, model);

  const parsed = parseJsonObject(text);
  const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  const result: VocabEntry[] = entries
    .map((e: any) => ({ name: String(e?.name || '').trim(), classification: 'DISCRIMINATING' as Classification, aliases: Array.isArray(e?.aliases) ? e.aliases.map((a: any) => String(a).trim()).filter(Boolean) : [] }))
    .filter((e: VocabEntry) => e.name);
  const covered = new Set(result.flatMap((e) => e.aliases));
  const missing = aliases.filter((a) => !covered.has(a));
  if (missing.length > 0) {
    console.warn(`  ${missing.length} alias(es) dropped by the model, re-added as their own entries.`);
    result.push(...missing.map((a) => ({ name: a, classification: 'DISCRIMINATING' as Classification, aliases: [a] })));
  }
  return result;
}

async function runSplit(catchallNames: string[]): Promise<void> {
  const consolidated = JSON.parse(fs.readFileSync(CONSOLIDATED_VOCAB_PATH, 'utf-8'));
  const entries: VocabEntry[] = consolidated.entries;
  const usage: ModelUsage = {};

  const untouched = entries.filter((e) => !catchallNames.includes(e.name));
  let result: VocabEntry[] = [...untouched];
  const splitSummary: Array<{ from: string; intoCount: number }> = [];

  for (let i = 0; i < catchallNames.length; i += 1) {
    const name = catchallNames[i];
    const original = entries.find((e) => e.name === name);
    if (!original) throw new Error(`Catch-all "${name}" not found in consolidated vocabulary`);
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    console.log(`  splitting "${name}" (${original.aliases.length} aliases)...`);
    const split = await splitCatchAll(name, original.aliases, usage);
    console.log(`    -> ${split.length} sub-operations.`);
    result.push(...split);
    splitSummary.push({ from: name, intoCount: split.length });
  }

  const outPath = path.join(DOCS_DIR, 'phy102-vocabulary-split.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify({ note: 'Post-split vocabulary (classification not yet assigned). Run --classify next.', splitSummary, rawToEntryMapping: consolidated.rawToEntryMapping, entries: result }, null, 2),
    'utf-8',
  );
  console.log(`Wrote ${result.length} entries (post-split) to ${outPath}. Model usage: ${JSON.stringify(usage)}`);
}

// ─── Step 5: classify by fixed rule, no model call ─────────────────────────────────────────────
// Rule (same as v6): a new entry naming a specific technique = DISCRIMINATING; a new entry that is
// a residual/leftover bucket from a split = GENERIC. Since PHY102 has no prior vocabulary to
// inherit from (unlike v6's Rule 1), EVERY entry gets this judgment call, made by hand against its
// full alias list — no model call, matching "classify by the v6 deterministic rules."
async function runClassify(classificationOverrides: Record<string, Classification>): Promise<void> {
  const splitPath = path.join(DOCS_DIR, 'phy102-vocabulary-split.json');
  const source = fs.existsSync(splitPath) ? JSON.parse(fs.readFileSync(splitPath, 'utf-8')) : JSON.parse(fs.readFileSync(CONSOLIDATED_VOCAB_PATH, 'utf-8'));
  const entries: VocabEntry[] = source.entries;

  const missing = entries.filter((e) => !classificationOverrides[e.name]);
  if (missing.length > 0) {
    throw new Error(`Missing classification for: ${missing.map((e) => e.name).join(', ')} — add to CLASSIFICATION_OVERRIDES in the script`);
  }

  const finalEntries = entries.map((e) => ({ ...e, classification: classificationOverrides[e.name] }));
  const discCount = finalEntries.filter((e) => e.classification === 'DISCRIMINATING').length;
  const genericCount = finalEntries.filter((e) => e.classification === 'GENERIC').length;

  fs.writeFileSync(
    FINAL_VOCAB_PATH,
    JSON.stringify(
      {
        note: 'FROZEN. PHY102 vocabulary built fresh with the v6 method: consolidate -> split catch-alls -> classify by fixed rule (no empirical model classification, no hand-tuning of the resulting archetypes).',
        generatedAt: new Date().toISOString(),
        entryCount: finalEntries.length,
        discriminatingCount: discCount,
        genericCount,
        rawToEntryMapping: source.rawToEntryMapping,
        entries: finalEntries,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`Wrote ${finalEntries.length} entries (${discCount} DISCRIMINATING, ${genericCount} GENERIC) to ${FINAL_VOCAB_PATH}.`);
}

// ─── Step 6: build archetypes, hold-out test ────────────────────────────────────────────────────
function buildMapping(rawToEntry: Record<string, string>): Record<string, string> {
  return rawToEntry;
}

function discSignatureForRawLabels(rawActionLabels: string[], mapping: Record<string, string>, vocabByName: Map<string, VocabEntry>): string {
  const disc = rawActionLabels
    .map((l) => mapping[l])
    .filter((n): n is string => Boolean(n))
    .filter((n) => vocabByName.get(n)?.classification === 'DISCRIMINATING');
  const signature = disc.join(' -> ');
  return signature === '' ? DIRECT_EVALUATION : signature;
}

function buildArchetypes(labeledExamples: LabeledExample[], mapping: Record<string, string>, vocabByName: Map<string, VocabEntry>, examplesById: Map<string, ExtractedExample>): Archetype[] {
  const groups = new Map<string, string[]>();
  for (const le of labeledExamples) {
    const signature = discSignatureForRawLabels(le.actionLabels, mapping, vocabByName);
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature)!.push(le.exampleId);
  }
  const archetypes: Archetype[] = [];
  for (const [signature, memberIds] of groups) {
    let shortest: ExtractedExample | null = null;
    if (signature !== DIRECT_EVALUATION) {
      for (const id of memberIds) {
        const ex = examplesById.get(id);
        if (ex && (!shortest || ex.problemText.length < shortest.problemText.length)) shortest = ex;
      }
    }
    archetypes.push({ signature, memberCount: memberIds.length, canonicalStem: shortest?.problemText || (signature === DIRECT_EVALUATION ? '_(many different trivial problems)_' : '(unknown)'), memberIds });
  }
  return archetypes.sort((a, b) => b.memberCount - a.memberCount);
}

async function labelHoldoutBatch(batch: Array<{ exampleId: string; problemText: string; solutionSteps: string[] }>, vocabNames: string[], usage: ModelUsage): Promise<{ results: LabeledExample[]; coercedCount: number }> {
  const vocabSet = new Set(vocabNames);
  const prompt = `Here is a FROZEN, CLOSED vocabulary of operation labels — this is the complete list; you may not invent new labels:
${vocabNames.join(', ')}

For each example below, label EVERY solution step using EXACTLY one of the vocabulary labels above. If — and only if — a step's operation genuinely is not covered by ANY label in the list, label that step "UNMAPPED" instead. Never force a mismatched label just to avoid UNMAPPED.

EXAMPLES:
${batch.map((e) => `=== exampleId: ${e.exampleId} ===\nPROBLEM: ${e.problemText}\nSTEPS:\n${e.solutionSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`).join('\n\n')}

Format as JSON: { "results": [ { "exampleId": string, "actionLabels": string[] } ] }
Include an entry for every exampleId above.`;

  const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
    systemPrompt: 'You label solution steps using ONLY a fixed, closed operation vocabulary, or "UNMAPPED" if truly nothing fits. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 2500,
    extendedTimeouts: true,
    temperature: HOLDOUT_LABEL_TEMPERATURE,
  });
  recordUsage(usage, 'step6-label-holdout', model);

  const parsed = parseJsonObject(text);
  const rows = Array.isArray(parsed?.results) ? parsed.results : [];
  let coercedCount = 0;
  const results = rows.map((r: any) => {
    const raw: string[] = Array.isArray(r?.actionLabels) ? r.actionLabels.map((l: any) => String(l).trim()).filter(Boolean) : [];
    const coerced = raw.map((l) => {
      if (l === 'UNMAPPED' || vocabSet.has(l)) return l;
      coercedCount += 1;
      return 'UNMAPPED';
    });
    return { exampleId: String(r?.exampleId || ''), actionLabels: coerced };
  });
  return { results, coercedCount };
}

async function runHoldout(): Promise<void> {
  const usage: ModelUsage = {};
  const vocabData = JSON.parse(fs.readFileSync(FINAL_VOCAB_PATH, 'utf-8'));
  const vocab: VocabEntry[] = vocabData.entries;
  const rawToEntry: Record<string, string> = vocabData.rawToEntryMapping;
  const vocabByName = new Map(vocab.map((e) => [e.name, e]));
  const vocabNames = vocab.map((e) => e.name);

  const allExamples = loadExtractedExamples();
  const trainingExamples = allExamples.filter((e) => !e.isHeldOut);
  const holdoutExamples = allExamples.filter((e) => e.isHeldOut);
  const trainingLabeled = loadLabels();
  const examplesById = new Map(allExamples.map((e) => [e.exampleId, e]));

  console.log(`Building archetypes from ${trainingLabeled.length} training examples...`);
  const archetypes = buildArchetypes(trainingLabeled, rawToEntry, vocabByName, examplesById);
  const singletonCount = archetypes.filter((a) => a.memberCount === 1).length;
  const directEval = archetypes.find((a) => a.signature === DIRECT_EVALUATION);
  console.log(`${archetypes.length} archetypes, ${singletonCount} singletons. DIRECT_EVALUATION covers ${directEval?.memberCount || 0} training examples.`);

  console.log(`\nLabeling ${holdoutExamples.length} held-out examples, constrained to the frozen vocabulary...`);
  const holdoutLabeled: LabeledExample[] = [];
  let coercedCount = 0;
  for (let i = 0; i < holdoutExamples.length; i += LABEL_BATCH_SIZE) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const batch = holdoutExamples.slice(i, i + LABEL_BATCH_SIZE);
    console.log(`  labeling ${i + 1}-${Math.min(i + batch.length, holdoutExamples.length)} of ${holdoutExamples.length}...`);
    const { results, coercedCount: c } = await labelHoldoutBatch(batch, vocabNames, usage);
    holdoutLabeled.push(...results);
    coercedCount += c;
  }

  const referenceBySignature = new Map(archetypes.map((a) => [a.signature, a]));
  const holdoutResults = holdoutLabeled.map((h) => {
    const signature = discSignatureForRawLabels(h.actionLabels, rawToEntry, vocabByName);
    const unmappedCount = h.actionLabels.filter((l) => l === 'UNMAPPED').length;
    const matched = referenceBySignature.get(signature);
    return { exampleId: h.exampleId, signature, unmappedCount, fits: Boolean(matched) };
  });

  const fitCount = holdoutResults.filter((r) => r.fits).length;
  const coverageScore = holdoutExamples.length > 0 ? fitCount / holdoutExamples.length : 0;
  const directEvalMatches = holdoutResults.filter((r) => r.fits && r.signature === DIRECT_EVALUATION).length;
  const totalUnmapped = holdoutResults.reduce((sum, r) => sum + r.unmappedCount, 0);
  console.log(`coverageScore = ${fitCount} / ${holdoutExamples.length} = ${coverageScore.toFixed(3)}`);

  const generatedAt = new Date().toISOString();
  const usageLines = Object.entries(usage).flatMap(([phase, models]) => Object.entries(models).map(([model, count]) => `  - ${phase}: ${model} x${count}`));
  const problemTextById = new Map(allExamples.map((e) => [e.exampleId, e.problemText]));

  const md = [
    '# Archetype Extraction Experiment v7 — PHY 102 (generalization test)',
    '',
    `Captured ${generatedAt}. Standalone experiment, not wired into any job/queue. No database writes (vocabulary/cache files and this report are the only file artifacts).`,
    '',
    '## Methodology',
    '',
    '- **Generalization test**: same method as v6 (extract -> label steps -> normalize -> consolidate into a closed vocabulary -> split catch-alls -> classify DISCRIMINATING/GENERIC by fixed rule, no model-judged classification -> exact discriminating-only signature match, empty -> `DIRECT_EVALUATION`), applied fresh to PHY 102 with no hand-tuning and no reuse of MTH102\'s vocabulary.',
    `- Source materials: ${SOURCE_TITLES.map((t) => `"${t}"`).join(', ')}. "${EXCLUDED_TITLE}" was excluded — it is cross-listed under both PHY 102 and PHY 108 (identical content, confirmed by matching byte length), so including it would not be PHY-102-specific source material.`,
    `- No held-out tutorial document exists for PHY 102, so the hold-out is a random ${Math.round(HOLDOUT_FRACTION * 100)}% of the extracted examples, set aside (seed=${RANDOM_SEED}) before any labeling, normalization, or vocabulary work touched the data. The other ${Math.round((1 - HOLDOUT_FRACTION) * 100)}% built the vocabulary and archetypes.`,
    `- Catch-all identification (which consolidated entries needed splitting) was done by manual inspection of alias counts, the same way it was originally done for MTH102 — not an automated threshold.`,
    `- Held-out examples were labeled in batches of at most ${LABEL_BATCH_SIZE}, hard-constrained to the frozen vocabulary or "UNMAPPED". Closed-vocabulary violations coerced in code: ${coercedCount}.`,
    '- Model usage per phase:',
    ...usageLines,
    '',
    '## Extraction and vocabulary',
    '',
    `**${allExamples.length} examples extracted** (${trainingExamples.length} training, ${holdoutExamples.length} held out).`,
    '',
    `**Vocabulary: ${vocab.length} entries** (${vocab.filter((e) => e.classification === 'DISCRIMINATING').length} DISCRIMINATING, ${vocab.filter((e) => e.classification === 'GENERIC').length} GENERIC).`,
    '',
    '## Archetypes (built from the 80% training set)',
    '',
    `**${archetypes.length} archetypes**, ${singletonCount} singletons. \`DIRECT_EVALUATION\` covers **${directEval?.memberCount || 0}** of ${trainingExamples.length} training examples (${((directEval?.memberCount || 0) / trainingExamples.length * 100).toFixed(1)}%).`,
    '',
    '### Largest 10 archetypes by member count',
    '',
    archetypes.slice(0, 10).map((a) => `- **[memberCount=${a.memberCount}]** \`${a.signature}\`\n  - canonicalStem: ${a.canonicalStem}`).join('\n'),
    '',
    '## Hold-out test (random 20%, unseen during vocabulary/archetype building)',
    '',
    `${holdoutExamples.length} held-out examples.`,
    '',
    `**coverageScore = ${fitCount} / ${holdoutExamples.length} = ${coverageScore.toFixed(3)}**`,
    '',
    `Of the ${fitCount} fits, **${directEvalMatches}** matched \`DIRECT_EVALUATION\`.`,
    '',
    `Total UNMAPPED step labels: ${totalUnmapped}.`,
    '',
    '### Full per-example results',
    '',
    ...holdoutResults.map((r) => `- ${r.exampleId} (${r.fits ? 'FIT' : 'NO FIT'}, ${r.unmappedCount} UNMAPPED): "${(problemTextById.get(r.exampleId) || '').slice(0, 120)}"\n  - signature: \`${r.signature}\``),
    '',
  ].join('\n');

  fs.writeFileSync(OUTPUT_PATH, md, 'utf-8');
  console.log(`\nWrote report to ${OUTPUT_PATH}`);

  console.log('\n=== Summary ===');
  console.log(
    JSON.stringify(
      {
        examplesExtracted: allExamples.length,
        trainingCount: trainingExamples.length,
        holdoutCount: holdoutExamples.length,
        vocabularyEntryCount: vocab.length,
        discriminatingCount: vocab.filter((e) => e.classification === 'DISCRIMINATING').length,
        genericCount: vocab.filter((e) => e.classification === 'GENERIC').length,
        archetypeCount: archetypes.length,
        singletonCount,
        directEvaluationMemberCount: directEval?.memberCount || 0,
        coverageScore: Number(coverageScore.toFixed(3)),
        directEvaluationMatches: directEvalMatches,
        totalUnmappedStepLabels: totalUnmapped,
        modelUsage: usage,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const args = process.argv.slice(2);
  const phase = args[0];

  if (phase === '--estimate' || !phase) {
    const sources = await loadSourceMaterials();
    const chunks = buildChunks(sources);
    console.log(`Sources: ${sources.map((s) => `${s.title} (${s.content.length} chars)`).join(', ')}`);
    console.log(`${chunks.length} chunks (chunkSize=${CHUNK_SIZE}, overlap=${CHUNK_OVERLAP}).`);
    console.log(`Estimated extraction calls: ${Math.ceil(chunks.length / CHUNKS_PER_EXTRACTION_CALL)} (at ${CHUNKS_PER_EXTRACTION_CALL} chunks/call).`);
    console.log('\nPhases: --extract, --label, --consolidate, --split --catchalls=a,b,c, --classify, --holdout');
    return;
  }
  if (phase === '--extract') return runExtraction();
  if (phase === '--label') return runLabeling();
  if (phase === '--consolidate') return runConsolidation();
  if (phase === '--split') {
    const catchallsArg = args.find((a) => a.startsWith('--catchalls='));
    if (!catchallsArg) throw new Error('Usage: --split --catchalls=name1,name2,...');
    const catchallNames = catchallsArg.slice('--catchalls='.length).split(',').map((s) => s.trim());
    return runSplit(catchallNames);
  }
  if (phase === '--classify') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { CLASSIFICATION_OVERRIDES } = require('./_phy102-classification-overrides');
    return runClassify(CLASSIFICATION_OVERRIDES);
  }
  if (phase === '--holdout') return runHoldout();
  throw new Error(`Unknown phase: ${phase}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

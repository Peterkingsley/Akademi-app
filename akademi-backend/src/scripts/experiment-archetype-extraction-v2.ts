// STANDALONE EXPERIMENT (v2) — not wired into any job, queue, or JOB_NAMES entry. Run manually via
// `npx tsx src/scripts/experiment-archetype-extraction-v2.ts`. Read-only against the database;
// writes nothing to it. Output is a single markdown report on disk.
//
// Revision of experiment-archetype-extraction.ts: v1 asked the model to identify archetypes
// directly from the raw source text in one shot per run. v2 separates EXTRACTION (verbatim,
// chunked, no interpretation) from CLUSTERING (group the extracted flat list into archetypes by
// strict solution-action-sequence equality), on the theory that verbatim extraction should be far
// more reproducible across runs than freeform archetype naming was.
//
// Input discipline (unchanged from v1):
//   - Extraction/clustering reads ONLY the three named MTH 102 source materials below.
//   - "MTH 102 TUTORIAL 2026" is a held-out answer key — never read until the hold-out phase.
//   - No AI-generated Question rows or GeneratedTextbookSection content are read anywhere here.

import fs from 'fs';
import path from 'path';
import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';

const SOURCE_TITLES = ['MTH 102 CALCULUS LECTURE NOTES', 'MTH 102 LECTURE 1', 'MTH 102 LECTURE 1 CONT.'];
const HOLDOUT_TITLE = 'MTH 102 TUTORIAL 2026';
const COURSE_CODE = 'MTH 102';
// Reduced from 3 to 1 run: the full 3-run design needs ~39 model calls, but the configured
// primary model has a confirmed hard 20-requests/day cap (see the Step 0 note in the report), hit
// mid-run on a prior attempt today. With only 1 run, extractionStability/stabilityScore are not
// measured — see the report's methodology section.
const NUM_RUNS = 1;
const TEMPERATURE = 0.7;
const CHUNK_SIZE = 8000;
const CHUNK_OVERLAP = 500;
const CHUNKS_PER_EXTRACTION_CALL = 2; // batches chunks per API call to keep call count sane
const OUTPUT_PATH = path.join(__dirname, '../../../docs/archetype-experiment-mth102-v2.md');
const SIMILARITY_THRESHOLD = 0.6; // word-overlap Jaccard, for matching verbatim examples across runs

type SourceChunk = { chunkId: string; sourceTitle: string; chunkIndex: number; text: string };
type ExtractedExample = { problemText: string; solutionSteps: string[]; sourceChunk: string };
type Archetype = {
  trigger: string;
  method: string;
  distinctBecause: string;
  memberCount: number;
  canonicalStem: string;
  memberIndices: number[];
};
type CanonicalArchetype = {
  trigger: string;
  method: string;
  distinctBecause: string;
  canonicalStem: string;
  foundInRuns: number[];
};
type FitResult = { questionIndex: number; fits: boolean; archetypeIndex: number | null; reason: string };
type RunResult = { chunks: SourceChunk[]; examples: ExtractedExample[]; countsPerChunk: Record<string, number>; archetypes: Archetype[] };

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

// Source material is calculus notes full of LaTeX (\frac, \sqrt, \times, \(...\), ...); the model
// frequently emits those backslashes inside JSON string values without escaping them, which breaks
// JSON.parse. A regex applied to the whole text can't reliably tell "inside a string" apart from
// structural JSON, so this walks the text character by character tracking string-open state, and
// escapes any backslash inside a string that isn't already starting a valid JSON escape sequence
// (\", \\, \/, \b, \f, \n, \r, \t, \u). This can occasionally misinterpret real LaTeX like "\text"
// as if it started a \t escape — acceptable here since this is a one-off analysis script, not
// production content storage, and the alternative is a hard crash on nearly every batch.
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
        i += 1; // consume the escape character too, so it isn't re-examined as a plain char
      } else {
        result += '\\\\';
      }
      continue;
    }

    result += ch;
  }

  return result;
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

// ─── Step 1: verbatim extraction, batched across chunks to keep API call count reasonable ──────
async function extractFromChunkBatch(batch: SourceChunk[]): Promise<Map<string, ExtractedExample[]>> {
  const prompt = `You are extracting worked examples from real teaching material text chunks. Do NOT interpret, generalize, summarize, or name anything at this stage — extract exactly what is present in the text, verbatim.

For EACH chunk below, extract every worked example, solved problem, or illustrative problem present in that chunk's text (verbatim, as written). If a chunk genuinely contains no worked examples, include it in the output with an empty "examples" array — do not skip it, and do not invent examples that are not actually present.

For each example found, record:
- problemText: the problem statement, verbatim from the text
- solutionSteps: the solution/working, split into an ordered array of individual steps, verbatim from the text

CHUNKS:
${batch.map((c) => `=== chunk_id: ${c.chunkId} ===\n${c.text}`).join('\n\n')}

Format as JSON: { "chunkResults": [ { "chunkId": string, "examples": [ { "problemText": string, "solutionSteps": string[] } ] } ] }
Include an entry in "chunkResults" for every chunk_id given above, even if its "examples" array is empty.`;

  const output = await aiProvider.generateResponse(prompt, {
    systemPrompt:
      'You are a precise text-extraction tool. You extract worked examples verbatim from source text — you never interpret, generalize, or paraphrase. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 8000,
    extendedTimeouts: true,
    temperature: TEMPERATURE,
  });

  const parsed = parseJsonObject(output);
  const results = new Map<string, ExtractedExample[]>();
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
          sourceChunk: chunkId,
        }))
        .filter((e: ExtractedExample) => e.problemText),
    );
  }
  // Ensure every requested chunk has an entry even if the model omitted it from its response.
  for (const c of batch) {
    if (!results.has(c.chunkId)) results.set(c.chunkId, []);
  }
  return results;
}

async function runExtraction(chunks: SourceChunk[]): Promise<{ examples: ExtractedExample[]; countsPerChunk: Record<string, number> }> {
  const examples: ExtractedExample[] = [];
  const countsPerChunk: Record<string, number> = {};

  for (let i = 0; i < chunks.length; i += CHUNKS_PER_EXTRACTION_CALL) {
    const batch = chunks.slice(i, i + CHUNKS_PER_EXTRACTION_CALL);
    console.log(`    extracting chunks ${i + 1}-${Math.min(i + batch.length, chunks.length)} of ${chunks.length}...`);
    const batchResults = await extractFromChunkBatch(batch);
    for (const c of batch) {
      const found = batchResults.get(c.chunkId) || [];
      countsPerChunk[c.chunkId] = found.length;
      examples.push(...found);
    }
  }

  return { examples, countsPerChunk };
}

// ─── Step 2: cluster the flat example list into archetypes ─────────────────────────────────────
async function clusterExamples(examples: ExtractedExample[]): Promise<Archetype[]> {
  if (examples.length === 0) return [];

  const listText = examples
    .map((e, i) => `${i}. PROBLEM: ${e.problemText}\n   STEPS: ${e.solutionSteps.map((s, j) => `(${j + 1}) ${s}`).join(' ')}`)
    .join('\n\n');

  const prompt = `Given this flat list of worked examples (extracted verbatim from teaching material — no interpretation has been applied yet), group them into ARCHETYPES.

RULE: Two examples belong to the SAME archetype ONLY IF their solutionSteps are the exact same sequence of actions, differing only in the specific values, letters, or context used. If one example's solution requires an action step the other's solution does not, they are DIFFERENT archetypes — even if they look superficially similar or concern the same broad topic. For example: power rule, product rule, quotient rule, and chain rule differentiation are FOUR different action sequences and must NEVER be merged into one archetype.

EXAMPLES:
${listText}

For each cluster you form, report:
- trigger: what you notice in a problem that signals this archetype applies
- method: the general action sequence (described in terms of actions, not tied to specific numbers)
- distinctBecause: one sentence on how this archetype's action sequence differs from every OTHER archetype you report
- memberCount: how many examples from the list belong to this cluster
- canonicalStem: the problemText of the SIMPLEST member of this cluster, copied verbatim from the list above
- memberIndices: the indices (from the numbered list above) of every example belonging to this cluster

Format as JSON: { "archetypes": [ { "trigger": string, "method": string, "distinctBecause": string, "memberCount": number, "canonicalStem": string, "memberIndices": number[] } ] }
Every example index (0 to ${examples.length - 1}) must belong to exactly one archetype.`;

  const output = await aiProvider.generateResponse(prompt, {
    systemPrompt:
      'You are a strict taxonomist grouping worked examples by identical solution-action-sequence, never by surface topic similarity. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 8000,
    extendedTimeouts: true,
    temperature: TEMPERATURE,
  });

  const parsed = parseJsonObject(output);
  const archetypes = Array.isArray(parsed?.archetypes) ? parsed.archetypes : [];
  return archetypes.map((a: any) => ({
    trigger: String(a?.trigger || '').trim(),
    method: String(a?.method || '').trim(),
    distinctBecause: String(a?.distinctBecause || '').trim(),
    memberCount: Number(a?.memberCount) || (Array.isArray(a?.memberIndices) ? a.memberIndices.length : 0),
    canonicalStem: String(a?.canonicalStem || '').trim(),
    memberIndices: Array.isArray(a?.memberIndices) ? a.memberIndices.map((n: any) => Number(n)).filter((n: number) => !isNaN(n)) : [],
  }));
}

// ─── Step 3: cross-run stability ────────────────────────────────────────────────────────────────
function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeForMatch(a).split(' ').filter(Boolean));
  const wordsB = new Set(normalizeForMatch(b).split(' ').filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection += 1;
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Groups extracted examples across the 3 runs by textual similarity (these are meant to be
// verbatim extractions from the same source, so word-overlap similarity is a legitimate,
// deterministic signal here — unlike archetype descriptions, which need semantic/LLM matching
// because their wording is genuinely freeform).
function computeExtractionStability(runExamples: ExtractedExample[][]): {
  totalDistinctExamples: number;
  foundInAllRuns: number;
  groups: Array<{ representative: string; foundInRuns: Set<number> }>;
} {
  const groups: Array<{ representative: string; members: Array<{ runIndex: number; example: ExtractedExample }>; runs: Set<number> }> = [];

  runExamples.forEach((examples, runIndex) => {
    for (const example of examples) {
      let matched = false;
      for (const group of groups) {
        if (jaccardSimilarity(group.representative, example.problemText) >= SIMILARITY_THRESHOLD) {
          group.members.push({ runIndex, example });
          group.runs.add(runIndex);
          matched = true;
          break;
        }
      }
      if (!matched) {
        groups.push({ representative: example.problemText, members: [{ runIndex, example }], runs: new Set([runIndex]) });
      }
    }
  });

  return {
    totalDistinctExamples: groups.length,
    foundInAllRuns: groups.filter((g) => g.runs.size >= NUM_RUNS).length,
    groups: groups.map((g) => ({ representative: g.representative, foundInRuns: g.runs })),
  };
}

async function canonicalizeArchetypesAcrossRuns(runArchetypes: Archetype[][]): Promise<CanonicalArchetype[]> {
  const prompt = `Three independent runs each clustered worked examples into ARCHETYPES using this rule: two examples are the SAME archetype only if their solutions follow an identical sequence of actions, differing only in values/letters/context. Archetypes like power rule, product rule, quotient rule, and chain rule differentiation must NEVER be merged into each other, even though they are all "differentiation."

Match archetypes ACROSS the 3 runs below. An archetype from one run and an archetype from another run are the SAME canonical archetype only if they would pass that same identical-action-sequence test — do not merge just because they sound topically similar or share a broad subject area.

RUN 1 ARCHETYPES:
${JSON.stringify(runArchetypes[0].map((a) => ({ trigger: a.trigger, method: a.method, distinctBecause: a.distinctBecause, canonicalStem: a.canonicalStem })), null, 2)}

RUN 2 ARCHETYPES:
${JSON.stringify(runArchetypes[1].map((a) => ({ trigger: a.trigger, method: a.method, distinctBecause: a.distinctBecause, canonicalStem: a.canonicalStem })), null, 2)}

RUN 3 ARCHETYPES:
${JSON.stringify(runArchetypes[2].map((a) => ({ trigger: a.trigger, method: a.method, distinctBecause: a.distinctBecause, canonicalStem: a.canonicalStem })), null, 2)}

Format as JSON: { "canonicalArchetypes": [ { "trigger": string, "method": string, "distinctBecause": string, "canonicalStem": string, "foundInRuns": number[] } ] }`;

  const output = await aiProvider.generateResponse(prompt, {
    systemPrompt: 'You are auditing three independent clustering runs for consistency, matching strictly by identical action sequence. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 8000,
    extendedTimeouts: true,
    temperature: 0.2,
  });

  const parsed = parseJsonObject(output);
  const canonical = Array.isArray(parsed?.canonicalArchetypes) ? parsed.canonicalArchetypes : [];
  return canonical.map((a: any) => ({
    trigger: String(a?.trigger || '').trim(),
    method: String(a?.method || '').trim(),
    distinctBecause: String(a?.distinctBecause || '').trim(),
    canonicalStem: String(a?.canonicalStem || '').trim(),
    foundInRuns: Array.isArray(a?.foundInRuns) ? a.foundInRuns.map((n: any) => Number(n)).filter((n: number) => !isNaN(n)) : [],
  }));
}

// ─── Step 4: hold-out test ───────────────────────────────────────────────────────────────────────
async function extractTutorialQuestions(holdoutContent: string): Promise<{ questionText: string }[]> {
  const prompt = `Extract EVERY worked example and exercise/practice question from the document below. Include the full problem statement text for each — verbatim, or a faithful close paraphrase preserving every specific number/value — whether or not the document shows a solution for it. Do not summarize; do not skip any.

DOCUMENT (MTH 102 TUTORIAL 2026):
${holdoutContent}

Format as JSON: { "questions": [ { "questionText": string } ] }`;

  const output = await aiProvider.generateResponse(prompt, {
    systemPrompt: 'You are cataloguing every worked example and exercise question in a document, verbatim. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 6000,
    extendedTimeouts: true,
  });
  const parsed = parseJsonObject(output);
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
  return questions.map((q: any) => ({ questionText: String(q?.questionText || '').trim() })).filter((q: any) => q.questionText);
}

async function checkFit(canonical: CanonicalArchetype[], questions: { questionText: string }[]): Promise<FitResult[]> {
  const archetypeList = canonical.map((a, i) => `${i}. TRIGGER: ${a.trigger} | METHOD: ${a.method} | STEM: ${a.canonicalStem}`).join('\n');
  const questionList = questions.map((q, i) => `${i}. ${q.questionText}`).join('\n\n');

  const prompt = `Here is an inventory of archetypes (distinct solution-action-sequences) discovered from lecture material:
${archetypeList}

Here is a list of real tutorial questions:
${questionList}

For EACH question, decide: does solving it follow the SAME sequence of actions as ONE of the archetypes above (only values/context differ), or does it require a genuinely different sequence of actions not covered by any archetype above?

Format as JSON: { "results": [ { "questionIndex": number, "fits": boolean, "archetypeIndex": number|null, "reason": string } ] }
"archetypeIndex" must be the index of the single best-matching archetype if fits=true, else null. "reason" is one sentence. Include an entry for every question index.`;

  const output = await aiProvider.generateResponse(prompt, {
    systemPrompt: 'You are checking whether real exam-prep questions match a known inventory of solution-form archetypes. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 8000,
    extendedTimeouts: true,
    temperature: 0.2,
  });
  const parsed = parseJsonObject(output);
  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  return results.map((r: any) => ({
    questionIndex: Number(r?.questionIndex),
    fits: Boolean(r?.fits),
    archetypeIndex: r?.archetypeIndex === null || r?.archetypeIndex === undefined ? null : Number(r.archetypeIndex),
    reason: String(r?.reason || '').trim(),
  }));
}

function formatArchetype(a: Archetype): string {
  return [
    `**${a.canonicalStem.slice(0, 80)}${a.canonicalStem.length > 80 ? '...' : ''}**`,
    `- trigger: ${a.trigger}`,
    `- method: ${a.method}`,
    `- distinctBecause: ${a.distinctBecause}`,
    `- memberCount: ${a.memberCount}`,
    `- canonicalStem: ${a.canonicalStem}`,
  ].join('\n');
}

async function main() {
  console.log('Loading source materials (hold-out NOT read yet)...');
  const sources = await loadSourceMaterials();
  const chunks = buildChunks(sources);
  console.log(`Loaded ${sources.length} source materials -> ${chunks.length} chunks (size=${CHUNK_SIZE}, overlap=${CHUNK_OVERLAP}).\n`);

  const runResults: RunResult[] = [];

  for (let run = 0; run < NUM_RUNS; run += 1) {
    console.log(`=== Run ${run + 1}/${NUM_RUNS} ===`);
    console.log('  Step 1: extraction...');
    const { examples, countsPerChunk } = await runExtraction(chunks);
    console.log(`    -> ${examples.length} examples extracted across ${chunks.length} chunks.`);

    console.log('  Step 2: clustering...');
    const archetypes = await clusterExamples(examples);
    console.log(`    -> ${archetypes.length} archetypes.`);

    runResults.push({ chunks, examples, countsPerChunk, archetypes });
  }

  const measuringStability = NUM_RUNS > 1;
  let extractionStability: ReturnType<typeof computeExtractionStability> | null = null;
  let canonical: CanonicalArchetype[];
  let stableCount = 0;
  let stabilityScore: number | null = null;

  if (measuringStability) {
    console.log('\nComputing extraction stability (example-level, textual similarity)...');
    extractionStability = computeExtractionStability(runResults.map((r) => r.examples));
    console.log(
      `  ${extractionStability.foundInAllRuns} / ${extractionStability.totalDistinctExamples} distinct examples found in all ${NUM_RUNS} runs.`,
    );

    console.log(`\nCanonicalizing archetypes across the ${NUM_RUNS} runs...`);
    canonical = await canonicalizeArchetypesAcrossRuns(runResults.map((r) => r.archetypes));
    stableCount = canonical.filter((a) => new Set(a.foundInRuns).size >= NUM_RUNS).length;
    stabilityScore = canonical.length > 0 ? stableCount / canonical.length : 0;
    console.log(`  -> ${canonical.length} canonical archetypes; stabilityScore = ${stableCount}/${canonical.length} = ${stabilityScore.toFixed(3)}`);
  } else {
    console.log('\nSkipping cross-run stability (NUM_RUNS=1 — reduced scope due to confirmed quota exhaustion, see report).');
    canonical = runResults[0].archetypes.map((a) => ({
      trigger: a.trigger,
      method: a.method,
      distinctBecause: a.distinctBecause,
      canonicalStem: a.canonicalStem,
      foundInRuns: [1],
    }));
  }

  console.log('\nLoading hold-out material (MTH 102 TUTORIAL 2026) — first read of it in this run...');
  const holdoutContent = await loadHoldoutMaterial();

  console.log('Extracting tutorial questions...');
  const tutorialQuestions = await extractTutorialQuestions(holdoutContent);
  console.log(`  -> ${tutorialQuestions.length} questions.`);

  console.log('Checking fit against canonical archetypes...');
  const fitResults = await checkFit(canonical, tutorialQuestions);
  const fitCount = fitResults.filter((r) => r.fits).length;
  const coverageScore = tutorialQuestions.length > 0 ? fitCount / tutorialQuestions.length : 0;
  const uncovered = fitResults.filter((r) => !r.fits);
  const matchedIndices = new Set(fitResults.filter((r) => r.fits && r.archetypeIndex !== null).map((r) => r.archetypeIndex));
  const neverMatched = canonical.filter((_, i) => !matchedIndices.has(i));
  console.log(`  coverageScore = ${fitCount}/${tutorialQuestions.length} = ${coverageScore.toFixed(3)}`);

  const generatedAt = new Date().toISOString();
  const md = [
    '# Archetype Extraction Experiment v2 — MTH 102',
    '',
    `Captured ${generatedAt}. Standalone experiment, not wired into any job/queue. No database writes.`,
    '',
    '## Methodology',
    '',
    '- **Step 0 quota check — corrected.** A single test call to the configured primary Gemini model initially succeeded with `usageMetadata.serviceTier: "standard"`, which was read as "billing is active, the 20/day free-tier cap no longer applies." That was wrong: a subsequent full attempt at this experiment hit repeated `429` errors mid-run with the exact same `GenerateRequestsPerDayPerProjectPerModel-FreeTier` quota (`quotaValue: "20"`) from an earlier session today. The single successful test call does not reliably indicate remaining daily quota — treat "the primary model answered once" as no signal at all about whether it will keep answering.',
    `- **Scope reduced to ${NUM_RUNS} run** (from the original design's 3) as a direct consequence: the full 3-run design needs ~39 model calls against a confirmed hard 20/day cap on the primary model. extractionStability and stabilityScore are therefore ${measuringStability ? 'measured as designed' : 'NOT measured this run — see Step 3'}.`,
    `- Source (read for extraction/clustering ONLY): ${SOURCE_TITLES.map((t) => `"${t}"`).join(', ')}.`,
    `- Held out (never read until the hold-out phase): "${HOLDOUT_TITLE}".`,
    '- No AI-generated Question rows or GeneratedTextbookSection content were read anywhere in this experiment.',
    `- Each source document was chunked into ~${CHUNK_SIZE}-char windows with ~${CHUNK_OVERLAP}-char overlap, producing ${chunks.length} chunks total. Every chunk was processed — none sampled or truncated.`,
    `- Step 1 (extraction) batches ${CHUNKS_PER_EXTRACTION_CALL} chunks per API call for cost/quota reasons; every chunk still gets its own dedicated slot in every batch's prompt and response, none are skipped.`,
    '- Step 1 explicitly forbids interpretation/generalization: verbatim problemText + solutionSteps only.',
    '- Step 2 clusters that flat list into archetypes by strict solution-action-sequence equality (power/product/quotient/chain rule kept as separate archetypes, per instruction).',
    `- Ran Steps 1+2 ${NUM_RUNS} time(s), temperature=${TEMPERATURE}.`,
    measuringStability
      ? `- extractionStability (are the same real examples found run to run) was computed by direct word-overlap similarity (Jaccard >= ${SIMILARITY_THRESHOLD}) between extracted problemText strings — a deterministic, non-LLM check, since these are meant to be verbatim extractions of the same source text rather than freeform descriptions.`
      : '- extractionStability was not computed (only 1 run — nothing to compare across runs).',
    measuringStability
      ? '- stabilityScore (archetype-level) still required an LLM matching pass across runs (temperature 0.2, same strict non-merge rule), since archetype trigger/method wording is freeform even when the underlying examples are identical.'
      : '- stabilityScore was not computed (only 1 run — nothing to compare across runs). The "canonical archetypes" below are simply this single run\'s Step 2 output.',
    '',
    '## Step 1 — extraction counts',
    '',
    ...runResults.flatMap((r, i) => [
      `### Run ${i + 1}: ${r.examples.length} examples across ${chunks.length} chunks`,
      '',
      '| Chunk | Examples found |',
      '|---|---|',
      ...chunks.map((c) => `| ${c.chunkId} | ${r.countsPerChunk[c.chunkId] ?? 0} |`),
      '',
    ]),
    '## Step 2 — archetypes per run',
    '',
    ...runResults.flatMap((r, i) => [`### Run ${i + 1} (${r.archetypes.length} archetypes)`, '', ...r.archetypes.map((a) => formatArchetype(a)), '']),
    '## Step 3 — stability',
    '',
    measuringStability && extractionStability
      ? [
          `### extractionStability (do the ${NUM_RUNS} runs find the same real examples?)`,
          '',
          `${extractionStability.foundInAllRuns} / ${extractionStability.totalDistinctExamples} distinct examples (by textual similarity) were found in all ${NUM_RUNS} runs.`,
          '',
          '| Representative example (first occurrence) | Found in runs |',
          '|---|---|',
          ...extractionStability.groups.map(
            (g) => `| ${g.representative.replace(/\|/g, '/').slice(0, 100)}${g.representative.length > 100 ? '...' : ''} | [${[...g.foundInRuns].map((n) => n + 1).join(', ')}] |`,
          ),
          '',
          '### stabilityScore (archetype-level)',
          '',
          `**stabilityScore = ${stableCount} / ${canonical.length} = ${(stabilityScore ?? 0).toFixed(3)}**`,
          '',
          '(canonical archetypes appearing in all runs / total distinct canonical archetypes)',
          '',
          ...canonical.map(
            (a, i) =>
              `${i}. **${a.canonicalStem.slice(0, 80)}${a.canonicalStem.length > 80 ? '...' : ''}**\n- trigger: ${a.trigger}\n- method: ${a.method}\n- distinctBecause: ${a.distinctBecause}\n- foundInRuns: [${a.foundInRuns.join(', ')}]${new Set(a.foundInRuns).size >= NUM_RUNS ? ' — STABLE' : ' — UNSTABLE'}\n`,
          ),
        ].join('\n')
      : [
          '**Not measured this run.** Scope was reduced to 1 run (see Methodology) after confirming the primary model\'s 20/day quota was already exhausted partway through a prior attempt today — with only one run, there is nothing to compare across runs. The archetypes below are this single run\'s Step 2 output, used as-is for the hold-out test.',
          '',
          '### Archetypes found (single run — not cross-validated)',
          '',
          ...canonical.map((a, i) => `${i}. **${a.canonicalStem.slice(0, 80)}${a.canonicalStem.length > 80 ? '...' : ''}**\n- trigger: ${a.trigger}\n- method: ${a.method}\n- distinctBecause: ${a.distinctBecause}\n`),
        ].join('\n'),
    '## Step 4 — hold-out test (MTH 102 TUTORIAL 2026)',
    '',
    `${tutorialQuestions.length} worked examples/exercise questions extracted from the hold-out document.`,
    '',
    `**coverageScore = ${fitCount} / ${tutorialQuestions.length} = ${coverageScore.toFixed(3)}**`,
    '',
    '### Tutorial questions that fit NO archetype',
    '',
    uncovered.length > 0
      ? uncovered.map((r) => `- Q${r.questionIndex}: "${tutorialQuestions[r.questionIndex]?.questionText || '(unknown)'}"\n  - reason: ${r.reason}`).join('\n')
      : '_None — every tutorial question fit a canonical archetype._',
    '',
    '### Canonical archetypes absent from the tutorial',
    '',
    neverMatched.length > 0
      ? neverMatched.map((a) => `- "${a.trigger}"`).join('\n')
      : '_None — every canonical archetype was matched by at least one tutorial question._',
    '',
    '### Full per-question fit results',
    '',
    ...fitResults.map((r) => {
      const q = tutorialQuestions[r.questionIndex];
      const label = r.fits && r.archetypeIndex !== null ? `archetype #${r.archetypeIndex}` : 'no match';
      return `- Q${r.questionIndex} (${r.fits ? 'FIT' : 'NO FIT'} — ${label}): "${q?.questionText?.slice(0, 150) || '(unknown)'}"\n  - ${r.reason}`;
    }),
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, md, 'utf-8');
  console.log(`\nWrote report to ${OUTPUT_PATH}`);

  console.log('\n=== Summary ===');
  console.log(
    JSON.stringify(
      {
        chunkCount: chunks.length,
        perRunExampleCounts: runResults.map((r) => r.examples.length),
        perRunArchetypeCounts: runResults.map((r) => r.archetypes.length),
        extractionStability: extractionStability
          ? { totalDistinct: extractionStability.totalDistinctExamples, foundInAllRuns: extractionStability.foundInAllRuns }
          : 'not measured (1 run)',
        canonicalArchetypeCount: canonical.length,
        stableArchetypeCount: measuringStability ? stableCount : 'n/a',
        stabilityScore: stabilityScore !== null ? Number(stabilityScore.toFixed(3)) : 'not measured (1 run)',
        tutorialQuestionCount: tutorialQuestions.length,
        coverageScore: Number(coverageScore.toFixed(3)),
        uncoveredCount: uncovered.length,
        neverMatchedArchetypeCount: neverMatched.length,
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

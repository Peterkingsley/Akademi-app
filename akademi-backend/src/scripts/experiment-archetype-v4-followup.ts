// STANDALONE EXPERIMENT (v4 follow-up) — not wired into any job, queue, or JOB_NAMES entry. Run
// manually via `npx tsx src/scripts/experiment-archetype-v4-followup.ts`. Read-only against the
// database (in fact makes no DB calls at all — everything needed already lives in
// docs/mth102-labels-v3.json, docs/mth102-operation-vocabulary.json, and
// docs/archetype-experiment-mth102-v4.md). Appends its findings to the v4 report; writes nothing
// else.
//
// Two independent investigations into v4's results:
//   A. Audit the 178 examples whose discriminating-only signature came out empty. Sample 30 of the
//      162 distinct v3 archetypes that produced an empty signature (each backed by 1+ real
//      examples; canonicalStem is a real verbatim member problemText) and classify each as TRIVIAL
//      (no distinctive technique) or MISLABELLED (a real technique got recorded as a GENERIC
//      vocabulary entry instead of DISCRIMINATING). Uses the model — batched, paced.
//   B. Recompute Step 3's hold-out matching three ways — exact ordered signature (baseline),
//      set match (order-insensitive), and subset match — entirely from cached/already-reported
//      data. Zero AI calls.

import fs from 'fs';
import path from 'path';
import { aiProvider } from '../modules/ai/ai.provider';

const LABELS_V3_CACHE_PATH = path.join(__dirname, '../../../docs/mth102-labels-v3.json');
const VOCAB_PATH = path.join(__dirname, '../../../docs/mth102-operation-vocabulary.json');
const V4_REPORT_PATH = path.join(__dirname, '../../../docs/archetype-experiment-mth102-v4.md');

const CLASSIFY_BATCH_SIZE = 5;
const MIN_MS_BETWEEN_CALLS = 4500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const SAMPLE_SIZE = 30;
const CLASSIFY_TEMPERATURE = 0.2;

type V3Archetype = { signature: string; memberCount: number; canonicalStem: string };
type Classification = 'DISCRIMINATING' | 'GENERIC';
type VocabEntry = { name: string; classification: Classification; aliases: string[] };
type V4Archetype = { signature: string; memberCount: number; canonicalStem: string };
type ModelUsage = Record<string, Record<string, number>>;
type HoldoutQuestion = { index: number; fit: boolean; unmapped: number; text: string; signature: string };

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

function loadV3Archetypes(): V3Archetype[] {
  const parsed = JSON.parse(fs.readFileSync(LABELS_V3_CACHE_PATH, 'utf-8'));
  return parsed.archetypes;
}

function loadVocabulary(): VocabEntry[] {
  const parsed = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf-8'));
  return parsed.entries;
}

function buildMapping(vocabEntries: VocabEntry[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const e of vocabEntries) for (const alias of e.aliases) mapping[alias] = e.name;
  return mapping;
}

function tokens(sig: string): string[] {
  return sig ? sig.split(' -> ').map((s) => s.trim()).filter(Boolean) : [];
}

function discSignatureForRaw(rawSignature: string, mapping: Record<string, string>, vocabByName: Map<string, VocabEntry>): string {
  const rawLabels = tokens(rawSignature);
  const disc = rawLabels
    .map((l) => mapping[l])
    .filter((n): n is string => Boolean(n))
    .filter((n) => vocabByName.get(n)?.classification === 'DISCRIMINATING');
  return disc.join(' -> ');
}

function buildV4Archetypes(v3Archetypes: V3Archetype[], mapping: Record<string, string>, vocabByName: Map<string, VocabEntry>): V4Archetype[] {
  const groups = new Map<string, { memberCount: number; canonicalStem: string }>();
  for (const a of v3Archetypes) {
    const signature = discSignatureForRaw(a.signature, mapping, vocabByName);
    if (!groups.has(signature)) groups.set(signature, { memberCount: 0, canonicalStem: a.canonicalStem });
    const g = groups.get(signature)!;
    g.memberCount += a.memberCount;
    if (a.canonicalStem.length > 0 && (g.canonicalStem.length === 0 || a.canonicalStem.length < g.canonicalStem.length)) g.canonicalStem = a.canonicalStem;
  }
  return Array.from(groups.entries())
    .map(([signature, g]) => ({ signature, memberCount: g.memberCount, canonicalStem: g.canonicalStem }))
    .sort((a, b) => b.memberCount - a.memberCount);
}

function parseHoldoutQuestions(): HoldoutQuestion[] {
  const md = fs.readFileSync(V4_REPORT_PATH, 'utf-8');
  const lines = md.split('\n');
  const startIdx = lines.findIndex((l) => l.startsWith('### Full per-question results'));
  if (startIdx < 0) throw new Error('Could not find "### Full per-question results" in the v4 report');
  const headerRe = /^- Q(\d+) \((FIT|NO FIT), (\d+) UNMAPPED\): "(.*)"$/;
  const sigRe = /^\s*- signature: `(.*)`$/;
  const results: HoldoutQuestion[] = [];
  for (let i = startIdx; i < lines.length; i += 1) {
    const m = lines[i].match(headerRe);
    if (!m) continue;
    const sigMatch = lines[i + 1]?.match(sigRe);
    const sigRaw = sigMatch ? sigMatch[1] : '';
    results.push({
      index: Number(m[1]),
      fit: m[2] === 'FIT',
      unmapped: Number(m[3]),
      text: m[4],
      signature: sigRaw === '(empty)' ? '' : sigRaw,
    });
  }
  return results;
}

// ─── Part A: audit empty-signature examples ────────────────────────────────────────────────────
function shuffleSample<T>(items: T[], n: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

type ClassifyResult = { index: number; classification: 'TRIVIAL' | 'MISLABELLED'; technique: string | null; wronglyAbsorbedBy: string | null };

async function classifyBatch(
  batch: Array<{ index: number; problemText: string }>,
  genericNames: string[],
  usage: ModelUsage,
): Promise<ClassifyResult[]> {
  const prompt = `For each problem statement below, classify it as:
- TRIVIAL: the problem genuinely requires no distinctive technique beyond generic bookkeeping (e.g. "lim x->2 of x^2+1": substitute and evaluate, nothing else).
- MISLABELLED: the problem DOES require a distinctive technique (a specific rule or method that identifies its solution form), but that technique was recorded as a GENERIC bookkeeping operation instead of being recognized as distinctive.

Here are the GENERIC vocabulary entries currently in use (bookkeeping operations, not technique-identifying):
${genericNames.join(', ')}

For MISLABELLED cases, name the specific technique that should have been DISCRIMINATING, and say which GENERIC entry above wrongly absorbed it (pick the one from the list that's the closest fit).

PROBLEMS:
${batch.map((p) => `${p.index}. ${p.problemText}`).join('\n\n')}

Format as JSON: { "results": [ { "index": number, "classification": "TRIVIAL" | "MISLABELLED", "technique": string | null, "wronglyAbsorbedBy": string | null } ] }
"technique" and "wronglyAbsorbedBy" must be null for TRIVIAL cases. Include an entry for every index above.`;

  const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
    systemPrompt:
      'You audit whether a math problem genuinely needs no distinctive solution technique, or whether a real technique was mislabeled as generic bookkeeping. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 2500,
    extendedTimeouts: true,
    temperature: CLASSIFY_TEMPERATURE,
  });
  recordUsage(usage, 'partA-classify', model);

  const parsed = parseJsonObject(text);
  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  return results.map((r: any) => ({
    index: Number(r?.index),
    classification: r?.classification === 'MISLABELLED' ? 'MISLABELLED' : 'TRIVIAL',
    technique: r?.technique ? String(r.technique).trim() : null,
    wronglyAbsorbedBy: r?.wronglyAbsorbedBy ? String(r.wronglyAbsorbedBy).trim() : null,
  }));
}

async function runPartA(v3Archetypes: V3Archetype[], mapping: Record<string, string>, vocabByName: Map<string, VocabEntry>, usage: ModelUsage) {
  const emptyArchetypes = v3Archetypes.filter((a) => discSignatureForRaw(a.signature, mapping, vocabByName) === '');
  const totalExamples = emptyArchetypes.reduce((sum, a) => sum + a.memberCount, 0);
  console.log(`Found ${emptyArchetypes.length} distinct v3 archetypes with an empty discriminating signature, covering ${totalExamples} examples.`);

  const sample = shuffleSample(emptyArchetypes, Math.min(SAMPLE_SIZE, emptyArchetypes.length));
  const genericNames = Array.from(vocabByName.values()).filter((e) => e.classification === 'GENERIC').map((e) => e.name);

  const classified: Array<ClassifyResult & { canonicalStem: string; v3Signature: string; memberCount: number }> = [];
  for (let i = 0; i < sample.length; i += CLASSIFY_BATCH_SIZE) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const batch = sample.slice(i, i + CLASSIFY_BATCH_SIZE).map((a, j) => ({ index: i + j, problemText: a.canonicalStem }));
    console.log(`  classifying ${i + 1}-${Math.min(i + batch.length, sample.length)} of ${sample.length}...`);
    const results = await classifyBatch(batch, genericNames, usage);
    for (const r of results) {
      const src = sample[r.index];
      classified.push({ ...r, canonicalStem: src.canonicalStem, v3Signature: src.signature, memberCount: src.memberCount });
    }
  }

  const trivialCount = classified.filter((c) => c.classification === 'TRIVIAL').length;
  const mislabelledCount = classified.filter((c) => c.classification === 'MISLABELLED').length;
  const mislabelledEntries = new Set(classified.filter((c) => c.classification === 'MISLABELLED' && c.wronglyAbsorbedBy).map((c) => c.wronglyAbsorbedBy as string));

  return { emptyArchetypeCount: emptyArchetypes.length, totalExamplesCovered: totalExamples, sampleSize: sample.length, classified, trivialCount, mislabelledCount, mislabelledEntries: Array.from(mislabelledEntries) };
}

// ─── Part B: order-tolerant matching, zero AI calls ────────────────────────────────────────────
function matchExact(qSig: string, archetypes: V4Archetype[]): V4Archetype[] {
  if (!qSig) return [];
  return archetypes.filter((a) => a.signature !== '' && a.signature === qSig);
}

function matchSet(qSig: string, archetypes: V4Archetype[]): V4Archetype[] {
  if (!qSig) return [];
  const qSet = new Set(tokens(qSig));
  return archetypes.filter((a) => {
    if (!a.signature) return false;
    const aSet = new Set(tokens(a.signature));
    if (aSet.size !== qSet.size) return false;
    for (const t of qSet) if (!aSet.has(t)) return false;
    return true;
  });
}

function matchSubset(qSig: string, archetypes: V4Archetype[]): V4Archetype[] {
  if (!qSig) return [];
  const qSet = new Set(tokens(qSig));
  return archetypes.filter((a) => {
    if (!a.signature) return false;
    const aSet = new Set(tokens(a.signature));
    const qSubA = [...qSet].every((t) => aSet.has(t));
    const aSubQ = [...aSet].every((t) => qSet.has(t));
    return qSubA || aSubQ;
  });
}

function countDistinctGroupsExact(items: HoldoutQuestion[]): number {
  const keys = items.map((it) => (it.signature === '' ? `__empty_${it.index}` : it.signature));
  return new Set(keys).size;
}

function countDistinctGroupsSet(items: HoldoutQuestion[]): number {
  const keys = items.map((it) => (it.signature === '' ? `__empty_${it.index}` : Array.from(new Set(tokens(it.signature))).sort().join('|')));
  return new Set(keys).size;
}

function countDistinctGroupsSubset(items: HoldoutQuestion[]): number {
  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let i = 0; i < n; i += 1) {
    if (!items[i].signature) continue;
    const si = new Set(tokens(items[i].signature));
    for (let j = i + 1; j < n; j += 1) {
      if (!items[j].signature) continue;
      const sj = new Set(tokens(items[j].signature));
      const subIJ = [...si].every((t) => sj.has(t));
      const subJI = [...sj].every((t) => si.has(t));
      if (subIJ || subJI) union(i, j);
    }
  }
  const roots = new Set<number>();
  for (let i = 0; i < n; i += 1) roots.add(items[i].signature ? find(i) : -1000 - i);
  return roots.size;
}

function runStrategy(
  name: string,
  matchFn: (qSig: string, archetypes: V4Archetype[]) => V4Archetype[],
  groupCountFn: (items: HoldoutQuestion[]) => number,
  questions: HoldoutQuestion[],
  archetypes: V4Archetype[],
  differentiationQuestions: HoldoutQuestion[],
) {
  const results = questions.map((q) => ({ ...q, matches: matchFn(q.signature, archetypes) }));
  const fitCount = results.filter((r) => r.matches.length > 0).length;
  const coverageScore = fitCount / questions.length;
  const differentiationSplitCount = groupCountFn(differentiationQuestions);
  return { name, results, fitCount, coverageScore, differentiationSplitCount };
}

async function main() {
  const usage: ModelUsage = {};

  console.log('Loading cached v3 archetypes + frozen vocabulary...');
  const v3Archetypes = loadV3Archetypes();
  const vocabEntries = loadVocabulary();
  const mapping = buildMapping(vocabEntries);
  const vocabByName = new Map(vocabEntries.map((e) => [e.name, e]));
  const v4Archetypes = buildV4Archetypes(v3Archetypes, mapping, vocabByName);
  console.log(`${v3Archetypes.length} v3 archetypes -> ${v4Archetypes.length} v4 archetypes (rebuilt, no AI call).`);

  console.log('\n=== Part A: empty-signature audit ===');
  const partA = await runPartA(v3Archetypes, mapping, vocabByName, usage);
  console.log(`Sampled ${partA.sampleSize} of ${partA.emptyArchetypeCount} distinct empty-signature archetypes.`);
  console.log(`TRIVIAL: ${partA.trivialCount}, MISLABELLED: ${partA.mislabelledCount}`);

  console.log('\n=== Part B: order-tolerant matching ===');
  const holdoutQuestions = parseHoldoutQuestions();
  const nonEmptyArchetypes = v4Archetypes.filter((a) => a.signature !== '');
  const differentiationRe = /power rule|chain rule|product rule|quotient rule|dy\/dx|derivative/i;
  const differentiationQuestions = holdoutQuestions.filter((q) => differentiationRe.test(q.text));
  console.log(`${holdoutQuestions.length} hold-out questions parsed from the v4 report. ${differentiationQuestions.length} differentiation-related.`);

  const strategy1 = runStrategy('exact ordered signature match', matchExact, countDistinctGroupsExact, holdoutQuestions, nonEmptyArchetypes, differentiationQuestions);
  const strategy2 = runStrategy('set match (order ignored)', matchSet, countDistinctGroupsSet, holdoutQuestions, nonEmptyArchetypes, differentiationQuestions);
  const strategy3 = runStrategy('subset match', matchSubset, countDistinctGroupsSubset, holdoutQuestions, nonEmptyArchetypes, differentiationQuestions);

  for (const s of [strategy1, strategy2, strategy3]) {
    console.log(`  ${s.name}: coverageScore = ${s.fitCount}/${holdoutQuestions.length} = ${s.coverageScore.toFixed(3)}, differentiation split = ${s.differentiationSplitCount}`);
  }

  const q31 = holdoutQuestions.find((q) => q.index === 31);
  const q31Set = q31 ? matchSet(q31.signature, nonEmptyArchetypes) : [];
  const q31Subset = q31 ? matchSubset(q31.signature, nonEmptyArchetypes) : [];
  console.log(`  Q31 under set match: ${q31Set.length > 0 ? 'FIT' : 'NO FIT'}; under subset match: ${q31Subset.length > 0 ? 'FIT' : 'NO FIT'}`);

  // ─── Append to the v4 report ────────────────────────────────────────────────────────────────
  const generatedAt = new Date().toISOString();
  const usageLines = Object.entries(usage).flatMap(([phase, models]) => Object.entries(models).map(([model, count]) => `  - ${phase}: ${model} x${count}`));

  const partAmd = [
    '',
    '## Follow-up A — empty-signature audit',
    '',
    `Captured ${generatedAt}.`,
    '',
    `${partA.emptyArchetypeCount} distinct v3 archetypes produced an empty discriminating-only signature, covering ${partA.totalExamplesCovered} of the 356 cached examples. Per-example sampling isn't possible — v3 never persisted per-example labels (see Step 0's methodology note), so this audit samples ${partA.sampleSize} of the **${partA.emptyArchetypeCount} distinct archetypes** (each backed by a real, verbatim member problemText as its canonicalStem) rather than ${SAMPLE_SIZE} of the 178 raw examples.`,
    '',
    `**Split: ${partA.trivialCount} TRIVIAL, ${partA.mislabelledCount} MISLABELLED** (of ${partA.sampleSize} sampled).`,
    '',
    '### Vocabulary entries implicated in MISLABELLED cases',
    '',
    partA.mislabelledEntries.length > 0 ? partA.mislabelledEntries.map((e) => `- \`${e}\``).join('\n') : '_None — no MISLABELLED cases in the sample._',
    '',
    '### Full sample',
    '',
    ...partA.classified.map(
      (c) =>
        `- [${c.classification}] "${c.canonicalStem.slice(0, 150)}"${
          c.classification === 'MISLABELLED' ? `\n  - technique: ${c.technique}\n  - wrongly absorbed by: \`${c.wronglyAbsorbedBy}\`` : ''
        }`,
    ),
    '',
    '### Model usage (Part A)',
    '',
    ...usageLines,
    '',
  ].join('\n');

  const strategySection = (s: typeof strategy1) => [
    `### ${s.name}`,
    '',
    `**coverageScore = ${s.fitCount} / ${holdoutQuestions.length} = ${s.coverageScore.toFixed(3)}**`,
    '',
    `Differentiation split: **${s.differentiationSplitCount}** distinct group(s) among ${differentiationQuestions.length} differentiation-related questions.`,
    '',
  ].join('\n');

  const partBmd = [
    '',
    '## Follow-up B — order-tolerant matching',
    '',
    `Captured ${generatedAt}. Recomputed entirely from cached data (\`${path.relative(path.join(__dirname, '../../..'), LABELS_V3_CACHE_PATH)}\`, \`${path.relative(path.join(__dirname, '../../..'), VOCAB_PATH)}\`, and this report's own Step 3 per-question signatures). Zero AI calls.`,
    '',
    '- **Exact ordered signature match**: the Step 3 baseline — two examples are the same archetype only if their discriminating-only label sequences are identical, in order.',
    '- **Set match**: order-insensitive — same set of discriminating operations, any order.',
    '- **Subset match**: a question fits an archetype if its operation set is a subset of the archetype\'s, or vice versa.',
    '- An empty discriminating-only signature never counts as a meaningful match under any strategy (an empty set is trivially a subset of everything, which would otherwise let every "no distinctive technique" question falsely match every archetype) — and for the differentiation-split counts, an empty-signature question is always its own isolated group rather than merging with other empty-signature questions or anything else, under all three strategies.',
    '',
    strategySection(strategy1),
    strategySection(strategy2),
    strategySection(strategy3),
    '### Q31 (sin^2 x)',
    '',
    `- signature: \`${q31?.signature || '(empty)'}\``,
    `- exact ordered match: ${q31 && matchExact(q31.signature, nonEmptyArchetypes).length > 0 ? 'FIT' : 'NO FIT'}`,
    `- set match: ${q31Set.length > 0 ? `FIT (${q31Set.map((a) => `\`${a.signature}\``).join(', ')})` : 'NO FIT'}`,
    `- subset match: ${q31Subset.length > 0 ? `FIT (${q31Subset.map((a) => `\`${a.signature}\``).join(', ')})` : 'NO FIT'}`,
    '',
  ].join('\n');

  fs.appendFileSync(V4_REPORT_PATH, partAmd + partBmd, 'utf-8');
  console.log(`\nAppended Follow-up A and B to ${V4_REPORT_PATH}`);

  console.log('\n=== Summary ===');
  console.log(
    JSON.stringify(
      {
        partA: {
          emptyArchetypeCount: partA.emptyArchetypeCount,
          totalExamplesCovered: partA.totalExamplesCovered,
          sampleSize: partA.sampleSize,
          trivialCount: partA.trivialCount,
          mislabelledCount: partA.mislabelledCount,
          mislabelledEntries: partA.mislabelledEntries,
        },
        partB: {
          holdoutQuestionCount: holdoutQuestions.length,
          differentiationQuestionCount: differentiationQuestions.length,
          strategies: [strategy1, strategy2, strategy3].map((s) => ({ name: s.name, coverageScore: Number(s.coverageScore.toFixed(3)), differentiationSplitCount: s.differentiationSplitCount })),
          q31: { signature: q31?.signature || '(empty)', setMatch: q31Set.length > 0, subsetMatch: q31Subset.length > 0 },
        },
        modelUsage: usage,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

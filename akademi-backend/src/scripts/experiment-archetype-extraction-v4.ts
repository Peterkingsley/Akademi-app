// STANDALONE EXPERIMENT (v4) — not wired into any job, queue, or JOB_NAMES entry. Run manually via
// `npx tsx src/scripts/experiment-archetype-extraction-v4.ts` (add `--run-full` to execute Steps
// 1-3 after reviewing the call-volume estimate). Read-only against the database; writes nothing to
// it (only the report + two new local cache files, all on local disk).
//
// v3's failure mode: exact FULL-signature string matching (every labeled step, including
// bookkeeping/arithmetic steps) is brittle to step-labeling granularity differences between the
// original extraction-labeling pass and a fresh hold-out solve-and-label pass — two examples using
// the identical technique produced different signatures because one pass split a step the other
// pass merged. v4 fixes this by dropping GENERIC bookkeeping operations from the signature entirely:
//   Step 0: reuse everything cached from v3 (no re-extraction, no re-labeling of the 356 examples).
//           v3 never persisted its per-example labels to disk — only the final archetype-level
//           aggregates (signature/memberCount/canonicalStem) survive, in the v3 markdown report.
//           That reconstruction is the "cache" for this step; see the note field in its output file.
//   Step 1 (model): collapse v3's canonical labels into a CLOSED, FROZEN vocabulary of ~40-80
//                    operations, each tagged DISCRIMINATING (identifies the solution form) or
//                    GENERIC (bookkeeping that recurs across many forms).
//   Step 2 (NO model): rebuild every archetype's signature using ONLY its DISCRIMINATING operations
//                    (GENERIC ones dropped), then regroup by exact match on that shorter signature.
//   Step 3 (model, constrained): label the held-out tutorial's steps using ONLY the frozen
//                    vocabulary (or "UNMAPPED"), build discriminating-only signatures the same way,
//                    and exact-match against Step 2's archetypes.
//
// Input discipline (unchanged from v1-v3):
//   - No re-extraction and no re-labeling of the 356 cached examples — Steps 1-2 work entirely from
//     v3's already-produced aggregates.
//   - "MTH 102 TUTORIAL 2026" is read fresh in Step 3 (this IS the designated hold-out phase).
//   - No AI-generated Question rows or GeneratedTextbookSection content are read anywhere here.

import fs from 'fs';
import path from 'path';
import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';

const HOLDOUT_TITLE = 'MTH 102 TUTORIAL 2026';
const COURSE_CODE = 'MTH 102';
const LABEL_BATCH_SIZE = 5; // hard cap per instruction — never exceed this
// Confirmed in v3: the fallback model has a 15-requests/minute cap that the labeling loop blows
// past without an explicit delay, since each call is small and fast.
const MIN_MS_BETWEEN_CALLS = 4500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const VOCAB_CHUNK_SIZE = 40;
const VOCAB_TARGET_MIN = 40;
const VOCAB_TARGET_MAX = 80;
const VOCAB_TEMPERATURE = 0.2;
const HOLDOUT_LABEL_TEMPERATURE = 0.2;

const V3_REPORT_PATH = path.join(__dirname, '../../../docs/archetype-experiment-mth102-v3.md');
const LABELS_V3_CACHE_PATH = path.join(__dirname, '../../../docs/mth102-labels-v3.json');
const VOCAB_PATH = path.join(__dirname, '../../../docs/mth102-operation-vocabulary.json');
const OUTPUT_PATH = path.join(__dirname, '../../../docs/archetype-experiment-mth102-v4.md');

type V3Archetype = { signature: string; memberCount: number; canonicalStem: string };
type Classification = 'DISCRIMINATING' | 'GENERIC';
type VocabEntry = { name: string; classification: Classification; aliases: string[] };
type V4Archetype = { signature: string; memberCount: number; canonicalStem: string; sourceArchetypeSignatures: string[] };
type ModelUsage = Record<string, Record<string, number>>;

function recordUsage(usage: ModelUsage, phase: string, model: string) {
  usage[phase] = usage[phase] || {};
  usage[phase][model] = (usage[phase][model] || 0) + 1;
}

// ─── shared JSON-repair helpers (unchanged from v2/v3 — LLM output routinely contains raw LaTeX
// backslashes that break naive JSON.parse) ──────────────────────────────────────────────────────
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

// ─── Step 0: reconstruct v3's per-archetype labels from its markdown report, cache to disk ────────
function parseV3Archetypes(): V3Archetype[] {
  const md = fs.readFileSync(V3_REPORT_PATH, 'utf-8');
  const lines = md.split('\n');
  const startIdx = lines.findIndex((l) => l.startsWith('## Step 1-3'));
  const endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith('## Step 4'));
  if (startIdx < 0 || endIdx < 0) throw new Error('Could not locate the Step 1-3 archetype section in the v3 report');
  const section = lines.slice(startIdx, endIdx);

  const headerRe = /^- \*\*\[memberCount=(\d+)\]\*\* `(.*)`$/;
  const archetypes: V3Archetype[] = [];
  let current: { signature: string; memberCount: number; stemLines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const stemText = current.stemLines.join('\n').replace(/^\s*-\s*canonicalStem:\s*/, '').trim();
    archetypes.push({ signature: current.signature, memberCount: current.memberCount, canonicalStem: stemText });
  };

  for (const line of section) {
    const m = line.match(headerRe);
    if (m) {
      flush();
      current = { signature: m[2], memberCount: Number(m[1]), stemLines: [] };
      continue;
    }
    if (current) current.stemLines.push(line);
  }
  flush();
  return archetypes;
}

function getOrCreateV3LabelsCache(): { archetypes: V3Archetype[]; alreadyCached: boolean } {
  if (fs.existsSync(LABELS_V3_CACHE_PATH)) {
    console.log(`Loading cached v3 archetype data from ${LABELS_V3_CACHE_PATH} (Step 0 skipped).`);
    const parsed = JSON.parse(fs.readFileSync(LABELS_V3_CACHE_PATH, 'utf-8'));
    return { archetypes: parsed.archetypes, alreadyCached: true };
  }

  console.log('No v4 label cache found. Reconstructing v3 archetype data from its markdown report...');
  const archetypes = parseV3Archetypes();
  const payload = {
    note:
      'v3 never persisted raw per-example action labels to disk — only this script\'s final markdown report survived, which records archetype-level aggregates (every example already grouped into its exact-signature archetype). Each entry below is one v3 archetype, not one example: "signature" is the full ordered label sequence shared by every member, "memberCount" is how many of the 356 cached examples share it, and "canonicalStem" is the shortest member problemText. This is mathematically sufficient input for v4 Steps 1-2 (vocabulary consolidation and discriminating-only regrouping), which only need to know each distinct full signature and how many examples carry it — it does not give exampleId-level granularity beyond that.',
    sourceReport: path.relative(path.join(__dirname, '../../..'), V3_REPORT_PATH),
    archetypeCount: archetypes.length,
    totalExamplesCovered: archetypes.reduce((sum, a) => sum + a.memberCount, 0),
    archetypes,
  };
  fs.mkdirSync(path.dirname(LABELS_V3_CACHE_PATH), { recursive: true });
  fs.writeFileSync(LABELS_V3_CACHE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Cached ${archetypes.length} v3 archetypes (covering ${payload.totalExamplesCovered} examples) to ${LABELS_V3_CACHE_PATH}.`);
  return { archetypes, alreadyCached: false };
}

function distinctV3Labels(archetypes: V3Archetype[]): string[] {
  const set = new Set<string>();
  for (const a of archetypes) {
    if (!a.signature) continue;
    for (const label of a.signature.split(' -> ')) {
      const trimmed = label.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return Array.from(set).sort();
}

// ─── Step 1: closed, frozen, DISCRIMINATING/GENERIC vocabulary ─────────────────────────────────────
async function vocabChunkCall(items: string[], usage: ModelUsage, phase: string, extraInstruction: string): Promise<VocabEntry[]> {
  const prompt = `Below is a list of operation labels used to describe individual steps in worked math solutions.

Consolidate these into a small set of canonical OPERATION entries. Merge two labels ONLY if they name the IDENTICAL operation in different words (e.g. "apply the power rule" and "use power rule" merge; "apply power rule" and "apply chain rule" must NEVER merge — different operations; "factor numerator" and "factor denominator" must NEVER merge — they act on different things). If in doubt, do NOT merge.

For each canonical entry, classify it as one of:
- DISCRIMINATING: an operation that, by itself, tells you what KIND of problem or solution technique this is (examples: "apply chain rule", "apply L'Hopital's rule", "apply quotient rule", "factor and cancel common factors", "apply integration by parts", "compute cartesian product", "apply signum definition"). If this operation is present, you know something specific about which technique is being used.
- GENERIC: bookkeeping or arithmetic operations that occur across many different problem types and do NOT by themselves indicate the technique (examples: "simplify expression", "substitute value", "arithmetic evaluation", "combine like terms", "evaluate expression", "compare values", "add terms").
${extraInstruction}
LABELS:
${items.map((l, i) => `${i}. ${l}`).join('\n')}

Format as JSON: { "entries": [ { "name": string, "classification": "DISCRIMINATING" | "GENERIC", "aliases": string[] } ] }
"aliases" must list every label above that maps to this entry (a label with no synonyms still lists itself as its only alias). Every label above must appear in exactly one entry's aliases — do not drop any.`;

  const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
    systemPrompt:
      'You are a strict vocabulary consolidator. You merge only exact-same-operation synonyms and classify each surviving operation as DISCRIMINATING or GENERIC. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 4000,
    extendedTimeouts: true,
    temperature: VOCAB_TEMPERATURE,
  });
  recordUsage(usage, phase, model);

  const parsed = parseJsonObject(text);
  const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  return entries
    .map((e: any) => ({
      name: String(e?.name || '').trim(),
      classification: (e?.classification === 'GENERIC' ? 'GENERIC' : 'DISCRIMINATING') as Classification,
      aliases: Array.isArray(e?.aliases) ? e.aliases.map((a: any) => String(a).trim()).filter(Boolean) : [],
    }))
    .filter((e: VocabEntry) => e.name);
}

function dedupeEntriesByName(entries: VocabEntry[]): VocabEntry[] {
  const byKey = new Map<string, VocabEntry>();
  for (const e of entries) {
    const key = e.name.toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, { name: e.name, classification: e.classification, aliases: [...e.aliases] });
    } else {
      const existing = byKey.get(key)!;
      existing.aliases.push(...e.aliases);
      if (e.classification === 'DISCRIMINATING') existing.classification = 'DISCRIMINATING';
    }
  }
  for (const e of byKey.values()) e.aliases = Array.from(new Set(e.aliases));
  return Array.from(byKey.values());
}

// Safety net: if the model drops an input item from every entry's aliases (instruction says it
// must not, but LLM output isn't guaranteed), re-add it as its own singleton entry rather than
// silently losing it. Defaults recovered entries to DISCRIMINATING — the safer direction, since
// wrongly keeping an operation in a signature is lower-risk than wrongly dropping it.
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

async function consolidateVocabulary(
  rawLabels: string[],
  usage: ModelUsage,
): Promise<{ entries: VocabEntry[]; recoveredCount: number; tiers: Array<{ tier: string; entryCount: number }> }> {
  const tiers: Array<{ tier: string; entryCount: number }> = [];
  let recoveredCount = 0;

  // Tier 1: chunk the raw labels directly.
  let entries: VocabEntry[] = [];
  for (let i = 0; i < rawLabels.length; i += VOCAB_CHUNK_SIZE) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const chunk = rawLabels.slice(i, i + VOCAB_CHUNK_SIZE);
    const chunkEntries = await vocabChunkCall(chunk, usage, 'vocab-tier1', '');
    entries.push(...chunkEntries);
  }
  {
    const byName = new Map(rawLabels.map((l) => [l, { name: l, classification: 'DISCRIMINATING' as Classification, aliases: [l] }]));
    const { entries: reconciled, recovered } = reconcileDropped(rawLabels, byName, entries);
    recoveredCount += recovered.length;
    entries = dedupeEntriesByName(reconciled);
  }
  console.log(`  vocab tier1: ${rawLabels.length} raw labels -> ${entries.length} entries (${recoveredCount} recovered so far)`);
  tiers.push({ tier: 'tier1', entryCount: entries.length });

  // Tier 2+: repeatedly AI-merge in chunks until small enough for one final targeted pass.
  let round = 2;
  while (entries.length > VOCAB_CHUNK_SIZE * 2 && round <= 6) {
    const byName = new Map(entries.map((e) => [e.name, e]));
    const names = entries.map((e) => e.name);
    let merged: VocabEntry[] = [];
    for (let i = 0; i < names.length; i += VOCAB_CHUNK_SIZE) {
      if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
      const chunkNames = names.slice(i, i + VOCAB_CHUNK_SIZE);
      const chunkEntries = await vocabChunkCall(chunkNames, usage, `vocab-tier${round}`, '');
      for (const ce of chunkEntries) {
        merged.push({ name: ce.name, classification: ce.classification, aliases: ce.aliases.flatMap((n) => byName.get(n)?.aliases || [n]) });
      }
    }
    const { entries: reconciled, recovered } = reconcileDropped(names, byName, merged);
    recoveredCount += recovered.length;
    entries = dedupeEntriesByName(reconciled);
    console.log(`  vocab tier${round}: -> ${entries.length} entries (${recoveredCount} recovered so far)`);
    tiers.push({ tier: `tier${round}`, entryCount: entries.length });
    round += 1;
  }

  // Final pass: one call explicitly targeting the 40-80 range.
  await sleep(MIN_MS_BETWEEN_CALLS);
  const byNameFinal = new Map(entries.map((e) => [e.name, e]));
  const finalNames = entries.map((e) => e.name);
  const finalInstruction = `\nIMPORTANT: Consolidate these into a CLOSED vocabulary of between ${VOCAB_TARGET_MIN} and ${VOCAB_TARGET_MAX} total entries. Merge more aggressively across near-duplicate operations if needed to reach that range, but NEVER merge two entries that are genuinely different operations just to hit the count.\n`;
  const finalChunkEntries = await vocabChunkCall(finalNames, usage, 'vocab-final', finalInstruction);
  const finalMerged = finalChunkEntries.map((ce) => ({
    name: ce.name,
    classification: ce.classification,
    aliases: ce.aliases.flatMap((n) => byNameFinal.get(n)?.aliases || [n]),
  }));
  const { entries: reconciledFinal, recovered: recoveredFinal } = reconcileDropped(finalNames, byNameFinal, finalMerged);
  recoveredCount += recoveredFinal.length;
  const finalEntries = dedupeEntriesByName(reconciledFinal);
  tiers.push({ tier: 'final', entryCount: finalEntries.length });
  console.log(`  vocab final: -> ${finalEntries.length} entries (target ${VOCAB_TARGET_MIN}-${VOCAB_TARGET_MAX}, ${recoveredCount} total recovered)`);

  return { entries: finalEntries, recoveredCount, tiers };
}

function buildRawToVocabMapping(rawLabels: string[], vocabEntries: VocabEntry[]): { mapping: Record<string, string>; unmapped: string[] } {
  const mapping: Record<string, string> = {};
  for (const entry of vocabEntries) {
    for (const alias of entry.aliases) mapping[alias] = entry.name;
  }
  const unmapped = rawLabels.filter((l) => !mapping[l]);
  return { mapping, unmapped };
}

// ─── Step 2: rebuild signatures using ONLY discriminating operations (deterministic, no AI call) ──
function buildV4Archetypes(v3Archetypes: V3Archetype[], mapping: Record<string, string>, vocabByName: Map<string, VocabEntry>): V4Archetype[] {
  const groups = new Map<string, { memberCount: number; canonicalStem: string; sourceSignatures: string[] }>();
  for (const a of v3Archetypes) {
    const rawLabels = a.signature ? a.signature.split(' -> ').map((s) => s.trim()).filter(Boolean) : [];
    const discLabels = rawLabels
      .map((l) => mapping[l])
      .filter((name): name is string => Boolean(name))
      .filter((name) => vocabByName.get(name)?.classification === 'DISCRIMINATING');
    const signature = discLabels.join(' -> ');
    if (!groups.has(signature)) groups.set(signature, { memberCount: 0, canonicalStem: a.canonicalStem, sourceSignatures: [] });
    const g = groups.get(signature)!;
    g.memberCount += a.memberCount;
    g.sourceSignatures.push(a.signature);
    if (a.canonicalStem.length > 0 && (g.canonicalStem.length === 0 || a.canonicalStem.length < g.canonicalStem.length)) g.canonicalStem = a.canonicalStem;
  }
  return Array.from(groups.entries())
    .map(([signature, g]) => ({ signature, memberCount: g.memberCount, canonicalStem: g.canonicalStem, sourceArchetypeSignatures: g.sourceSignatures }))
    .sort((a, b) => b.memberCount - a.memberCount);
}

// ─── Step 3: hold-out, constrained to the frozen vocabulary ────────────────────────────────────────
async function loadHoldoutMaterial(): Promise<string> {
  const material = await prisma.material.findFirst({
    where: { is_akademi_generated: false, course_code: COURSE_CODE, title: HOLDOUT_TITLE },
    select: { content: true },
  });
  if (!material?.content?.trim()) throw new Error(`Hold-out material "${HOLDOUT_TITLE}" not found or empty`);
  return material.content.trim();
}

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
  recordUsage(usage, 'step3-extract-questions', model);

  const parsed = parseJsonObject(text);
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
  return questions.map((q: any) => ({ questionText: String(q?.questionText || '').trim() })).filter((q: any) => q.questionText);
}

async function labelHoldoutQuestionsConstrained(
  questions: { questionText: string }[],
  vocabEntries: VocabEntry[],
  usage: ModelUsage,
): Promise<{ results: Array<{ questionIndex: number; actionLabels: string[] }>; coercedCount: number }> {
  const results: Array<{ questionIndex: number; actionLabels: string[] }> = [];
  const vocabNames = vocabEntries.map((e) => e.name);
  const vocabSet = new Set(vocabNames);
  let coercedCount = 0;

  for (let i = 0; i < questions.length; i += LABEL_BATCH_SIZE) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const batch = questions.slice(i, i + LABEL_BATCH_SIZE).map((q, j) => ({ index: i + j, questionText: q.questionText }));

    const prompt = `Here is a FROZEN, CLOSED vocabulary of operation labels — this is the complete list; you may not invent new labels:
${vocabNames.join(', ')}

For each question below: solve it (or use its shown solution if the text gives one), break the solution into an ordered sequence of individual actions, and label each action using EXACTLY one of the vocabulary labels above. If — and only if — a step's operation genuinely is not covered by ANY label in the list, label that step "UNMAPPED" instead. Never force a mismatched label just to avoid UNMAPPED, and never invent a label that is not in the list above.

QUESTIONS:
${batch.map((q) => `${q.index}. ${q.questionText}`).join('\n\n')}

Format as JSON: { "results": [ { "questionIndex": number, "actionLabels": string[] } ] }
Include an entry for every question index above.`;

    const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
      systemPrompt:
        'You solve math questions and label each solution step using ONLY a fixed, closed operation vocabulary, or "UNMAPPED" if truly nothing fits. Return ONLY valid JSON, no prose outside the JSON object.',
      maxTokens: 3000,
      extendedTimeouts: true,
      temperature: HOLDOUT_LABEL_TEMPERATURE,
    });
    recordUsage(usage, 'step3-label-holdout', model);

    const parsed = parseJsonObject(text);
    const batchResults = Array.isArray(parsed?.results) ? parsed.results : [];
    for (const r of batchResults) {
      const rawLabels: string[] = Array.isArray(r?.actionLabels) ? r.actionLabels.map((l: any) => String(l).trim()).filter(Boolean) : [];
      const coerced = rawLabels.map((l) => {
        if (l === 'UNMAPPED' || vocabSet.has(l)) return l;
        coercedCount += 1;
        return 'UNMAPPED';
      });
      results.push({ questionIndex: Number(r?.questionIndex), actionLabels: coerced });
    }
  }

  return { results, coercedCount };
}

function buildHoldoutSignature(actionLabels: string[], vocabByName: Map<string, VocabEntry>): string {
  return actionLabels.filter((l) => l !== 'UNMAPPED' && vocabByName.get(l)?.classification === 'DISCRIMINATING').join(' -> ');
}

function tokenMultisetOverlapScore(a: string[], b: string[]): number {
  const countsA = new Map<string, number>();
  for (const t of a) countsA.set(t, (countsA.get(t) || 0) + 1);
  const countsB = new Map<string, number>();
  for (const t of b) countsB.set(t, (countsB.get(t) || 0) + 1);
  let intersection = 0;
  for (const [t, ca] of countsA) intersection += Math.min(ca, countsB.get(t) || 0);
  const union = a.length + b.length - intersection;
  return union === 0 ? 0 : intersection / union;
}

function findClosestArchetype(signature: string, archetypes: V4Archetype[]): { signature: string; score: number } | null {
  const tokens = signature.split(' -> ').filter(Boolean);
  let best: { signature: string; score: number } | null = null;
  for (const a of archetypes) {
    if (!a.signature) continue; // never offer the degenerate empty-signature group as a "closest" match
    const score = tokenMultisetOverlapScore(tokens, a.signature.split(' -> ').filter(Boolean));
    if (!best || score > best.score) best = { signature: a.signature, score };
  }
  return best;
}

function estimateCallVolume(rawLabelCount: number, tutorialCount: number): Record<string, number | string> {
  const tier1Calls = Math.ceil(rawLabelCount / VOCAB_CHUNK_SIZE);
  return {
    vocabTier1Calls: tier1Calls,
    vocabLaterTiersAndFinal: 'variable (depends on tier1 consolidation ratio; capped at 6 merge rounds + 1 final pass)',
    holdoutExtraction: 1,
    holdoutLabeling: Math.ceil(tutorialCount / LABEL_BATCH_SIZE),
    roughFloor: tier1Calls + 1 + 1 + Math.ceil(tutorialCount / LABEL_BATCH_SIZE),
  };
}

async function main() {
  const usage: ModelUsage = {};
  const args = new Set(process.argv.slice(2));

  console.log('=== Step 0: v3 archetype cache ===');
  const { archetypes: v3Archetypes, alreadyCached } = getOrCreateV3LabelsCache();
  const rawLabels = distinctV3Labels(v3Archetypes);
  console.log(`${v3Archetypes.length} v3 archetypes, ${rawLabels.length} distinct raw labels.\n`);

  const volumeEstimate = estimateCallVolume(rawLabels.length, 36 /* corrected after real extraction in Step 3 */);
  console.log('Estimated call volume for Steps 1-3:');
  console.log(JSON.stringify(volumeEstimate, null, 2));

  if (!args.has('--run-full')) {
    console.log('\nDry run only (pass --run-full to execute Steps 1-3). Exiting after Step 0.');
    return;
  }

  console.log('\n=== Step 1: closed vocabulary ===');
  const { entries: vocabEntries, recoveredCount, tiers } = await consolidateVocabulary(rawLabels, usage);
  const { mapping, unmapped } = buildRawToVocabMapping(rawLabels, vocabEntries);
  const vocabByName = new Map(vocabEntries.map((e) => [e.name, e]));
  const discCount = vocabEntries.filter((e) => e.classification === 'DISCRIMINATING').length;
  const genericCount = vocabEntries.filter((e) => e.classification === 'GENERIC').length;
  console.log(`Vocabulary frozen: ${vocabEntries.length} entries (${discCount} DISCRIMINATING, ${genericCount} GENERIC). Unmapped raw labels: ${unmapped.length}.`);

  fs.mkdirSync(path.dirname(VOCAB_PATH), { recursive: true });
  fs.writeFileSync(
    VOCAB_PATH,
    JSON.stringify(
      {
        note: 'FROZEN at generation time — no later additions. Built from the 444 v3 canonical labels reconstructed in docs/mth102-labels-v3.json.',
        generatedAt: new Date().toISOString(),
        entryCount: vocabEntries.length,
        discriminatingCount: discCount,
        genericCount: genericCount,
        recoveredDuringMerge: recoveredCount,
        unmappedRawLabels: unmapped,
        entries: vocabEntries,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`Wrote frozen vocabulary to ${VOCAB_PATH}`);

  console.log('\n=== Step 2: discriminating-only signatures (no AI call) ===');
  const v4Archetypes = buildV4Archetypes(v3Archetypes, mapping, vocabByName);
  const singletonCount = v4Archetypes.filter((a) => a.memberCount === 1).length;
  const emptySignatureGroup = v4Archetypes.find((a) => a.signature === '');
  console.log(`${v4Archetypes.length} discriminating-only archetypes, ${singletonCount} singletons.`);
  if (emptySignatureGroup) {
    console.log(`  ${emptySignatureGroup.memberCount} examples (across ${emptySignatureGroup.sourceArchetypeSignatures.length} v3 archetypes) collapsed to an empty signature (all-GENERIC or unmapped v3 labels).`);
  }

  console.log('\n=== Step 3: hold-out (MTH 102 TUTORIAL 2026) ===');
  const holdoutContent = await loadHoldoutMaterial();
  const tutorialQuestions = await extractTutorialQuestions(holdoutContent, usage);
  console.log(`${tutorialQuestions.length} tutorial questions extracted.`);

  await sleep(MIN_MS_BETWEEN_CALLS);
  const { results: holdoutLabeled, coercedCount } = await labelHoldoutQuestionsConstrained(tutorialQuestions, vocabEntries, usage);

  const referenceArchetypes = v4Archetypes;
  const referenceBySignature = new Map(referenceArchetypes.filter((a) => a.signature !== '').map((a) => [a.signature, a]));

  const holdoutResults = holdoutLabeled.map((h) => {
    const signature = buildHoldoutSignature(h.actionLabels, vocabByName);
    const unmappedCount = h.actionLabels.filter((l) => l === 'UNMAPPED').length;
    const matched = signature !== '' ? referenceBySignature.get(signature) : undefined;
    return {
      questionIndex: h.questionIndex,
      actionLabels: h.actionLabels,
      signature,
      unmappedCount,
      fits: Boolean(matched),
      matchedSignature: matched?.signature || null,
    };
  });

  const fitCount = holdoutResults.filter((r) => r.fits).length;
  const coverageScore = tutorialQuestions.length > 0 ? fitCount / tutorialQuestions.length : 0;
  const uncovered = holdoutResults.filter((r) => !r.fits);
  const totalUnmapped = holdoutResults.reduce((sum, r) => sum + r.unmappedCount, 0);

  console.log(`coverageScore = ${fitCount} / ${tutorialQuestions.length} = ${coverageScore.toFixed(3)}`);
  console.log(`Total UNMAPPED step labels: ${totalUnmapped}. Model closed-vocabulary violations coerced: ${coercedCount}.`);

  const differentiationIndexes = holdoutResults
    .map((r) => r.questionIndex)
    .filter((idx) => /power rule|chain rule|product rule|quotient rule|dy\/dx|derivative/i.test(tutorialQuestions[idx]?.questionText || ''));
  const differentiationSignatures = new Set(differentiationIndexes.map((idx) => holdoutResults.find((r) => r.questionIndex === idx)?.signature));

  const closestForUnmatched = uncovered.map((r) => ({ ...r, closest: findClosestArchetype(r.signature, referenceArchetypes) }));

  const generatedAt = new Date().toISOString();
  const usageLines = Object.entries(usage).flatMap(([phase, models]) => Object.entries(models).map(([model, count]) => `  - ${phase}: ${model} x${count}`));

  const md = [
    '# Archetype Extraction Experiment v4 — MTH 102',
    '',
    `Captured ${generatedAt}. Standalone experiment, not wired into any job/queue. No database writes (label/vocabulary caches and this report are the only file artifacts).`,
    '',
    '## Methodology',
    '',
    "- **v3 -> v4 change:** v3's failure was exact-match brittleness caused by step-labeling granularity drift between the original labeling pass and the hold-out pass. v4 removes that source of noise by classifying every canonical operation as DISCRIMINATING (identifies the solution form) or GENERIC (bookkeeping shared across many forms), then building signatures from DISCRIMINATING operations only.",
    `- Step 0 reused v3's output with **no re-extraction and no re-labeling of the 356 examples**. v3 never persisted per-example labels to disk, so this step reconstructed archetype-level aggregates (signature/memberCount/canonicalStem for all ${v3Archetypes.length} v3 archetypes) from its markdown report and cached them to \`${path.relative(path.join(__dirname, '../../..'), LABELS_V3_CACHE_PATH)}\`${alreadyCached ? ' (already present from an earlier run of this script)' : ' this run'}. This is a lossless-enough input for Steps 1-2: those steps only need each distinct full signature and its member count, both of which the v3 archetype list already provides directly.`,
    `- Step 1 (model) consolidated ${rawLabels.length} distinct raw v3 canonical labels into a closed vocabulary, chunked in batches of ${VOCAB_CHUNK_SIZE} with repeated AI-merge rounds until small enough for one final pass explicitly targeting ${VOCAB_TARGET_MIN}-${VOCAB_TARGET_MAX} entries. Vocabulary consolidation tiers: ${tiers.map((t) => `${t.tier}=${t.entryCount}`).join(', ')}. The result is FROZEN — no later step adds to it.`,
    '- Step 2 (no AI call) rebuilt every v3 archetype\'s signature using only its DISCRIMINATING-classified labels (GENERIC ones dropped), then regrouped by exact string match on that shorter signature — purely deterministic.',
    `- Step 3 (model) read "${HOLDOUT_TITLE}" fresh (the designated hold-out phase), extracted its questions (1 call), then labeled each question's solution steps in batches of at most ${LABEL_BATCH_SIZE} (hard cap), hard-constrained to the frozen vocabulary or the literal sentinel "UNMAPPED" — no new labels permitted. Any label the model returned outside the frozen vocabulary and not literally "UNMAPPED" was coerced to "UNMAPPED" in code (count: ${coercedCount}).`,
    '- No AI-generated Question rows or GeneratedTextbookSection content were read anywhere in this experiment.',
    '- Model usage per phase (so it\'s traceable which calls came from the primary model vs. its fallback):',
    ...usageLines,
    '',
    '## Step 1 — closed vocabulary',
    '',
    `**${vocabEntries.length} entries** (${discCount} DISCRIMINATING, ${genericCount} GENERIC). ${recoveredCount} raw label(s) were dropped by the model mid-merge and auto-recovered as singleton entries. ${unmapped.length} raw label(s) remain unmapped after recovery.`,
    '',
    '### DISCRIMINATING entries',
    '',
    vocabEntries
      .filter((e) => e.classification === 'DISCRIMINATING')
      .map((e) => `- \`${e.name}\` (${e.aliases.length} alias${e.aliases.length === 1 ? '' : 'es'})`)
      .join('\n'),
    '',
    '### GENERIC entries',
    '',
    vocabEntries
      .filter((e) => e.classification === 'GENERIC')
      .map((e) => `- \`${e.name}\` (${e.aliases.length} alias${e.aliases.length === 1 ? '' : 'es'})`)
      .join('\n'),
    '',
    '### Unmapped raw labels',
    '',
    unmapped.length > 0 ? unmapped.map((l) => `- \`${l}\``).join('\n') : '_None — every v3 label mapped to a vocabulary entry._',
    '',
    '## Step 2 — discriminating-only archetypes',
    '',
    `**${v4Archetypes.length} archetypes**, ${singletonCount} singletons (from ${v3Archetypes.length} v3 archetypes covering ${v3Archetypes.reduce((s, a) => s + a.memberCount, 0)} examples).`,
    emptySignatureGroup
      ? `\n${emptySignatureGroup.memberCount} examples across ${emptySignatureGroup.sourceArchetypeSignatures.length} v3 archetypes collapsed to an EMPTY discriminating-only signature (every one of their v3 labels was GENERIC or unmapped) — excluded from the reference set used for Step 3 matching.`
      : '',
    '',
    '### Top 15 archetypes by member count',
    '',
    v4Archetypes
      .slice(0, 15)
      .map((a) => `- **[memberCount=${a.memberCount}]** \`${a.signature || '(empty)'}\`\n  - canonicalStem: ${a.canonicalStem}`)
      .join('\n'),
    '',
    '## Step 3 — hold-out test (MTH 102 TUTORIAL 2026)',
    '',
    `${tutorialQuestions.length} questions extracted.`,
    '',
    `**coverageScore = ${fitCount} / ${tutorialQuestions.length} = ${coverageScore.toFixed(3)}**`,
    '',
    `Total UNMAPPED step labels across all questions: ${totalUnmapped}.`,
    '',
    `Differentiation-related questions (${differentiationIndexes.length} identified) produced **${differentiationSignatures.size} distinct discriminating-only signature(s)**.`,
    '',
    '### Unmatched questions (with closest archetype)',
    '',
    closestForUnmatched.length > 0
      ? closestForUnmatched
          .map(
            (r) =>
              `- Q${r.questionIndex}: "${tutorialQuestions[r.questionIndex]?.questionText.slice(0, 150)}"\n  - signature: \`${r.signature || '(empty)'}\`\n  - closest archetype: ${r.closest ? `\`${r.closest.signature}\` (overlap=${r.closest.score.toFixed(2)})` : '_none available_'}`,
          )
          .join('\n')
      : '_None — every question matched a reference archetype._',
    '',
    '### Full per-question results',
    '',
    ...holdoutResults.map(
      (r) =>
        `- Q${r.questionIndex} (${r.fits ? 'FIT' : 'NO FIT'}, ${r.unmappedCount} UNMAPPED): "${tutorialQuestions[r.questionIndex]?.questionText.slice(0, 120)}"\n  - signature: \`${r.signature || '(empty)'}\``,
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
        v3ArchetypeCount: v3Archetypes.length,
        distinctRawLabelCount: rawLabels.length,
        vocabularyEntryCount: vocabEntries.length,
        discriminatingCount: discCount,
        genericCount: genericCount,
        unmappedRawLabelCount: unmapped.length,
        v4ArchetypeCount: v4Archetypes.length,
        v4SingletonCount: singletonCount,
        tutorialQuestionCount: tutorialQuestions.length,
        coverageScore: Number(coverageScore.toFixed(3)),
        uncoveredCount: uncovered.length,
        totalUnmappedStepLabels: totalUnmapped,
        closedVocabularyViolationsCoerced: coercedCount,
        differentiationQuestionCount: differentiationIndexes.length,
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

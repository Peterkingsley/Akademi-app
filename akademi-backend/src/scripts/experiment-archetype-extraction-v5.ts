// STANDALONE EXPERIMENT (v5) — not wired into any job, queue, or JOB_NAMES entry. Run manually via
// `npx tsx src/scripts/experiment-archetype-extraction-v5.ts` (add `--run-full` to execute after
// reviewing the call-volume estimate). Read-only against the database (only Step 4's fresh
// tutorial read touches it); writes nothing to it — only the new vocabulary + report files.
//
// v4's Follow-up A/B found two things: (1) 14 of 30 sampled "empty signature" examples were
// MISLABELLED, not TRIVIAL — a real technique got buried inside a GENERIC catch-all entry
// ("evaluate limit", "evaluate integral", "calculate derivative", "assign variables", "simplify
// expression", "miscellaneous operations"); (2) order/subset-tolerant matching doesn't help (subset
// match gains +1 coverage only by collapsing genuinely distinct differentiation techniques
// together). So v5 leaves matching logic untouched and instead fixes the vocabulary itself:
//   Step 1 (model): split each of the 6 catch-alls' alias lists into distinct, real-technique
//                    sub-operations. "miscellaneous operations" is deleted outright — every one of
//                    its aliases must be reassigned to a genuinely-fitting entry (existing or newly
//                    split), never left in a fresh catch-all.
//   Step 2 (model): reclassify EVERY entry (touched or not) as DISCRIMINATING/GENERIC using
//                    empirical evidence (real example problems where the operation appears) rather
//                    than how the label sounds — this is the fix for v4 wrongly calling "direct
//                    substitution"-like operations GENERIC just because they sound like bookkeeping.
//   Step 3 (NO model): deterministic — same exact-signature-matching logic as v3/v4, rebuilt over
//                    the new vocabulary.
//   Step 4 (model): hold-out, same procedure as v4's Step 3 (fresh read, constrained labeling,
//                    exact ordered match only — matching logic is explicitly unchanged this round).

import fs from 'fs';
import path from 'path';
import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';

const HOLDOUT_TITLE = 'MTH 102 TUTORIAL 2026';
const COURSE_CODE = 'MTH 102';
const LABEL_BATCH_SIZE = 5; // hard cap, matches Step 4's per-call limit
const MIN_MS_BETWEEN_CALLS = 4500; // confirmed fallback-model per-minute cap from v3
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SPLIT_TEMPERATURE = 0.3;
const RECLASSIFY_TEMPERATURE = 0.2;
const RECLASSIFY_BATCH_SIZE = 6;
const EVIDENCE_SAMPLE_SIZE = 5;
const HOLDOUT_LABEL_TEMPERATURE = 0.2;

const LABELS_V3_CACHE_PATH = path.join(__dirname, '../../../docs/mth102-labels-v3.json');
const V4_VOCAB_PATH = path.join(__dirname, '../../../docs/mth102-operation-vocabulary.json');
const V5_VOCAB_PATH = path.join(__dirname, '../../../docs/mth102-operation-vocabulary-v2.json');
const OUTPUT_PATH = path.join(__dirname, '../../../docs/archetype-experiment-mth102-v5.md');

const CATCHALLS_TO_SPLIT = ['evaluate limit', 'evaluate integral', 'calculate derivative', 'assign variables', 'simplify expression'];
const MISC_NAME = 'miscellaneous operations';

type V3Archetype = { signature: string; memberCount: number; canonicalStem: string };
type Classification = 'DISCRIMINATING' | 'GENERIC';
type VocabEntry = { name: string; classification: Classification; aliases: string[] };
type V5Archetype = { signature: string; memberCount: number; canonicalStem: string; memberV3ArchetypeCount: number };
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

function tokens(sig: string): string[] {
  return sig ? sig.split(' -> ').map((s) => s.trim()).filter(Boolean) : [];
}

function shuffleSample<T>(items: T[], n: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function loadV3Archetypes(): V3Archetype[] {
  const parsed = JSON.parse(fs.readFileSync(LABELS_V3_CACHE_PATH, 'utf-8'));
  return parsed.archetypes;
}

function loadV4Vocabulary(): VocabEntry[] {
  const parsed = JSON.parse(fs.readFileSync(V4_VOCAB_PATH, 'utf-8'));
  return parsed.entries;
}

// ─── Step 1: split the 6 catch-alls ────────────────────────────────────────────────────────────
async function splitCatchAll(entryName: string, aliases: string[], usage: ModelUsage): Promise<VocabEntry[]> {
  const prompt = `Below is the full alias list currently grouped under one overly-broad vocabulary entry, "${entryName}". This single entry is a catch-all hiding multiple genuinely distinct techniques.

Split these aliases into multiple distinct sub-operations, each naming ONE real, specific technique. For example, an entry like "evaluate limit" should split into things like: one-sided limit, limit at infinity, factor and cancel, apply L'Hopital's rule, apply fundamental trig limit, direct substitution — because these are all different, real, distinguishable techniques that a single generic label was hiding.

Merge two aliases into the same sub-operation ONLY if they name the literal same technique in different words. If in doubt, keep them separate — under-splitting is the exact mistake being fixed here.

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
  recordUsage(usage, `step1-split[${entryName}]`, model);

  const parsed = parseJsonObject(text);
  const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  const result: VocabEntry[] = entries
    .map((e: any) => ({
      name: String(e?.name || '').trim(),
      classification: 'DISCRIMINATING' as Classification, // placeholder — Step 2 reclassifies everything empirically
      aliases: Array.isArray(e?.aliases) ? e.aliases.map((a: any) => String(a).trim()).filter(Boolean) : [],
    }))
    .filter((e: VocabEntry) => e.name);

  // Safety net: don't silently lose an alias the model forgot to place.
  const covered = new Set(result.flatMap((e) => e.aliases));
  const missing = aliases.filter((a) => !covered.has(a));
  if (missing.length > 0) {
    console.warn(`  step1-split[${entryName}]: ${missing.length} alias(es) dropped by the model, re-added as their own entries.`);
    result.push(...missing.map((a) => ({ name: a, classification: 'DISCRIMINATING' as Classification, aliases: [a] })));
  }
  return result;
}

async function reassignMisc(miscAliases: string[], candidateNames: string[], usage: ModelUsage): Promise<{ assignments: Record<string, string>; newEntryNames: Set<string> }> {
  const prompt = `Below is the full alias list currently grouped under "${MISC_NAME}" — a catch-all entry that must be deleted entirely. Every alias below must be reassigned to a genuinely-fitting entry.

CANDIDATE ENTRIES (reuse one of these whenever it genuinely fits):
${candidateNames.join(', ')}

ALIASES TO REASSIGN:
${miscAliases.map((a, i) => `${i}. ${a}`).join('\n')}

For each alias, assign it to the best-fitting candidate entry above. Only if an alias truly does not fit ANY candidate, invent a new, specific, real technique name for it instead — never assign it to another vague catch-all, and never leave it unassigned.

Format as JSON: { "assignments": [ { "alias": string, "assignedTo": string } ] }
Include an entry for every alias above.`;

  const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
    systemPrompt: 'You eliminate a catch-all vocabulary entry by reassigning every one of its aliases to a genuinely-fitting real entry, inventing a new specific entry only when truly necessary. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 4000,
    extendedTimeouts: true,
    temperature: SPLIT_TEMPERATURE,
  });
  recordUsage(usage, 'step1-reassign-misc', model);

  const parsed = parseJsonObject(text);
  const rows = Array.isArray(parsed?.assignments) ? parsed.assignments : [];
  const candidateSet = new Set(candidateNames);
  const assignments: Record<string, string> = {};
  const newEntryNames = new Set<string>();
  for (const r of rows) {
    const alias = String(r?.alias || '').trim();
    const assignedTo = String(r?.assignedTo || '').trim();
    if (!alias || !assignedTo) continue;
    assignments[alias] = assignedTo;
    if (!candidateSet.has(assignedTo)) newEntryNames.add(assignedTo);
  }
  // Safety net: anything the model forgot gets its own new entry rather than being lost.
  for (const a of miscAliases) {
    if (!assignments[a]) {
      assignments[a] = a;
      newEntryNames.add(a);
      console.warn(`  step1-reassign-misc: "${a}" was not assigned by the model, given its own new entry.`);
    }
  }
  return { assignments, newEntryNames };
}

async function runStep1(v4Vocab: VocabEntry[], usage: ModelUsage): Promise<{ vocab: VocabEntry[]; splitSummary: Array<{ from: string; intoCount: number }> }> {
  const untouched = v4Vocab.filter((e) => !CATCHALLS_TO_SPLIT.includes(e.name) && e.name !== MISC_NAME);
  let vocab: VocabEntry[] = [...untouched];
  const splitSummary: Array<{ from: string; intoCount: number }> = [];

  for (let i = 0; i < CATCHALLS_TO_SPLIT.length; i += 1) {
    const name = CATCHALLS_TO_SPLIT[i];
    const original = v4Vocab.find((e) => e.name === name);
    if (!original) throw new Error(`Expected catch-all "${name}" not found in v4 vocabulary`);
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    console.log(`  splitting "${name}" (${original.aliases.length} aliases)...`);
    const split = await splitCatchAll(name, original.aliases, usage);
    console.log(`    -> ${split.length} sub-operations.`);
    vocab.push(...split);
    splitSummary.push({ from: name, intoCount: split.length });
  }

  const miscOriginal = v4Vocab.find((e) => e.name === MISC_NAME);
  if (!miscOriginal) throw new Error(`Expected "${MISC_NAME}" not found in v4 vocabulary`);
  await sleep(MIN_MS_BETWEEN_CALLS);
  console.log(`  reassigning "${MISC_NAME}" (${miscOriginal.aliases.length} aliases) across ${vocab.length} candidate entries...`);
  const { assignments, newEntryNames } = await reassignMisc(miscOriginal.aliases, vocab.map((e) => e.name), usage);

  const byName = new Map(vocab.map((e) => [e.name, e]));
  for (const name of newEntryNames) {
    if (!byName.has(name)) {
      const entry: VocabEntry = { name, classification: 'DISCRIMINATING', aliases: [] };
      byName.set(name, entry);
      vocab.push(entry);
    }
  }
  for (const [alias, assignedTo] of Object.entries(assignments)) {
    byName.get(assignedTo)!.aliases.push(alias);
  }
  console.log(`    -> reassigned into ${new Set(Object.values(assignments)).size} distinct entries (${newEntryNames.size} newly created).`);

  return { vocab, splitSummary };
}

// ─── Step 2: empirical reclassification ────────────────────────────────────────────────────────
function evidenceForEntry(entry: VocabEntry, v3Archetypes: V3Archetype[]): string[] {
  const aliasSet = new Set(entry.aliases);
  const matches = v3Archetypes.filter((a) => tokens(a.signature).some((t) => aliasSet.has(t)));
  return shuffleSample(matches, Math.min(EVIDENCE_SAMPLE_SIZE, matches.length)).map((a) => a.canonicalStem.replace(/\s+/g, ' ').slice(0, 200));
}

async function reclassifyBatch(
  batch: Array<{ index: number; name: string; evidence: string[] }>,
  usage: ModelUsage,
): Promise<Array<{ index: number; classification: Classification }>> {
  const prompt = `For each operation below, decide whether it is DISCRIMINATING or GENERIC, using this EMPIRICAL test — NOT whether the name sounds like routine bookkeeping:

- GENERIC: this operation shows up in problems belonging to MANY CLEARLY DIFFERENT solution forms/techniques — the example problems below look meaningfully different from each other in what technique they actually need.
- DISCRIMINATING: knowing this operation was used narrows down what KIND of problem this is — even if the operation itself sounds simple or routine. For example, "direct substitution" is DISCRIMINATING even though it sounds trivial: its presence (with nothing else) tells you the problem needed no other technique, which IS diagnostic of the solution form.

Base your judgment on whether the example problems shown for each operation look like the same kind of problem, or genuinely different kinds.

OPERATIONS:
${batch
  .map(
    (b) =>
      `${b.index}. ${b.name}\n   examples:\n${b.evidence.length > 0 ? b.evidence.map((e) => `   - ${e}`).join('\n') : '   (no example problems found in the cached archetype data)'}`,
  )
  .join('\n\n')}

Format as JSON: { "results": [ { "index": number, "classification": "DISCRIMINATING" | "GENERIC" } ] }
Include an entry for every index above.`;

  const { text, model } = await aiProvider.generateResponseWithModel(prompt, {
    systemPrompt:
      'You classify operations as DISCRIMINATING or GENERIC using empirical evidence of where each one is actually used, never by how the label sounds in isolation. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 2000,
    extendedTimeouts: true,
    temperature: RECLASSIFY_TEMPERATURE,
  });
  recordUsage(usage, 'step2-reclassify', model);

  const parsed = parseJsonObject(text);
  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  return results.map((r: any) => ({
    index: Number(r?.index),
    classification: r?.classification === 'GENERIC' ? 'GENERIC' : ('DISCRIMINATING' as Classification),
  }));
}

async function runStep2(vocab: VocabEntry[], v3Archetypes: V3Archetype[], usage: ModelUsage): Promise<VocabEntry[]> {
  const withEvidence = vocab.map((e) => ({ name: e.name, aliases: e.aliases, evidence: evidenceForEntry(e, v3Archetypes) }));
  const classifications = new Map<string, Classification>();

  for (let i = 0; i < withEvidence.length; i += RECLASSIFY_BATCH_SIZE) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const batch = withEvidence.slice(i, i + RECLASSIFY_BATCH_SIZE).map((e, j) => ({ index: i + j, name: e.name, evidence: e.evidence }));
    console.log(`  reclassifying ${i + 1}-${Math.min(i + batch.length, withEvidence.length)} of ${withEvidence.length}...`);
    const results = await reclassifyBatch(batch, usage);
    for (const r of results) {
      const item = withEvidence[r.index];
      if (item) classifications.set(item.name, r.classification);
    }
  }

  return vocab.map((e) => ({ ...e, classification: classifications.get(e.name) || e.classification }));
}

// ─── Step 3: rebuild archetypes, deterministic ─────────────────────────────────────────────────
function buildMapping(vocab: VocabEntry[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const e of vocab) for (const alias of e.aliases) mapping[alias] = e.name;
  return mapping;
}

function discSignatureForRaw(rawSignature: string, mapping: Record<string, string>, vocabByName: Map<string, VocabEntry>): string {
  const rawLabels = tokens(rawSignature);
  const disc = rawLabels
    .map((l) => mapping[l])
    .filter((n): n is string => Boolean(n))
    .filter((n) => vocabByName.get(n)?.classification === 'DISCRIMINATING');
  return disc.join(' -> ');
}

function buildV5Archetypes(v3Archetypes: V3Archetype[], mapping: Record<string, string>, vocabByName: Map<string, VocabEntry>): V5Archetype[] {
  const groups = new Map<string, { memberCount: number; canonicalStem: string; v3Count: number }>();
  for (const a of v3Archetypes) {
    const signature = discSignatureForRaw(a.signature, mapping, vocabByName);
    if (!groups.has(signature)) groups.set(signature, { memberCount: 0, canonicalStem: a.canonicalStem, v3Count: 0 });
    const g = groups.get(signature)!;
    g.memberCount += a.memberCount;
    g.v3Count += 1;
    if (a.canonicalStem.length > 0 && (g.canonicalStem.length === 0 || a.canonicalStem.length < g.canonicalStem.length)) g.canonicalStem = a.canonicalStem;
  }
  return Array.from(groups.entries())
    .map(([signature, g]) => ({ signature, memberCount: g.memberCount, canonicalStem: g.canonicalStem, memberV3ArchetypeCount: g.v3Count }))
    .sort((a, b) => b.memberCount - a.memberCount);
}

// ─── Step 4: hold-out, constrained to the new frozen vocabulary ────────────────────────────────
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
  recordUsage(usage, 'step4-extract-questions', model);

  const parsed = parseJsonObject(text);
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
  return questions.map((q: any) => ({ questionText: String(q?.questionText || '').trim() })).filter((q: any) => q.questionText);
}

async function labelHoldoutQuestionsConstrained(
  questions: { questionText: string }[],
  vocabNames: string[],
  usage: ModelUsage,
): Promise<{ results: Array<{ questionIndex: number; actionLabels: string[] }>; coercedCount: number }> {
  const results: Array<{ questionIndex: number; actionLabels: string[] }> = [];
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
    recordUsage(usage, 'step4-label-holdout', model);

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

function estimateCallVolume(catchallAliasCount: number, vocabEntryCountGuess: number, tutorialCount: number): Record<string, number | string> {
  return {
    step1SplitCalls: CATCHALLS_TO_SPLIT.length,
    step1MiscReassignCalls: 1,
    step2ReclassifyCallsEstimate: Math.ceil(vocabEntryCountGuess / RECLASSIFY_BATCH_SIZE),
    step4Extraction: 1,
    step4Labeling: Math.ceil(tutorialCount / LABEL_BATCH_SIZE),
    roughFloor: CATCHALLS_TO_SPLIT.length + 1 + Math.ceil(vocabEntryCountGuess / RECLASSIFY_BATCH_SIZE) + 1 + Math.ceil(tutorialCount / LABEL_BATCH_SIZE),
  };
}

async function main() {
  const usage: ModelUsage = {};
  const args = new Set(process.argv.slice(2));

  console.log('=== Loading cached inputs ===');
  const v3Archetypes = loadV3Archetypes();
  const v4Vocab = loadV4Vocabulary();
  console.log(`${v3Archetypes.length} v3 archetypes, v4 vocabulary has ${v4Vocab.length} entries.\n`);

  const roughGuess = v4Vocab.length - 6 + 20; // 44 untouched + a rough guess of how many new sub-ops the 6 catch-alls yield
  console.log('Estimated call volume:');
  console.log(JSON.stringify(estimateCallVolume(170, roughGuess, 36), null, 2));

  if (!args.has('--run-full')) {
    console.log('\nDry run only (pass --run-full to execute Steps 1-4). Exiting.');
    return;
  }

  console.log('\n=== Step 1: split catch-alls ===');
  const { vocab: postSplitVocab, splitSummary } = await runStep1(v4Vocab, usage);
  console.log(`Vocabulary after Step 1: ${postSplitVocab.length} entries.`);

  console.log('\n=== Step 2: empirical reclassification ===');
  const finalVocab = await runStep2(postSplitVocab, v3Archetypes, usage);
  const discCount = finalVocab.filter((e) => e.classification === 'DISCRIMINATING').length;
  const genericCount = finalVocab.filter((e) => e.classification === 'GENERIC').length;
  console.log(`Final vocabulary: ${finalVocab.length} entries (${discCount} DISCRIMINATING, ${genericCount} GENERIC).`);

  // Completeness check against the original 444 raw v3 labels.
  const allRawLabels = new Set<string>();
  for (const a of v3Archetypes) for (const t of tokens(a.signature)) allRawLabels.add(t);
  const mapping = buildMapping(finalVocab);
  const unmapped = Array.from(allRawLabels).filter((l) => !mapping[l]);
  if (unmapped.length > 0) {
    console.warn(`${unmapped.length} raw label(s) ended up unmapped after Steps 1-2 — adding as singleton DISCRIMINATING entries.`);
    finalVocab.push(...unmapped.map((l) => ({ name: l, classification: 'DISCRIMINATING' as Classification, aliases: [l] })));
  }

  fs.mkdirSync(path.dirname(V5_VOCAB_PATH), { recursive: true });
  fs.writeFileSync(
    V5_VOCAB_PATH,
    JSON.stringify(
      {
        note: 'FROZEN at generation time. Built from v4\'s vocabulary (docs/mth102-operation-vocabulary.json) by splitting its 6 catch-all entries into real named techniques (Step 1) and reclassifying every entry empirically using example problems rather than label wording (Step 2).',
        generatedAt: new Date().toISOString(),
        splitSummary,
        entryCount: finalVocab.length,
        discriminatingCount: discCount,
        genericCount,
        unmappedRawLabelsRecovered: unmapped,
        entries: finalVocab,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`Wrote v5 vocabulary to ${V5_VOCAB_PATH}`);

  console.log('\n=== Step 3: rebuild archetypes (no AI call) ===');
  const vocabByName = new Map(finalVocab.map((e) => [e.name, e]));
  const finalMapping = buildMapping(finalVocab);
  const v5Archetypes = buildV5Archetypes(v3Archetypes, finalMapping, vocabByName);
  const singletonCount = v5Archetypes.filter((a) => a.memberCount === 1).length;
  const emptyGroup = v5Archetypes.find((a) => a.signature === '');
  const emptyExampleCount = emptyGroup?.memberCount || 0;
  console.log(`${v5Archetypes.length} archetypes, ${singletonCount} singletons, ${emptyExampleCount} examples still empty-signature.`);

  console.log('\n=== Step 4: hold-out (MTH 102 TUTORIAL 2026) ===');
  const holdoutContent = await loadHoldoutMaterial();
  const tutorialQuestions = await extractTutorialQuestions(holdoutContent, usage);
  console.log(`${tutorialQuestions.length} tutorial questions extracted.`);

  await sleep(MIN_MS_BETWEEN_CALLS);
  const vocabNames = finalVocab.map((e) => e.name);
  const { results: holdoutLabeled, coercedCount } = await labelHoldoutQuestionsConstrained(tutorialQuestions, vocabNames, usage);

  const referenceArchetypes = v5Archetypes.filter((a) => a.signature !== '');
  const referenceBySignature = new Map(referenceArchetypes.map((a) => [a.signature, a]));

  const holdoutResults = holdoutLabeled.map((h) => {
    const signature = buildHoldoutSignature(h.actionLabels, vocabByName);
    const unmappedCount = h.actionLabels.filter((l) => l === 'UNMAPPED').length;
    const matched = signature !== '' ? referenceBySignature.get(signature) : undefined;
    return { questionIndex: h.questionIndex, signature, unmappedCount, fits: Boolean(matched) };
  });

  const fitCount = holdoutResults.filter((r) => r.fits).length;
  const coverageScore = tutorialQuestions.length > 0 ? fitCount / tutorialQuestions.length : 0;
  const totalUnmapped = holdoutResults.reduce((sum, r) => sum + r.unmappedCount, 0);
  console.log(`coverageScore = ${fitCount} / ${tutorialQuestions.length} = ${coverageScore.toFixed(3)}`);

  const differentiationIndexes = holdoutResults
    .map((r) => r.questionIndex)
    .filter((idx) => /power rule|chain rule|product rule|quotient rule|dy\/dx|derivative/i.test(tutorialQuestions[idx]?.questionText || ''));
  const differentiationSignatures = new Set(
    differentiationIndexes.map((idx) => {
      const sig = holdoutResults.find((r) => r.questionIndex === idx)?.signature || '';
      return sig === '' ? `__empty_${idx}` : sig;
    }),
  );

  const generatedAt = new Date().toISOString();
  const usageLines = Object.entries(usage).flatMap(([phase, models]) => Object.entries(models).map(([model, count]) => `  - ${phase}: ${model} x${count}`));

  const md = [
    '# Archetype Extraction Experiment v5 — MTH 102',
    '',
    `Captured ${generatedAt}. Standalone experiment, not wired into any job/queue. No database writes (vocabulary cache and this report are the only file artifacts besides the reused v3/v4 caches).`,
    '',
    '## Methodology',
    '',
    "- **v4 -> v5 change:** matching logic is UNCHANGED (exact ordered discriminating-only signature, same as v3/v4). Only the vocabulary changes: Step 1 splits v4's 6 catch-all GENERIC entries (`evaluate limit`, `evaluate integral`, `calculate derivative`, `assign variables`, `simplify expression`, `miscellaneous operations`) into real named techniques; `miscellaneous operations` is deleted outright, every one of its aliases reassigned to a genuinely-fitting entry. Step 2 reclassifies EVERY entry (touched or not) as DISCRIMINATING/GENERIC using empirical evidence — real example problems where the operation appears — rather than how the label sounds, fixing v4's tendency to call bookkeeping-sounding-but-actually-diagnostic operations (like direct substitution) GENERIC by default.",
    '- Step 0 (implicit) reused the same cached v3 archetype data as v4 — no re-extraction, no re-labeling of the 356 examples.',
    `- Step 1 split summary: ${splitSummary.map((s) => `\`${s.from}\` -> ${s.intoCount} sub-operations`).join('; ')}.`,
    `- Step 2 reclassification used up to ${EVIDENCE_SAMPLE_SIZE} real example problems per entry (drawn from the cached v3 archetype data) as evidence, batched in groups of ${RECLASSIFY_BATCH_SIZE}, temperature=${RECLASSIFY_TEMPERATURE}.`,
    `- Step 4 hold-out read "${HOLDOUT_TITLE}" fresh, extracted its questions (1 call), then labeled each in batches of at most ${LABEL_BATCH_SIZE}, hard-constrained to the new frozen vocabulary or "UNMAPPED". Closed-vocabulary violations coerced in code: ${coercedCount}.`,
    '- No AI-generated Question rows or GeneratedTextbookSection content were read anywhere in this experiment.',
    '- Model usage per phase:',
    ...usageLines,
    '',
    '## Step 1-2 — vocabulary',
    '',
    `**${finalVocab.length} entries** (${discCount} DISCRIMINATING, ${genericCount} GENERIC). ${unmapped.length} raw label(s) needed post-hoc recovery.`,
    '',
    '### DISCRIMINATING entries',
    '',
    finalVocab.filter((e) => e.classification === 'DISCRIMINATING').map((e) => `- \`${e.name}\` (${e.aliases.length} alias${e.aliases.length === 1 ? '' : 'es'})`).join('\n'),
    '',
    '### GENERIC entries',
    '',
    finalVocab.filter((e) => e.classification === 'GENERIC').map((e) => `- \`${e.name}\` (${e.aliases.length} alias${e.aliases.length === 1 ? '' : 'es'})`).join('\n'),
    '',
    '## Step 3 — rebuilt archetypes',
    '',
    `**${v5Archetypes.length} archetypes**, ${singletonCount} singletons. ${emptyExampleCount} of ${v3Archetypes.reduce((s, a) => s + a.memberCount, 0)} examples still have an empty discriminating-only signature (down from 178 in v4)${emptyGroup ? ` — across ${emptyGroup.memberV3ArchetypeCount} v3 archetypes` : ''}.`,
    '',
    '### Top 15 archetypes by member count',
    '',
    v5Archetypes.slice(0, 15).map((a) => `- **[memberCount=${a.memberCount}]** \`${a.signature || '(empty)'}\`\n  - canonicalStem: ${a.canonicalStem}`).join('\n'),
    '',
    '## Step 4 — hold-out test (MTH 102 TUTORIAL 2026)',
    '',
    `${tutorialQuestions.length} questions extracted.`,
    '',
    `**coverageScore = ${fitCount} / ${tutorialQuestions.length} = ${coverageScore.toFixed(3)}**`,
    '',
    `Total UNMAPPED step labels: ${totalUnmapped}.`,
    '',
    `Differentiation-related questions (${differentiationIndexes.length} identified) produced **${differentiationSignatures.size} distinct signature(s)** (matching logic unchanged from v4 — exact ordered match only).`,
    '',
    '### Full per-question results',
    '',
    ...holdoutResults.map((r) => `- Q${r.questionIndex} (${r.fits ? 'FIT' : 'NO FIT'}, ${r.unmappedCount} UNMAPPED): "${tutorialQuestions[r.questionIndex]?.questionText.slice(0, 120)}"\n  - signature: \`${r.signature || '(empty)'}\``),
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, md, 'utf-8');
  console.log(`\nWrote report to ${OUTPUT_PATH}`);

  console.log('\n=== Summary ===');
  console.log(
    JSON.stringify(
      {
        vocabularyEntryCount: finalVocab.length,
        discriminatingCount: discCount,
        genericCount,
        v5ArchetypeCount: v5Archetypes.length,
        singletonCount,
        emptySignatureExampleCount: emptyExampleCount,
        tutorialQuestionCount: tutorialQuestions.length,
        coverageScore: Number(coverageScore.toFixed(3)),
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

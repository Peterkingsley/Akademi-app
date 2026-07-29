// STANDALONE EXPERIMENT (v6) — not wired into any job, queue, or JOB_NAMES entry. Run manually via
// `npx tsx src/scripts/experiment-archetype-extraction-v6.ts` (add `--run-full` to execute after
// reviewing the call-volume estimate). Read-only against the database (only Step 4's fresh
// tutorial read touches it); writes nothing to it.
//
// v5's Step 2 (empirical reclassification via AI, using ~5 raw problem statements per entry as
// "evidence") backfired: it flipped 8 well-established DISCRIMINATING techniques to GENERIC
// (apply power rule, apply chain rule, apply product rule, apply u-substitution, apply
// trigonometric identity, apply fundamental theorem of calculus, apply absolute value definition,
// apply quadratic formula) because those techniques recur across many superficially-different-
// looking word problems — the model read surface variety as solution-form variety. v6 throws that
// step out entirely and reclassifies by fixed rule, no model call:
//   Rule 1: an entry present in v4 (untouched by v5's split — i.e. not one of the 6 catch-alls)
//           keeps its v4 classification, full stop.
//   Rule 2: a NEW entry (created by v5's split) that names a specific technique is DISCRIMINATING
//           — that's the whole reason it was split out.
//   Rule 3: a NEW entry that is a residual/leftover bucket from a split (vague, still-generic
//           phrasing that the split process couldn't cleanly break down further) is GENERIC.
// v6 also changes how an empty signature is treated: instead of being excluded from matching
// entirely, it becomes its own real archetype, "DIRECT_EVALUATION" (the problem needed no
// distinctive technique) — applied identically to the cached examples and the hold-out questions.

import fs from 'fs';
import path from 'path';
import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';

const HOLDOUT_TITLE = 'MTH 102 TUTORIAL 2026';
const COURSE_CODE = 'MTH 102';
const LABEL_BATCH_SIZE = 5;
const MIN_MS_BETWEEN_CALLS = 4500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const HOLDOUT_LABEL_TEMPERATURE = 0.2;
const DIRECT_EVALUATION = 'DIRECT_EVALUATION';

const LABELS_V3_CACHE_PATH = path.join(__dirname, '../../../docs/mth102-labels-v3.json');
const V4_VOCAB_PATH = path.join(__dirname, '../../../docs/mth102-operation-vocabulary.json');
const V5_VOCAB_PATH = path.join(__dirname, '../../../docs/mth102-operation-vocabulary-v2.json');
const V6_VOCAB_PATH = path.join(__dirname, '../../../docs/mth102-operation-vocabulary-v3.json');
const OUTPUT_PATH = path.join(__dirname, '../../../docs/archetype-experiment-mth102-v6.md');

const CATCHALLS_SPLIT_IN_V5 = ['evaluate limit', 'evaluate integral', 'calculate derivative', 'assign variables', 'simplify expression', 'miscellaneous operations'];

type V3Archetype = { signature: string; memberCount: number; canonicalStem: string };
type Classification = 'DISCRIMINATING' | 'GENERIC';
type VocabEntry = { name: string; classification: Classification; aliases: string[] };
type V6Archetype = { signature: string; memberCount: number; canonicalStem: string; memberV3ArchetypeCount: number };
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

function loadV3Archetypes(): V3Archetype[] {
  return JSON.parse(fs.readFileSync(LABELS_V3_CACHE_PATH, 'utf-8')).archetypes;
}
function loadV4Vocab(): VocabEntry[] {
  return JSON.parse(fs.readFileSync(V4_VOCAB_PATH, 'utf-8')).entries;
}
function loadV5Vocab(): VocabEntry[] {
  return JSON.parse(fs.readFileSync(V5_VOCAB_PATH, 'utf-8')).entries;
}

// ─── Step 1: deterministic reclassification, zero model calls ─────────────────────────────────
// Rule 2/3 judgment for every entry v5's split process created (84 - 44 untouched = 40 entries).
// This was produced by manual inspection of each entry's full alias list (see the v6 follow-up
// conversation) — not a runtime heuristic, since "names a specific technique" vs. "is a residual
// leftover bucket" is exactly the kind of judgment call that can't be reduced to a string pattern.
const RULE_2_3_CLASSIFICATION: Record<string, Classification> = {
  // real, specific limit techniques
  'apply limit definition': 'DISCRIMINATING',
  'evaluate one-sided limits': 'DISCRIMINATING',
  'evaluate standard limit': 'DISCRIMINATING',
  // residual/leftover limit buckets
  'apply limit laws': 'GENERIC',
  'evaluate limit of components': 'GENERIC',
  'general limit evaluation': 'GENERIC', // the user's own named example of a residual bucket

  // real, specific integration techniques
  'integrate trigonometric function': 'DISCRIMINATING',
  'integrate exponential function': 'DISCRIMINATING',
  'integrate reciprocal function': 'DISCRIMINATING',
  'set up sum of integrals': 'DISCRIMINATING',
  'split integral': 'DISCRIMINATING',
  'split integral at discontinuity': 'DISCRIMINATING',
  // residual/leftover integration buckets
  'apply fundamental integration formula': 'GENERIC',
  'evaluate definite integral': 'GENERIC',
  'set up integral': 'GENERIC',
  'rewrite integrand': 'GENERIC',

  // real, specific derivative techniques
  'calculate higher-order derivative': 'DISCRIMINATING',
  'differentiate polynomial': 'DISCRIMINATING',
  // residual/leftover derivative buckets and bookkeeping sub-steps
  'calculate first derivative': 'GENERIC',
  'differentiate quotient component': 'GENERIC',
  'algebraic manipulation of derivatives': 'GENERIC',

  // real, specific setup techniques (tied to an identifiable method)
  'define substitution and shell variables': 'DISCRIMINATING', // u-substitution / shell method setup
  'define interval and endpoint parameters': 'DISCRIMINATING', // epsilon-delta / interval-based problem setup
  'construct linear equations': 'DISCRIMINATING', // point-slope form, e.g. tangent line problems
  'swap variables': 'DISCRIMINATING', // inverse-function technique
  // residual/leftover word-problem setup buckets
  'assign variables': 'GENERIC', // v5 kept the original catch-all's own name for its unsplit residual core
  'define functions': 'GENERIC',
  'define specific mathematical functions': 'GENERIC',
  'define sets and subsets': 'GENERIC',

  // real, specific algebraic techniques
  'cancel common factors': 'DISCRIMINATING', // paired with factoring specifically to resolve a removable singularity
  'rewrite trigonometric expression': 'DISCRIMINATING', // trig-identity manipulation, a real distinguishing technique
  // generic algebra bookkeeping, applies broadly regardless of technique
  'combine like terms': 'GENERIC',
  'distribute terms': 'GENERIC',
  'expand polynomial': 'GENERIC',
  'factor expression': 'GENERIC',
  'rewrite using exponent rules': 'GENERIC',
  'rewrite using radical rules': 'GENERIC',
  'simplify fraction': 'GENERIC',
  'simplify arithmetic and coefficients': 'GENERIC',
  'general algebraic manipulation': 'GENERIC', // explicit "general" residual, same pattern as general limit evaluation
};

function buildV6Vocabulary(v4Vocab: VocabEntry[], v5Vocab: VocabEntry[]): VocabEntry[] {
  const v4ByName = new Map(v4Vocab.map((e) => [e.name, e]));
  const untouchedNames = new Set(v4Vocab.filter((e) => !CATCHALLS_SPLIT_IN_V5.includes(e.name)).map((e) => e.name));

  return v5Vocab.map((e) => {
    if (untouchedNames.has(e.name)) {
      // Rule 1 — restore the v4 classification verbatim, no re-evaluation.
      return { ...e, classification: v4ByName.get(e.name)!.classification };
    }
    const ruled = RULE_2_3_CLASSIFICATION[e.name];
    if (!ruled) throw new Error(`No Rule 2/3 classification recorded for new entry "${e.name}" — update RULE_2_3_CLASSIFICATION`);
    return { ...e, classification: ruled };
  });
}

// ─── Step 2/3: rebuild archetypes, empty signature -> DIRECT_EVALUATION, deterministic ─────────
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
  const signature = disc.join(' -> ');
  return signature === '' ? DIRECT_EVALUATION : signature;
}

function buildV6Archetypes(v3Archetypes: V3Archetype[], mapping: Record<string, string>, vocabByName: Map<string, VocabEntry>): V6Archetype[] {
  const groups = new Map<string, { memberCount: number; canonicalStem: string; v3Count: number }>();
  for (const a of v3Archetypes) {
    const signature = discSignatureForRaw(a.signature, mapping, vocabByName);
    if (!groups.has(signature)) groups.set(signature, { memberCount: 0, canonicalStem: a.canonicalStem, v3Count: 0 });
    const g = groups.get(signature)!;
    g.memberCount += a.memberCount;
    g.v3Count += 1;
    if (signature !== DIRECT_EVALUATION && a.canonicalStem.length > 0 && (g.canonicalStem.length === 0 || a.canonicalStem.length < g.canonicalStem.length)) {
      g.canonicalStem = a.canonicalStem;
    }
  }
  return Array.from(groups.entries())
    .map(([signature, g]) => ({ signature, memberCount: g.memberCount, canonicalStem: g.canonicalStem, memberV3ArchetypeCount: g.v3Count }))
    .sort((a, b) => b.memberCount - a.memberCount);
}

// ─── Step 4: hold-out, constrained to vocabulary-v3 ────────────────────────────────────────────
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
  const signature = actionLabels.filter((l) => l !== 'UNMAPPED' && vocabByName.get(l)?.classification === 'DISCRIMINATING').join(' -> ');
  return signature === '' ? DIRECT_EVALUATION : signature;
}

function estimateCallVolume(tutorialCount: number): Record<string, number> {
  return {
    step4Extraction: 1,
    step4Labeling: Math.ceil(tutorialCount / LABEL_BATCH_SIZE),
    roughFloor: 1 + Math.ceil(tutorialCount / LABEL_BATCH_SIZE),
  };
}

async function main() {
  const usage: ModelUsage = {};
  const args = new Set(process.argv.slice(2));

  console.log('=== Step 1: deterministic reclassification (no model call) ===');
  const v3Archetypes = loadV3Archetypes();
  const v4Vocab = loadV4Vocab();
  const v5Vocab = loadV5Vocab();
  const v6Vocab = buildV6Vocabulary(v4Vocab, v5Vocab);
  const discCount = v6Vocab.filter((e) => e.classification === 'DISCRIMINATING').length;
  const genericCount = v6Vocab.filter((e) => e.classification === 'GENERIC').length;

  const changedFromV5 = v6Vocab.filter((e) => {
    const v5e = v5Vocab.find((x) => x.name === e.name)!;
    return v5e.classification !== e.classification;
  });
  console.log(`${v6Vocab.length} entries (unchanged from v5's split), ${discCount} DISCRIMINATING, ${genericCount} GENERIC.`);
  console.log(`${changedFromV5.length} entries differ from v5's classification.`);

  fs.mkdirSync(path.dirname(V6_VOCAB_PATH), { recursive: true });
  fs.writeFileSync(
    V6_VOCAB_PATH,
    JSON.stringify(
      {
        note: 'FROZEN. Same 84 entries/aliases as docs/mth102-operation-vocabulary-v2.json (v5) — only classification changed, by fixed rule (no model call): entries untouched by v5\'s split keep their v4 classification verbatim; new entries are DISCRIMINATING if they name a specific technique, GENERIC if they are a residual/leftover bucket from a split. See RULE_2_3_CLASSIFICATION in experiment-archetype-extraction-v6.ts for the per-entry judgment.',
        generatedAt: new Date().toISOString(),
        entryCount: v6Vocab.length,
        discriminatingCount: discCount,
        genericCount,
        changedFromV5Count: changedFromV5.length,
        changedFromV5: changedFromV5.map((e) => ({ name: e.name, v5Classification: v5Vocab.find((x) => x.name === e.name)!.classification, v6Classification: e.classification })),
        entries: v6Vocab,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`Wrote v6 vocabulary to ${V6_VOCAB_PATH}`);

  console.log('\n=== Step 2-3: rebuild archetypes (empty -> DIRECT_EVALUATION, no AI call) ===');
  const vocabByName = new Map(v6Vocab.map((e) => [e.name, e]));
  const mapping = buildMapping(v6Vocab);
  const v6Archetypes = buildV6Archetypes(v3Archetypes, mapping, vocabByName);
  const singletonCount = v6Archetypes.filter((a) => a.memberCount === 1).length;
  const directEval = v6Archetypes.find((a) => a.signature === DIRECT_EVALUATION);
  console.log(`${v6Archetypes.length} archetypes, ${singletonCount} singletons. DIRECT_EVALUATION covers ${directEval?.memberCount || 0} examples.`);

  const volumeEstimate = estimateCallVolume(36);
  console.log('\nEstimated call volume for Step 4:');
  console.log(JSON.stringify(volumeEstimate, null, 2));

  if (!args.has('--run-full')) {
    console.log('\nDry run only (pass --run-full to execute Step 4). Exiting.');
    return;
  }

  console.log('\n=== Step 4: hold-out (MTH 102 TUTORIAL 2026) ===');
  const holdoutContent = await loadHoldoutMaterial();
  const tutorialQuestions = await extractTutorialQuestions(holdoutContent, usage);
  console.log(`${tutorialQuestions.length} tutorial questions extracted.`);

  await sleep(MIN_MS_BETWEEN_CALLS);
  const vocabNames = v6Vocab.map((e) => e.name);
  const { results: holdoutLabeled, coercedCount } = await labelHoldoutQuestionsConstrained(tutorialQuestions, vocabNames, usage);

  const referenceBySignature = new Map(v6Archetypes.map((a) => [a.signature, a]));
  const holdoutResults = holdoutLabeled.map((h) => {
    const signature = buildHoldoutSignature(h.actionLabels, vocabByName);
    const unmappedCount = h.actionLabels.filter((l) => l === 'UNMAPPED').length;
    const matched = referenceBySignature.get(signature);
    return { questionIndex: h.questionIndex, signature, unmappedCount, fits: Boolean(matched) };
  });

  const fitCount = holdoutResults.filter((r) => r.fits).length;
  const coverageScore = tutorialQuestions.length > 0 ? fitCount / tutorialQuestions.length : 0;
  const directEvalMatches = holdoutResults.filter((r) => r.fits && r.signature === DIRECT_EVALUATION).length;
  const totalUnmapped = holdoutResults.reduce((sum, r) => sum + r.unmappedCount, 0);
  console.log(`coverageScore = ${fitCount} / ${tutorialQuestions.length} = ${coverageScore.toFixed(3)}`);
  console.log(`Of those fits, ${directEvalMatches} matched DIRECT_EVALUATION.`);

  const differentiationIndexes = holdoutResults
    .map((r) => r.questionIndex)
    .filter((idx) => /power rule|chain rule|product rule|quotient rule|dy\/dx|derivative/i.test(tutorialQuestions[idx]?.questionText || ''));
  const differentiationSignatures = new Set(differentiationIndexes.map((idx) => holdoutResults.find((r) => r.questionIndex === idx)?.signature));

  const generatedAt = new Date().toISOString();
  const usageLines = Object.entries(usage).flatMap(([phase, models]) => Object.entries(models).map(([model, count]) => `  - ${phase}: ${model} x${count}`));

  const md = [
    '# Archetype Extraction Experiment v6 — MTH 102',
    '',
    `Captured ${generatedAt}. Standalone experiment, not wired into any job/queue. No database writes (vocabulary cache and this report are the only file artifacts besides the reused v3/v4/v5 caches).`,
    '',
    '## Methodology',
    '',
    "- **v5 -> v6 change:** v5's vocabulary SPLITS are kept exactly as-is (same 84 entries/aliases). Its Step 2 classification is discarded entirely — that AI-judged empirical reclassification flipped 8 well-established techniques (apply power rule, apply chain rule, apply product rule, apply u-substitution, apply trigonometric identity, apply fundamental theorem of calculus, apply absolute value definition, apply quadratic formula) to GENERIC because it read superficial problem-statement variety as solution-form variety.",
    '- Step 1 reclassifies by fixed rule, zero model calls: an entry untouched by v5\'s split keeps its v4 classification verbatim (Rule 1); a new entry naming a specific technique is DISCRIMINATING (Rule 2); a new entry that is a residual/leftover bucket from a split is GENERIC (Rule 3). Per-entry judgment is a hardcoded lookup in the script, reviewed by hand against each entry\'s full alias list.',
    '- Steps 2-3 (rebuilding archetypes) are unchanged in mechanism from v4/v5 — deterministic exact-signature grouping — except an empty discriminating-only signature is no longer excluded: it becomes its own real archetype, `DIRECT_EVALUATION`, applied identically to the cached examples (Step 3) and the hold-out questions (Step 4).',
    `- Step 4 hold-out read "${HOLDOUT_TITLE}" fresh, extracted its questions (1 call), then labeled each in batches of at most ${LABEL_BATCH_SIZE}, hard-constrained to vocabulary-v3 or "UNMAPPED". Closed-vocabulary violations coerced in code: ${coercedCount}.`,
    '- No AI-generated Question rows or GeneratedTextbookSection content were read anywhere in this experiment.',
    '- Model usage per phase:',
    ...usageLines,
    '',
    '## Step 1 — deterministic reclassification',
    '',
    `**${v6Vocab.length} entries** (unchanged from v5's split), **${discCount} DISCRIMINATING, ${genericCount} GENERIC**.`,
    '',
    `### Entries whose class differs from v5 (${changedFromV5.length})`,
    '',
    changedFromV5
      .map((e) => {
        const v5e = v5Vocab.find((x) => x.name === e.name)!;
        return `- \`${e.name}\`: v5=${v5e.classification} -> v6=${e.classification}`;
      })
      .join('\n'),
    '',
    '## Step 2-3 — rebuilt archetypes',
    '',
    `**${v6Archetypes.length} archetypes**, ${singletonCount} singletons. \`DIRECT_EVALUATION\` covers **${directEval?.memberCount || 0}** of ${v3Archetypes.reduce((s, a) => s + a.memberCount, 0)} examples (across ${directEval?.memberV3ArchetypeCount || 0} v3 archetypes).`,
    '',
    '### Top 15 archetypes by member count',
    '',
    v6Archetypes.slice(0, 15).map((a) => `- **[memberCount=${a.memberCount}]** \`${a.signature}\`\n  - canonicalStem: ${a.signature === DIRECT_EVALUATION ? '_(represents many different trivial problems, no single representative)_' : a.canonicalStem}`).join('\n'),
    '',
    '## Step 4 — hold-out test (MTH 102 TUTORIAL 2026)',
    '',
    `${tutorialQuestions.length} questions extracted.`,
    '',
    `**coverageScore = ${fitCount} / ${tutorialQuestions.length} = ${coverageScore.toFixed(3)}**`,
    '',
    `Of the ${fitCount} fits, **${directEvalMatches}** matched \`DIRECT_EVALUATION\`.`,
    '',
    `Total UNMAPPED step labels: ${totalUnmapped}.`,
    '',
    `Differentiation-related questions (${differentiationIndexes.length} identified) produced **${differentiationSignatures.size} distinct signature(s)**.`,
    '',
    '### Full per-question results',
    '',
    ...holdoutResults.map((r) => `- Q${r.questionIndex} (${r.fits ? 'FIT' : 'NO FIT'}, ${r.unmappedCount} UNMAPPED): "${tutorialQuestions[r.questionIndex]?.questionText.slice(0, 120)}"\n  - signature: \`${r.signature}\``),
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, md, 'utf-8');
  console.log(`\nWrote report to ${OUTPUT_PATH}`);

  console.log('\n=== Summary ===');
  console.log(
    JSON.stringify(
      {
        vocabularyEntryCount: v6Vocab.length,
        discriminatingCount: discCount,
        genericCount,
        changedFromV5Count: changedFromV5.length,
        v6ArchetypeCount: v6Archetypes.length,
        singletonCount,
        directEvaluationMemberCount: directEval?.memberCount || 0,
        tutorialQuestionCount: tutorialQuestions.length,
        coverageScore: Number(coverageScore.toFixed(3)),
        directEvaluationMatches: directEvalMatches,
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

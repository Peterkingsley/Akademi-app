// STANDALONE EXPERIMENT — not wired into any job, queue, or JOB_NAMES entry. Run manually via
// `npx tsx src/scripts/experiment-archetype-extraction.ts`. Read-only against the database
// (Material, GeneratedTextbookOutline/Node for topic context only); writes nothing to the DB.
// Output is a single markdown report on disk.
//
// Question this answers: can we extract a stable, reusable inventory of question ARCHETYPES
// (distinct solution forms) from real teaching material, well enough that it actually covers
// the kinds of questions students are given later?
//
// Input discipline (see the task this came from):
//   - Archetype extraction reads ONLY the three named MTH 102 lecture/notes materials below.
//   - "MTH 102 TUTORIAL 2026" is a held-out answer key — it is never read until the hold-out
//     test phase, and never appears in any archetype-extraction prompt.
//   - No AI-generated Question rows or GeneratedTextbookSection content are read anywhere in
//     this script — only real, human-authored student uploads, plus outline node
//     title/learning_outcome (not the generated prose) for topic-grouping context.

import fs from 'fs';
import path from 'path';
import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';

const SOURCE_TITLES = ['MTH 102 CALCULUS LECTURE NOTES', 'MTH 102 LECTURE 1', 'MTH 102 LECTURE 1 CONT.'];
const HOLDOUT_TITLE = 'MTH 102 TUTORIAL 2026';
const COURSE_CODE = 'MTH 102';
const NUM_RUNS = 3;
const EXTRACTION_TEMPERATURE = 0.7;
const OUTPUT_PATH = path.join(__dirname, '../../../docs/archetype-experiment-mth102.md');

type Archetype = {
  topic: string;
  trigger: string;
  method: string;
  canonicalStem: string;
  distinctBecause: string;
};

type CanonicalArchetype = Archetype & { foundInRuns: number[] };

type TutorialQuestion = { questionText: string };

type FitResult = {
  questionIndex: number;
  fits: boolean;
  archetypeIndex: number | null;
  reason: string;
};

function parseJsonObject(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('AI did not return valid JSON');
  }
}

async function loadSourceMaterials() {
  const materials = await prisma.material.findMany({
    where: { is_akademi_generated: false, course_code: COURSE_CODE, title: { in: SOURCE_TITLES } },
    select: { title: true, content: true },
  });

  const byTitle = new Map(materials.map((m) => [m.title, m.content || '']));
  const missing = SOURCE_TITLES.filter((t) => !byTitle.has(t) || !byTitle.get(t)?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing or empty source material(s): ${missing.join(', ')}`);
  }

  return SOURCE_TITLES.map((title) => ({ title, content: byTitle.get(title)!.trim() }));
}

async function loadHoldoutMaterial() {
  const material = await prisma.material.findFirst({
    where: { is_akademi_generated: false, course_code: COURSE_CODE, title: HOLDOUT_TITLE },
    select: { content: true },
  });
  if (!material?.content?.trim()) {
    throw new Error(`Hold-out material "${HOLDOUT_TITLE}" not found or empty`);
  }
  return material.content.trim();
}

async function loadTopicList(): Promise<string[]> {
  const outline = await prisma.generatedTextbookOutline.findFirst({
    where: { course_code: COURSE_CODE, is_current: true },
    select: { id: true },
  });
  if (!outline) return [];

  const nodes = await prisma.generatedTextbookOutlineNode.findMany({
    where: { outline_id: outline.id },
    select: { depth: true, order_index: true, title: true },
    orderBy: { order_index: 'asc' },
  });

  return nodes.map((n) => `${'  '.repeat(n.depth)}- ${n.title}`);
}

function buildExtractionPrompt(sources: Array<{ title: string; content: string }>, topicList: string[]): string {
  return `You are extracting ARCHETYPES from real teaching material for MTH 102 (Elementary Mathematics II).

DEFINITION: An archetype is a distinct solution form — a kind of problem where the sequence of solving actions is the same, and only values, letters, or context change. Two problems that differ only in numbers or letters are the SAME archetype.

MERGE RULE: If you cannot state in one sentence how an archetype's action sequence differs from every OTHER archetype you report, merge them into a single archetype instead. Be conservative — undercount rather than inflate. Do not split one method into multiple archetypes just because it was demonstrated on different-looking problems.

For each DISTINCT archetype you find, report:
- topic: the single closest-matching topic from this list (copy verbatim), or "unmatched" if truly none fit:
${topicList.join('\n')}
- trigger: what you notice in a problem that signals this form applies
- method: the general solving procedure — described in terms of the actions taken, not tied to specific numbers
- canonicalStem: the simplest possible problem statement that still requires the full method (write an actual problem, not a description of one)
- distinctBecause: one sentence on how this archetype's action sequence differs from every other archetype you are reporting in this same response

SOURCE MATERIAL (three real lecture/notes documents — this is the ONLY material you may draw archetypes from):

${sources.map((s) => `=== ${s.title} ===\n${s.content}`).join('\n\n')}

Format as JSON: { "archetypes": [ { "topic": string, "trigger": string, "method": string, "canonicalStem": string, "distinctBecause": string } ] }`;
}

async function runExtraction(sources: Array<{ title: string; content: string }>, topicList: string[]): Promise<Archetype[]> {
  const prompt = buildExtractionPrompt(sources, topicList);
  const output = await aiProvider.generateResponse(prompt, {
    systemPrompt: 'You are a meticulous curriculum analyst identifying distinct problem-solving archetypes. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 6000,
    extendedTimeouts: true,
    temperature: EXTRACTION_TEMPERATURE,
  });
  const parsed = parseJsonObject(output);
  const archetypes = Array.isArray(parsed?.archetypes) ? parsed.archetypes : [];
  return archetypes
    .map((a: any) => ({
      topic: String(a?.topic || '').trim(),
      trigger: String(a?.trigger || '').trim(),
      method: String(a?.method || '').trim(),
      canonicalStem: String(a?.canonicalStem || '').trim(),
      distinctBecause: String(a?.distinctBecause || '').trim(),
    }))
    .filter((a: Archetype) => a.trigger && a.method && a.canonicalStem);
}

async function canonicalizeRuns(runs: Archetype[][]): Promise<CanonicalArchetype[]> {
  const prompt = `Three independent extraction runs each produced a list of problem-solving ARCHETYPES from the same source material. An archetype is a distinct solution form — same rule as before: two archetypes are the SAME archetype if you cannot state in one sentence how their action sequences differ; if so, merge them into one.

Cluster all archetypes below (across all 3 runs) into a canonical, deduplicated list. For each canonical archetype:
- Synthesize ONE clear trigger/method/canonicalStem/distinctBecause from whichever run(s) described it (pick the clearest wording, or combine them)
- List which run number(s) — 1, 2, and/or 3 — contributed something matching this canonical archetype
- Only merge if the action sequence is genuinely the same. If one archetype requires a step the other doesn't, they are NOT the same — keep them separate.

RUN 1:
${JSON.stringify(runs[0], null, 2)}

RUN 2:
${JSON.stringify(runs[1], null, 2)}

RUN 3:
${JSON.stringify(runs[2], null, 2)}

Format as JSON: { "canonicalArchetypes": [ { "topic": string, "trigger": string, "method": string, "canonicalStem": string, "distinctBecause": string, "foundInRuns": number[] } ] }`;

  const output = await aiProvider.generateResponse(prompt, {
    systemPrompt: 'You are auditing three independent extraction runs for consistency and deduplicating them. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 8000,
    extendedTimeouts: true,
    temperature: 0.2,
  });
  const parsed = parseJsonObject(output);
  const canonical = Array.isArray(parsed?.canonicalArchetypes) ? parsed.canonicalArchetypes : [];
  return canonical.map((a: any) => ({
    topic: String(a?.topic || '').trim(),
    trigger: String(a?.trigger || '').trim(),
    method: String(a?.method || '').trim(),
    canonicalStem: String(a?.canonicalStem || '').trim(),
    distinctBecause: String(a?.distinctBecause || '').trim(),
    foundInRuns: Array.isArray(a?.foundInRuns) ? a.foundInRuns.map((n: any) => Number(n)).filter((n: number) => !isNaN(n)) : [],
  }));
}

async function extractTutorialQuestions(holdoutContent: string): Promise<TutorialQuestion[]> {
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
  return questions
    .map((q: any) => ({ questionText: String(q?.questionText || '').trim() }))
    .filter((q: TutorialQuestion) => q.questionText);
}

async function checkFit(canonical: CanonicalArchetype[], questions: TutorialQuestion[]): Promise<FitResult[]> {
  const archetypeList = canonical
    .map((a, i) => `${i}. [${a.topic}] TRIGGER: ${a.trigger} | METHOD: ${a.method} | STEM: ${a.canonicalStem}`)
    .join('\n');
  const questionList = questions.map((q, i) => `${i}. ${q.questionText}`).join('\n\n');

  const prompt = `Here is an inventory of archetypes (distinct solution forms) discovered from lecture material:
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

function formatArchetype(a: Archetype, index?: number): string {
  const label = index !== undefined ? `${index}. ` : '';
  return [
    `${label}**[${a.topic}]**`,
    `- trigger: ${a.trigger}`,
    `- method: ${a.method}`,
    `- canonicalStem: ${a.canonicalStem}`,
    `- distinctBecause: ${a.distinctBecause}`,
  ].join('\n');
}

async function main() {
  console.log('Loading source materials (archetype extraction phase — hold-out NOT read yet)...');
  const sources = await loadSourceMaterials();
  const topicList = await loadTopicList();
  console.log(`Loaded ${sources.length} source materials, ${topicList.length} outline topics.\n`);

  const runs: Archetype[][] = [];
  for (let i = 0; i < NUM_RUNS; i += 1) {
    console.log(`Running extraction ${i + 1}/${NUM_RUNS} (temperature=${EXTRACTION_TEMPERATURE})...`);
    const archetypes = await runExtraction(sources, topicList);
    console.log(`  -> ${archetypes.length} archetypes found.`);
    runs.push(archetypes);
  }

  console.log('\nCanonicalizing across the 3 runs...');
  const canonical = await canonicalizeRuns(runs);
  console.log(`  -> ${canonical.length} canonical archetypes.`);

  const totalDistinct = canonical.length;
  const stableCount = canonical.filter((a) => new Set(a.foundInRuns).size >= NUM_RUNS).length;
  const stabilityScore = totalDistinct > 0 ? stableCount / totalDistinct : 0;
  const unstable = canonical.filter((a) => new Set(a.foundInRuns).size < NUM_RUNS);

  console.log(`  stabilityScore = ${stableCount}/${totalDistinct} = ${stabilityScore.toFixed(3)}`);

  console.log('\nLoading hold-out material (MTH 102 TUTORIAL 2026) — first read of it in this run...');
  const holdoutContent = await loadHoldoutMaterial();

  console.log('Extracting tutorial questions...');
  const tutorialQuestions = await extractTutorialQuestions(holdoutContent);
  console.log(`  -> ${tutorialQuestions.length} questions found.`);

  console.log('Checking fit against canonical archetypes...');
  const fitResults = await checkFit(canonical, tutorialQuestions);

  const fitCount = fitResults.filter((r) => r.fits).length;
  const coverageScore = tutorialQuestions.length > 0 ? fitCount / tutorialQuestions.length : 0;
  const uncovered = fitResults.filter((r) => !r.fits);
  const matchedArchetypeIndices = new Set(fitResults.filter((r) => r.fits && r.archetypeIndex !== null).map((r) => r.archetypeIndex));
  const neverMatchedArchetypes = canonical.filter((_, i) => !matchedArchetypeIndices.has(i));

  console.log(`  coverageScore = ${fitCount}/${tutorialQuestions.length} = ${coverageScore.toFixed(3)}`);

  const generatedAt = new Date().toISOString();
  const md = [
    '# Archetype Extraction Experiment — MTH 102',
    '',
    `Captured ${generatedAt}. Standalone experiment, not wired into any job/queue. No database writes.`,
    '',
    '## Methodology',
    '',
    `- Source (read for archetype extraction ONLY): ${SOURCE_TITLES.map((t) => `"${t}"`).join(', ')}.`,
    `- Held out (never read until the hold-out test phase below): "${HOLDOUT_TITLE}".`,
    `- No AI-generated Question rows or GeneratedTextbookSection content were read anywhere in this experiment.`,
    `- Topic grouping used the ${topicList.length} nodes of the current GeneratedTextbookOutline for MTH 102 (title/learning_outcome only — not the generated prose).`,
    `- Ran extraction ${NUM_RUNS} times independently, same input, temperature=${EXTRACTION_TEMPERATURE}.`,
    `- Cross-run matching/deduplication and hold-out fit-checking were done by a separate, lower-temperature (0.2) model call applying the same "one-sentence distinctBecause" merge rule as the extraction step itself — not string matching, since wording varies run to run.`,
    '',
    '## 1. Archetypes found per run',
    '',
    ...runs.flatMap((archetypes, i) => [
      `### Run ${i + 1} (${archetypes.length} archetypes)`,
      '',
      ...archetypes.map((a) => formatArchetype(a)),
      '',
    ]),
    '## 2 & 3. Canonical archetypes and stability',
    '',
    `**stabilityScore = ${stableCount} / ${totalDistinct} = ${stabilityScore.toFixed(3)}**`,
    '',
    '(archetypes appearing in all 3 runs / total distinct canonical archetypes found across all runs)',
    '',
    '### All canonical archetypes',
    '',
    ...canonical.map((a, i) => `${formatArchetype(a, i)}\n- foundInRuns: [${a.foundInRuns.join(', ')}]${new Set(a.foundInRuns).size >= NUM_RUNS ? ' — STABLE' : ' — UNSTABLE'}\n`),
    '### Unstable archetypes (appeared in 1 or 2 runs only)',
    '',
    unstable.length > 0
      ? unstable.map((a) => `- [${a.topic}] "${a.trigger}" — found in run(s) [${a.foundInRuns.join(', ')}]`).join('\n')
      : '_None — every archetype found was stable across all 3 runs._',
    '',
    '## Hold-out test — MTH 102 TUTORIAL 2026',
    '',
    `${tutorialQuestions.length} worked examples/exercise questions extracted from the hold-out document.`,
    '',
    `**coverageScore = ${fitCount} / ${tutorialQuestions.length} = ${coverageScore.toFixed(3)}**`,
    '',
    '(tutorial questions that fit a canonical archetype / total tutorial questions)',
    '',
    '### 5. Tutorial questions that fit NO archetype',
    '',
    uncovered.length > 0
      ? uncovered
          .map((r) => `- Q${r.questionIndex}: "${tutorialQuestions[r.questionIndex]?.questionText || '(unknown)'}"\n  - reason: ${r.reason}`)
          .join('\n')
      : '_None — every tutorial question fit a canonical archetype._',
    '',
    '### 6. Canonical archetypes that appear NOWHERE in the tutorial',
    '',
    neverMatchedArchetypes.length > 0
      ? neverMatchedArchetypes.map((a) => `- [${a.topic}] "${a.trigger}"`).join('\n')
      : '_None — every canonical archetype was matched by at least one tutorial question._',
    '',
    '### Full per-question fit results',
    '',
    ...fitResults.map((r) => {
      const q = tutorialQuestions[r.questionIndex];
      const archetypeLabel = r.fits && r.archetypeIndex !== null ? `archetype #${r.archetypeIndex} [${canonical[r.archetypeIndex]?.topic}]` : 'no match';
      return `- Q${r.questionIndex} (${r.fits ? 'FIT' : 'NO FIT'} — ${archetypeLabel}): "${q?.questionText?.slice(0, 150) || '(unknown)'}"\n  - ${r.reason}`;
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
        runsArchetypeCounts: runs.map((r) => r.length),
        totalDistinctCanonical: totalDistinct,
        stableCount,
        stabilityScore: Number(stabilityScore.toFixed(3)),
        unstableCount: unstable.length,
        tutorialQuestionCount: tutorialQuestions.length,
        coverageScore: Number(coverageScore.toFixed(3)),
        uncoveredCount: uncovered.length,
        neverMatchedArchetypeCount: neverMatchedArchetypes.length,
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

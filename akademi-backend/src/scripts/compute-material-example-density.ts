// PRODUCTION UTILITY — unlike the archetype experiment scripts, this one WRITES to the database
// (Material.extracted_example_count). Not wired into any job/queue or JOB_NAMES entry; run manually
// via `npx tsx src/scripts/compute-material-example-density.ts <mode>`.
//
// Purpose: measure worked-example density per Material using the same verbatim chunked extraction
// the archetype pipeline (v2-v7) uses, so density can gate which courses are even worth attempting
// archetype extraction on. Density = content.length / extracted example count. Course-level
// classification: DENSE < 1000 chars/example, MODERATE 1000-3000, SPARSE > 3000 (or 0 examples).
//
// Modes:
//   --estimate     free, no AI calls — how many materials/chars/chunks would be processed
//   --run          extract + write extracted_example_count to every qualifying, uncomputed
//                  Material row, then print the report (add --force to recompute already-scored
//                  rows too)
//   --report-only  free, no AI calls — print the report from whatever's already stored
//
// Scope: is_akademi_generated=false (real student-uploaded material only), verification_status !=
// TAKEN_DOWN, non-empty content. Materials with byte-identical content (confirmed cross-listed
// duplicates, e.g. the same file uploaded under two course codes) are extracted ONCE and the count
// is copied to every row sharing that content — avoids paying for the same extraction twice.

import crypto from 'crypto';
import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';

const CHUNK_SIZE = 8000;
const CHUNK_OVERLAP = 500;
const CHUNKS_PER_EXTRACTION_CALL = 2;
const MIN_MS_BETWEEN_CALLS = 4500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const DENSE_MAX = 1000;
const MODERATE_MAX = 3000;

type SourceChunk = { chunkId: string; chunkIndex: number; text: string };
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

function contentHash(content: string): string {
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

// Identical extraction call to v2/v3/v6/v7's extractFromChunkBatch (same prompt, same verbatim
// problemText+solutionSteps schema) — deliberately not a lighter "just count them" prompt, so the
// density measured here reflects exactly what the archetype pipeline's own extraction step finds,
// not a differently-calibrated count. The extracted text itself is discarded; only the count is
// kept (this script never persists worked-example text, only Material.extracted_example_count).
async function extractCountFromChunkBatch(batch: SourceChunk[], usage: ModelUsage): Promise<Map<string, number>> {
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
  recordUsage(usage, 'extract-count', model);

  const parsed = parseJsonObject(text);
  const results = new Map<string, number>();
  const chunkResults = Array.isArray(parsed?.chunkResults) ? parsed.chunkResults : [];
  for (const cr of chunkResults) {
    const chunkId = String(cr?.chunkId || '');
    const examples = Array.isArray(cr?.examples) ? cr.examples : [];
    const validCount = examples.filter((e: any) => String(e?.problemText || '').trim()).length;
    if (chunkId) results.set(chunkId, validCount);
  }
  for (const c of batch) if (!results.has(c.chunkId)) results.set(c.chunkId, 0);
  return results;
}

async function countExamplesInContent(content: string, usage: ModelUsage): Promise<number> {
  const pieces = chunkText(content.trim(), CHUNK_SIZE, CHUNK_OVERLAP);
  const chunks: SourceChunk[] = pieces.map((text, i) => ({ chunkId: `chunk${i}`, chunkIndex: i, text }));

  let total = 0;
  for (let i = 0; i < chunks.length; i += CHUNKS_PER_EXTRACTION_CALL) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const batch = chunks.slice(i, i + CHUNKS_PER_EXTRACTION_CALL);
    const results = await extractCountFromChunkBatch(batch, usage);
    for (const c of batch) total += results.get(c.chunkId) || 0;
  }
  return total;
}

function classify(charsPerExample: number | null): 'DENSE' | 'MODERATE' | 'SPARSE' {
  if (charsPerExample === null) return 'SPARSE'; // 0 examples
  if (charsPerExample < DENSE_MAX) return 'DENSE';
  if (charsPerExample <= MODERATE_MAX) return 'MODERATE';
  return 'SPARSE';
}

async function loadQualifyingMaterials(includeAlreadyComputed: boolean) {
  const materials = await prisma.material.findMany({
    where: {
      is_akademi_generated: false,
      verification_status: { not: 'TAKEN_DOWN' },
      ...(includeAlreadyComputed ? {} : { extracted_example_count: null }),
    },
    select: { id: true, title: true, course_code: true, content: true, extracted_example_count: true },
  });
  return materials.filter((m) => (m.content?.trim().length || 0) > 0);
}

function groupByContentHash<T extends { content: string | null }>(materials: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const m of materials) {
    const hash = contentHash(m.content!);
    if (!groups.has(hash)) groups.set(hash, []);
    groups.get(hash)!.push(m);
  }
  return groups;
}

async function runEstimate() {
  const materials = await loadQualifyingMaterials(false);
  const groups = groupByContentHash(materials);
  const uniqueChars = Array.from(groups.values()).reduce((sum, rows) => sum + (rows[0].content?.length || 0), 0);
  const totalChunks = Array.from(groups.values()).reduce((sum, rows) => sum + chunkText(rows[0].content!.trim(), CHUNK_SIZE, CHUNK_OVERLAP).length, 0);

  console.log(`${materials.length} qualifying materials without a score yet, ${groups.size} distinct content hashes (dedup saves ${materials.length - groups.size} redundant extractions).`);
  console.log(`Unique content: ${uniqueChars} chars, ~${totalChunks} chunks.`);
  console.log(`Estimated extraction calls: ${Math.ceil(totalChunks / CHUNKS_PER_EXTRACTION_CALL)} (at ${CHUNKS_PER_EXTRACTION_CALL} chunks/call).`);
  const dupGroups = Array.from(groups.values()).filter((rows) => rows.length > 1);
  if (dupGroups.length > 0) {
    console.log('\nDuplicate-content groups (extracted once, count copied to all rows):');
    for (const rows of dupGroups) console.log(`  ${rows.map((r) => `"${r.title}" [${r.course_code}]`).join(' == ')}`);
  }
}

async function runCompute(force: boolean) {
  const usage: ModelUsage = {};
  const materials = await loadQualifyingMaterials(force);
  const groups = groupByContentHash(materials);
  console.log(`${materials.length} qualifying materials, ${groups.size} distinct content hashes to extract.`);

  let i = 0;
  for (const [hash, rows] of groups) {
    i += 1;
    const content = rows[0].content!;
    console.log(`[${i}/${groups.size}] "${rows[0].title}" (${content.length} chars, shared by ${rows.length} row(s))...`);
    const count = await countExamplesInContent(content, usage);
    console.log(`  -> ${count} examples.`);

    for (const row of rows) {
      await prisma.material.update({ where: { id: row.id }, data: { extracted_example_count: count } });
    }
    if (i < groups.size) await sleep(MIN_MS_BETWEEN_CALLS);
  }

  console.log(`\nDone. Model usage: ${JSON.stringify(usage)}`);
  await printReport();
}

async function printReport() {
  const materials = await prisma.material.findMany({
    where: { is_akademi_generated: false, verification_status: { not: 'TAKEN_DOWN' } },
    select: { course_code: true, content: true, extracted_example_count: true },
  });
  const nonEmpty = materials.filter((m) => (m.content?.trim().length || 0) > 0);

  const byCourse = new Map<string, { totalChars: number; totalExamples: number; scoredCount: number; unscoredCount: number }>();
  for (const m of nonEmpty) {
    const code = m.course_code || '(none)';
    if (!byCourse.has(code)) byCourse.set(code, { totalChars: 0, totalExamples: 0, scoredCount: 0, unscoredCount: 0 });
    const g = byCourse.get(code)!;
    g.totalChars += m.content!.length;
    if (m.extracted_example_count !== null) {
      g.totalExamples += m.extracted_example_count;
      g.scoredCount += 1;
    } else {
      g.unscoredCount += 1;
    }
  }

  console.log('\n=== Worked-example density by course code ===\n');
  console.log('course_code\ttotal_chars\texample_count\tchars/example\tclassification\tunscored_materials');
  const rows = Array.from(byCourse.entries()).sort((a, b) => b[1].totalChars - a[1].totalChars);
  for (const [code, g] of rows) {
    const charsPerExample = g.totalExamples > 0 ? g.totalChars / g.totalExamples : null;
    const cls = classify(charsPerExample);
    console.log(
      `${code}\t${g.totalChars}\t${g.totalExamples}\t${charsPerExample !== null ? Math.round(charsPerExample) : 'n/a (0 examples)'}\t${cls}\t${g.unscoredCount > 0 ? g.unscoredCount : ''}`,
    );
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === '--estimate') return runEstimate();
  if (mode === '--run') return runCompute(process.argv.includes('--force'));
  if (mode === '--report-only') return printReport();
  console.log('Usage: --estimate | --run [--force] | --report-only');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

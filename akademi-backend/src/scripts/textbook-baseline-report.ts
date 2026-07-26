// Read-only snapshot of everything the legacy Akademi-generated-textbook pipeline actually
// produced, captured as a comparison benchmark BEFORE the reset-generated-textbooks.ts cleanup
// runs. Never writes to the database — only reads, and writes the markdown report to disk.
//
// For each course code, we report against ONE representative outline: the currently published
// one (is_current: true) if it exists, otherwise the most recently created outline for that
// code. That mirrors what the app itself treats as "the" textbook for a course code — older,
// superseded regeneration attempts for the same code are not double-counted here.

import fs from 'fs';
import path from 'path';
import prisma from '../config/db';

const CHARS_PER_PAGE = 3000;
const TOP_N_FOR_EXAMPLE_EXTRACTION = 3;
const OUTPUT_MD_PATH = path.join(__dirname, '../../../docs/legacy-textbook-baseline.md');
const CONTENT_DUMP_DIR = path.join(__dirname, '../../../docs/.legacy-textbook-baseline-content');

type CourseStats = {
  courseCode: string;
  title: string;
  outlineId: string;
  isPublished: boolean;
  sectionCount: number;
  totalChars: number;
  estimatedPages: number;
  needsDiagramCount: number;
  failedAuditAtLeastOnceCount: number;
};

async function pickRepresentativeOutlines() {
  const outlines = await prisma.generatedTextbookOutline.findMany({
    select: {
      id: true,
      course_code: true,
      is_current: true,
      created_at: true,
      material: { select: { title: true } },
    },
  });

  const byCourseCode = new Map<string, (typeof outlines)[number]>();
  for (const outline of outlines) {
    const existing = byCourseCode.get(outline.course_code);
    if (!existing) {
      byCourseCode.set(outline.course_code, outline);
      continue;
    }
    // Prefer the published (is_current) row; if neither/both are published, prefer the newer one.
    if (outline.is_current && !existing.is_current) {
      byCourseCode.set(outline.course_code, outline);
    } else if (outline.is_current === existing.is_current && outline.created_at > existing.created_at) {
      byCourseCode.set(outline.course_code, outline);
    }
  }

  return Array.from(byCourseCode.values());
}

async function computeStatsForOutline(outline: {
  id: string;
  course_code: string;
  is_current: boolean;
  material: { title: string } | null;
}): Promise<CourseStats> {
  const leafNodes = await prisma.generatedTextbookOutlineNode.findMany({
    where: { outline_id: outline.id, children: { none: {} } },
    select: {
      retry_count: true,
      section: { select: { content: true, needs_diagram: true } },
    },
  });

  let totalChars = 0;
  let sectionCount = 0;
  let needsDiagramCount = 0;
  let failedAuditAtLeastOnceCount = 0;

  for (const node of leafNodes) {
    if (!node.section?.content) continue;
    sectionCount += 1;
    totalChars += node.section.content.length;
    if (node.section.needs_diagram) needsDiagramCount += 1;
    // retry_count is only ever incremented by auditTextbookOutlineJob's handleFailedCheck on a
    // failed quality check, so > 0 means this section failed audit at least once.
    if (node.retry_count > 0) failedAuditAtLeastOnceCount += 1;
  }

  return {
    courseCode: outline.course_code,
    title: outline.material?.title || `${outline.course_code} (never published)`,
    outlineId: outline.id,
    isPublished: Boolean(outline.material),
    sectionCount,
    totalChars,
    estimatedPages: Math.ceil(totalChars / CHARS_PER_PAGE),
    needsDiagramCount,
    failedAuditAtLeastOnceCount,
  };
}

async function dumpContentForExampleExtraction(outlineId: string, courseCode: string) {
  const leafNodes = await prisma.generatedTextbookOutlineNode.findMany({
    where: { outline_id: outlineId, children: { none: {} } },
    orderBy: { order_index: 'asc' },
    select: {
      title: true,
      parent: { select: { title: true } },
      section: { select: { content: true } },
    },
  });

  const parts = leafNodes
    .filter((node) => node.section?.content)
    .map((node) => `## ${node.parent?.title || node.title} — ${node.title}\n\n${node.section!.content.trim()}`);

  fs.mkdirSync(CONTENT_DUMP_DIR, { recursive: true });
  const filePath = path.join(CONTENT_DUMP_DIR, `${courseCode.replace(/[^A-Z0-9]/gi, '_')}.md`);
  fs.writeFileSync(filePath, parts.join('\n\n---\n\n'), 'utf-8');
  return filePath;
}

function formatTable(rows: CourseStats[]): string {
  const header = '| Course Code | Title | Sections | Total Chars | Est. Pages | needs_diagram | Failed Audit ≥ 1x |';
  const divider = '|---|---|---|---|---|---|---|';
  const lines = rows.map(
    (r) =>
      `| ${r.courseCode} | ${r.title} | ${r.sectionCount} | ${r.totalChars.toLocaleString()} | ${r.estimatedPages} | ${r.needsDiagramCount} | ${r.failedAuditAtLeastOnceCount} |`,
  );
  return [header, divider, ...lines].join('\n');
}

async function main() {
  console.log('[textbook-baseline-report] loading outlines...');
  const representativeOutlines = await pickRepresentativeOutlines();
  console.log(`[textbook-baseline-report] ${representativeOutlines.length} distinct course codes found.`);

  const stats: CourseStats[] = [];
  for (const outline of representativeOutlines) {
    stats.push(await computeStatsForOutline(outline));
  }

  // Only courses with at least one generated section are meaningful for this benchmark.
  const withContent = stats.filter((s) => s.sectionCount > 0);
  withContent.sort((a, b) => b.totalChars - a.totalChars);

  const topN = withContent.slice(0, TOP_N_FOR_EXAMPLE_EXTRACTION);
  const dumpPaths: Array<{ courseCode: string; filePath: string }> = [];
  for (const course of topN) {
    const filePath = await dumpContentForExampleExtraction(course.outlineId, course.courseCode);
    dumpPaths.push({ courseCode: course.courseCode, filePath });
    console.log(`[textbook-baseline-report] dumped ${course.courseCode} content to ${filePath}`);
  }

  const generatedAt = new Date().toISOString();
  const totalSections = withContent.reduce((sum, s) => sum + s.sectionCount, 0);
  const totalChars = withContent.reduce((sum, s) => sum + s.totalChars, 0);
  const totalPages = withContent.reduce((sum, s) => sum + s.estimatedPages, 0);

  const md = [
    '# Legacy Textbook Generation — Baseline Snapshot',
    '',
    `Captured ${generatedAt}, before the generated-textbook reset. This is a comparison benchmark for the replacement pipeline, not a live report — re-run \`script:textbook-baseline-report\` if you need a fresher snapshot before it's superseded.`,
    '',
    `One row per distinct course code that has at least one \`GeneratedTextbookOutline\`. Where a course code has multiple outline versions (regenerations), only the currently published one is counted, or the most recent if none is published — never both.`,
    '',
    '## Summary',
    '',
    `- Course codes with generated content: ${withContent.length}`,
    `- Total sections generated: ${totalSections}`,
    `- Total characters generated: ${totalChars.toLocaleString()}`,
    `- Total estimated pages (at ${CHARS_PER_PAGE.toLocaleString()} chars/page): ${totalPages}`,
    '',
    '## Per-course breakdown',
    '',
    formatTable(withContent),
    '',
    '## Worked-example / question types (top 3 courses by content volume)',
    '',
    `The 3 courses with the most content are: ${topN.map((c) => c.courseCode).join(', ') || 'none'}.`,
    '',
    'This section is filled in by hand after a manual read of each course\'s full generated content ' +
      '(dumped to `docs/.legacy-textbook-baseline-content/<course_code>.md` by this script, not committed) ' +
      '— a conservative, human read of the actual prose, not a keyword/regex scan, per the request to ' +
      'undercount rather than inflate.',
    '',
    ...topN.map((c) => `### ${c.courseCode} — ${c.title}\n\n_Pending manual review._\n`),
  ].join('\n');

  fs.mkdirSync(path.dirname(OUTPUT_MD_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_MD_PATH, md, 'utf-8');
  console.log(`[textbook-baseline-report] wrote ${OUTPUT_MD_PATH}`);
  console.log('\nSummary:');
  console.log(
    JSON.stringify(
      { courseCodesWithContent: withContent.length, totalSections, totalChars, totalPages, topN: topN.map((c) => c.courseCode) },
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

import fs from 'fs/promises';
import path from 'path';
import prisma from '../config/db';

type CourseSource = {
  url: string;
  university: string;
  department: string;
  faculty?: string;
  level?: number;
  semester?: number;
};

type ScrapedCourse = {
  code: string;
  name: string;
  level: number;
  semester: number;
  sourceUrl: string;
};

const DEFAULT_DELAY_MS = 1500;
const COURSE_PATTERN = /\b([A-Z]{2,4}\s?\d{3}[A-Z]?)\b\s*[-:–—]?\s*([A-Z][A-Za-z0-9,&'’()./\-\s]{4,120})/g;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeCode = (value: string) => value.replace(/\s+/g, ' ').trim().toUpperCase();

const normalizeText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#8211;|&#x2013;/gi, '-')
    .replace(/&#8212;|&#x2014;/gi, '-')
    .replace(/\s+/g, ' ');

const inferLevel = (code: string, fallback?: number) => {
  const match = code.match(/\d/);
  if (!match) return fallback || 100;
  return Number(match[0]) * 100;
};

const cleanCourseName = (name: string) => {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  return trimmed.replace(/\b(Credit Units?|Units?|Semester|Level)\b.*$/i, '').trim();
};

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'AkademiCourseBot/1.0 (+https://akademi-app.onrender.com)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function extractCourses(html: string, source: CourseSource): ScrapedCourse[] {
  const text = normalizeText(html);
  const seen = new Set<string>();
  const courses: ScrapedCourse[] = [];

  for (const match of text.matchAll(COURSE_PATTERN)) {
    const code = normalizeCode(match[1]);
    const name = cleanCourseName(match[2]);
    if (!code || !name || name.length < 4 || seen.has(code)) continue;

    seen.add(code);
    courses.push({
      code,
      name,
      level: source.level || inferLevel(code, source.level),
      semester: source.semester || 1,
      sourceUrl: source.url,
    });
  }

  return courses;
}

async function findDepartment(source: CourseSource) {
  return prisma.department.findFirst({
    where: {
      name: { equals: source.department, mode: 'insensitive' },
      ...(source.faculty ? { faculty: { equals: source.faculty, mode: 'insensitive' } } : {}),
      university: {
        name: { equals: source.university, mode: 'insensitive' },
      },
    },
  });
}

async function upsertCourses(source: CourseSource, courses: ScrapedCourse[]) {
  const department = await findDepartment(source);
  if (!department) {
    return { inserted: 0, skipped: courses.length, reason: 'Department not found' as string | undefined };
  }

  let inserted = 0;
  for (const course of courses) {
    await prisma.course.upsert({
      where: {
        code_department_id: {
          code: course.code,
          department_id: department.id,
        },
      },
      update: {
        name: course.name,
        level: course.level,
        semester: course.semester,
        source: 'scraper',
        source_url: course.sourceUrl,
      },
      create: {
        code: course.code,
        name: course.name,
        level: course.level,
        semester: course.semester,
        source: 'scraper',
        source_url: course.sourceUrl,
        department_id: department.id,
      },
    });
    inserted += 1;
  }

  return { inserted, skipped: 0, reason: undefined as string | undefined };
}

async function loadSources(filePath: string): Promise<CourseSource[]> {
  const raw = await fs.readFile(filePath, 'utf-8');
  const sources = JSON.parse(raw);
  if (!Array.isArray(sources)) {
    throw new Error('Course source file must be a JSON array');
  }
  return sources;
}

async function main() {
  const sourceArg = process.argv.find((arg) => arg.startsWith('--sources='));
  const delayArg = process.argv.find((arg) => arg.startsWith('--delay='));
  const sourcesPath = sourceArg?.split('=')[1] || path.join(process.cwd(), 'prisma/data/course-scrape-sources.json');
  const delayMs = delayArg ? Number(delayArg.split('=')[1]) : DEFAULT_DELAY_MS;
  const sources = await loadSources(sourcesPath);

  const report = {
    sources: sources.length,
    inserted: 0,
    skipped: 0,
    failed: [] as Array<{ url: string; reason: string }>,
  };

  for (const [index, source] of sources.entries()) {
    try {
      console.log(`[${index + 1}/${sources.length}] Fetching ${source.url}`);
      const html = await fetchHtml(source.url);
      const courses = extractCourses(html, source);
      const result = await upsertCourses(source, courses);
      report.inserted += result.inserted;
      report.skipped += result.skipped;
      if (result.reason) report.failed.push({ url: source.url, reason: result.reason });
      console.log(`  Extracted ${courses.length}; upserted ${result.inserted}`);
    } catch (error: any) {
      report.failed.push({ url: source.url, reason: error.message || 'Unknown error' });
      console.error(`  Failed: ${error.message || error}`);
    }

    if (index < sources.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

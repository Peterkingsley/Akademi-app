import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

type ImportCandidate = {
  name: string;
  type?: string;
  source?: string;
  category?: string;
  serial?: string;
  year?: string | null;
  ownership?: string | null;
  state?: string | null;
  sourceUrl?: string;
  approved?: boolean;
  decision?: string;
  possibleMatches?: string[];
  matchScore?: number;
};

type ReviewFile = {
  candidates: ImportCandidate[];
};

const DEFAULT_REVIEW_FILE = './data/tertiary-import-review-2026-06-11.json';
const DEFAULT_MASTER_FILE = './data/nigerian_tertiary_master.json';

function normalizeInstitutionName(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(formerly|former|affl|affiliated|affliated|campus|main campus|open|degree awarding|deg)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|of|and|for|in|at|a|to)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDefaultFaculty(candidate: ImportCandidate) {
  if (candidate.type === 'polytechnic') return 'Technical and Vocational Studies';
  if (candidate.type === 'college_of_education') return 'Education';
  return 'General Studies';
}

function getDefaultDepartment(candidate: ImportCandidate) {
  if (candidate.type === 'polytechnic') return 'General Technical Studies';
  if (candidate.type === 'college_of_education') return 'General Education';
  return 'General Studies';
}

function getLocation(candidate: ImportCandidate) {
  return candidate.state ? `${candidate.state}, Nigeria` : 'Nigeria';
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const fileArg = process.argv.find((arg) => arg.startsWith('--file='));
  const masterFileArg = process.argv.find((arg) => arg.startsWith('--master-file='));

  return {
    apply: args.has('--apply'),
    includeManualReview: args.has('--include-manual-review'),
    filePath: fileArg?.replace('--file=', '') || DEFAULT_REVIEW_FILE,
    masterFilePath: masterFileArg?.replace('--master-file=', '') || DEFAULT_MASTER_FILE,
  };
}

async function main() {
  const options = parseArgs();
  const reviewPath = path.resolve(__dirname, options.filePath);
  const masterPath = path.resolve(__dirname, options.masterFilePath);

  if (!fs.existsSync(reviewPath)) {
    throw new Error(`Review file not found at ${reviewPath}`);
  }

  const review = JSON.parse(fs.readFileSync(reviewPath, 'utf-8')) as ReviewFile;
  const candidates = review.candidates.filter((candidate) => {
    if (!candidate.name) return false;
    if (candidate.approved) return true;
    return options.includeManualReview && candidate.decision === 'manual_review_required';
  });

  const universities = options.apply
    ? await prisma.university.findMany({ select: { id: true, name: true } })
    : JSON.parse(fs.readFileSync(masterPath, 'utf-8')).map((institution: { institution: string }) => ({
        id: institution.institution,
        name: institution.institution,
      }));
  const normalizedExisting = new Map<string, string>();

  for (const university of universities) {
    normalizedExisting.set(normalizeInstitutionName(university.name), university.name);
  }

  const stats = {
    reviewed: review.candidates.length,
    selected: candidates.length,
    inserted: 0,
    skippedDuplicate: 0,
    skippedUnapproved: review.candidates.filter((candidate) => !candidate.approved).length,
  };

  for (const candidate of candidates) {
    const normalized = normalizeInstitutionName(candidate.name);
    const existingName = normalizedExisting.get(normalized);

    if (existingName) {
      stats.skippedDuplicate += 1;
      console.log(`SKIP duplicate: ${candidate.name} -> ${existingName}`);
      continue;
    }

    console.log(`${options.apply ? 'IMPORT' : 'DRY RUN'}: ${candidate.name}`);

    if (!options.apply) {
      stats.inserted += 1;
      normalizedExisting.set(normalized, candidate.name);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const university = await tx.university.create({
        data: {
          name: candidate.name,
          location: getLocation(candidate),
        },
      });

      await tx.department.create({
        data: {
          name: getDefaultDepartment(candidate),
          faculty: getDefaultFaculty(candidate),
          university_id: university.id,
        },
      });
    });

    stats.inserted += 1;
    normalizedExisting.set(normalized, candidate.name);
  }

  console.log(options.apply ? 'Import complete.' : 'Dry run complete. Re-run with --apply to write to the database.');
  console.log(JSON.stringify(stats, null, 2));
}

main()
  .catch((error) => {
    console.error('Failed to import tertiary institutions:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

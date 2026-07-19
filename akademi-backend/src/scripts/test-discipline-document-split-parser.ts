// One-off verification script for parseDisciplineDocumentSplitResponse's SCOPE field handling
// (the 70%/30% national-core vs. school-specific classification added alongside CODE/LEVEL).
// Not part of the app; run manually with
// `npx tsx src/scripts/test-discipline-document-split-parser.ts`.
//
// This tests the mechanical PARSER only — it cannot exercise the actual AI classification quality
// (whether Gemini correctly identifies which section a course code sits under in a real CCMAS
// PDF), since this sandbox has no live AI/DB access. Re-run the real split preview against the
// Physics document separately to confirm the actual classification.

import { parseDisciplineDocumentSplitResponse } from '../shared/utils/discipline-document-split';

const fakeAiResponse = `
Some preamble text the model might emit that should be ignored.

===COURSE===
CODE: PHY101
LEVEL: 100
SCOPE: NATIONAL_CORE
CONTENT_START
Introductory Mechanics — this is core content shared by every school's CCMAS copy.
CONTENT_END
===END===

===COURSE===
CODE: MTH103
LEVEL: 100
SCOPE: SCHOOL_SPECIFIC
CONTENT_START
Elective Mathematics — this is Ibadan's own 30% pick, not necessarily AKSU's.
CONTENT_END
===END===

===COURSE===
CODE: STA121
LEVEL: 100
SCOPE: school_specific
CONTENT_START
Lowercase scope value should still be recognized as SCHOOL_SPECIFIC.
CONTENT_END
===END===

===COURSE===
CODE: COS101
LEVEL: 100
CONTENT_START
No SCOPE line at all — must default to NATIONAL_CORE, never guess SCHOOL_SPECIFIC.
CONTENT_END
===END===
`;

function run() {
  const entries = parseDisciplineDocumentSplitResponse(fakeAiResponse);
  const byCode = new Map(entries.map((entry) => [entry.course_code, entry]));

  const checks: Array<{ label: string; pass: boolean }> = [
    { label: 'parsed 4 entries', pass: entries.length === 4 },
    { label: 'PHY101 is NATIONAL_CORE', pass: byCode.get('PHY101')?.scope_type === 'NATIONAL_CORE' },
    { label: 'MTH103 is SCHOOL_SPECIFIC', pass: byCode.get('MTH103')?.scope_type === 'SCHOOL_SPECIFIC' },
    { label: 'STA121 lowercase "school_specific" still recognized', pass: byCode.get('STA121')?.scope_type === 'SCHOOL_SPECIFIC' },
    { label: 'COS101 missing SCOPE defaults to NATIONAL_CORE (never guesses SCHOOL_SPECIFIC)', pass: byCode.get('COS101')?.scope_type === 'NATIONAL_CORE' },
    { label: 'PHY101 level parsed as 100', pass: byCode.get('PHY101')?.level === 100 },
  ];

  let allPassed = true;
  for (const check of checks) {
    console.log(`${check.pass ? 'PASS' : 'FAIL'} — ${check.label}`);
    if (!check.pass) allPassed = false;
  }

  console.log('');
  console.log(allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
  process.exit(allPassed ? 0 : 1);
}

run();

// One-off verification script for the fuzzy content-faithfulness check used by
// previewDisciplineDocumentSplit (admin.service.ts). Not part of the app; run manually with
// `npx tsx src/scripts/test-discipline-document-similarity.ts`.
//
// This is a synthetic validation (this sandbox has no access to the real department-wide
// Physics document or its actual PHY102/PHY104/PHY108/MTH103/STA121/COS101 extractions) built to
// exercise exactly the noise categories named in the bug report — smart quotes, hyphenation
// across a line break, an en/em dash, and a ligature glyph — plus a genuinely altered extraction
// (a dropped sentence, a reworded outcome, a changed number) that must still fail. Re-run the
// real split preview against the actual document separately to confirm the six previously-
// flagged entries now pass in practice.

import { isContentFaithfulToSource, getBestSimilarityScore, CONTENT_SIMILARITY_THRESHOLD } from '../shared/utils/content-similarity';

const sourceDocument = `
COS101: Introduction to Computer Science

Course Description: This course introduces students to the fundamental concepts of computing,
including problem-solving techniques, algorithm design, and the basic structure of computer
systems. Topics covered include number systems, Boolean algebra, and an overview of programming
languages.

Learning Outcomes: By the end of this course, students should be able to - explain the basic
components of a computer system; describe the difference between hardware and software; construct
simple algorithms using flowcharts and pseudocode; and convert numbers between binary, octal, and
hexadecimal representations. The course carries 3 credit units.

PHY102: Introductory Mechanics, Heat and Properties of Matter

Course Description: This course covers Newton's laws of motion, work and energy, and the thermal
properties of matter. Students will study the behaviour of solids, liquids, and gases under
varying conditions of temperature and pressure.

Learning Outcomes: By the end of the course, students should be able to state and apply Newton's
three laws of motion; explain the concepts of work, energy, and power; and describe the thermal
properties of solids, liquids, and gases. The course carries 4 credit units.
`.trim();

// The exact PHY102 section above, but run through noise typical of real PDF text extraction:
// curly quotes, a word hyphenated across a line wrap, an em dash standing in for a plain hyphen,
// and a ligature glyph (ﬁ = "fi") replacing the letter pair it represents. The actual words
// and meaning are completely unchanged.
const noisyButFaithfulExtraction = [
  `PHY102: Introductory Mechanics, Heat and Properties of Mat-`,
  `ter`,
  '',
  `Course Description: This course covers Newton’s laws of motion, work and energy, and the thermal`,
  `properties of matter. Students will study the behaviour of solids, liquids, and gases under`,
  `varying conditions of temperature and pressure.`,
  '',
  `Learning Outcomes: By the end of the course, students should be able to state and apply Newton’s`,
  `three laws of motion—explain the concepts of work, energy, and power; and describe the thermal`,
  `properties of solids, liquids, and gases. The course carries 4 credit units.`,
].join('\n');

// A genuinely altered version: the "work and energy" clause is dropped from the description, the
// learning-outcome wording is reworded ("apply" -> "utilize", "describe" -> "summarize"), and the
// credit-unit count is silently changed from 4 to 3.
const deliberatelyAlteredExtraction = `
PHY102: Introductory Mechanics, Heat and Properties of Matter

Course Description: This course covers Newton's laws of motion and the thermal properties of
matter. Students will study the behaviour of solids, liquids, and gases under varying conditions
of temperature and pressure.

Learning Outcomes: By the end of the course, students should be able to state and utilize Newton's
three laws of motion; explain the concepts of work, energy, and power; and summarize the thermal
properties of solids, liquids, and gases. The course carries 3 credit units.
`.trim();

function run() {
  console.log(`CONTENT_SIMILARITY_THRESHOLD = ${CONTENT_SIMILARITY_THRESHOLD}`);
  console.log('');

  const noisyScore = getBestSimilarityScore(noisyButFaithfulExtraction, sourceDocument);
  const noisyResult = isContentFaithfulToSource(noisyButFaithfulExtraction, sourceDocument);
  console.log(`[1] Noisy-but-faithful extraction: score=${noisyScore.toFixed(4)} verified=${noisyResult}`);
  console.log(noisyResult ? '    PASS (expected true)' : '    FAIL — expected true, got false');
  console.log('');

  const alteredScore = getBestSimilarityScore(deliberatelyAlteredExtraction, sourceDocument);
  const alteredResult = isContentFaithfulToSource(deliberatelyAlteredExtraction, sourceDocument);
  console.log(`[2] Deliberately-altered extraction: score=${alteredScore.toFixed(4)} verified=${alteredResult}`);
  console.log(!alteredResult ? '    PASS (expected false)' : '    FAIL — expected false, got true');
  console.log('');

  const unrelatedText = 'This paragraph has nothing to do with the source document at all and should score very low.';
  const unrelatedScore = getBestSimilarityScore(unrelatedText, sourceDocument);
  const unrelatedResult = isContentFaithfulToSource(unrelatedText, sourceDocument);
  console.log(`[3] Unrelated text: score=${unrelatedScore.toFixed(4)} verified=${unrelatedResult}`);
  console.log(!unrelatedResult ? '    PASS (expected false)' : '    FAIL — expected false, got true');

  const allPassed = noisyResult === true && alteredResult === false && unrelatedResult === false;
  console.log('');
  console.log(allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
  process.exit(allPassed ? 0 : 1);
}

run();

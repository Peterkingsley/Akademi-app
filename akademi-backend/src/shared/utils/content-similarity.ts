// Used by admin.service.ts's previewDisciplineDocumentSplit to flag content_verified. Split out
// into its own dependency-free module (rather than living inline in admin.service.ts) so it can
// be unit-tested in isolation — admin.service.ts's own module graph pulls in enough (Prisma,
// Redis, S3, PDF parsing, etc.) that importing it just to test a pure string function is fragile.

// How similar an extraction must be to its best-matching window of the source document to count
// as content_verified. Tunable — start at 90%. Word-trigram Jaccard similarity was chosen over
// character-bigram similarity (e.g. Dice's coefficient via the `string-similarity` package) after
// testing showed character-level comparison was too forgiving: a handful of scattered word-level
// edits (a dropped clause, a reworded phrase, a changed number) in a few-hundred-word block still
// scored above 90% under character bigrams, because most individual characters were still
// technically shared. Token-based (word n-gram) comparison is far more sensitive to exactly the
// kind of localized wording/number changes this check exists to catch — see
// test-discipline-document-similarity.ts for the calibration test that drove this choice.
export const CONTENT_SIMILARITY_THRESHOLD = 0.9;
// Word n-gram size for the Jaccard comparison. 3 (trigrams) balances sensitivity (a single changed
// word corrupts 3 overlapping trigrams, so even a small edit measurably shifts the score) against
// stability (not so short that generic filler phrases inflate overlap on unrelated text).
const NGRAM_SIZE = 3;
// Stride (in source words) between comparison windows when hunting for the best-matching region
// of the source — see isContentFaithfulToSource. Smaller = more precise alignment, more compute.
const SIMILARITY_WINDOW_STEP_WORDS = 5;

// PDF text extraction routinely mangles a document's exact bytes without changing its actual
// content: smart quotes, en/em dashes, words hyphenated across a line-wrap, and ligature glyphs
// (ﬁ, ﬂ, etc.) standing in for their letter pairs. None of that should count as "this extraction
// doesn't match the source" — so it's normalized away before comparing, on both sides.
export function normalizeForSimilarity(text: string): string {
  return text
    // Common PDF-extraction ligature glyphs -> their expanded letters. Written as explicit \u
    // escapes rather than pasting the literal glyphs, which are easy to mis-copy/mis-render and
    // hard to visually diff.
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    // A hyphen immediately before a line break is a word split across a PDF line wrap, not a
    // real hyphen — rejoin it before anything else touches whitespace or punctuation.
    .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2')
    // Hyphen (U+2010) through horizontal bar (U+2015, includes en/em dash) plus the ASCII hyphen
    // are word separators, not word characters — turn them into spaces rather than deleting them,
    // so "concept A—concept B" doesn't collapse into one fused token.
    .replace(/[-\u2010-\u2015]/g, ' ')
    // Soft hyphen: an invisible line-break hint some PDF extractors leave behind.
    .replace(/\u00AD/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    // Smart quotes/apostrophes and all other remaining punctuation don't affect meaning for this
    // comparison — strip down to word characters and spaces only.
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildWordNgrams(words: string[], n: number): Set<string> {
  const grams = new Set<string>();
  if (words.length === 0) return grams;
  if (words.length < n) {
    grams.add(words.join(' '));
    return grams;
  }
  for (let i = 0; i <= words.length - n; i += 1) {
    grams.add(words.slice(i, i + n).join(' '));
  }
  return grams;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const gram of a) {
    if (b.has(gram)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Slides a window sized to the extraction across the (normalized) source document and returns
// the best word-trigram Jaccard similarity found across every window position — a mechanical
// faithfulness score, not an AI self-assessment of "does this look verbatim to you" (which would
// be exactly the less-reliable approach this exists to avoid). Exported (not just the boolean
// isContentFaithfulToSource below) so the raw score is available for tuning CONTENT_SIMILARITY_THRESHOLD
// against real documents rather than only ever seeing a pass/fail.
export function getBestSimilarityScore(extracted: string, source: string): number {
  const normalizedExtracted = normalizeForSimilarity(extracted);
  if (!normalizedExtracted) return 0;

  const normalizedSource = normalizeForSimilarity(source);
  if (!normalizedSource) return 0;

  const extractedWords = normalizedExtracted.split(' ');
  const sourceWords = normalizedSource.split(' ');
  const windowWordCount = extractedWords.length;
  const extractedGrams = buildWordNgrams(extractedWords, NGRAM_SIZE);

  if (sourceWords.length <= windowWordCount) {
    return jaccardSimilarity(extractedGrams, buildWordNgrams(sourceWords, NGRAM_SIZE));
  }

  const step = Math.max(1, Math.min(SIMILARITY_WINDOW_STEP_WORDS, Math.floor(windowWordCount / 4) || 1));
  let bestScore = 0;

  for (let start = 0; start <= sourceWords.length - windowWordCount; start += step) {
    const windowWords = sourceWords.slice(start, start + windowWordCount);
    const score = jaccardSimilarity(extractedGrams, buildWordNgrams(windowWords, NGRAM_SIZE));
    if (score > bestScore) bestScore = score;
  }

  // The stride above can overshoot the tail of the source if its length isn't an exact multiple
  // of the step — always check the final possible window too.
  const lastStart = sourceWords.length - windowWordCount;
  if (lastStart % step !== 0) {
    const windowWords = sourceWords.slice(lastStart);
    const score = jaccardSimilarity(extractedGrams, buildWordNgrams(windowWords, NGRAM_SIZE));
    if (score > bestScore) bestScore = score;
  }

  return bestScore;
}

// Mechanical faithfulness check backing the content_verified signal the admin sees before
// confirming a split: does this extraction's best-matching region of the source clear the
// similarity threshold. See getBestSimilarityScore above for how the score itself is computed.
export function isContentFaithfulToSource(extracted: string, source: string): boolean {
  return getBestSimilarityScore(extracted, source) >= CONTENT_SIMILARITY_THRESHOLD;
}

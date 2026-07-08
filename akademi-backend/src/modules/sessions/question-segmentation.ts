export interface SegmentedQuestion {
  index: number;
  text: string;
}

// Matches a numbered question marker at the start of a line, e.g. "1.", "1)",
// "Q1:", "Question 2)". Deliberately does not match sub-parts like "1a)" or
// "(i)" so those stay attached to the parent question's text.
const QUESTION_MARKER = /(?:^|\n)[ \t]*(?:Q(?:uestion)?\.?\s*)?(\d{1,3})[.):]\s+/gi;

const MIN_CHUNK_LENGTH = 3;

/**
 * Splits raw extracted document text into individual questions. Has no
 * built-in cap on how many questions it can find — a document with 3 or 300
 * numbered questions is handled the same way. Falls back to a single chunk
 * (the whole text, unsplit) whenever the numbering doesn't look reliable, so
 * callers can distinguish "one question" from "we couldn't segment this."
 */
export function segmentQuestions(rawText: string): SegmentedQuestion[] {
  const text = rawText.trim();
  if (!text) return [];

  const matches = [...text.matchAll(QUESTION_MARKER)];

  if (matches.length < 2) {
    return [{ index: 0, text }];
  }

  const numbers = matches.map((match) => parseInt(match[1], 10));
  const isAscendingSequence = numbers.every((value, i) => i === 0 || value >= numbers[i - 1]);
  const startsNearOne = numbers[0] <= 2;
  const hasNoDuplicates = new Set(numbers).size === numbers.length;

  if (!isAscendingSequence || !startsNearOne || !hasNoDuplicates) {
    return [{ index: 0, text }];
  }

  const rawChunks: string[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length;
    const chunk = text.slice(start, end).trim();
    if (chunk) rawChunks.push(chunk);
  }

  const meaningfulChunks = rawChunks.filter((chunk) => chunk.length >= MIN_CHUNK_LENGTH);
  if (meaningfulChunks.length < 2) {
    return [{ index: 0, text }];
  }

  return meaningfulChunks.map((chunk, index) => ({ index, text: chunk }));
}

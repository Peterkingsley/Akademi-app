// Parsing for previewDisciplineDocumentSplit (admin.service.ts). Split out into its own
// dependency-free module — same reasoning as content-similarity.ts — so the delimiter parser can
// be unit-tested without dragging in admin.service.ts's full module graph.
//
// Deliberately NOT the JSON-response convention used elsewhere in this codebase's AI calls: each
// course's extracted content can be several thousand characters of verbatim source text, and
// asking a model to correctly JSON-escape that much raw text (quotes, newlines, tables) is a real
// failure mode. A plain delimiter format sidesteps escaping entirely and is trivial to parse.

export type DocumentScopeClassification = 'NATIONAL_CORE' | 'SCHOOL_SPECIFIC';

export interface DisciplineDocumentSplitEntry {
  course_code: string;
  level: number | null;
  scope_type: DocumentScopeClassification;
  content: string;
}

export function parseDisciplineDocumentSplitResponse(text: string): DisciplineDocumentSplitEntry[] {
  const blocks = new Map<string, DisciplineDocumentSplitEntry>();
  const blockPattern = /===COURSE===([\s\S]*?)===END===/g;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(text))) {
    const block = match[1];
    const codeMatch = block.match(/CODE:\s*(.+)/);
    const levelMatch = block.match(/LEVEL:\s*(.*)/);
    const scopeMatch = block.match(/SCOPE:\s*(.*)/);
    const contentMatch = block.match(/CONTENT_START\s*([\s\S]*?)\s*CONTENT_END/);

    const courseCode = codeMatch?.[1]?.trim().toUpperCase();
    const content = contentMatch?.[1]?.trim();
    if (!courseCode || !content) continue;

    const levelRaw = levelMatch?.[1]?.trim();
    const level = levelRaw && /^\d+$/.test(levelRaw) ? Number(levelRaw) : null;

    // Same default as the schema (DocumentScopeType @default(NATIONAL_CORE)) — if the model
    // omits SCOPE entirely, or answers with something unrecognized, treat it as national rather
    // than guessing school-specific, since that's the safer failure mode (a course wrongly kept
    // national just stays visible to everyone, same as it always would have been; a course
    // wrongly scoped to one school would incorrectly hide it from every other school).
    const scopeRaw = scopeMatch?.[1]?.trim().toUpperCase().replace(/[^A-Z_]/g, '');
    const scopeType: DocumentScopeClassification = scopeRaw === 'SCHOOL_SPECIFIC' ? 'SCHOOL_SPECIFIC' : 'NATIONAL_CORE';

    // The same course code can legitimately appear more than once in the raw AI output (e.g. a
    // document mentioning a course in both a table of contents and its own section) — keep
    // whichever extraction is longer as the more complete one, rather than erroring or blindly
    // taking the first.
    const existing = blocks.get(courseCode);
    if (!existing || content.length > existing.content.length) {
      blocks.set(courseCode, { course_code: courseCode, level, scope_type: scopeType, content });
    }
  }

  return Array.from(blocks.values());
}

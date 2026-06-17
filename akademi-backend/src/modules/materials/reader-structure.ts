interface ReaderPage {
  id: string;
  chapterTitle: string;
  pageTitle: string;
  content: string;
  pageNumber: number;
  pageCountInChapter: number;
}

export interface ReaderStructure {
  version: number;
  generated_at: string;
  pages: ReaderPage[];
}

const BOOK_PAGE_TARGET_CHARS = 1800;
const PAGE_FILL_MIN_RATIO = 0.68;

const HEADING_PATTERNS = [
  /^chapter\s+\d+/i,
  /^section\s+\d+/i,
  /^unit\s+\d+/i,
  /^\d+(\.\d+)*\s+[A-Z]/,
];

const SOFT_HEADING_PATTERNS = [
  /^slide\s+\d+/i,
];

export function normalizeExtractedText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isLikelyHeading(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (HEADING_PATTERNS.some((pattern) => pattern.test(trimmed))) return true;
  if (SOFT_HEADING_PATTERNS.some((pattern) => pattern.test(trimmed))) return true;
  const words = trimmed.split(/\s+/);
  const uppercaseWords = words.filter((word) => /[A-Z]/.test(word) && word === word.toUpperCase()).length;
  return words.length <= 10 && uppercaseWords >= Math.max(1, Math.floor(words.length * 0.6));
}

function isSoftHeading(line: string) {
  return SOFT_HEADING_PATTERNS.some((pattern) => pattern.test(line.trim()));
}

function chunkSection(sectionTitle: string, body: string): ReaderPage[] {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';
  const maxChars = BOOK_PAGE_TARGET_CHARS;

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  if (!chunks.length && body.trim()) chunks.push(body.trim());

  return chunks.map((chunk, index) => ({
    id: `${sectionTitle}-${index + 1}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    chapterTitle: sectionTitle,
    pageTitle: chunks.length > 1 ? `${sectionTitle} | Page ${index + 1}` : sectionTitle,
    content: chunk,
    pageNumber: index + 1,
    pageCountInChapter: chunks.length,
  }));
}

export function buildReaderStructure(rawText: string): ReaderStructure {
  const normalized = normalizeExtractedText(rawText);
  if (!normalized) {
    return {
      version: 1,
      generated_at: new Date().toISOString(),
      pages: [],
    };
  }

  const lines = normalized.split('\n').map((line) => line.trimEnd());
  const sections: Array<{ title: string; body: string[] }> = [];
  let activeTitle = 'Introduction';
  let activeBody: string[] = [];

  const flushSection = () => {
    const bodyText = activeBody.join('\n').trim();
    if (bodyText) sections.push({ title: activeTitle, body: [bodyText] });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      activeBody.push('');
      continue;
    }

    if (isLikelyHeading(trimmed)) {
      flushSection();
      activeTitle = trimmed.replace(/^#+\s*/, '');
      activeBody = [];
      continue;
    }

    activeBody.push(trimmed);
  }

  flushSection();

  const pages =
    sections.length > 0
      ? (() => {
          const mergedPages: ReaderPage[] = [];
          let currentTitle = '';
          let currentContent = '';
          let currentStartTitle = '';

          const flushCurrent = () => {
            if (!currentContent.trim()) return;
            const title = currentStartTitle || currentTitle || 'Reading';
            mergedPages.push(...chunkSection(title, currentContent.trim()));
            currentTitle = '';
            currentContent = '';
            currentStartTitle = '';
          };

          for (const section of sections) {
            const sectionBody = section.body.join('\n').trim();
            if (!sectionBody) continue;

            const renderedSection =
              section.title && section.title !== 'Reading'
                ? `${section.title}\n\n${sectionBody}`
                : sectionBody;

            if (!isSoftHeading(section.title)) {
              flushCurrent();
              mergedPages.push(...chunkSection(section.title, sectionBody));
              continue;
            }

            if (!currentContent) {
              currentStartTitle = section.title;
              currentTitle = section.title;
              currentContent = renderedSection;
              continue;
            }

            const candidate = `${currentContent}\n\n${renderedSection}`.trim();
            const hasEnoughFill = currentContent.length >= BOOK_PAGE_TARGET_CHARS * PAGE_FILL_MIN_RATIO;
            if (candidate.length > BOOK_PAGE_TARGET_CHARS && hasEnoughFill) {
              flushCurrent();
              currentStartTitle = section.title;
              currentTitle = section.title;
              currentContent = renderedSection;
              continue;
            }

            currentContent = candidate;
            currentTitle = section.title;
          }

          flushCurrent();
          return mergedPages;
        })()
      : chunkSection('Reading', normalized);

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    pages,
  };
}

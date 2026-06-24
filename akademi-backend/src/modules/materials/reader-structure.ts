export interface ReaderBlock {
  id: string;
  type: 'text' | 'image';
  text?: string;
  src?: string;
  alt?: string;
  caption?: string;
  description?: string;
}

export interface ReaderPage {
  id: string;
  chapterTitle: string;
  pageTitle: string;
  content: string;
  pageNumber: number;
  pageCountInChapter: number;
  blocks: ReaderBlock[];
}

export interface ReaderStructure {
  version: number;
  generated_at: string;
  pages: ReaderPage[];
}

const BOOK_PAGE_TARGET_CHARS = 3500;
const PAGE_FILL_MIN_RATIO = 0.4;
const IMAGE_BLOCK_WEIGHT = 520;

const HEADING_PATTERNS = [
  /^chapter\s+\d+/i,
  /^section\s+\d+/i,
  /^unit\s+\d+/i,
  /^\d+(\.\d+)*\s+[A-Z]/,
];

const SOFT_HEADING_PATTERNS = [
  /^slide\s+\d+/i,
];

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const stripHtml = (value: string) =>
  decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

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

function blockWeight(block: ReaderBlock) {
  if (block.type === 'image') return IMAGE_BLOCK_WEIGHT;
  return block.text?.length || 0;
}

function buildPageContent(blocks: ReaderBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === 'text') return block.text?.trim() || '';
      const imageLines = [
        block.caption ? `Image caption: ${block.caption}` : '',
        block.description ? `Image description: ${block.description}` : '',
        block.alt ? `Alt text: ${block.alt}` : '',
      ].filter(Boolean);
      return imageLines.join('\n');
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function chunkBlocks(sectionTitle: string, blocks: ReaderBlock[], maxChars = BOOK_PAGE_TARGET_CHARS): ReaderPage[] {
  const pages: ReaderPage[] = [];
  let currentBlocks: ReaderBlock[] = [];
  let currentWeight = 0;

  const flush = () => {
    if (!currentBlocks.length) return;
    pages.push({
      id: `${sectionTitle}-${pages.length + 1}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      chapterTitle: sectionTitle,
      pageTitle: sectionTitle,
      content: buildPageContent(currentBlocks),
      pageNumber: pages.length + 1,
      pageCountInChapter: 1,
      blocks: currentBlocks,
    });
    currentBlocks = [];
    currentWeight = 0;
  };

  for (const block of blocks) {
    const weight = blockWeight(block);
    const hasEnoughFill = currentWeight >= maxChars * PAGE_FILL_MIN_RATIO;

    if (currentBlocks.length && currentWeight + weight > maxChars && hasEnoughFill) {
      flush();
    }

    currentBlocks.push(block);
    currentWeight += weight;
  }

  flush();

  return pages.map((page, index) => ({
    ...page,
    pageTitle: pages.length > 1 ? `${sectionTitle} | Page ${index + 1}` : sectionTitle,
    pageNumber: index + 1,
    pageCountInChapter: pages.length,
  }));
}

export function buildReaderStructure(rawText: string): ReaderStructure {
  const normalized = normalizeExtractedText(rawText);
  if (!normalized) {
    return {
      version: 2,
      generated_at: new Date().toISOString(),
      pages: [],
    };
  }

  const lines = normalized.split('\n').map((line) => line.trimEnd());
  const sections: Array<{ title: string; blocks: ReaderBlock[] }> = [];
  let activeTitle = 'Introduction';
  let activeParagraphs: string[] = [];
  let textBlockIndex = 0;

  const flushParagraphs = (targetBlocks: ReaderBlock[]) => {
    const paragraphText = activeParagraphs.join('\n').trim();
    if (!paragraphText) {
      activeParagraphs = [];
      return;
    }

    targetBlocks.push({
      id: `text-${++textBlockIndex}`,
      type: 'text',
      text: paragraphText,
    });
    activeParagraphs = [];
  };

  const flushSection = () => {
    const blocks: ReaderBlock[] = [];
    flushParagraphs(blocks);
    if (blocks.length) sections.push({ title: activeTitle, blocks });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      activeParagraphs.push('');
      continue;
    }

    if (isLikelyHeading(trimmed)) {
      flushSection();
      activeTitle = trimmed.replace(/^#+\s*/, '');
      activeParagraphs = [];
      continue;
    }

    activeParagraphs.push(trimmed);
  }

  flushSection();

  const pages =
    sections.length > 0
      ? (() => {
          const mergedPages: ReaderPage[] = [];
          let currentTitle = '';
          let currentBlocks: ReaderBlock[] = [];
          let currentStartTitle = '';

          const flushCurrent = () => {
            if (!currentBlocks.length) return;
            const title = currentStartTitle || currentTitle || 'Reading';
            mergedPages.push(...chunkBlocks(title, currentBlocks, BOOK_PAGE_TARGET_CHARS));
            currentTitle = '';
            currentBlocks = [];
            currentStartTitle = '';
          };

          for (const section of sections) {
            if (!section.blocks.length) continue;

            if (!isSoftHeading(section.title)) {
              flushCurrent();
              mergedPages.push(...chunkBlocks(section.title, section.blocks, BOOK_PAGE_TARGET_CHARS));
              continue;
            }

            const sectionWeight = section.blocks.reduce((sum, block) => sum + blockWeight(block), 0);
            const currentWeight = currentBlocks.reduce((sum, block) => sum + blockWeight(block), 0);
            const hasEnoughFill = currentWeight >= BOOK_PAGE_TARGET_CHARS * PAGE_FILL_MIN_RATIO;

            if (!currentBlocks.length) {
              currentStartTitle = section.title;
              currentTitle = section.title;
              currentBlocks = [...section.blocks];
              continue;
            }

            if (currentWeight + sectionWeight > BOOK_PAGE_TARGET_CHARS && hasEnoughFill) {
              flushCurrent();
              currentStartTitle = section.title;
              currentTitle = section.title;
              currentBlocks = [...section.blocks];
              continue;
            }

            currentBlocks = [...currentBlocks, ...section.blocks];
            currentTitle = section.title;
          }

          flushCurrent();
          return mergedPages;
        })()
      : chunkBlocks('Reading', [{ id: 'text-1', type: 'text', text: normalized }]);

  return {
    version: 2,
    generated_at: new Date().toISOString(),
    pages,
  };
}

interface ImageMeta {
  alt?: string;
  description?: string;
  caption?: string;
}

function parseAttributes(attributeString: string) {
  const attributes: Record<string, string> = {};
  attributeString.replace(/([a-zA-Z0-9:_-]+)\s*=\s*"([^"]*)"/g, (_, key, value) => {
    attributes[key] = decodeHtmlEntities(value);
    return '';
  });
  return attributes;
}

function appendImagesFromHtmlFragment(
  fragment: string,
  targetBlocks: ReaderBlock[],
  imageMetaBySrc: Map<string, ImageMeta> | undefined,
  getNextImageId: () => string,
) {
  const imagePattern = /<img\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(fragment))) {
    const attrs = parseAttributes(match[1] || '');
    const src = attrs.src;
    if (!src) continue;
    const meta = imageMetaBySrc?.get(src);
    targetBlocks.push({
      id: getNextImageId(),
      type: 'image',
      src,
      alt: attrs.alt || meta?.alt || '',
      description: meta?.description || '',
      caption: meta?.caption || '',
    });
  }
}

export function buildReaderStructureFromHtml(
  rawHtml: string,
  fallbackText: string,
  imageMetaBySrc?: Map<string, ImageMeta>,
): ReaderStructure {
  const html = rawHtml?.trim();
  if (!html) {
    return buildReaderStructure(fallbackText);
  }

  const sections: Array<{ title: string; blocks: ReaderBlock[] }> = [];
  let activeTitle = 'Introduction';
  let activeBlocks: ReaderBlock[] = [];
  let textBlockIndex = 0;
  let imageBlockIndex = 0;

  const flushSection = () => {
    if (activeBlocks.length) {
      sections.push({ title: activeTitle, blocks: activeBlocks });
    }
    activeBlocks = [];
  };

  const attachCaptionToPreviousImage = (text: string) => {
    const lastBlock = activeBlocks[activeBlocks.length - 1];
    if (!lastBlock || lastBlock.type !== 'image') return false;
    if (!/^figure\b|^chart\b|^diagram\b|^image\b/i.test(text)) return false;
    lastBlock.caption = lastBlock.caption || text;
    return true;
  };

  const elementPattern = /<img\b([^>]*)\/?>|<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\2>/gi;
  let match: RegExpExecArray | null;

  while ((match = elementPattern.exec(html))) {
    if (match[1] !== undefined) {
      const attrs = parseAttributes(match[1]);
      const src = attrs.src;
      if (!src) continue;
      const meta = imageMetaBySrc?.get(src);
      activeBlocks.push({
        id: `image-${++imageBlockIndex}`,
        type: 'image',
        src,
        alt: attrs.alt || meta?.alt || '',
        description: meta?.description || '',
        caption: meta?.caption || '',
      });
      continue;
    }

    const tag = match[2]?.toLowerCase();
    const innerHtml = match[3] || '';
    appendImagesFromHtmlFragment(
      innerHtml,
      activeBlocks,
      imageMetaBySrc,
      () => `image-${++imageBlockIndex}`,
    );
    const text = stripHtml(innerHtml.replace(/<img\b[^>]*\/?>/gi, ' '));
    if (!text) continue;

    if (tag?.startsWith('h') || isLikelyHeading(text)) {
      flushSection();
      activeTitle = text.replace(/^#+\s*/, '');
      continue;
    }

    if (attachCaptionToPreviousImage(text)) {
      continue;
    }

    activeBlocks.push({
      id: `text-${++textBlockIndex}`,
      type: 'text',
      text,
    });
  }

  flushSection();

  if (!sections.length) {
    return buildReaderStructure(fallbackText);
  }

  const pages = sections.flatMap((section) => chunkBlocks(section.title, section.blocks, BOOK_PAGE_TARGET_CHARS));

  return {
    version: 2,
    generated_at: new Date().toISOString(),
    pages,
  };
}

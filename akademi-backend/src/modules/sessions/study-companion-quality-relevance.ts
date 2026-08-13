import { normalizeText } from './study-companion-prompt-directives';
import { RoadmapSection, TutorMessageQualityArgs } from './study-companion.types';
import * as base from './study-companion-quality-relevance.base';

export * from './study-companion-quality-relevance.base';

export function isNonSubstantiveStudentResponse(value: string) {
  const raw = normalizeText(String(value || '')).toLowerCase();
  if (!raw) return true;
  if (/[0-9=^×÷+\-]/.test(raw)) return false;
  const compact = raw
    .replace(/[.!?,;:'"()]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return /^(?:h+m+|hm+|uh+|um+|erm+|idk|i\s+don'?t\s+know|don'?t\s+know|i\s+don'?t\s+remember|don'?t\s+remember|i\s+can'?t\s+remember|can'?t\s+remember|i\s+forgot|forgot|not\s+sure|no\s+idea|no\s+clue|dunno|skip|pass|maybe|go\s+on|continue|yes|yeah|yep|ok|okay|got\s+it|i\s+understand|i\s+understand\s+now|it'?s\s+clear|yes\s+it'?s\s+clear)$/.test(
    compact,
  );
}

function normalizeMathMatch(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[−–—]/g, '-')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '×')
    .replace(/\\left|\\right/g, '')
    .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
    .replace(/[{}$\s]/g, '')
    .trim();
}

function isConciseExactNumericAnswer(section: RoadmapSection, studentResponse: string) {
  const response = normalizeText(studentResponse);
  if (!response || response.length > 48 || !/[0-9^×÷+\-]/.test(response)) {
    return false;
  }
  const normalizedResponse = normalizeMathMatch(response);
  if (normalizedResponse.length < 2) return false;
  const normalizedSource = normalizeMathMatch(`${section.title}\n${section.content || ''}`);
  return normalizedSource.includes(normalizedResponse);
}

export function isPrefixOrAbbreviationSection(section: RoadmapSection) {
  const source = `${section.title}\n${String(section.content || '').slice(0, 2200)}`.toLowerCase();
  return /\b(prefix|abbreviation|milli|micro|nano|kilo|centi|deci|metric prefix|powers? of ten)\b/.test(
    source,
  );
}

export function fallbackWeakConceptForSection(section: RoadmapSection) {
  const source = `${section.title}\n${String(section.content || '').slice(0, 2200)}`.toLowerCase();
  if (isPrefixOrAbbreviationSection(section)) {
    return 'using metric-prefix multipliers correctly in unit conversions';
  }
  if (/formula|calculate|solve|equation|convert|conversion/.test(source)) {
    return 'applying the main method correctly';
  }
  return `the main rule in ${section.title}`;
}

function conceptTokens(value: string) {
  const stop = new Set([
    'about',
    'after',
    'again',
    'around',
    'because',
    'could',
    'from',
    'have',
    'into',
    'main',
    'that',
    'their',
    'these',
    'this',
    'using',
    'want',
    'what',
    'when',
    'where',
    'which',
    'with',
  ]);
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !stop.has(token));
}

function cleanConcept(value: string) {
  const cleaned = normalizeText(String(value || ''))
    .replace(/[*_#|]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!cleaned) return '';

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const tinyTokens = tokens.filter((token) => token.length <= 1).length;
  const tableLike =
    /\bsymbol\b.*\bprefix\b.*\bmultiplier\b/i.test(cleaned) ||
    tinyTokens >= Math.max(4, Math.ceil(tokens.length * 0.35)) ||
    /(?:\bdeci\b.*\bcenti\b.*\bmilli\b)|(?:\bmilli\b.*\bmicro\b.*\bnano\b)/i.test(
      cleaned,
    ) ||
    /10\s*[−-]\s*1?10\s*[−-]\s*2/i.test(cleaned);
  if (tableLike) return '';

  const firstClause = cleaned.split(/[.;!?]/)[0]?.trim() || cleaned;
  const words = firstClause.split(/\s+/).filter(Boolean);
  if (words.length < 2) return '';
  return words.slice(0, 14).join(' ');
}

function conceptIsRelevantToSection(section: RoadmapSection, concept: string) {
  if (!concept) return false;
  const lower = concept.toLowerCase();

  if (isPrefixOrAbbreviationSection(section)) {
    return /\b(prefix|abbreviation|multiplier|power|unit|conversion|convert|milli|micro|nano|kilo|centi|deci|mega|giga|tera|meter|metre|gram|second)\b/.test(
      lower,
    );
  }

  const focus = `${section.title}\n${String(section.content || '').slice(0, 1800)}`;
  const focusTokens = new Set(conceptTokens(focus));
  const candidateTokens = conceptTokens(concept);
  if (!candidateTokens.length) return false;
  return candidateTokens.some((token) => focusTokens.has(token));
}

export function sanitizeFailedConcepts(section: RoadmapSection, values: string[] | undefined) {
  const cleaned = (values || [])
    .map(cleanConcept)
    .filter(Boolean)
    .filter((item) => conceptIsRelevantToSection(section, item))
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 3);
  return cleaned.length ? cleaned : [fallbackWeakConceptForSection(section)];
}

function cleanIncompleteTail(value: string) {
  let cleaned = normalizeText(value);
  if (/\bSimple Example:[\s\S]*?(?:^|\n)\s*\d+\.\s*$/im.test(cleaned)) {
    cleaned = cleaned.replace(/\s*\bSimple Example:[\s\S]*$/i, '').trim();
  }
  cleaned = cleaned
    .replace(/\s*(?:^|\n)\s*\d+\.\s*$/m, '')
    .replace(/\s+\b(?:Simple Example|For example|For instance):\s*$/i, '')
    .trim();
  return cleaned;
}

function simplePowerToReadableText(value: string) {
  const superscript: Record<string, string> = {
    '-': '⁻',
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };
  const render = (exponent: string) => `10${exponent.split('').map((char) => superscript[char] || char).join('')}`;

  return value
    .replace(/\\\(\s*10\^\{(-?\d+)\}\s*\\\)/g, (_match, exponent: string) => render(exponent))
    .replace(/\\\[\s*10\^\{(-?\d+)\}\s*\\\]/g, (_match, exponent: string) => render(exponent));
}

export function sanitizeTutorStyle(content: string) {
  return normalizeText(
    simplePowerToReadableText(
      cleanIncompleteTail(base.sanitizeTutorStyle(content))
        .replace(/\s*\(External support:[^)]*\)\s*/gi, ' ')
        .replace(/\s*External support:[^.?!]*(?:[.?!]|$)\s*/gi, ' ')
        .replace(/^\s*No problem at all[.!]?\s*/i, '')
        .replace(/^\s*Yes,\s*you are correct(?: that)?\s*/i, 'Correct — ')
        .replace(/^\s*You are correct(?: that)?\s*/i, 'Correct — ')
        .replace(/^\s*Yes,\s*that(?:'s| is) correct[,.!;:]?\s*/i, 'Correct — ')
        .replace(/(^|\n)\s*\*\s*(?=Simple Example:)/gi, '$1'),
    ),
  );
}

export function computeCoverageScore(
  section: RoadmapSection,
  studentResponse: string,
) {
  if (isNonSubstantiveStudentResponse(studentResponse)) return 0;
  if (isConciseExactNumericAnswer(section, studentResponse)) return 92;
  return base.computeCoverageScore(section, studentResponse);
}

export function deriveFailedConcepts(
  section: RoadmapSection,
  studentResponse: string,
) {
  if (isNonSubstantiveStudentResponse(studentResponse)) {
    return [fallbackWeakConceptForSection(section)];
  }

  const score = computeCoverageScore(section, studentResponse);
  if (score >= 80) return [];

  return sanitizeFailedConcepts(
    section,
    base.deriveFailedConcepts(section, studentResponse),
  );
}

export function validateTutorMessageQuality(args: TutorMessageQualityArgs) {
  const sanitizedContent = sanitizeTutorStyle(args.content || '');
  const result = base.validateTutorMessageQuality({
    ...args,
    content: sanitizedContent,
  });
  return {
    ...result,
    correctedContent: result.correctedContent
      ? sanitizeTutorStyle(result.correctedContent)
      : result.correctedContent,
  };
}

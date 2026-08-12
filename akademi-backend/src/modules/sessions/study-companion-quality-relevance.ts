import { normalizeText } from './study-companion-prompt-directives';
import { RoadmapSection, TutorMessageQualityArgs } from './study-companion.types';
import * as base from './study-companion-quality-relevance.base';

export * from './study-companion-quality-relevance.base';

function isNonSubstantiveResponse(value: string) {
  const raw = normalizeText(String(value || '')).toLowerCase();
  if (!raw) return true;
  if (/[0-9=^×÷+\-]/.test(raw)) return false;
  const compact = raw
    .replace(/[.!?,;:'"()]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return /^(?:h+m+|hm+|uh+|um+|erm+|idk|i\s+don'?t\s+know|don'?t\s+know|not\s+sure|no\s+idea|dunno|skip|pass|maybe)$/.test(
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

function fallbackWeakConcept(section: RoadmapSection) {
  const source = `${section.title}\n${section.content || ''}`.toLowerCase();
  if (/prefix|abbreviation|milli|micro|nano|kilo|centi|deci/.test(source)) {
    return 'using metric-prefix multipliers correctly in unit conversions';
  }
  if (/formula|calculate|solve|equation|convert|conversion/.test(source)) {
    return 'applying the main method correctly';
  }
  return `the main rule in ${section.title}`;
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

export function sanitizeTutorStyle(content: string) {
  return normalizeText(
    cleanIncompleteTail(base.sanitizeTutorStyle(content))
      .replace(/^\s*Yes,\s*you are correct(?: that)?\s*/i, 'Correct — ')
      .replace(/^\s*Yes,\s*that(?:'s| is) correct[,.!;:]?\s*/i, 'Correct — ')
      .replace(/(^|\n)\s*\*\s*(?=Simple Example:)/gi, '$1')
      .replace(/\b10\^(-?\d+)\b/g, '\\(10^{$1}\\)'),
  );
}

export function computeCoverageScore(
  section: RoadmapSection,
  studentResponse: string,
) {
  if (isNonSubstantiveResponse(studentResponse)) return 0;
  if (isConciseExactNumericAnswer(section, studentResponse)) return 92;
  return base.computeCoverageScore(section, studentResponse);
}

export function deriveFailedConcepts(
  section: RoadmapSection,
  studentResponse: string,
) {
  if (isNonSubstantiveResponse(studentResponse)) {
    return [fallbackWeakConcept(section)];
  }

  const score = computeCoverageScore(section, studentResponse);
  if (score >= 80) return [];

  const cleaned = base
    .deriveFailedConcepts(section, studentResponse)
    .map(cleanConcept)
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 3);
  return cleaned.length ? cleaned : [fallbackWeakConcept(section)];
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

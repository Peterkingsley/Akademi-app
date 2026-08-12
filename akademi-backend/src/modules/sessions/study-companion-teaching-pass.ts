import { aiProvider } from '../ai/ai.provider';
import { normalizeText } from './study-companion-prompt-directives';
import {
  removeAccidentalTeachingQuestions,
  truncateToSentence,
} from './study-companion-teacher-brain';
import { sanitizeTutorStyle } from './study-companion-quality-relevance';
import { shouldUseCondensedCompanionFlow } from './study-companion-session-state';
import * as base from './study-companion-teaching-pass.base';

export * from './study-companion-teaching-pass.base';

function cleanTutorText(value: string) {
  return normalizeText(
    sanitizeTutorStyle(String(value || ''))
      .replace(/^\s*Yes,\s*you are correct(?: that)?\s*/i, 'Correct — ')
      .replace(/^\s*Yes,\s*that(?:'s| is) correct[,.!;:]?\s*/i, 'Correct — ')
      .replace(/^\s*As we discussed,?\s*/i, '')
      .replace(/^\s*Following on from our discussion[^,]*,?\s*/i, '')
      .replace(/(^|\n)\s*\*\s*(?=Simple Example:)/gi, '$1')
      .replace(/\b10\^(-?\d+)\b/g, '\\(10^{$1}\\)')
      .replace(/\n{3,}/g, '\n\n'),
  );
}

function feedbackOnly(value: string) {
  const cleaned = cleanTutorText(value);
  const withoutQuestions = removeAccidentalTeachingQuestions(cleaned);
  return normalizeText(
    withoutQuestions ||
      'The response gives some evidence of understanding; the next checkpoint will test the remaining idea.',
  );
}

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

function fallbackWeakConcept(section: Parameters<typeof base.evaluateMemoryDump>[0]) {
  const source = `${section.title}\n${section.content || ''}`.toLowerCase();
  if (/prefix|abbreviation|milli|micro|nano|kilo|centi|deci/.test(source)) {
    return 'using metric-prefix multipliers correctly in unit conversions';
  }
  if (/formula|calculate|solve|equation|convert|conversion/.test(source)) {
    return 'applying the main method correctly';
  }
  return `the main rule in ${section.title}`;
}

function cleanWeakConcept(value: string) {
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

function safeWeakConcepts(
  values: string[] | undefined,
  section: Parameters<typeof base.evaluateMemoryDump>[0],
) {
  const cleaned = (values || [])
    .map(cleanWeakConcept)
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 3);
  return cleaned.length ? cleaned : [fallbackWeakConcept(section)];
}

function parseJsonObject(raw: string) {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function clampScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function compactCondensedTeachingTurn(content: string, pass: 1 | 2 | 3) {
  const cleaned = cleanTutorText(content);
  if (pass === 3) return truncateToSentence(cleaned, 620);

  const questionIndex = cleaned.lastIndexOf('?');
  if (questionIndex < 0) {
    return truncateToSentence(cleaned, pass === 1 ? 620 : 780);
  }

  const prefix = cleaned.slice(0, questionIndex + 1);
  const questionStart = Math.max(
    prefix.lastIndexOf('. ', questionIndex - 1),
    prefix.lastIndexOf('! ', questionIndex - 1),
    prefix.lastIndexOf('\n', questionIndex - 1),
  );
  const start = questionStart >= 0 ? questionStart + 1 : 0;
  const body = prefix.slice(0, start).trim();
  const question = prefix.slice(start).trim();
  const compactBody = body
    ? truncateToSentence(body, pass === 1 ? 560 : 720)
    : '';
  return normalizeText([compactBody, question].filter(Boolean).join(' '));
}

function looksIncomplete(value: string) {
  const cleaned = normalizeText(value);
  return (
    /:\s*$/.test(cleaned) ||
    /(?:^|\n)\s*\d+\.\s*$/.test(cleaned) ||
    /\b(?:simple example|for example|for instance)\s*:?\s*$/i.test(cleaned)
  );
}

function looksCorruptedTable(value: string) {
  const cleaned = normalizeText(value);
  return (
    /\bSymbol Prefix Multiplier\b/i.test(cleaned) ||
    /(?:\bc\b\s+\bm\b\s+μ\s+\bn\b)/i.test(cleaned) ||
    /10\s*[−-]\s*1?10\s*[−-]\s*2/i.test(cleaned)
  );
}

function deterministicReteach(
  section: Parameters<typeof base.buildGapReteach>[0],
  concept: string,
) {
  const source = `${section.title}\n${section.content || ''}`.toLowerCase();
  if (/prefix|abbreviation|milli|micro|nano|kilo|centi|deci/.test(source)) {
    return [
      'For metric-prefix conversions, replace the prefix with its power-of-ten multiplier.',
      'For example, milli means \\(10^{-3}\\), so \\(5\\,\\text{mm} = 5 \\times 10^{-3}\\,\\text{m} = 0.005\\,\\text{m}\\).',
      'The key step is to multiply the numerical value by the prefix multiplier when converting to the base unit.',
      'Keep the sign of the exponent attached to the correct prefix.',
    ].join(' ');
  }

  return [
    `Focus on ${concept}.`,
    'State the rule in one clear sentence, use it once in a small example, and check that the result matches the rule.',
    'The next checkpoint should test only that repaired idea.',
  ].join(' ');
}

export async function buildTeachingPass(
  ...args: Parameters<typeof base.buildTeachingPass>
): Promise<Awaited<ReturnType<typeof base.buildTeachingPass>>> {
  const result = await base.buildTeachingPass(...args);
  const section = args[0];
  const pass = args[1];
  const cleaned = cleanTutorText(result.content);
  return {
    ...result,
    content: shouldUseCondensedCompanionFlow(section)
      ? compactCondensedTeachingTurn(cleaned, pass)
      : cleaned,
  };
}

export async function evaluateTeachBack(
  ...args: Parameters<typeof base.evaluateTeachBack>
): Promise<Awaited<ReturnType<typeof base.evaluateTeachBack>>> {
  const result = await base.evaluateTeachBack(...args);
  const section = args[0];
  const failedConcepts =
    result.score >= 80 ? [] : safeWeakConcepts(result.failedConcepts, section);
  return {
    ...result,
    evaluation: feedbackOnly(result.evaluation),
    failedConcepts,
  };
}

export async function buildMemoryDumpPrompt(
  ..._args: Parameters<typeof base.buildMemoryDumpPrompt>
): Promise<Awaited<ReturnType<typeof base.buildMemoryDumpPrompt>>> {
  return 'Active recall: Without checking your notes, explain the main rule or idea from this section in your own words, then give one correct example or application you remember.';
}

export async function evaluateMemoryDump(
  ...args: Parameters<typeof base.evaluateMemoryDump>
): Promise<Awaited<ReturnType<typeof base.evaluateMemoryDump>>> {
  const section = args[0];
  const studentResponse = args[1];
  const teacherBrainContext = args[2] || '';
  const lessonPlan = args[5];

  if (isNonSubstantiveResponse(studentResponse)) {
    return {
      evaluation:
        'That response does not provide enough evidence of recall yet, so the core rule still needs one focused review.',
      score: 0,
      failedConcepts: [fallbackWeakConcept(section)],
    };
  }

  try {
    const raw = await aiProvider.generateResponse(
      [
        `Section title: ${section.title}`,
        `Section source:\n${String(section.content || '').slice(0, 2800)}`,
        teacherBrainContext
          ? `Teacher context:\n${String(teacherBrainContext).slice(0, 1600)}`
          : '',
        lessonPlan?.checkpointFocus?.length
          ? `Checkpoint focus:\n${lessonPlan.checkpointFocus.slice(0, 4).join('\n')}`
          : '',
        `Student active-recall response:\n${studentResponse}`,
        'Score the recall semantically, not by keyword overlap.',
        'Rubric: 0-10 means no usable recall; 20-40 means one isolated fact; 50-70 means partial understanding with important gaps; 80-100 requires the main rule or idea plus at least one correct example, application, method, or relationship.',
        'Do not reward filler such as hmm, I do not know, or vague confidence statements.',
        'Return strict JSON only with keys: score, feedback, missingIdeas.',
        'feedback must be one or two concise sentences, contain no question, and avoid generic praise.',
        'missingIdeas must contain at most two short conceptual labels, never copied table rows or OCR fragments.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      {
        systemPrompt: [
          'You are a strict but fair university mastery evaluator.',
          'Judge demonstrated understanding from the student response.',
          'Do not require verbatim wording from the source.',
          'Never invent missing facts and never output a follow-up question.',
        ].join('\n'),
        maxTokens: 240,
      },
    );
    const parsed = parseJsonObject(raw);
    const score = clampScore(parsed?.score);
    if (parsed && score !== null) {
      const feedback = feedbackOnly(String(parsed.feedback || ''));
      const missingIdeas = Array.isArray(parsed.missingIdeas)
        ? parsed.missingIdeas.map((item) => String(item || ''))
        : [];
      return {
        evaluation:
          feedback ||
          (score >= 80
            ? 'The response shows the main idea and a usable application.'
            : 'The response shows partial recall, but one important idea still needs review.'),
        score,
        failedConcepts:
          score >= 80 ? [] : safeWeakConcepts(missingIdeas, section),
      };
    }
  } catch (error) {
    console.error('memory_dump_semantic_evaluation_failed', {
      sectionTitle: section.title,
      message: error instanceof Error ? error.message : 'Unknown semantic evaluation failure',
    });
  }

  const fallback = await base.evaluateMemoryDump(...args);
  return {
    ...fallback,
    evaluation: feedbackOnly(fallback.evaluation),
    score: isNonSubstantiveResponse(studentResponse) ? 0 : fallback.score,
    failedConcepts:
      fallback.score >= 80
        ? []
        : safeWeakConcepts(fallback.failedConcepts, section),
  };
}

export async function buildGapReteach(
  ...args: Parameters<typeof base.buildGapReteach>
): Promise<Awaited<ReturnType<typeof base.buildGapReteach>>> {
  const section = args[0];
  const safeConcepts = safeWeakConcepts(args[1], section);
  const forwarded = [...args] as Parameters<typeof base.buildGapReteach>;
  forwarded[1] = safeConcepts;

  let content = cleanTutorText(await base.buildGapReteach(...forwarded));
  if (!looksIncomplete(content) && !looksCorruptedTable(content)) {
    return content;
  }

  const concept = safeConcepts[0];
  try {
    const regenerated = await aiProvider.generateResponse(
      [
        `Section title: ${section.title}`,
        `Weak idea to repair: ${concept}`,
        `Section source:\n${String(section.content || '').slice(0, 2200)}`,
        'Reteach only the weak idea in 4 to 6 short sentences.',
        'If the idea involves a rule or conversion, include one complete example from start to final result.',
        'Do not use markdown, bullets, numbered lists, tables, or a question.',
        'Do not copy raw table rows or OCR fragments from the source.',
        'Finish the explanation completely; never end after a colon, heading, or numbered-step marker.',
      ].join('\n\n'),
      {
        systemPrompt:
          'You are Akademi AI Tutor. Produce one concise, complete targeted reteach with no question and no formatting artifacts.',
        maxTokens: 360,
      },
    );
    const cleaned = cleanTutorText(regenerated);
    if (cleaned && !looksIncomplete(cleaned) && !looksCorruptedTable(cleaned)) {
      return cleaned;
    }
  } catch (error) {
    console.error('gap_reteach_completion_repair_failed', {
      sectionTitle: section.title,
      message: error instanceof Error ? error.message : 'Unknown reteach repair failure',
    });
  }

  return deterministicReteach(section, concept);
}

export async function buildMasteryOutcome(
  ...args: Parameters<typeof base.buildMasteryOutcome>
): Promise<Awaited<ReturnType<typeof base.buildMasteryOutcome>>> {
  const [section, score, passed, failedConcepts] = args;
  if (passed) {
    return [
      `Mastery check: ${score}%`,
      `You showed enough understanding of ${section.title} to move forward.`,
      'Continue when you are ready for the next section.',
    ].join('\n\n');
  }

  const concept = safeWeakConcepts(failedConcepts, section)[0];
  return [
    `Mastery check: ${score}%`,
    `One area still needs work: ${concept}.`,
    'I will reteach that specific idea, then check it once more.',
  ].join('\n\n');
}

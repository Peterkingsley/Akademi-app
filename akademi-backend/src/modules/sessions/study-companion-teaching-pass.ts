import prisma from '../../config/db';
import { aiProvider } from '../ai/ai.provider';
import { normalizeText } from './study-companion-prompt-directives';
import {
  buildCalculationTeachingContext,
  getTeacherBrainSectionContext,
  removeAccidentalTeachingQuestions,
  truncateToSentence,
} from './study-companion-teacher-brain';
import {
  fallbackWeakConceptForSection,
  isNonSubstantiveStudentResponse,
  isPrefixOrAbbreviationSection,
  sanitizeFailedConcepts,
  sanitizeTutorStyle,
} from './study-companion-quality-relevance';
import { shouldUseCondensedCompanionFlow } from './study-companion-session-state';
import * as base from './study-companion-teaching-pass.base';

export * from './study-companion-teaching-pass.base';

function cleanTutorText(value: string) {
  return normalizeText(
    sanitizeTutorStyle(String(value || ''))
      .replace(/^\s*As we discussed,?\s*/i, '')
      .replace(/^\s*Following on from our discussion[^,]*,?\s*/i, '')
      .replace(/^\s*Alright,?\s*let'?s proceed[.!]?\s*/i, '')
      .replace(/(^|\n)\s*\*\s*(?=Simple Example:)/gi, '$1')
      .replace(/\n{3,}/g, '\n\n'),
  );
}

function feedbackOnly(value: string) {
  const cleaned = cleanTutorText(value);
  const withoutQuestions = removeAccidentalTeachingQuestions(cleaned);
  return normalizeText(
    withoutQuestions ||
      'The response shows some understanding, but the next checkpoint will test the remaining idea directly.',
  );
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

function extractFinalQuestion(value: string) {
  const cleaned = normalizeText(value);
  const questionEnd = cleaned.lastIndexOf('?');
  if (questionEnd < 0) return cleaned;
  const before = cleaned.slice(0, questionEnd + 1);
  const start = Math.max(
    before.lastIndexOf('. ', questionEnd - 1),
    before.lastIndexOf('! ', questionEnd - 1),
    before.lastIndexOf('\n', questionEnd - 1),
  );
  return before.slice(start >= 0 ? start + 1 : 0).trim();
}

function compactCondensedTeachingTurn(
  content: string,
  pass: 1 | 2 | 3,
  section: Parameters<typeof base.buildTeachingPass>[0],
) {
  const cleaned = cleanTutorText(content);
  const isPrefixSection = isPrefixOrAbbreviationSection(section);
  const bodyLimit = isPrefixSection
    ? pass === 1
      ? 320
      : pass === 2
        ? 440
        : 420
    : pass === 1
      ? 420
      : pass === 2
        ? 560
        : 500;

  if (pass === 3) return truncateToSentence(cleaned, bodyLimit);

  const questionIndex = cleaned.lastIndexOf('?');
  if (questionIndex < 0) {
    return truncateToSentence(cleaned, bodyLimit);
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
  const compactBody = body ? truncateToSentence(body, bodyLimit) : '';
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

function looksOverbroadReteach(value: string) {
  const cleaned = normalizeText(value);
  const numberedItems = cleaned.match(/(?:^|\s)\d+\.\s+/g) || [];
  return (
    cleaned.length > 900 ||
    numberedItems.length > 4 ||
    /\bexternal support\b/i.test(cleaned) ||
    /\bdeci\b[\s\S]*\bcenti\b[\s\S]*\bmilli\b[\s\S]*\bmicro\b[\s\S]*\bnano\b[\s\S]*\bpico\b/i.test(
      cleaned,
    )
  );
}

function deterministicReteach(
  section: Parameters<typeof base.buildGapReteach>[0],
  concept: string,
) {
  if (isPrefixOrAbbreviationSection(section)) {
    return [
      'Metric prefixes are shorthand multipliers attached to a base unit.',
      'For example, milli means 10⁻³, so 5 millimeters equals 5 × 10⁻³ meters, which is 0.005 meters.',
      'The same rule works for other prefixes: replace the prefix with its power-of-ten multiplier, then keep the base unit.',
      'The important part is matching the correct prefix to the correct exponent before converting.',
    ].join(' ');
  }

  return [
    `Focus on ${concept}.`,
    'State the rule in one clear sentence, use it once in a small example, and check that the result matches the rule.',
    'The next checkpoint should test only that repaired idea.',
  ].join(' ');
}

function specificClarificationCheck(section: Parameters<typeof base.buildInterruptResponse>[0]) {
  if (isPrefixOrAbbreviationSection(section)) {
    return 'If milli means 10⁻³, what does 1 millimeter equal in meters?';
  }
  return `In one sentence, what is the main relationship you can now state from ${section.title}?`;
}

function replaceGenericClarityCheck(
  content: string,
  section: Parameters<typeof base.buildInterruptResponse>[0],
) {
  const genericCheck = /\s*(?:does (?:that|this|the explanation)[^?]{0,90}(?:clarify|make sense|help)[^?]*\?|do you understand[^?]*\?|is (?:that|this) clear[^?]*\?)\s*$/i;
  if (!genericCheck.test(content)) return content;
  const body = content.replace(genericCheck, '').trim();
  return normalizeText(`${body} ${specificClarificationCheck(section)}`);
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
      ? compactCondensedTeachingTurn(cleaned, pass, section)
      : cleaned,
  };
}

export async function evaluateTeachBack(
  ...args: Parameters<typeof base.evaluateTeachBack>
): Promise<Awaited<ReturnType<typeof base.evaluateTeachBack>>> {
  const section = args[0];
  const studentResponse = args[1];
  const attemptNumber = args[2];
  const teacherBrainContext = args[3] || '';
  const contextMeta = args[4] as { sessionId?: string } | undefined;
  const lessonPlan = args[6];

  if (isNonSubstantiveStudentResponse(studentResponse)) {
    return {
      evaluation: 'That response does not demonstrate the checkpoint idea yet.',
      score: 0,
      failedConcepts: [fallbackWeakConceptForSection(section)],
    };
  }

  let checkpointPrompt = '';
  if (contextMeta?.sessionId) {
    try {
      const currentState = await prisma.studyCompanionState.findUnique({
        where: { session_id: contextMeta.sessionId },
        select: { pending_prompt: true },
      });
      checkpointPrompt = String(currentState?.pending_prompt || '');
    } catch (error) {
      console.error('teachback_checkpoint_lookup_failed', {
        sessionId: contextMeta.sessionId,
        message: error instanceof Error ? error.message : 'Unknown checkpoint lookup failure',
      });
    }
  }

  const exactQuestion = extractFinalQuestion(checkpointPrompt);

  try {
    const raw = await aiProvider.generateResponse(
      [
        `Checkpoint attempt: ${attemptNumber}`,
        exactQuestion ? `Exact question asked:\n${exactQuestion}` : '',
        `Section title: ${section.title}`,
        `Relevant section source:\n${String(section.content || '').slice(0, 2400)}`,
        teacherBrainContext
          ? `Teacher context:\n${String(teacherBrainContext).slice(0, 1000)}`
          : '',
        lessonPlan?.checkpointFocus?.length
          ? `Internal checkpoint objectives:\n${lessonPlan.checkpointFocus.slice(0, 3).join('\n')}`
          : '',
        `Student answer:\n${studentResponse}`,
        'Judge the student against the exact question that was asked, not against every fact in the section.',
        'A concise mathematical answer can be fully correct. Do not penalize brevity when the question only requires a value, relation, multiplier, formula, or short statement.',
        'Score 90-100 for a fully correct answer to the exact question, 75-89 for essentially correct with a minor imprecision, 40-74 for partial understanding, and 0-39 for wrong or insufficient evidence.',
        'Return strict JSON only with keys: score, feedback, missingIdeas.',
        'feedback must be one concise sentence with no follow-up question and no generic praise.',
        'missingIdeas must contain at most two short conceptual labels relevant to this section.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      {
        systemPrompt:
          'You are a strict but fair university checkpoint evaluator. Evaluate only the question actually asked. Never import unrelated topics from transcript, memory, or other sections.',
        maxTokens: 220,
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
            ? 'The answer matches the checkpoint.'
            : 'The answer shows a gap in the checkpoint idea.'),
        score,
        failedConcepts:
          score >= 80 ? [] : sanitizeFailedConcepts(section, missingIdeas),
      };
    }
  } catch (error) {
    console.error('teachback_semantic_evaluation_failed', {
      sectionTitle: section.title,
      message: error instanceof Error ? error.message : 'Unknown teach-back evaluation failure',
    });
  }

  const fallback = await base.evaluateTeachBack(...args);
  return {
    ...fallback,
    evaluation: feedbackOnly(fallback.evaluation),
    failedConcepts:
      fallback.score >= 80
        ? []
        : sanitizeFailedConcepts(section, fallback.failedConcepts),
  };
}

export async function buildTeachBackPrompt(
  ...args: Parameters<typeof base.buildTeachBackPrompt>
): Promise<Awaited<ReturnType<typeof base.buildTeachBackPrompt>>> {
  const section = args[0];
  const attemptNumber = args[1];
  const teacherBrainSectionContext = args[5];

  if (isPrefixOrAbbreviationSection(section)) {
    return attemptNumber === 1
      ? 'Teach it back: Explain what a metric prefix represents and give one correct example showing a prefix, its power of ten, and the base unit.'
      : 'Final teach-back: Explain how metric prefixes change a base unit and give one fresh conversion example in your own words.';
  }

  const calculationContext = buildCalculationTeachingContext(
    section,
    teacherBrainSectionContext || getTeacherBrainSectionContext(null, 0, ''),
  );
  if (calculationContext.detected) {
    return cleanTutorText(await base.buildTeachBackPrompt(...args));
  }

  return attemptNumber === 1
    ? `Teach it back: Explain the main idea of ${section.title} in your own words, then give one example or application.`
    : `Final teach-back: Explain the main idea of ${section.title} again in your own words, correcting the weak point, then give one example or application.`;
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

  if (isNonSubstantiveStudentResponse(studentResponse)) {
    return {
      evaluation:
        'That response does not provide evidence of recall yet, so one focused review is needed.',
      score: 0,
      failedConcepts: [fallbackWeakConceptForSection(section)],
    };
  }

  try {
    const raw = await aiProvider.generateResponse(
      [
        `Section title: ${section.title}`,
        `Current-section source:\n${String(section.content || '').slice(0, 2800)}`,
        teacherBrainContext
          ? `Teacher context:\n${String(teacherBrainContext).slice(0, 1200)}`
          : '',
        lessonPlan?.checkpointFocus?.length
          ? `Checkpoint objectives:\n${lessonPlan.checkpointFocus.slice(0, 3).join('\n')}`
          : '',
        `Student active-recall response:\n${studentResponse}`,
        'Score the recall semantically, not by keyword overlap.',
        'Ignore transcript, memory, or retrieved ideas that are unrelated to this current section.',
        'Rubric: 0-10 means no usable recall; 20-40 means one isolated fact; 50-70 means partial understanding with important gaps; 80-100 requires the main rule or idea plus at least one correct example, application, method, or relationship.',
        'Return strict JSON only with keys: score, feedback, missingIdeas.',
        'feedback must be one or two concise sentences, contain no question, and avoid generic praise.',
        'missingIdeas must contain at most two short conceptual labels from this current section only.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      {
        systemPrompt:
          'You are a strict but fair university mastery evaluator. Never introduce unrelated concepts from another section.',
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
          score >= 80 ? [] : sanitizeFailedConcepts(section, missingIdeas),
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
    score: isNonSubstantiveStudentResponse(studentResponse) ? 0 : fallback.score,
    failedConcepts:
      fallback.score >= 80
        ? []
        : sanitizeFailedConcepts(section, fallback.failedConcepts),
  };
}

export async function buildGapReteach(
  ...args: Parameters<typeof base.buildGapReteach>
): Promise<Awaited<ReturnType<typeof base.buildGapReteach>>> {
  const section = args[0];
  const safeConcepts = sanitizeFailedConcepts(section, args[1]);
  const concept = safeConcepts[0];

  if (isPrefixOrAbbreviationSection(section)) {
    return deterministicReteach(section, concept);
  }

  const forwarded = [...args] as Parameters<typeof base.buildGapReteach>;
  forwarded[1] = safeConcepts;

  let content = cleanTutorText(await base.buildGapReteach(...forwarded));
  if (
    content &&
    !looksIncomplete(content) &&
    !looksCorruptedTable(content) &&
    !looksOverbroadReteach(content)
  ) {
    return truncateToSentence(content, 850);
  }

  try {
    const regenerated = await aiProvider.generateResponse(
      [
        `Section title: ${section.title}`,
        `Weak idea to repair: ${concept}`,
        `Current-section source:\n${String(section.content || '').slice(0, 2200)}`,
        'Reteach only the weak idea in 4 to 6 short sentences.',
        'If the idea involves a rule or calculation, include one complete example from start to final result.',
        'Do not use markdown, bullets, numbered lists, tables, source-routing labels, or a question.',
        'Do not copy raw table rows, OCR fragments, or unrelated concepts from other sections.',
        'Finish the explanation completely; never end after a colon, heading, or numbered-step marker.',
      ].join('\n\n'),
      {
        systemPrompt:
          'You are Akademi AI Tutor. Produce one concise targeted reteach grounded only in the current section.',
        maxTokens: 320,
      },
    );
    const cleaned = cleanTutorText(regenerated);
    if (
      cleaned &&
      !looksIncomplete(cleaned) &&
      !looksCorruptedTable(cleaned) &&
      !looksOverbroadReteach(cleaned)
    ) {
      return truncateToSentence(cleaned, 850);
    }
  } catch (error) {
    console.error('gap_reteach_completion_repair_failed', {
      sectionTitle: section.title,
      message: error instanceof Error ? error.message : 'Unknown reteach repair failure',
    });
  }

  return deterministicReteach(section, concept);
}

export async function buildInterruptResponse(
  ...args: Parameters<typeof base.buildInterruptResponse>
): Promise<Awaited<ReturnType<typeof base.buildInterruptResponse>>> {
  const section = args[0];
  const content = cleanTutorText(await base.buildInterruptResponse(...args));
  return truncateToSentence(replaceGenericClarityCheck(content, section), 760);
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

  const concept = sanitizeFailedConcepts(section, failedConcepts)[0];
  return [
    `Mastery check: ${score}%`,
    `One area still needs work: ${concept}.`,
    'I will reteach that specific idea, then check it once more.',
  ].join('\n\n');
}

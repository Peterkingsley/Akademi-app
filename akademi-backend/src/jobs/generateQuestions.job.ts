import { addQuestionsToIndex } from '../shared/search/typesense.sync';
import prisma from '../config/db';
import { Difficulty } from '@prisma/client';
import { aiProvider } from '../modules/ai/ai.provider';
import { ReaderPage } from '../modules/materials/reader-structure';

type GeneratedQuestion = {
  question_text: string;
  options: string[];
  correct_answer: string;
  approach_guide: string;
  explanation?: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  question_type: 'RECALL' | 'APPLICATION' | 'CALCULATION' | 'REASONING' | 'MISCONCEPTION';
};

type GenerateQuestionOptions = {
  count?: number;
  excludeQuestionTexts?: string[];
  pageStart?: number;
  pageEnd?: number;
};

async function parseJsonObject(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const candidate = cleaned.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        try {
          return JSON.parse(candidate.replace(/\\(?!["\\/bfnrtu])/g, '\\\\'));
        } catch {
          const repaired = await aiProvider.generateResponse(candidate, {
            systemPrompt: 'Repair this malformed JSON without changing, adding, or removing any questions. Escape invalid backslashes and return JSON only.',
            maxTokens: 6500,
            temperature: 0,
          });
          const repairedClean = repaired.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
          return JSON.parse(repairedClean);
        }
      }
    }
    throw new Error('AI did not return valid JSON');
  }
}

function normalizeQuestion(raw: any): GeneratedQuestion | null {
  const options = Array.isArray(raw.options)
    ? raw.options.map((option: any) => String(option).trim()).filter(Boolean).slice(0, 4)
    : [];
  const correctAnswer = String(raw.correct_answer || raw.answer || '').trim();
  const difficulty = String(raw.difficulty || '').toUpperCase();
  const questionType = String(raw.question_type || '').toUpperCase();

  if (
    !raw.question_text ||
    !raw.approach_guide ||
    options.length !== 4 ||
    new Set(options.map((option: string) => option.toLowerCase())).size !== 4 ||
    !correctAnswer ||
    !['RECALL', 'APPLICATION', 'CALCULATION', 'REASONING', 'MISCONCEPTION'].includes(questionType)
  ) {
    return null;
  }

  const matchingOption = options.find((option: string) => option.toLowerCase() === correctAnswer.toLowerCase());
  if (!matchingOption) return null;

  return {
    question_text: String(raw.question_text).trim(),
    options,
    correct_answer: matchingOption,
    approach_guide: String(raw.approach_guide).trim(),
    explanation: raw.explanation ? String(raw.explanation).trim() : String(raw.approach_guide).trim(),
    difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(difficulty) ? difficulty as GeneratedQuestion['difficulty'] : 'MEDIUM',
    question_type: questionType as GeneratedQuestion['question_type'],
  };
}

const QUESTION_BANK_TARGET = Math.max(Number(process.env.MATERIAL_QUESTION_BANK_TARGET || 30), 10);
const QUESTION_BANK_MAX_SIZE = Math.max(Number(process.env.QUESTION_BANK_MAX_SIZE || 300), QUESTION_BANK_TARGET);

function questionGenerationRetryAt(attempts: number) {
  const delayMs = Math.min(30_000 * 2 ** Math.max(attempts - 1, 0), 30 * 60_000);
  return new Date(Date.now() + delayMs);
}

const DEDUPE_STOP_WORDS = new Set(['what', 'which', 'when', 'where', 'does', 'from', 'with', 'that', 'this', 'into', 'about', 'following', 'correctly']);

function semanticTokens(value: string) {
  return Array.from(new Set(value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((token) => token.length >= 3 && !DEDUPE_STOP_WORDS.has(token))));
}

export function semanticSimilarity(a: string, b: string) {
  const left = new Set(semanticTokens(a));
  const right = new Set(semanticTokens(b));
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / Math.min(left.size, right.size);
}

export function expectedDifficultyCounts(count: number) {
  const easy = Math.max(1, Math.round(count * 0.2));
  const medium = Math.max(1, Math.round(count * 0.3));
  return { EASY: easy, MEDIUM: medium, HARD: Math.max(count - easy - medium, 1) };
}

function validateGeneratedBatch(
  questions: GeneratedQuestion[],
  requestedCount: number,
  sourceContent: string,
  existingQuestionTexts: string[],
) {
  if (questions.length < requestedCount) {
    throw new Error(`AI returned ${questions.length}/${requestedCount} valid questions`);
  }
  const selected = questions.slice(0, requestedCount);
  const expected = expectedDifficultyCounts(requestedCount);
  const actual = selected.reduce((counts, question) => {
    counts[question.difficulty] += 1;
    return counts;
  }, { EASY: 0, MEDIUM: 0, HARD: 0 });
  if (actual.EASY !== expected.EASY || actual.MEDIUM !== expected.MEDIUM || actual.HARD !== expected.HARD) {
    throw new Error(`Invalid difficulty distribution: expected ${expected.EASY}/${expected.MEDIUM}/${expected.HARD}, received ${actual.EASY}/${actual.MEDIUM}/${actual.HARD}`);
  }

  const sourceTokens = new Set(semanticTokens(sourceContent));
  if (requestedCount >= 5 && new Set(selected.map((question) => question.question_type)).size < 3) {
    throw new Error('Question batch does not contain at least three distinct question types');
  }
  const accepted: GeneratedQuestion[] = [];
  for (const question of selected) {
    const grounded = semanticTokens(`${question.question_text} ${question.correct_answer}`)
      .some((token) => sourceTokens.has(token));
    if (!grounded) throw new Error(`Question is not grounded in the selected material: ${question.question_text.slice(0, 120)}`);
    const comparisons = [...existingQuestionTexts, ...accepted.map((item) => item.question_text)];
    if (comparisons.some((text) => semanticSimilarity(text, question.question_text) >= 0.82)) {
      throw new Error(`Semantic duplicate detected: ${question.question_text.slice(0, 120)}`);
    }
    accepted.push(question);
  }
  return accepted;
}

async function selectUndercoveredPageRange(materialId: string) {
  const material = await prisma.material.findUnique({ where: { id: materialId }, select: { reader_structure: true } });
  const pages = Array.isArray((material?.reader_structure as any)?.pages)
    ? ((material?.reader_structure as any).pages as ReaderPage[])
    : [];
  if (!pages.length) return null;
  const coveredRanges = await prisma.question.findMany({
    where: { material_id: materialId, source_page_start: { not: null } },
    select: { source_page_start: true, source_page_end: true },
  });
  const byPage = new Map<number, number>();
  for (const range of coveredRanges) {
    const start = range.source_page_start as number;
    const end = range.source_page_end ?? start;
    for (let page = start; page <= end; page += 1) {
      byPage.set(page, (byPage.get(page) || 0) + 1);
    }
  }
  const pageStart = pages.reduce((best, page) =>
    (byPage.get(page.pageNumber) || 0) < (byPage.get(best) || 0) ? page.pageNumber : best, pages[0].pageNumber);
  return { pageStart, pageEnd: Math.min(pageStart + 2, pages[pages.length - 1].pageNumber) };
}

async function generateQuestionsBatch(materialId: string, options: GenerateQuestionOptions = {}) {
  let material = await prisma.material.findUnique({
    where: { id: materialId },
  });
  if (!material) throw new Error('Material not found');

  let materialContent = material.content?.trim();
  if (!materialContent) {
    const { ingestMaterialJob } = await import('./ingestMaterial.job');
    await ingestMaterialJob(materialId);
    material = await prisma.material.findUnique({ where: { id: materialId } });
    materialContent = material?.content?.trim();
  }

  if (!material || !materialContent) {
    throw new Error('Cannot generate questions before material content is ingested');
  }

  const hasPageRange = options.pageStart != null && options.pageEnd != null;
  let sourceContent = materialContent;

  if (hasPageRange) {
    const pageStart = options.pageStart as number;
    const pageEnd = options.pageEnd as number;
    const pages = Array.isArray((material.reader_structure as any)?.pages)
      ? ((material.reader_structure as any).pages as ReaderPage[])
      : [];

    if (!pages.length) {
      throw new Error(`No content found for pages ${pageStart}-${pageEnd}`);
    }

    const rangeContent = pages
      .filter((page) => page.pageNumber >= pageStart && page.pageNumber <= pageEnd)
      .map((page) => page.content)
      .filter(Boolean)
      .join('\n\n')
      .trim();

    if (!rangeContent) {
      throw new Error(`No content found for pages ${pageStart}-${pageEnd}`);
    }

    sourceContent = rangeContent;
  }

  const requestedCount = Math.min(Math.max(options.count || 10, 5), 30);
  const existingQuestionTexts = options.excludeQuestionTexts?.filter(Boolean) || [];
  const disciplineDocument = await prisma.disciplineDocument.findFirst({
    where: { department: material.department, is_active: true },
    orderBy: { version: 'desc' },
  });

  const prompt = `Generate exam-prep multiple-choice questions from the following material, for a university student. This is not JAMB/WAEC-style testing — optimize for depth and multi-concept synthesis, not speed or pattern recognition.

  Material title: ${material.title}
  Course code: ${material.course_code || 'General'}
  Material content:
  ${sourceContent.slice(0, 24000)}

  Context: ${JSON.stringify(disciplineDocument)}
  Generate ${requestedCount} multiple-choice questions.
  Distribution: 20% EASY, 30% MEDIUM, 50% HARD.
  Required exact counts for this batch: ${expectedDifficultyCounts(requestedCount).EASY} EASY, ${expectedDifficultyCounts(requestedCount).MEDIUM} MEDIUM, ${expectedDifficultyCounts(requestedCount).HARD} HARD.
  Question-type coverage: use at least 3 of RECALL, APPLICATION, CALCULATION, REASONING, MISCONCEPTION in every batch. Include CALCULATION when the selected material contains formulas or quantitative methods. Use MISCONCEPTION questions to test a plausible student error, not trivia.

  DIFFICULTY DEFINITIONS (do not self-label — construct each question to this spec):
  - EASY: a single fact, direct recall, no scenario needed.
  - MEDIUM: one-step application of a formula/rule to a new but simple scenario not verbatim in the material.
  - HARD: multi-step reasoning, or synthesis across two or more concepts, requiring misconception-grade distractors (see below).

  TOUGHNESS RULES:
  - Never restate a single fact as the question. MEDIUM and HARD questions must require applying a concept to a new situation, or combining two or more facts together.
  - Every distractor (wrong option) must represent a specific, identifiable error a real student could actually make — a common miscalculation, a confused term, the wrong formula applied, an off-by-one error. Never an option that is just randomly false with no real reasoning behind it.
  - No "all of the above" or "none of the above" options.
  - No grammatical mismatch between the stem and the options that tips off the answer (e.g. "an ___" only fitting one option grammatically).
  - The correct answer must not be noticeably longer, more hedged, or more detailed than the distractors — keep all four options similar in length and specificity.
  - Avoid absolute words like "always" or "never" as an easy tell for a wrong distractor. If used, they must appear in a correct option at least as often as in a wrong one.

  SCENARIO & VALUE VARIETY:
  - When multiple questions in this batch test the same underlying concept, vary both the numeric values/parameters AND the real-world scenario dressing each time. Never generate the same scenario setup with only the numbers swapped.

  NO-REPEAT RULE:
  - A new question must differ from every existing question on the same concept along at least one of these axes: (a) the angle or facet being tested (e.g. definition vs. application vs. contrast vs. identifying the concept within a described scenario), (b) the scenario used, or (c) the specific values used. Any single one of these three is sufficient on its own — you do not need to change all three at once.
  ${existingQuestionTexts.length ? `- Do not repeat or closely paraphrase any of these existing questions:\n${existingQuestionTexts.slice(0, 80).map((text, index) => `${index + 1}. ${text}`).join('\n')}` : ''}

  VALIDITY:
  - Exactly one option must be unambiguously correct; the other three must be unambiguously wrong to anyone who knows the material. Avoid any "most nearly correct" or partial-credit situations.
  - correct_answer must exactly match one of the four options, verbatim.
  - No factual errors, outdated conventions, or contested/disputed claims presented as settled fact.
  - Each question must have exactly 4 concise options.
  - explanation must justify why the correct answer is right AND briefly state why each of the three distractors is wrong. If you cannot explain why a distractor is wrong, it is not a valid distractor — replace it.

  Format as JSON: { "questions": [{ "question_text": string, "options": string[], "correct_answer": string, "approach_guide": string, "explanation": string, "difficulty": "EASY"|"MEDIUM"|"HARD", "question_type": "RECALL"|"APPLICATION"|"CALCULATION"|"REASONING"|"MISCONCEPTION" }] }`;

  const aiOutput = await aiProvider.generateResponse(prompt, {
    systemPrompt: 'You are an expert university-level exam-question writer. You construct rigorous, exam-standard multiple-choice questions with plausible, misconception-based distractors — never questions that reward recall or lucky guessing. Return ONLY valid JSON.',
    maxTokens: 6000,
  });

  const parsed = await parseJsonObject(aiOutput);
  const normalizedQuestions = (parsed.questions || [])
    .map(normalizeQuestion)
    .filter(Boolean) as GeneratedQuestion[];
  const questions = validateGeneratedBatch(normalizedQuestions, requestedCount, sourceContent, existingQuestionTexts);

  let createdCount = 0;
  for (const q of questions) {
    // Check for duplicates
    const existing = await prisma.question.findFirst({
      where: {
        course_code: material.course_code,
        question_text: q.question_text,
      },
    });

    if (!existing) {
      const createdQuestion = await prisma.question.create({
        data: {
          material_id: materialId,
          course_code: material.course_code,
          course_id: material.course_id,
          university: material.university,
          department: material.department,
          level: material.level,
          question_text: q.question_text,
          approach_guide: q.approach_guide,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          difficulty: q.difficulty as Difficulty,
          question_type: q.question_type,
          source_page_start: hasPageRange ? options.pageStart : null,
          source_page_end: hasPageRange ? options.pageEnd : null,
        },
      });

      try {
        await addQuestionsToIndex([createdQuestion.id]);
      } catch (error) {
        console.error('Question saved, but Typesense indexing failed:', error);
      }
      createdCount += 1;
    }
  }

  return createdCount;
}

export async function generateQuestionsJob(materialId: string, options: GenerateQuestionOptions = {}) {
  const staleGeneration = new Date(Date.now() - 15 * 60_000);
  const claim = await prisma.material.updateMany({
    where: {
      id: materialId,
      OR: [
        { question_generation_status: { not: 'GENERATING' } },
        { question_generation_started_at: { lte: staleGeneration } },
      ],
    },
    data: {
      question_generation_status: 'GENERATING',
      question_bank_inventory_status: 'REFILLING',
      question_generation_attempts: { increment: 1 },
      question_generation_started_at: new Date(),
      question_generation_completed_at: null,
      question_generation_error: null,
      question_generation_next_retry_at: null,
    },
  });
  if (claim.count === 0) return 0;

  const lifecycle = await prisma.material.findUnique({
    where: { id: materialId },
    select: { question_generation_attempts: true },
  });
  if (!lifecycle) throw new Error('Material not found');

  try {
    const existing = await prisma.question.findMany({
      where: { material_id: materialId },
      select: { question_text: true },
    });
    if (existing.length >= QUESTION_BANK_MAX_SIZE || QUESTION_BANK_MAX_SIZE - existing.length < 5) {
      await prisma.material.update({
        where: { id: materialId },
        data: {
          question_generation_status: 'READY',
          question_bank_inventory_status: 'EXHAUSTED',
          question_generation_completed_at: new Date(),
          question_generation_error: null,
          question_generation_next_retry_at: null,
        },
      });
      return 0;
    }
    if (
      options.count == null &&
      options.pageStart == null &&
      options.pageEnd == null &&
      existing.length >= QUESTION_BANK_TARGET
    ) {
      await prisma.material.update({
        where: { id: materialId },
        data: {
          question_generation_status: 'READY',
          question_bank_inventory_status: existing.length >= QUESTION_BANK_MAX_SIZE ? 'EXHAUSTED' : 'HEALTHY',
          question_generation_completed_at: new Date(),
          question_generation_error: null,
          question_generation_next_retry_at: null,
        },
      });
      return 0;
    }
    const requestedCount = Math.min(
      options.count ?? Math.min(Math.max(QUESTION_BANK_TARGET - existing.length, 5), 10),
      QUESTION_BANK_MAX_SIZE - existing.length,
    );
    const coverageRange = options.pageStart == null && options.pageEnd == null
      ? await selectUndercoveredPageRange(materialId)
      : null;
    const createdCount = await generateQuestionsBatch(materialId, {
      ...options,
      count: requestedCount,
      ...(coverageRange || {}),
      excludeQuestionTexts: [
        ...existing.map((question) => question.question_text),
        ...(options.excludeQuestionTexts || []),
      ],
    });
    const totalQuestions = await prisma.question.count({ where: { material_id: materialId } });
    const ready =
      totalQuestions >= QUESTION_BANK_TARGET ||
      (createdCount === 0 && totalQuestions >= 10 && lifecycle.question_generation_attempts >= 5);

    await prisma.material.update({
      where: { id: materialId },
      data: {
        question_generation_status: ready ? 'READY' : 'PENDING',
        question_bank_inventory_status: totalQuestions >= QUESTION_BANK_MAX_SIZE ? 'EXHAUSTED' : ready ? 'HEALTHY' : 'BUILDING',
        question_generation_completed_at: ready ? new Date() : null,
        question_bank_last_refill_at: new Date(),
        question_generation_error: null,
        question_generation_next_retry_at: ready ? null : new Date(Date.now() + 10_000),
      },
    });

    return createdCount;
  } catch (error) {
    await prisma.material.update({
      where: { id: materialId },
      data: {
        question_generation_status: 'FAILED',
        question_bank_inventory_status: 'FAILED',
        question_generation_error: error instanceof Error ? error.message : 'Unknown question generation error',
        question_generation_next_retry_at: questionGenerationRetryAt(lifecycle.question_generation_attempts),
      },
    }).catch((lifecycleError) => {
      console.error('Failed to persist question generation failure:', lifecycleError);
    });
    throw error;
  }
}

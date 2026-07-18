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
};

type GenerateQuestionOptions = {
  count?: number;
  excludeQuestionTexts?: string[];
  pageStart?: number;
  pageEnd?: number;
};

function parseJsonObject(text: string) {
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
      return JSON.parse(cleaned.slice(start, end + 1));
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

  if (!raw.question_text || !raw.approach_guide || options.length < 2 || !correctAnswer) {
    return null;
  }

  const matchingOption = options.find((option: string) => option.toLowerCase() === correctAnswer.toLowerCase());
  if (!matchingOption) {
    options[0] = correctAnswer;
  }

  return {
    question_text: String(raw.question_text).trim(),
    options,
    correct_answer: matchingOption || correctAnswer,
    approach_guide: String(raw.approach_guide).trim(),
    explanation: raw.explanation ? String(raw.explanation).trim() : String(raw.approach_guide).trim(),
    difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(difficulty) ? difficulty as GeneratedQuestion['difficulty'] : 'MEDIUM',
  };
}

export async function generateQuestionsJob(materialId: string, options: GenerateQuestionOptions = {}) {
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

  Format as JSON: { "questions": [{ "question_text": string, "options": string[], "correct_answer": string, "approach_guide": string, "explanation": string, "difficulty": "EASY"|"MEDIUM"|"HARD" }] }`;

  const aiOutput = await aiProvider.generateResponse(prompt, {
    systemPrompt: 'You are an expert university-level exam-question writer. You construct rigorous, exam-standard multiple-choice questions with plausible, misconception-based distractors — never questions that reward recall or lucky guessing. Return ONLY valid JSON.',
    maxTokens: 2000,
  });

  const parsed = parseJsonObject(aiOutput);
  const questions = (parsed.questions || [])
    .map(normalizeQuestion)
    .filter(Boolean) as GeneratedQuestion[];

  if (questions.length === 0) {
    throw new Error('AI returned no usable questions');
  }

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

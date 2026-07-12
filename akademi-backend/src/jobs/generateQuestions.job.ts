import { addQuestionsToIndex } from '../shared/search/typesense.sync';
import prisma from '../config/db';
import { Difficulty } from '@prisma/client';
import { aiProvider } from '../modules/ai/ai.provider';

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
};

// A CBT practice bank should always sit at least this far ahead of what any single user has
// consumed, so a fresh batch is already available well before anyone actually runs dry.
export const QUESTION_BUFFER_TARGET = 100;

// One AI call is kept to a modest chunk size so the JSON response reliably fits within the
// token budget instead of risking truncation on a single giant request; generateQuestionsJob
// loops chunks internally to reach any larger requested count.
const CHUNK_SIZE = 20;
const MAX_CHUNKS_PER_RUN = 8;

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

async function generateChunk(
  material: { title: string; course_code: string | null; department: string; content: string | null },
  chunkCount: number,
  excludeQuestionTexts: string[],
): Promise<GeneratedQuestion[]> {
  const materialContent = material.content?.trim() || '';
  const disciplineDocument = await prisma.disciplineDocument.findFirst({
    where: { department: material.department, is_active: true },
    orderBy: { version: 'desc' },
  });

  const prompt = `Generate exam-prep multiple-choice questions from the following material based on the disciplinary context.
  Material title: ${material.title}
  Course code: ${material.course_code || 'General'}
  Material content:
  ${materialContent.slice(0, 24000)}

  Context: ${JSON.stringify(disciplineDocument)}
  Generate ${chunkCount} multiple-choice questions.
  Distribution: 20% EASY, 30% MEDIUM, 50% HARD.
  Goal: cover the full breadth of the material and make the set academically challenging, rigorous, and exam-standard.
  Each question must have exactly 4 concise options. The correct_answer must exactly match one option.
  ${excludeQuestionTexts.length ? `Do not repeat or closely paraphrase any of these existing questions:\n${excludeQuestionTexts.slice(0, 120).map((text, index) => `${index + 1}. ${text}`).join('\n')}` : ''}
  Format as JSON: { "questions": [{ "question_text": string, "options": string[], "correct_answer": string, "approach_guide": string, "explanation": string, "difficulty": "EASY"|"MEDIUM"|"HARD" }] }`;

  const aiOutput = await aiProvider.generateResponse(prompt, {
    systemPrompt: 'You are an expert academic assistant. Return ONLY valid JSON.',
    maxTokens: 4000,
  });

  const parsed = parseJsonObject(aiOutput);
  return (parsed.questions || [])
    .map(normalizeQuestion)
    .filter(Boolean) as GeneratedQuestion[];
}

/**
 * Generates up to `options.count` new questions for a material, looping AI calls in chunks of
 * CHUNK_SIZE (a single call can't reliably fit e.g. 100 structured questions in one JSON
 * response). Existing question texts for the material are always excluded automatically -
 * callers no longer need to compute/pass that list themselves.
 */
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

  const requestedCount = Math.min(Math.max(options.count || 10, 5), QUESTION_BUFFER_TARGET);

  const existingQuestions = await prisma.question.findMany({
    where: { material_id: materialId },
    select: { question_text: true },
  });
  const excludeQuestionTexts = new Set([
    ...existingQuestions.map((q) => q.question_text),
    ...(options.excludeQuestionTexts?.filter(Boolean) || []),
  ]);

  let createdCount = 0;
  let chunksRun = 0;

  while (createdCount < requestedCount && chunksRun < MAX_CHUNKS_PER_RUN) {
    const remaining = requestedCount - createdCount;
    const chunkCount = Math.min(remaining, CHUNK_SIZE);
    chunksRun += 1;

    let questions: GeneratedQuestion[];
    try {
      questions = await generateChunk(material, chunkCount, [...excludeQuestionTexts]);
    } catch (error) {
      console.error(`Question generation chunk failed for material ${materialId}:`, error);
      break;
    }

    if (questions.length === 0) break;

    for (const q of questions) {
      if (excludeQuestionTexts.has(q.question_text)) continue;

      const existing = await prisma.question.findFirst({
        where: { course_code: material.course_code, question_text: q.question_text },
      });
      if (existing) {
        excludeQuestionTexts.add(q.question_text);
        continue;
      }

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
        },
      });

      try {
        await addQuestionsToIndex([createdQuestion.id]);
      } catch (error) {
        console.error('Question saved, but Typesense indexing failed:', error);
      }

      excludeQuestionTexts.add(q.question_text);
      createdCount += 1;
    }
  }

  return createdCount;
}

/**
 * Checks a material's total question bank against QUESTION_BUFFER_TARGET and enqueues a
 * background top-up (non-blocking) if it's short. Safe to call from any request path - the
 * queue dedupes concurrent jobs for the same material, so calling this repeatedly while a
 * top-up is already in flight is a no-op.
 */
export async function ensureQuestionBuffer(materialId: string, targetCount: number = QUESTION_BUFFER_TARGET) {
  const currentCount = await prisma.question.count({ where: { material_id: materialId } });
  const shortfall = targetCount - currentCount;
  if (shortfall <= 0) return;

  const { systemQueue, JOB_NAMES } = await import('../config/queue');
  await systemQueue.add(JOB_NAMES.GENERATE_QUESTIONS, { materialId, count: shortfall });
}

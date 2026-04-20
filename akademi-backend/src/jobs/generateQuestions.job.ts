import { addQuestionsToIndex } from '../shared/search/typesense.sync';
import prisma from '../config/db';
import { Difficulty } from '@prisma/client';
import { aiProvider } from '../modules/ai/ai.provider';

export async function generateQuestionsJob(materialId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
  });
  if (!material) throw new Error('Material not found');

  // In real implementation, fetch content from R2. Mocking it here.
  const materialContent = `Mocked content from R2 for material ${material.title}`;

  const disciplineDocument = await prisma.disciplineDocument.findFirst({
    where: { department: material.department, is_active: true },
    orderBy: { version: 'desc' },
  });

  const prompt = `Generate 10 questions from the following material based on the disciplinary context.
  Material: ${materialContent}
  Context: ${JSON.stringify(disciplineDocument)}
  Distribution: 30% EASY, 40% MEDIUM, 30% HARD.
  Format as JSON: { questions: [{ question_text: string, approach_guide: string, difficulty: 'EASY'|'MEDIUM'|'HARD' }] }`;

  const aiOutput = await aiProvider.generateResponse(prompt, {
    systemPrompt: 'You are an expert academic assistant. Return ONLY valid JSON.',
    maxTokens: 2000,
  });

  const { questions } = JSON.parse(aiOutput);

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
          university: material.university,
          department: material.department,
          level: material.level,
          question_text: q.question_text,
          approach_guide: q.approach_guide,
          difficulty: q.difficulty as Difficulty,
        },
      });
      await addQuestionsToIndex([createdQuestion.id]);
    }
  }
}

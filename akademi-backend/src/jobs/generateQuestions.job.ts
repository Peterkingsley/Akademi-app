import prisma from '../config/db';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';
import { Difficulty } from '@prisma/client';

const anthropic = new Anthropic({ apiKey: config.claudeApiKey });

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

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: 'You are an expert academic assistant.',
    messages: [{ role: 'user', content: prompt }],
  });

  const content = (response.content[0] as any).text;
  const { questions } = JSON.parse(content);

  for (const q of questions) {
    // Check for duplicates
    const existing = await prisma.question.findFirst({
      where: {
        course_code: material.course_code,
        question_text: q.question_text,
      },
    });

    if (!existing) {
      await prisma.question.create({
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
    }
  }
}

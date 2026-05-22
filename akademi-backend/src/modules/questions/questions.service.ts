import { Difficulty, Feature } from '@prisma/client';
import prisma from '../../config/db';
import { checkFeatureAccess } from '../../shared/utils/feature-access';
import { orchestrateAIResponse } from '../../shared/utils/ai-orchestrator';

export class QuestionsService {
  async getQuestions(filter: any) {
    return prisma.question.findMany({
      where: filter,
    });
  }

  async getQuestion(id: string) {
    const question = await prisma.question.findUnique({
      where: { id },
    });
    if (!question) throw new Error('Question not found');
    return question;
  }

  async attemptQuestion(userId: string, questionId: string, answer: string) {
    // Check feature access (EXAM_PREP is used for practice questions too)
    const hasAccess = await checkFeatureAccess(userId, Feature.EXAM_PREP);
    if (!hasAccess) {
      throw new Error('No active feature access for exam prep');
    }

    const question = await this.getQuestion(questionId);

    let isCorrect = false;
    let feedback = '';

    if (question.correct_answer) {
      // Direct scoring if correct_answer exists
      isCorrect = answer.trim().toUpperCase() === question.correct_answer.trim().toUpperCase();
      feedback = isCorrect
        ? `Correct! ${question.explanation || ''}`
        : `Incorrect. The correct answer is ${question.correct_answer}. ${question.explanation || ''}`;
    } else {
      // Fallback to AI feedback if no correct_answer is stored (legacy or open-ended questions)
      feedback = await orchestrateAIResponse(userId, '', `Evaluating answer: ${answer} for question: ${question.question_text}`, null);
      // In a real implementation, the AI would also return a boolean for isCorrect
      isCorrect = feedback.toLowerCase().includes('correct') && !feedback.toLowerCase().includes('incorrect');
    }

    const attempt = await prisma.questionAttempt.create({
      data: {
        user_id: userId,
        question_id: questionId,
        answer,
        is_correct: isCorrect,
        feedback,
      },
    });

    return attempt;
  }

  async getFeedback(userId: string, questionId: string) {
    const attempt = await prisma.questionAttempt.findFirst({
      where: { user_id: userId, question_id: questionId },
      orderBy: { created_at: 'desc' },
    });
    if (!attempt) throw new Error('No attempt found for this question');
    return attempt;
  }
}

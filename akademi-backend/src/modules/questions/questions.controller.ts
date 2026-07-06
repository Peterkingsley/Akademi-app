import { Request, Response } from 'express';
import { QuestionsService } from './questions.service';
import { Difficulty } from '@prisma/client';

const questionsService = new QuestionsService();

export class QuestionsController {
  async getQuestions(req: Request, res: Response) {
    try {
      const { course_code, department, difficulty, level } = req.query;
      const filter: any = {};
      if (course_code) filter.course_code = course_code as string;
      if (department) filter.department = department as string;
      if (difficulty) filter.difficulty = difficulty as Difficulty;
      if (level) filter.level = parseInt(level as string);

      const questions = await questionsService.getQuestions(filter);
      res.status(200).json(questions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch questions' });
    }
  }

  async getQuestion(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const question = await questionsService.getPublicQuestion(id);
      res.status(200).json(question);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }

  async attemptQuestion(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { answer } = req.body;
      const userId = (req.user as any).userId;

      const attempt = await questionsService.attemptQuestion(userId, id, answer);
      res.status(201).json(attempt);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getFeedback(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req.user as any).userId;
      const feedback = await questionsService.getFeedback(userId, id);
      res.status(200).json(feedback);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }
}

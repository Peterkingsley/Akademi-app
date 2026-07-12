import { Request, Response } from 'express';
import { ExamPrepService } from './exam-prep.service';

const examPrepService = new ExamPrepService();

export class ExamPrepController {
  async getCourseHub(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const courses = await examPrepService.listCourseHub(userId);
      res.status(200).json(courses);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to load exam prep courses' });
    }
  }

  async getOrCreateCoursePlan(req: Request, res: Response) {
    try {
      const { courseCode } = req.params;
      const userId = (req.user as any).userId;
      const plan = await examPrepService.getOrCreateFormattedPlanForCourse(userId, courseCode);
      res.status(200).json(plan);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to load prep plan for course' });
    }
  }

  async upsertPlanSettings(req: Request, res: Response) {
    try {
      const { courseCode } = req.params;
      const {
        exam_date,
        assessment_type,
        duration_minutes,
        objective_question_count,
        theory_question_count,
      } = req.body;
      const userId = (req.user as any).userId;
      const plan = await examPrepService.upsertPlanSettings(
        userId,
        courseCode,
        exam_date,
        assessment_type,
        duration_minutes,
        objective_question_count,
        theory_question_count,
      );
      res.status(200).json(plan);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to save prep plan settings' });
    }
  }

  async startMockForCourse(req: Request, res: Response) {
    try {
      const { courseCode } = req.params;
      const userId = (req.user as any).userId;
      const mockExam = await examPrepService.startMockExamForCourse(userId, courseCode);
      res.status(201).json(mockExam);
    } catch (error: any) {
      res.status(403).json({ message: error.message });
    }
  }

  // Legacy create-plan endpoint - AddExamScreen historically called this to create a plan up
  // front; now it upserts the same get-or-create-by-course settings record.
  async createPlan(req: Request, res: Response) {
    try {
      const {
        course_code,
        exam_date,
        assessment_type,
        duration_minutes,
        objective_question_count,
        theory_question_count,
      } = req.body;
      const userId = (req.user as any).userId;
      const plan = await examPrepService.upsertPlanSettings(
        userId,
        course_code,
        exam_date,
        assessment_type,
        duration_minutes,
        objective_question_count,
        theory_question_count,
      );
      res.status(201).json(plan);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to create plan' });
    }
  }

  async getPlans(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const plans = await examPrepService.getAllPlans(userId);
      res.status(200).json(plans);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch plans' });
    }
  }

  async getPlan(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req.user as any).userId;
      const plan = await examPrepService.getPlan(userId, id);
      res.status(200).json(plan);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }

  async getMockHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req.user as any).userId;
      const history = await examPrepService.getMockHistory(userId, id);
      res.status(200).json(history);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }

  async startMock(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req.user as any).userId;
      const mockExam = await examPrepService.startMockExam(userId, id);
      res.status(201).json(mockExam);
    } catch (error: any) {
      res.status(403).json({ message: error.message });
    }
  }

  async getMockExam(req: Request, res: Response) {
    try {
      const { examId } = req.params;
      const userId = (req.user as any).userId;
      const exam = await examPrepService.getMockExam(userId, examId);
      res.status(200).json(exam);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }

  async submitMock(req: Request, res: Response) {
    try {
      const { examId } = req.params;
      const { answers } = req.body;
      const userId = (req.user as any).userId;
      const result = await examPrepService.submitMock(userId, examId, answers);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ message: 'Failed to submit mock exam' });
    }
  }

  async getMockResults(req: Request, res: Response) {
    try {
      const { examId } = req.params;
      const userId = (req.user as any).userId;
      const result = await examPrepService.getMockResults(userId, examId);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch mock results' });
    }
  }
}

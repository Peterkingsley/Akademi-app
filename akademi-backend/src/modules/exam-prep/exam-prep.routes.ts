import { Router } from 'express';
import { ExamPrepController } from './exam-prep.controller';
import { authenticate } from '../auth/auth.middleware';

const router = Router();
const controller = new ExamPrepController();

router.post('/', authenticate, controller.createPlan);
router.get('/', authenticate, controller.getPlans);
router.get('/:id', authenticate, controller.getPlan);
router.patch('/:id/progress', authenticate, controller.updateProgress);
router.get('/:id/readiness', authenticate, controller.getReadiness);
router.post('/:id/mock-exam', authenticate, controller.startMock);
router.get('/:id/mock-exam/:examId', authenticate, controller.getMockExam);
router.post('/:id/mock-exam/:examId/submit', authenticate, controller.submitMock);
router.get('/:id/mock-exam/:examId/results', authenticate, controller.getMockResults);

export default router;

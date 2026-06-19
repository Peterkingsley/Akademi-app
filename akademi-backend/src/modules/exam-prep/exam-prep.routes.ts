import { Router } from 'express';
import { ExamPrepController } from './exam-prep.controller';
import { authenticate } from '../auth/auth.middleware';
import { generalAuthenticatedApiLimiter } from '../../shared/middleware/rate-limit';

const router = Router();
const controller = new ExamPrepController();

router.use(authenticate);
router.use(generalAuthenticatedApiLimiter);

router.post('/', controller.createPlan);
router.get('/', controller.getPlans);
router.get('/:id', controller.getPlan);
router.patch('/:id/progress', controller.updateProgress);
router.get('/:id/readiness', controller.getReadiness);
router.get('/:id/mock-history', controller.getMockHistory);
router.post('/:id/mock-exam', controller.startMock);
router.get('/:id/mock-exam/:examId', controller.getMockExam);
router.post('/:id/mock-exam/:examId/submit', controller.submitMock);
router.get('/:id/mock-exam/:examId/results', controller.getMockResults);

export default router;

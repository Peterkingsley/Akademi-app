import { Router } from 'express';
import { ExamPrepController } from './exam-prep.controller';
import { authenticate } from '../auth/auth.middleware';
import { generalAuthenticatedApiLimiter } from '../../shared/middleware/rate-limit';

const router = Router();
const controller = new ExamPrepController();

router.use(authenticate);
router.use(generalAuthenticatedApiLimiter);

// Course hub routes - registered ahead of the `/:id` routes below so "courses" is never
// swallowed as a plan id.
router.get('/courses', controller.getCourseHub);
router.post('/courses/:courseCode/mock-exam', controller.startMockForCourse);
router.patch('/courses/:courseCode/settings', controller.upsertPlanSettings);

router.post('/', controller.createPlan);
router.get('/', controller.getPlans);
router.get('/:id', controller.getPlan);
router.get('/:id/readiness', controller.getReadiness);
router.get('/:id/mock-history', controller.getMockHistory);
router.post('/:id/mock-exam', controller.startMock);
router.get('/:id/mock-exam/:examId', controller.getMockExam);
router.post('/:id/mock-exam/:examId/submit', controller.submitMock);
router.get('/:id/mock-exam/:examId/results', controller.getMockResults);

export default router;

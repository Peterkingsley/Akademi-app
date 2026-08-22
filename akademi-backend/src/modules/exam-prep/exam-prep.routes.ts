import { Router } from 'express';
import { ExamPrepController } from './exam-prep.controller';
import { authenticate } from '../auth/auth.middleware';
import { generalAuthenticatedApiLimiter } from '../../shared/middleware/rate-limit';

const router = Router();
const controller = new ExamPrepController();

router.use(authenticate);
router.use(generalAuthenticatedApiLimiter);

// Guided question-based learning. Keep these focused lifecycle routes ahead of the legacy
// plan `/:id` routes so neither `materials` nor `sessions` can be interpreted as plan ids.
router.get('/materials', controller.getGuidedMaterials);
router.post('/materials/:materialId/sessions', controller.startGuidedSession);
router.get('/sessions/:sessionId', controller.getGuidedSession);
router.post('/sessions/:sessionId/questions/:questionId/submit', controller.submitGuidedQuestion);
router.post('/sessions/:sessionId/next', controller.advanceGuidedSession);
router.get('/sessions/:sessionId/summary', controller.getGuidedSummary);

// Course hub routes - registered ahead of the `/:id` routes below so "courses" is never
// swallowed as a plan id.
router.get('/courses', controller.getCourseHub);
router.post('/courses/:courseCode/mock-exam', controller.startMockForCourse);
router.patch('/courses/:courseCode/settings', controller.upsertPlanSettings);

router.post('/', controller.createPlan);
router.get('/', controller.getPlans);

// Plans use Prisma UUID ids. Constraining the legacy catch-all provides a second line of
// defence in addition to route ordering: a future named route can never become a plan lookup.
const legacyPlanPath = '/:id([0-9a-fA-F-]{36})';
router.get(legacyPlanPath, controller.getPlan);
router.get(`${legacyPlanPath}/readiness`, controller.getReadiness);
router.get(`${legacyPlanPath}/mock-history`, controller.getMockHistory);
router.post(`${legacyPlanPath}/mock-exam`, controller.startMock);
router.get(`${legacyPlanPath}/mock-exam/:examId`, controller.getMockExam);
router.post(`${legacyPlanPath}/mock-exam/:examId/submit`, controller.submitMock);
router.get(`${legacyPlanPath}/mock-exam/:examId/results`, controller.getMockResults);

export default router;

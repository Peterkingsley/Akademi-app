import { Router } from 'express';
import { DemoExamPrepController } from './demo-exam-prep.controller';
import {
  demoExamPrepGeneralRateLimiter,
  demoExamPrepSessionRateLimiter,
  demoExamPrepSubmitRateLimiter,
} from '../../shared/middleware/rate-limit';

const router = Router();
const controller = new DemoExamPrepController();

router.use(demoExamPrepGeneralRateLimiter);
router.get('/materials', (req, res) => controller.materials(req, res));
router.post('/sessions', demoExamPrepSessionRateLimiter, (req, res) => controller.start(req, res));
router.get('/sessions/:sessionId', (req, res) => controller.session(req, res));
router.post(
  '/sessions/:sessionId/questions/:questionId/submit',
  demoExamPrepSubmitRateLimiter,
  (req, res) => controller.submit(req, res),
);
router.post(
  '/sessions/:sessionId/questions/:questionId/retry',
  demoExamPrepSubmitRateLimiter,
  (req, res) => controller.retry(req, res),
);
router.post('/sessions/:sessionId/next', demoExamPrepSubmitRateLimiter, (req, res) => controller.next(req, res));

export default router;

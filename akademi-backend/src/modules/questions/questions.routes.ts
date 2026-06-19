import { Router } from 'express';
import { QuestionsController } from './questions.controller';
import { authenticate } from '../auth/auth.middleware';
import { generalAuthenticatedApiLimiter } from '../../shared/middleware/rate-limit';

const router = Router();
const controller = new QuestionsController();

router.use(authenticate);
router.use(generalAuthenticatedApiLimiter);

router.get('/', controller.getQuestions);
router.get('/:id', controller.getQuestion);
router.post('/:id/attempt', controller.attemptQuestion);
router.get('/:id/attempt/feedback', controller.getFeedback);

export default router;

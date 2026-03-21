import { Router } from 'express';
import { QuestionsController } from './questions.controller';
import { authenticate } from '../auth/auth.middleware';

const router = Router();
const controller = new QuestionsController();

router.get('/', authenticate, controller.getQuestions);
router.get('/:id', authenticate, controller.getQuestion);
router.post('/:id/attempt', authenticate, controller.attemptQuestion);
router.get('/:id/attempt/feedback', authenticate, controller.getFeedback);

export default router;

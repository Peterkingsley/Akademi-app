import { Router } from 'express';
import { SessionsController } from './sessions.controller';
import { authenticate } from '../auth/auth.middleware';

const router = Router();
const sessionsController = new SessionsController();

router.use(authenticate);

router.post('/', sessionsController.start);
router.get('/', sessionsController.list);
router.get('/:id', sessionsController.getOne);
router.patch('/:id/end', sessionsController.end);
router.get('/:id/messages', sessionsController.getMessages);
router.post('/:id/messages', sessionsController.sendMessage);
router.get('/:id/summary', sessionsController.getSummary);

export default router;

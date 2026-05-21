import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { authenticate } from '../auth/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', notificationsController.list);
router.patch('/:id/read', notificationsController.markRead);
router.post('/mark-all-read', notificationsController.markAllRead);

export default router;

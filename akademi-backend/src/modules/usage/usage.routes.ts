import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware';
import { generalAuthenticatedApiLimiter } from '../../shared/middleware/rate-limit';
import { UsageController } from './usage.controller';

const router = Router();
const controller = new UsageController();
router.use(authenticate, generalAuthenticatedApiLimiter);
router.get('/', controller.summary);
router.post('/ai-tutor/heartbeat', controller.tutorHeartbeat);
export default router;

import { Router } from 'express';
import { authenticate, requireActiveAdmin } from '../auth/auth.middleware';
import { companionTurnRateLimiter } from '../../shared/middleware/rate-limit';
import { TeachingEngineController } from './teaching-engine.controller';

const router = Router();
const controller = new TeachingEngineController();

// The teaching engine is still an internal/admin preview feature. This is a
// server-side gate, not merely a hidden client control.
router.use(authenticate, requireActiveAdmin);
router.post('/episodes', companionTurnRateLimiter, (req, res) => controller.createEpisode(req, res));

export default router;

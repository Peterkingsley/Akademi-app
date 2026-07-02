import { Router } from 'express';
import { waitlistController } from './waitlist.controller';
import { waitlistEventRateLimiter, waitlistJoinRateLimiter } from '../../shared/middleware/rate-limit';

const router = Router();

router.post('/', waitlistJoinRateLimiter, (req, res) => waitlistController.join(req, res));
router.post('/events', waitlistEventRateLimiter, (req, res) => waitlistController.trackEvent(req, res));

export default router;

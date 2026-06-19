import { Router } from 'express';
import { waitlistController } from './waitlist.controller';
import { waitlistJoinRateLimiter } from '../../shared/middleware/rate-limit';

const router = Router();

router.post('/', waitlistJoinRateLimiter, (req, res) => waitlistController.join(req, res));

export default router;

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { waitlistController } from './waitlist.controller';

const router = Router();

const waitlistLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', waitlistLimiter, (req, res) => waitlistController.join(req, res));

export default router;

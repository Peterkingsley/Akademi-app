import { Router } from 'express';
import { SessionsController } from './sessions.controller';
import { authenticate } from '../auth/auth.middleware';
import multer from 'multer';
import {
  generalAuthenticatedApiLimiter,
  sessionInteractionRateLimiter,
} from '../../shared/middleware/rate-limit';

const router = Router();
const sessionsController = new SessionsController();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image uploads are allowed'));
  },
});

router.use(authenticate);
router.use(generalAuthenticatedApiLimiter);

router.post('/', sessionInteractionRateLimiter, sessionsController.start);
router.get('/', sessionsController.list);
router.get('/:id', sessionsController.getOne);
router.patch('/:id/end', sessionsController.end);
router.get('/:id/messages', sessionsController.getMessages);
router.post('/:id/messages', sessionInteractionRateLimiter, sessionsController.sendMessage);
router.post('/:id/messages/photo', sessionInteractionRateLimiter, upload.single('photo'), sessionsController.sendPhotoMessage);
router.get('/:id/summary', sessionsController.getSummary);

export default router;

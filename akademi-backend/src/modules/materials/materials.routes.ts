import { Router } from 'express';
import { MaterialsController } from './materials.controller';
import { authenticate } from '../auth/auth.middleware';
import {
  generalAuthenticatedApiLimiter,
  materialUploadRateLimiter,
} from '../../shared/middleware/rate-limit';

const router = Router();
const materialsController = new MaterialsController();

router.use(authenticate);
router.use(generalAuthenticatedApiLimiter);

router.get('/', materialsController.list);
router.get('/pending', materialsController.getPending);
router.get('/:id', materialsController.getOne);
router.post('/upload', materialUploadRateLimiter, materialsController.upload);
router.post('/:id/confirm', materialUploadRateLimiter, materialsController.confirm);
router.get('/:id/download', materialsController.getDownloadUrl);
router.get('/:id/questions', materialsController.getQuestions);
router.post('/:id/questions/attempts', materialsController.submitQuestionAttempts);
router.post('/:id/report', materialsController.report);

export default router;

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
router.get('/intelligence/audit', materialsController.auditMaterialIntelligence);
router.post('/teacher-brain/backfill', materialsController.backfillTeacherBrains);
router.get('/:id', materialsController.getOne);
router.get('/:id/teacher-brain', materialsController.getTeacherBrain);
router.post('/:id/teacher-brain/regenerate', materialsController.regenerateTeacherBrain);
router.get('/:id/teaching-constraints', materialsController.listTeachingConstraints);
router.post('/:id/teaching-constraints', materialsController.createTeachingConstraint);
router.patch('/:id/teaching-constraints/:constraintId', materialsController.updateTeachingConstraint);
router.delete('/:id/teaching-constraints/:constraintId', materialsController.disableTeachingConstraint);
router.post('/upload', materialUploadRateLimiter, materialsController.upload);
router.post('/:id/confirm', materialsController.confirm);
router.get('/:id/download', materialsController.getDownloadUrl);
// Optional query params: limit, and pageStart/pageEnd to scope the CBT pool to a document-global
// reader page range (both required together, 1-indexed, inclusive).
router.get('/:id/questions', materialsController.getQuestions);
router.post('/:id/questions/attempts', materialsController.submitQuestionAttempts);
router.post('/:id/report', materialsController.report);

export default router;

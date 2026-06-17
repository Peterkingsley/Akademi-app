import { Router } from 'express';
import { MaterialsController } from './materials.controller';
import { authenticate } from '../auth/auth.middleware';

const router = Router();
const materialsController = new MaterialsController();

router.use(authenticate);

router.get('/', materialsController.list);
router.get('/pending', materialsController.getPending);
router.get('/:id', materialsController.getOne);
router.post('/upload', materialsController.upload);
router.post('/:id/confirm', materialsController.confirm);
router.get('/:id/download', materialsController.getDownloadUrl);
router.get('/:id/questions', materialsController.getQuestions);
router.post('/:id/questions/attempts', materialsController.submitQuestionAttempts);
router.post('/:id/report', materialsController.report);

export default router;

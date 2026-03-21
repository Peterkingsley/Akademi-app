import { Router } from 'express';
import { UniversitiesController } from './universities.controller';
import { authenticate } from '../auth/auth.middleware';

const router = Router();
const controller = new UniversitiesController();

router.get('/', authenticate, controller.getUniversities);
router.get('/:id/departments', authenticate, controller.getDepartments);

export default router;

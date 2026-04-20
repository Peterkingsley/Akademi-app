import { Router } from 'express';
import { UniversitiesController } from './universities.controller';

const router = Router();
const controller = new UniversitiesController();

router.get('/', controller.getUniversities);
router.get('/:id/departments', controller.getDepartments);

export default router;

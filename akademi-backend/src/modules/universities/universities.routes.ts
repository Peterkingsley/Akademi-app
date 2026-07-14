import { Router } from 'express';
import { UniversitiesController } from './universities.controller';

const router = Router();
const controller = new UniversitiesController();

router.get('/', controller.getUniversities);
router.post('/requests', controller.requestUniversity);
router.get('/:id/faculties', controller.getFaculties);
router.get('/:id/departments', controller.getDepartments);
router.get('/:id/departments/:departmentId/courses', controller.getCourseSuggestions);

export default router;

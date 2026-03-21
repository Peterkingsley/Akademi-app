import { Router } from 'express';
import { SearchController } from './search.controller';
import { authenticate } from '../auth/auth.middleware';

const router = Router();
const controller = new SearchController();

router.get('/', authenticate, controller.search);

export default router;

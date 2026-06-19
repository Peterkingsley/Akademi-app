import { Router } from 'express';
import { SearchController } from './search.controller';
import { optionalAuthenticate } from '../auth/auth.middleware';
import { generalOptionalApiLimiter } from '../../shared/middleware/rate-limit';

const router = Router();
const controller = new SearchController();

router.get('/', optionalAuthenticate, generalOptionalApiLimiter, controller.search);

export default router;

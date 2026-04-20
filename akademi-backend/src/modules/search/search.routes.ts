import { Router } from 'express';
import { SearchController } from './search.controller';
import { optionalAuthenticate } from '../auth/auth.middleware';

const router = Router();
const controller = new SearchController();

router.get('/', optionalAuthenticate, controller.search);

export default router;

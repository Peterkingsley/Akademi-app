import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware';
import { generalAuthenticatedApiLimiter } from '../../shared/middleware/rate-limit';
import { KoinController } from './koin.controller';

const router = Router();
const controller = new KoinController();
router.use(authenticate);
router.use(generalAuthenticatedApiLimiter);
router.get('/wallet', controller.wallet);
router.get('/packages', controller.packages);
router.post('/rewards', controller.reward);
router.get('/competitions/:id/pool', controller.competitionPool);
router.get('/tournaments/:id/pool', controller.tournamentPool);
router.post('/pools/:poolId/contributions', controller.contribute);
router.post('/withdrawals', controller.withdraw);
export default router;

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware';
import { CompetitionsController } from './competitions.controller';

const router = Router();
const controller = new CompetitionsController();

router.use(authenticate);

router.post('/', controller.create);
router.post('/join', controller.join);
router.get('/mine', controller.getMine);
router.get('/public', controller.getPublic);
router.get('/summary', controller.getSummary);
router.get('/leaderboard', controller.getLeaderboard);
router.get('/tournaments', controller.getTournaments);
router.post('/tournaments/:id/join', controller.joinTournament);
router.get('/:id', controller.getOne);
router.patch('/:id/status', controller.updateStatus);

export default router;

import { Router } from 'express';
import { FeatureAccessController } from './feature-access.controller';
import { authenticate } from '../auth/auth.middleware';

const router = Router();
const controller = new FeatureAccessController();

router.get('/', authenticate, controller.getActiveUnlocks);
router.post('/purchase', authenticate, controller.purchase);
router.get('/check/:feature', authenticate, controller.checkFeature);
router.post('/webhook', controller.webhook);

export default router;

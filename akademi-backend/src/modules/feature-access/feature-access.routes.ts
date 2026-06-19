import { Router } from 'express';
import { FeatureAccessController } from './feature-access.controller';
import { authenticate } from '../auth/auth.middleware';
import { generalAuthenticatedApiLimiter } from '../../shared/middleware/rate-limit';

const router = Router();
const controller = new FeatureAccessController();

router.post('/webhook', controller.webhook);

router.use(authenticate);
router.use(generalAuthenticatedApiLimiter);

router.get('/products', controller.getProducts);
router.get('/', controller.getActiveUnlocks);
router.post('/purchase', controller.purchase);
router.get('/check/:feature', controller.checkFeature);

export default router;

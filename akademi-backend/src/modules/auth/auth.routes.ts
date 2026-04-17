import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from './auth.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();
const authController = new AuthController();

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many failed login attempts, please try again after 15 minutes' },
  skipSuccessfulRequests: true,
});
const verificationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many attempts, please try again after 15 minutes' },
});


router.post('/register', verificationRateLimiter, (req, res) => authController.register(req, res));
router.post('/verify-email', (req, res) => authController.verifyEmail(req, res));
router.post('/login', loginRateLimiter, (req, res) => authController.login(req, res));
router.post('/google', (req, res) => authController.googleLogin(req, res));
router.post('/refresh', (req, res) => authController.refreshToken(req, res));
router.post('/logout', authenticate, (req, res) => authController.logout(req, res));
router.post('/logout-all', authenticate, (req, res) => authController.logoutAll(req, res));
router.post('/forgot-password', verificationRateLimiter, (req, res) => authController.forgotPassword(req, res));
router.post('/reset-password', (req, res) => authController.resetPassword(req, res));
router.post('/resend-verification', (req, res) => authController.resendVerification(req, res));
router.post('/change-password', authenticate, (req, res) => authController.changePassword(req, res));

export default router;

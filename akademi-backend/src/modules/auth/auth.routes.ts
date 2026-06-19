import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from './auth.middleware';
import {
  authForgotPasswordRateLimiter,
  authLoginRateLimiter,
  authRefreshRateLimiter,
  authRegisterRateLimiter,
} from '../../shared/middleware/rate-limit';

const router = Router();
const authController = new AuthController();

router.post('/register', authRegisterRateLimiter, (req, res) => authController.register(req, res));
router.post('/verify-email', (req, res) => authController.verifyEmail(req, res));
router.post('/login', authLoginRateLimiter, (req, res) => authController.login(req, res));
router.post('/google', authLoginRateLimiter, (req, res) => authController.googleLogin(req, res));
router.post('/refresh', authRefreshRateLimiter, (req, res) => authController.refreshToken(req, res));
router.post('/logout', authenticate, (req, res) => authController.logout(req, res));
router.post('/logout-all', authenticate, (req, res) => authController.logoutAll(req, res));
router.post('/forgot-password', authForgotPasswordRateLimiter, (req, res) => authController.forgotPassword(req, res));
router.post('/reset-password', (req, res) => authController.resetPassword(req, res));
router.post('/resend-verification', (req, res) => authController.resendVerification(req, res));
router.post('/change-password', authenticate, (req, res) => authController.changePassword(req, res));

export default router;

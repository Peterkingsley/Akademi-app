import { Request, Response } from 'express';
import { AuthService } from './auth.service';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      await authService.register(req.body);
      res.status(201).json({ message: 'Registration successful. Please check your email for verification.' });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(400).json({ message: error.message });
    }
  }

  async verifyEmail(req: Request, res: Response) {
    try {
      const { token } = req.body;
      await authService.verifyEmail(token);
      res.status(200).json({ message: 'Email verified successfully.' });
    } catch (error: any) {
      console.error('Email verification error:', error);
      res.status(400).json({ message: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const result = await authService.login(req.body);
      res.status(200).json(result);
    } catch (error: any) {
      console.error('Login error:', error);
      const status = error.message === 'Email not verified' ? 403 : 401;
      res.status(status).json({ message: error.message });
    }
  }

  async googleLogin(req: Request, res: Response) {
    try {
      const { googleToken, deviceInfo } = req.body;
      const result = await authService.googleLogin(googleToken, deviceInfo);
      res.status(200).json(result);
    } catch (error: any) {
      console.error('Google login error:', error);
      res.status(401).json({ message: error.message });
    }
  }

  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      res.status(200).json(result);
    } catch (error: any) {
      console.error('Token refresh error:', error);
      res.status(401).json({ message: error.message });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      await authService.logout(refreshToken);
      res.status(200).json({ message: 'Logged out successfully.' });
    } catch (error: any) {
      console.error('Logout error:', error);
      res.status(400).json({ message: error.message });
    }
  }

  async logoutAll(req: Request, res: Response) {
    try {
      await authService.logoutAll(req.user!.userId);
      res.status(200).json({ message: 'Logged out from all devices successfully.' });
    } catch (error: any) {
      console.error('Logout all error:', error);
      res.status(400).json({ message: error.message });
    }
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      await authService.forgotPassword(email);
      res.status(200).json({ message: 'If an account with that email exists, a reset link has been sent.' });
    } catch (error: any) {
      console.error('Forgot password error:', error);
      res.status(400).json({ message: error.message });
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;
      await authService.resetPassword(token, newPassword);
      res.status(200).json({ message: 'Password reset successfully.' });
    } catch (error: any) {
      console.error('Reset password error:', error);
      res.status(400).json({ message: error.message });
    }
  }

  async resendVerification(req: Request, res: Response) {
    try {
      const { email } = req.body;
      await authService.resendVerification(email);
      res.status(200).json({ message: 'Verification email resent.' });
    } catch (error: any) {
      console.error('Resend verification error:', error);
      res.status(400).json({ message: error.message });
    }
  }
}

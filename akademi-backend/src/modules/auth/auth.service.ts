import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../../config/db';
import { config } from '../../config/env';
import { RegisterRequest, LoginRequest, AuthResponse, JwtPayload } from './auth.types';
import { AuthProvider, VocabularyLevel } from '@prisma/client';
import crypto from 'crypto';

const resend = new Resend(config.resendApiKey);
const googleClient = new OAuth2Client(config.googleOauthClientId);

export class AuthService {
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: '15m' });
  }

  private async generateRefreshToken(userId: string, deviceInfo: { name: string; type: any }): Promise<string> {
    const token = uuidv4();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
        device_name: deviceInfo.name,
        device_type: deviceInfo.type,
        expires_at: expiresAt,
      },
    });

    return token;
  }

  async register(data: RegisterRequest): Promise<void> {
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      if (existingUser.is_deleted) {
        // Allow re-registration if deleted? Or just throw error?
        // Usually, re-registration means reactivating or creating new.
        // For this task, let's just throw error if email exists.
      }
      throw new Error('Email already registered');
    }

    let passwordHash = null;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 12);
    }

    const verificationToken = uuidv4();
    const verificationTokenExpiresAt = new Date();
    verificationTokenExpiresAt.setHours(verificationTokenExpiresAt.getHours() + 24);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password_hash: passwordHash,
        university: data.university,
        faculty: data.faculty,
        department: data.department,
        level: data.level,
        auth_provider: AuthProvider.EMAIL,
        is_verified: false,
        verification_token: verificationToken,
        verification_token_expires_at: verificationTokenExpiresAt,
      },
    });

    await prisma.learningProfile.create({
      data: {
        user_id: user.id,
        subject_strengths: {},
        subject_weaknesses: {},
        question_patterns: {},
        vocabulary_level: VocabularyLevel.BASIC,
      },
    });

    if (config.nodeEnv !== 'test') {
      await resend.emails.send({
        from: 'Akademi <no-reply@akademi.edu.ng>',
        to: user.email,
        subject: 'Verify your email',
        html: `<p>Click <a href="https://akademi.edu.ng/verify-email?token=${verificationToken}">here</a> to verify your email.</p>`,
      });
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: {
        verification_token: token,
        verification_token_expires_at: { gt: new Date() },
        is_deleted: false,
      },
    });

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        is_verified: true,
        verification_token: null,
        verification_token_expires_at: null,
      },
    });
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || user.is_deleted) {
      throw new Error('Invalid credentials');
    }

    if (!user.is_verified) {
      throw new Error('Email not verified');
    }

    if (!user.password_hash || !data.password) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const accessToken = this.generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = await this.generateRefreshToken(user.id, data.deviceInfo);

    return { accessToken, refreshToken };
  }

  async googleLogin(token: string, deviceInfo: { name: string; type: any }): Promise<AuthResponse> {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: config.googleOauthClientId,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error('Invalid Google token');
    }

    let user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (!user || user.is_deleted) {
      throw new Error('User not found. Please register first.');
    }

    const accessToken = this.generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = await this.generateRefreshToken(user.id, deviceInfo);

    return { accessToken, refreshToken };
  }

  async refreshToken(token: string): Promise<AuthResponse> {
    const tokenHash = this.hashToken(token);
    const refreshTokenRecord = await prisma.refreshToken.findFirst({
      where: {
        token_hash: tokenHash,
        is_active: true,
        expires_at: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!refreshTokenRecord || refreshTokenRecord.user.is_deleted) {
      throw new Error('Invalid or expired refresh token');
    }

    await prisma.refreshToken.update({
      where: { id: refreshTokenRecord.id },
      data: { is_active: false },
    });

    const accessToken = this.generateAccessToken({
      userId: refreshTokenRecord.user.id,
      email: refreshTokenRecord.user.email,
    });
    const newRefreshToken = await this.generateRefreshToken(refreshTokenRecord.user.id, {
      name: refreshTokenRecord.device_name,
      type: refreshTokenRecord.device_type,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await prisma.refreshToken.updateMany({
      where: { token_hash: tokenHash },
      data: { is_active: false },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { user_id: userId },
      data: { is_active: false },
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email, is_deleted: false } });
    if (!user) return;

    const resetToken = uuidv4();
    const resetTokenExpiresAt = new Date();
    resetTokenExpiresAt.setHours(resetTokenExpiresAt.getHours() + 1);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verification_token: resetToken,
        verification_token_expires_at: resetTokenExpiresAt,
      },
    });

    if (config.nodeEnv !== 'test') {
      await resend.emails.send({
        from: 'Akademi <no-reply@akademi.edu.ng>',
        to: user.email,
        subject: 'Reset your password',
        html: `<p>Click <a href="https://akademi.edu.ng/reset-password?token=${resetToken}">here</a> to reset your password.</p>`,
      });
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: {
        verification_token: token,
        verification_token_expires_at: { gt: new Date() },
        is_deleted: false,
      },
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: passwordHash,
        verification_token: null,
        verification_token_expires_at: null,
      },
    });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email, is_deleted: false } });
    if (!user || user.is_verified) {
      throw new Error('User not found or already verified');
    }

    const verificationToken = uuidv4();
    const verificationTokenExpiresAt = new Date();
    verificationTokenExpiresAt.setHours(verificationTokenExpiresAt.getHours() + 24);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verification_token: verificationToken,
        verification_token_expires_at: verificationTokenExpiresAt,
      },
    });

    if (config.nodeEnv !== 'test') {
      await resend.emails.send({
        from: 'Akademi <no-reply@akademi.edu.ng>',
        to: user.email,
        subject: 'Verify your email',
        html: `<p>Click <a href="https://akademi.edu.ng/verify-email?token=${verificationToken}">here</a> to verify your email.</p>`,
      });
    }
  }
}

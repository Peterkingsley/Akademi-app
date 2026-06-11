import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../../config/db';
import { config } from '../../config/env';
import { RegisterRequest, LoginRequest, AuthResponse, JwtPayload, ChangePasswordRequest, VerifyEmailRequest } from './auth.types';
import { AuthProvider, DeviceType, VocabularyLevel } from '@prisma/client';
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

  private isDummyResendKey(): boolean {
    return !config.resendApiKey || config.resendApiKey === 're_dummy_key' || config.resendApiKey === 'your_resend_api_key';
  }

  async register(data: RegisterRequest): Promise<void> {
    // Validation
    if (!data.name || !data.email || !data.university || !data.faculty || !data.department || !data.level) {
      throw new Error("All registration fields are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error("Invalid email format");
    }

    const semester = Number(data.semester);
    if (![1, 2].includes(semester)) {
      throw new Error("Semester is required");
    }

    if (!data.semesterStart || !data.semesterEnd) {
      throw new Error("Semester start and end dates are required");
    }

    const semesterStart = new Date(data.semesterStart);
    const semesterEnd = new Date(data.semesterEnd);
    if (Number.isNaN(semesterStart.getTime()) || Number.isNaN(semesterEnd.getTime()) || semesterEnd <= semesterStart) {
      throw new Error("Enter valid semester start and end dates");
    }

    const rawAcademicCourses: Array<{ code: string; name?: string; level?: number; semester?: number }> =
      data.academicCourses || data.courses?.map((code) => ({ code })) || [];

    const academicCourses = rawAcademicCourses
      .map((course) => ({
        code: course.code?.trim().toUpperCase(),
        name: course.name?.trim() || null,
        level: course.level || data.level,
        semester: course.semester || semester,
      }))
      .filter((course) => !!course.code);

    if (academicCourses.length === 0) {
      throw new Error("At least one course code is required");
    }

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      throw new Error('Email already registered');
    }

    let passwordHash = null;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 12);
    }

    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationTokenExpiresAt = new Date();
    verificationTokenExpiresAt.setMinutes(verificationTokenExpiresAt.getMinutes() + 15);

    const department = await prisma.department.findFirst({
      where: {
        name: data.department,
        faculty: data.faculty,
        university: {
          name: data.university,
        },
      },
    });

    if (!department) {
      throw new Error("Selected department could not be found");
    }

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          password_hash: passwordHash,
          university: data.university,
          faculty: data.faculty,
          department: data.department,
          level: data.level,
          courses: academicCourses.map((course) => course.code),
          auth_provider: AuthProvider.EMAIL,
          is_verified: false,
          verification_token: verificationToken,
          verification_token_expires_at: verificationTokenExpiresAt,
        },
      });

      await tx.studentCourse.createMany({
        data: academicCourses.map((course) => ({
          user_id: createdUser.id,
          department_id: department.id,
          code: course.code,
          name: course.name,
          level: course.level,
          semester: course.semester,
          semester_start: semesterStart,
          semester_end: semesterEnd,
        })),
        skipDuplicates: true,
      });

      await tx.learningProfile.create({
        data: {
          user_id: createdUser.id,
          subject_strengths: {},
          subject_weaknesses: {},
          question_patterns: {},
          vocabulary_level: VocabularyLevel.BASIC,
        },
      });

      return createdUser;
    });

    if (config.nodeEnv !== 'test' && !this.isDummyResendKey()) {
      try {
        await resend.emails.send({
          from: 'Akademi <noreply@opengigs.pro>',
          to: user.email,
          subject: 'Verify your email',
          html: `<p>Your verification code is: <strong>${verificationToken}</strong></p>`,
        });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // We don't throw here to allow registration to succeed in dev/staging even if email fails
      }
    } else if (this.isDummyResendKey()) {
      console.log(`Skipping email send due to dummy Resend API key. Verification token for ${user.email} is: ${verificationToken}`);
    }
  }

  async verifyEmail(data: VerifyEmailRequest): Promise<AuthResponse> {
    const user = await prisma.user.findFirst({
      where: {
        verification_token: data.token,
        verification_token_expires_at: { gt: new Date() },
        is_deleted: false,
      },
    });

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    const verifiedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        is_verified: true,
        verification_token: null,
        verification_token_expires_at: null,
      },
    });

    const deviceInfo = data.deviceInfo || { name: 'Unknown Device', type: DeviceType.ANDROID };
    const accessToken = this.generateAccessToken({ userId: verifiedUser.id, email: verifiedUser.email });
    const refreshToken = await this.generateRefreshToken(verifiedUser.id, deviceInfo);

    const admin = await prisma.admin.findUnique({
      where: { email: verifiedUser.email },
      select: { role: true }
    });

    const { password_hash, ...userWithoutPassword } = verifiedUser;
    return {
      accessToken,
      refreshToken,
      user: { ...userWithoutPassword, admin_role: admin?.role || null }
    };
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

    const admin = await prisma.admin.findUnique({
      where: { email: user.email },
      select: { role: true }
    });

    const { password_hash, ...userWithoutPassword } = user;
    return {
      accessToken,
      refreshToken,
      user: { ...userWithoutPassword, admin_role: admin?.role || null }
    };
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

    const admin = await prisma.admin.findUnique({
      where: { email: user.email },
      select: { role: true }
    });

    const { password_hash, ...userWithoutPassword } = user;
    return {
      accessToken,
      refreshToken,
      user: { ...userWithoutPassword, admin_role: admin?.role || null }
    };
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

    const admin = await prisma.admin.findUnique({
      where: { email: refreshTokenRecord.user.email },
      select: { role: true }
    });

    const { password_hash, ...userWithoutPassword } = refreshTokenRecord.user;
    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: { ...userWithoutPassword, admin_role: admin?.role || null }
    };
  }

  async logout(token: string): Promise<void> {
    if (!token) throw new Error("Refresh token is required");
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

    if (config.nodeEnv !== 'test' && !this.isDummyResendKey()) {
      try {
        await resend.emails.send({
          from: 'Akademi <onboarding@resend.dev>',
          to: user.email,
          subject: 'Reset your password',
          html: `<p>Click <a href="https://onboarding@resend.dev/reset-password?token=${resetToken}">here</a> to reset your password.</p>`,
        });
      } catch (emailError) {
        console.error('Failed to send forgot password email:', emailError);
      }
    } else if (this.isDummyResendKey()) {
      console.log(`Skipping forgot password email send. Reset token for ${user.email} is: ${resetToken}`);
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

    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationTokenExpiresAt = new Date();
    verificationTokenExpiresAt.setMinutes(verificationTokenExpiresAt.getMinutes() + 15);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verification_token: verificationToken,
        verification_token_expires_at: verificationTokenExpiresAt,
      },
    });

    if (config.nodeEnv !== 'test' && !this.isDummyResendKey()) {
      try {
        await resend.emails.send({
          from: 'Akademi <onboarding@resend.dev>',
          to: user.email,
          subject: 'Verify your email',
          html: `<p>Your verification code is: <strong>${verificationToken}</strong></p>`,
        });
      } catch (emailError) {
        console.error('Failed to resend verification email:', emailError);
      }
    } else if (this.isDummyResendKey()) {
      console.log(`Skipping resend verification email send. New verification token for ${user.email} is: ${verificationToken}`);
    }
  }

  async changePassword(userId: string, data: ChangePasswordRequest): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId, is_deleted: false } });
    if (!user || !user.password_hash) {
      throw new Error('User not found or password not set');
    }

    const isPasswordValid = await bcrypt.compare(data.oldPassword, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid current password');
    }

    const newPasswordHash = await bcrypt.hash(data.newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: newPasswordHash },
    });
  }
}

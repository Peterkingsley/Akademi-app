import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../../config/db';
import { config } from '../../config/env';
import { RegisterRequest, LoginRequest, AuthResponse, JwtPayload, ChangePasswordRequest, VerifyEmailRequest } from './auth.types';
import { AdminRole, AuthProvider, DeviceType, VocabularyLevel } from '@prisma/client';
import crypto from 'crypto';
import redisClient from '../../config/redis';
import { triggerTextbookGenerationForCourseCodes, autoEnrollStudentInDepartmentCourses } from '../textbooks/textbook-trigger';

const resend = new Resend(config.resendApiKey);
const googleClient = new OAuth2Client(config.googleOauthClientId);

// Lock an account's verification code after this many failed attempts within
// the window, so the 6-digit space cannot be brute-forced even across IPs.
const MAX_VERIFY_ATTEMPTS = 5;
const VERIFY_LOCK_WINDOW_SECONDS = 15 * 60;

export class AuthService {
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Cryptographically secure 6-digit code (crypto.randomInt, not Math.random).
  private generateVerificationCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  private verifyAttemptKey(email: string): string {
    return `verify-attempts:${email.trim().toLowerCase()}`;
  }

  private async assertVerifyAttemptsRemaining(email: string): Promise<void> {
    const key = this.verifyAttemptKey(email);
    const attempts = await redisClient.incr(key);
    if (attempts === 1) {
      await redisClient.expire(key, VERIFY_LOCK_WINDOW_SECONDS);
    }
    if (attempts > MAX_VERIFY_ATTEMPTS) {
      throw new Error('Too many verification attempts. Request a new code and try again later.');
    }
  }

  private async clearVerifyAttempts(email: string): Promise<void> {
    await redisClient.del(this.verifyAttemptKey(email));
  }

  private generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: '15m' });
  }

  private generateAdminAccessToken(admin: { id: string; email: string; role: AdminRole }): string {
    return jwt.sign(
      { adminId: admin.id, email: admin.email, role: admin.role },
      config.jwtSecret,
      { expiresIn: '24h' },
    );
  }

  private async getAdminAuthForEmail(email: string): Promise<{ adminRole: AdminRole | null; adminAccessToken: string | null }> {
    const admin = await prisma.admin.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!admin || admin.status === 'suspended') {
      return { adminRole: null, adminAccessToken: null };
    }

    return {
      adminRole: admin.role,
      adminAccessToken: this.generateAdminAccessToken(admin),
    };
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

    const rawAcademicCourses: Array<{ code: string; name?: string; level?: number; semester?: number }> =
      data.academicCourses || data.courses?.map((code) => ({ code })) || [];

    // Course codes and semester dates are optional at sign-up — a student may
    // not have them on hand (e.g. away from their course form). They can add
    // this later from their profile, so we only enforce it when they did
    // provide at least one course code.
    let semester: number | null = null;
    let semesterStart: Date | null = null;
    let semesterEnd: Date | null = null;
    let academicCourses: Array<{ code: string; name: string | null; level: number; semester: number }> = [];

    if (rawAcademicCourses.length > 0) {
      semester = Number(data.semester);
      if (![1, 2].includes(semester)) {
        throw new Error("Semester is required");
      }

      if (!data.semesterStart || !data.semesterEnd) {
        throw new Error("Semester start and end dates are required");
      }

      semesterStart = new Date(data.semesterStart);
      semesterEnd = new Date(data.semesterEnd);
      if (Number.isNaN(semesterStart.getTime()) || Number.isNaN(semesterEnd.getTime()) || semesterEnd <= semesterStart) {
        throw new Error("Enter valid semester start and end dates");
      }

      const resolvedSemester = semester;
      academicCourses = rawAcademicCourses
        .map((course) => ({
          code: course.code?.trim().toUpperCase() || "",
          name: course.name?.trim() || null,
          level: course.level || data.level,
          semester: course.semester || resolvedSemester,
        }))
        .filter((course) => !!course.code);
    }

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      throw new Error('Email already registered');
    }

    let passwordHash = null;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 12);
    }

    const verificationToken = this.generateVerificationCode();
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

      if (academicCourses.length > 0 && semesterStart && semesterEnd) {
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
      }

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

    if (academicCourses.length > 0 && semesterStart && semesterEnd) {
      // Fire-and-forget: must not block the registration response on textbook generation.
      // department.university_id is already on hand from the lookup above (no select clause was
      // used there, so every scalar field — including university_id — came back with it).
      triggerTextbookGenerationForCourseCodes(
        academicCourses.map((course) => course.code),
        department.university_id,
      ).catch(console.error);
    }

    // Always attempt auto-enrollment based on CCMAS documents for their level.
    // This allows school+department+level to be sufficient to trigger textbook generation
    // without requiring manual course entry.
    autoEnrollStudentInDepartmentCourses(
      user.id,
      department.university_id,
      user.faculty,
      user.department,
      user.level
    ).catch(console.error);

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
    if (!data.email || !data.token) {
      throw new Error('Email and verification code are required');
    }

    // Throttle per-account attempts before doing any lookup so the 6-digit code
    // cannot be brute-forced (even from many IPs) within its 15-minute TTL.
    await this.assertVerifyAttemptsRemaining(data.email);

    // Match the code against the specific account only — never look up a code
    // globally across all users.
    const user = await prisma.user.findFirst({
      where: {
        email: data.email,
        verification_token: data.token,
        verification_token_expires_at: { gt: new Date() },
        is_deleted: false,
      },
    });

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    await this.clearVerifyAttempts(data.email);

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

    const adminAuth = await this.getAdminAuthForEmail(verifiedUser.email);

    const { password_hash, ...userWithoutPassword } = verifiedUser;
    return {
      accessToken,
      refreshToken,
      adminAccessToken: adminAuth.adminAccessToken,
      user: { ...userWithoutPassword, admin_role: adminAuth.adminRole }
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

    const adminAuth = await this.getAdminAuthForEmail(user.email);

    const { password_hash, ...userWithoutPassword } = user;
    return {
      accessToken,
      refreshToken,
      adminAccessToken: adminAuth.adminAccessToken,
      user: { ...userWithoutPassword, admin_role: adminAuth.adminRole }
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

    const adminAuth = await this.getAdminAuthForEmail(user.email);

    const { password_hash, ...userWithoutPassword } = user;
    return {
      accessToken,
      refreshToken,
      adminAccessToken: adminAuth.adminAccessToken,
      user: { ...userWithoutPassword, admin_role: adminAuth.adminRole }
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

    if (!refreshTokenRecord || refreshTokenRecord.user.is_deleted || refreshTokenRecord.user.is_banned) {
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

    const adminAuth = await this.getAdminAuthForEmail(refreshTokenRecord.user.email);

    const { password_hash, ...userWithoutPassword } = refreshTokenRecord.user;
    return {
      accessToken,
      refreshToken: newRefreshToken,
      adminAccessToken: adminAuth.adminAccessToken,
      user: { ...userWithoutPassword, admin_role: adminAuth.adminRole }
    };
  }

  async logout(token: string, userId: string): Promise<void> {
    if (!token) throw new Error("Refresh token is required");
    const tokenHash = this.hashToken(token);
    const result = await prisma.refreshToken.updateMany({
      where: { token_hash: tokenHash, user_id: userId },
      data: { is_active: false },
    });

    if (result.count === 0) {
      throw new Error('Refresh token not found for this account');
    }
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
          html: `<p>Click <a href="${config.passwordResetUrl}?token=${encodeURIComponent(resetToken)}">here</a> to reset your password.</p>`,
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

    await prisma.refreshToken.updateMany({
      where: { user_id: user.id },
      data: { is_active: false },
    });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email, is_deleted: false } });
    // Do not reveal whether the account exists or is already verified — mirror
    // forgotPassword's behaviour so this endpoint can't be used to enumerate
    // registered accounts. Silently succeed in the no-op cases.
    if (!user || user.is_verified) {
      return;
    }

    const verificationToken = this.generateVerificationCode();
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

    await prisma.refreshToken.updateMany({
      where: { user_id: userId },
      data: { is_active: false },
    });
  }
}

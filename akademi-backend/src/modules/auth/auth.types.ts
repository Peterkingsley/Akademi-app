import { DeviceType, User } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Partial<User> & { admin_role?: string | null };
}

export interface RegisterRequest {
  name: string;
  email: string;
  university: string;
  faculty: string;
  department: string;
  level: number;
  semester?: number;
  semesterStart?: string;
  semesterEnd?: string;
  password?: string;
  courses?: string[];
  academicCourses?: Array<{
    code: string;
    name?: string;
    level?: number;
    semester?: number;
  }>;
}

export interface LoginRequest {
  email: string;
  password?: string;
  googleToken?: string;
  deviceInfo: {
    name: string;
    type: DeviceType;
  };
}

export interface VerifyEmailRequest {
  token: string;
  deviceInfo?: {
    name: string;
    type: DeviceType;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

import { DeviceType, User } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  adminAccessToken?: string | null;
  user: Partial<User> & { admin_role?: string | null };
  needsOnboarding?: boolean;
}

export interface RegisterRequest {
  name: string;
  phoneNumber: string;
  email: string;
  password: string;
  supportContactOptIn?: boolean;
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
  email: string;
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

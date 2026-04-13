import { AdminRole, VerificationStatus, Feature, AccessType } from '@prisma/client';

export interface AdminJwtPayload {
  adminId: string;
  email: string;
  role: AdminRole;
}

export interface DashboardStats {
  activeUsersToday: number;
  newRegistrations: number;
  revenueToday: number;
  materialsPending: number;
  flaggedContent: number;
  aiRequestsToday: number;
}

export interface DashboardCharts {
  userActivity: { date: string; count: number }[];
  revenue: { date: string; amount: number }[];
  featureUsage: { feature: string; count: number }[];
}

export interface DashboardActivity {
  recentFlagged: any[];
  recentRegistrations: any[];
  recentPayments: any[];
}

export interface SystemHealth {
  api: 'online' | 'offline';
  database: 'online' | 'offline';
  redis: 'online' | 'offline';
  typesense: 'online' | 'offline';
  claude: 'online' | 'offline';
  websocket: 'online' | 'offline';
  r2: 'online' | 'offline';
}

export interface UserListFilter {
  search?: string;
  university?: string;
  department?: string;
  status?: 'active' | 'banned' | 'unverified';
  plan?: 'free' | 'paid';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface GrantAccessRequest {
  feature: Feature;
  accessType: AccessType;
  expiresAt?: Date;
  usesRemaining?: number;
}

export interface AdminLoginRequest {
  email: string;
  password?: string;
}

export interface AdminAuthResponse {
  accessToken: string;
  admin: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
  };
}

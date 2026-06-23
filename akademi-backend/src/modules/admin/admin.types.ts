import { AdminRole, VerificationStatus, Feature, AccessType } from '@prisma/client';
import { SessionType } from '@prisma/client';

export interface AdminJwtPayload {
  adminId: string;
  email: string;
  role: AdminRole;
}

export interface DashboardStats {
  totalUsers: number;
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
  status: 'OK' | 'DEGRADED' | 'NOT_READY';
  live: boolean;
  ready: boolean;
  dependencies: {
    api: { status: 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown'; detail?: string | null };
    database: { status: 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown'; detail?: string | null };
    redis: { status: 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown'; detail?: string | null };
    queue: { status: 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown'; detail?: string | null };
    typesense: { status: 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown'; detail?: string | null };
    claude: { status: 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown'; detail?: string | null };
    websocket: { status: 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown'; detail?: string | null };
    r2: { status: 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown'; detail?: string | null };
  };
  runtime: {
    serviceType: string;
    startedAt: string;
    startupCompletedAt: string | null;
    shuttingDown: boolean;
    shutdownReason: string | null;
  };
  recovery: {
    databaseBackups: string[];
    storageBackups: string[];
    restorePlan: string[];
  };
  scaling: {
    horizontalReady: boolean;
    serviceType: string;
    websocketRedisAdapterEnabled: boolean;
    websocketTransportMode: 'websocket-only';
    schedulerMode: 'api-disabled' | 'jobs-only' | 'all-in-one';
    blockers: string[];
    warnings: string[];
    recommendations: string[];
  };
  timestamp: string;
}

export interface UserListFilter {
  search?: string;
  university?: string;
  department?: string;
  status?: 'active' | 'banned' | 'unverified';
  plan?: 'free' | 'paid' | 'pro' | 'premium';
  startDate?: string;
  endDate?: string;
  joinedWithinDays?: string | number;
  level?: string | number;
  courseCode?: string;
  featureUsed?: 'assignment' | 'study' | 'exam_prep' | 'uploads' | 'cbt';
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface EmailCampaignRequest extends UserListFilter {
  subject: string;
  message: string;
  previewOnly?: boolean;
  design?: CampaignDesignInput;
}

export interface WaitlistFilter {
  search?: string;
  university?: string;
  department?: string;
  status?: string;
  mainStruggle?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface WaitlistEmailRequest extends WaitlistFilter {
  subject: string;
  message: string;
  previewOnly?: boolean;
  design?: CampaignDesignInput;
}

export interface CampaignDesignInput {
  bannerImageUrl?: string;
  accentColor?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  preheader?: string;
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

// Pillar 4: Discipline Documents
export interface DisciplineDocumentListFilter {
  faculty?: string;
  department?: string;
  status?: 'active' | 'inactive';
}

export interface UploadDisciplineDocumentRequest {
  faculty: string;
  department: string;
  document_ref: string;
  version_notes: string;
}

export interface RollbackDocumentRequest {
  version: number;
}

export interface CommunityPatternListFilter {
  university?: string;
  status?: 'active' | 'inactive';
}

export interface UploadCommunityPatternRequest {
  university: string;
  title: string;
  story: string;
  context_type?: string;
  tags?: string[];
}

// Pillar 5: Analytics
export interface AnalyticsFilter {
  startDate?: string;
  endDate?: string;
  university?: string;
  department?: string;
  level?: number;
  session_type?: SessionType;
}

// Pillar 6: Finance
export interface FinanceFilter {
  startDate?: string;
  endDate?: string;
  feature?: string;
  plan?: string;
  status?: string;
  university?: string;
}

// Pillar 7: Monitoring
// (Already has SystemHealth)

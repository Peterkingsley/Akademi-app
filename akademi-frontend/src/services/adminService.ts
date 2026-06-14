import api from "./api";

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsersToday: number;
  newRegistrations: number;
  revenueToday: number;
  materialsPending: number;
  flaggedContent: number;
  aiRequestsToday: number;
}

export interface AdminDashboardCharts {
  userActivity: { date: string; count: number }[];
  revenue: { date: string; amount: number }[];
  featureUsage: { feature: string; count: number }[];
}

export interface AdminDashboardActivity {
  recentFlagged: any[];
  recentRegistrations: any[];
  recentPayments: any[];
}

export interface AdminSystemHealth {
  api: 'online' | 'offline';
  database: 'online' | 'offline';
  redis: 'online' | 'offline';
  typesense: 'online' | 'offline';
  claude: 'online' | 'offline';
  websocket: 'online' | 'offline';
  r2: 'online' | 'offline';
}

export interface DisciplineDocument {
  id: string;
  faculty: string;
  department: string;
  course_code: string | null;
  document_ref: string;
  version: number;
  version_notes: string | null;
  is_active: boolean;
  updated_at: string;
  history?: DisciplineDocument[];
}

export interface CommunityPattern {
  id: string;
  university: string;
  faculty: string;
  department: string;
  course_code: string | null;
  question_pattern: {
    type?: string;
    title?: string;
    story?: string;
    context_type?: string;
    tags?: string[];
    is_active?: boolean;
  };
  frequency: number;
  updated_at: string;
}

export interface DepartmentCoverage {
  id: string;
  name: string;
  university: string;
  faculty: string;
  status: 'active' | 'outdated' | 'missing';
  lastUpdated?: string;
}

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'MODERATOR' | 'ANALYST';
  status: 'active' | 'suspended';
  created_at: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  admin_name: string;
  action_verb: string;
  target: string;
  type: 'destructive' | 'system' | 'standard';
}

export interface IPLog {
  id: string;
  ip_address: string;
  location: string;
  timestamp: string;
  is_current: boolean;
}

export const adminService = {
  // Pillar 1: Dashboard
  getStats: async (): Promise<AdminDashboardStats> => {
    const { data } = await api.get("/admin/dashboard/stats");
    return data;
  },

  getCharts: async (): Promise<AdminDashboardCharts> => {
    const { data } = await api.get("/admin/dashboard/charts");
    return data;
  },

  getActivity: async (): Promise<AdminDashboardActivity> => {
    const { data } = await api.get("/admin/dashboard/activity");
    return data;
  },

  getSystemHealth: async (): Promise<AdminSystemHealth> => {
    const { data } = await api.get("/admin/dashboard/system-health");
    return data;
  },

  // Pillar 2: User Management
  listUsers: async (params: any) => {
    const { data } = await api.get("/admin/users", { params });
    return data;
  },

  getUserProfile: async (id: string) => {
    const { data } = await api.get(`/admin/users/${id}`);
    return data;
  },

  banUser: async (id: string) => {
    const { data } = await api.patch(`/admin/users/${id}/ban`);
    return data;
  },

  unbanUser: async (id: string) => {
    const { data } = await api.patch(`/admin/users/${id}/unban`);
    return data;
  },

  verifyUser: async (id: string) => {
    const { data } = await api.patch(`/admin/users/${id}/verify`);
    return data;
  },

  deleteUser: async (id: string) => {
    const { data } = await api.delete(`/admin/users/${id}`);
    return data;
  },

  grantAccess: async (userId: string, accessData: any) => {
    const { data } = await api.post(`/admin/users/${userId}/grant-access`, accessData);
    return data;
  },

  sendUserEmailCampaign: async (campaignData: any) => {
    const { data } = await api.post("/admin/users/email-campaign", campaignData);
    return data;
  },

  // Pillar 3: Content Moderation
  getFlaggedMaterials: async () => {
    const { data } = await api.get("/admin/materials/flagged");
    return data;
  },

  getPendingMaterials: async () => {
    const { data } = await api.get("/admin/materials/pending");
    return data;
  },

  getVerifiedMaterials: async () => {
    const { data } = await api.get("/admin/materials/verified");
    return data;
  },

  getArchivedMaterials: async () => {
    const { data } = await api.get("/admin/materials/archived");
    return data;
  },

  approveMaterial: async (id: string) => {
    const { data } = await api.patch(`/admin/materials/${id}/approve`);
    return data;
  },

  takedownMaterial: async (id: string) => {
    const { data } = await api.patch(`/admin/materials/${id}/takedown`);
    return data;
  },

  restoreMaterial: async (id: string) => {
    const { data } = await api.patch(`/admin/materials/${id}/restore`);
    return data;
  },

  forceVerify: async (id: string) => {
    const { data } = await api.post(`/admin/materials/${id}/force-verify`);
    return data;
  },

  // Pillar 4: Discipline Documents
  listDisciplineDocuments: async (params?: any) => {
    const { data } = await api.get("/admin/documents", { params });
    return data;
  },

  getDisciplineDocument: async (id: string): Promise<DisciplineDocument> => {
    const { data } = await api.get(`/admin/documents/${id}`);
    return data;
  },

  uploadDisciplineDocument: async (docData: any) => {
    const { data } = await api.post("/admin/documents", docData);
    return data;
  },

  listCommunityPatterns: async (params?: any): Promise<CommunityPattern[]> => {
    const { data } = await api.get("/admin/community-patterns", { params });
    return data;
  },

  uploadCommunityPattern: async (patternData: any) => {
    const { data } = await api.post("/admin/community-patterns", patternData);
    return data;
  },

  deactivateCommunityPattern: async (id: string) => {
    const { data } = await api.patch(`/admin/community-patterns/${id}/deactivate`);
    return data;
  },

  rollbackDisciplineDocument: async (id: string, version: number) => {
    const { data } = await api.post(`/admin/documents/${id}/rollback`, { version });
    return data;
  },

  deactivateDisciplineDocument: async (id: string) => {
    const { data } = await api.patch(`/admin/documents/${id}/deactivate`);
    return data;
  },

  getDepartmentCoverage: async (): Promise<DepartmentCoverage[]> => {
    const { data } = await api.get("/admin/documents/coverage");
    return data;
  },

  // Pillar 5: Platform Analytics
  getOverviewAnalytics: async (params?: any) => {
    const { data } = await api.get("/admin/analytics/overview", { params });
    return data;
  },

  getGrowthAnalytics: async (params?: any) => {
    const { data } = await api.get("/admin/analytics/growth", { params });
    return data;
  },

  getFeatureUsageAnalytics: async (params?: any) => {
    const { data } = await api.get("/admin/analytics/feature-usage", { params });
    return data;
  },

  getRetentionAnalytics: async (params?: any) => {
    const { data } = await api.get("/admin/analytics/retention", { params });
    return data;
  },

  getContentAnalytics: async (params?: any) => {
    const { data } = await api.get("/admin/analytics/content", { params });
    return data;
  },

  getConversionAnalytics: async (params?: any) => {
    const { data } = await api.get("/admin/analytics/conversion", { params });
    return data;
  },

  // Pillar 6: Financial Management
  getFinanceOverview: async () => {
    const { data } = await api.get("/admin/finance/overview");
    return data;
  },

  getFinanceBreakdown: async (params?: any) => {
    const { data } = await api.get("/admin/finance/breakdown", { params });
    return data;
  },

  getTransactions: async (params?: any) => {
    const { data } = await api.get("/admin/finance/transactions", { params });
    return data;
  },

  getFailedPayments: async () => {
    const { data } = await api.get("/admin/finance/failed-payments");
    return data;
  },

  getFinanceProjections: async () => {
    const { data } = await api.get("/admin/finance/projections");
    return data;
  },

  getPaystackWebhookLogs: async () => {
    const { data } = await api.get("/admin/finance/webhooks");
    return data;
  },

  // Pillar 7: AI & System Monitoring
  getAIMonitoring: async () => {
    const { data } = await api.get("/admin/system/ai");
    return data;
  },

  getHealthMonitoring: async () => {
    const { data } = await api.get("/admin/system/health");
    return data;
  },

  getErrorMonitoring: async () => {
    const { data } = await api.get("/admin/system/errors");
    return data;
  },

  getWebSocketMonitoring: async () => {
    const { data } = await api.get("/admin/system/websocket");
    return data;
  },

  getCacheMonitoring: async () => {
    const { data } = await api.get("/admin/system/cache");
    return data;
  },

  getJobsMonitoring: async () => {
    const { data } = await api.get("/admin/system/jobs");
    return data;
  },

  retryJob: async (name: string) => {
    const { data } = await api.post(`/admin/system/jobs/${name}/retry`);
    return data;
  },

  // Pillar 8: Admin Team & Security
  listAdmins: async (): Promise<AdminAccount[]> => {
    const { data } = await api.get("/admin/team");
    return data;
  },

  inviteAdmin: async (adminData: { name: string, email: string, role: string }): Promise<{ admin: AdminAccount; tempPassword?: string; message?: string }> => {
    const { data } = await api.post("/admin/team/invite", adminData);
    return data;
  },

  suspendAdmin: async (id: string) => {
    const { data } = await api.patch(`/admin/team/${id}/suspend`);
    return data;
  },

  unsuspendAdmin: async (id: string) => {
    const { data } = await api.patch(`/admin/team/${id}/unsuspend`);
    return data;
  },

  deleteAdmin: async (id: string) => {
    const { data } = await api.delete(`/admin/team/${id}`);
    return data;
  },

  getActivityLogs: async (params?: any): Promise<{ logs: ActivityLog[], hasMore: boolean }> => {
    const { data } = await api.get("/admin/team/activity-log", { params });
    return data;
  },

  getIPLogs: async (): Promise<IPLog[]> => {
    const { data } = await api.get("/admin/security/ip-logs");
    return data;
  },

  toggle2FA: async (enabled: boolean) => {
    const { data } = await api.patch("/admin/security/2fa", { enabled });
    return data;
  },

  getMaterialDownloadUrl: async (id: string): Promise<{ url: string }> => {
    const { data } = await api.get(`/admin/materials/${id}/download`);
    return data;
  },

  getSessionStatus: async () => {
    const { data } = await api.get("/admin/security/session-status");
    return data;
  }
};

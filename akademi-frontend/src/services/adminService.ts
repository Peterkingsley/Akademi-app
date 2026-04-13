import api from "./api";

export interface AdminDashboardStats {
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

export const adminService = {
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
};

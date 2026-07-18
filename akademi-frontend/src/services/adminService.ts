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

export interface GeneratedTextbookOverviewItem {
  id: string;
  course_code: string;
  is_current: boolean;
  ccmas_version: number;
  created_at: string;
  is_published: boolean;
  material_id: string | null;
  total_leaf_nodes: number;
  status_counts: Record<string, number>;
  diagrams_needed: number;
  diagrams_fetched: number;
}

export interface GeneratedTextbookOutlineNodeDetail {
  id: string;
  parent_id: string | null;
  order_index: number;
  depth: number;
  title: string;
  learning_outcome: string;
  is_international_addition: boolean;
  status: "PENDING" | "GENERATING" | "GENERATED" | "FAILED_QUALITY_CHECK" | "ADMIN_QUEUED";
  retry_count: number;
  section: {
    needs_diagram: boolean;
    diagram_image_url: string | null;
    quality_check_passed: boolean;
    quality_check_notes: string | null;
  } | null;
}

export interface GeneratedTextbookDetail {
  id: string;
  course_code: string;
  is_current: boolean;
  ccmas_version: number;
  material_id: string | null;
  nodes: GeneratedTextbookOutlineNodeDetail[];
}

export interface AdminQueuedSection {
  section_id: string;
  node_id: string;
  course_code: string;
  material_id: string | null;
  title: string;
  learning_outcome: string;
  content: string;
  quality_check_notes: string | null;
  retry_count: number;
  diagram_image_url: string | null;
}

export interface AdminSystemHealth {
  status: 'OK' | 'DEGRADED' | 'NOT_READY';
  live: boolean;
  ready: boolean;
  dependencies: {
    api: { status: 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown'; detail?: string | null };
    database: { status: 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown'; detail?: string | null };
    redis: { status: 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown'; detail?: string | null };
    queue: { status: 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown'; detail?: string | null };
    typesense: { status: 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown'; detail?: string | null };
    gemini: { status: 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown'; detail?: string | null };
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

export interface RateLimitRecentEvent {
  transport: 'http' | 'socket';
  namespaceOrEvent: string;
  routeOrEvent: string;
  method?: string;
  ip?: string | null;
  userId?: string | null;
  retryAfterSeconds: number;
  timestamp: string;
}

export interface RateLimitTopRoute {
  routeOrEvent: string;
  count: number;
}

export interface RateLimitTopUser {
  userId: string;
  count: number;
}

export interface RateLimitTopIp {
  ip: string;
  count: number;
}

export interface AdminRateLimitMonitoring {
  totalRecorded: number;
  recent: RateLimitRecentEvent[];
  topRoutes: RateLimitTopRoute[];
  topUsers: RateLimitTopUser[];
  topIps: RateLimitTopIp[];
  alerts: {
    id: string;
    type: 'auth-abuse' | 'ai-session-spam' | 'competition-spam' | 'socket-offender';
    severity: 'high' | 'medium';
    title: string;
    message: string;
    count: number;
    windowMinutes: number;
    target?: string;
    lastSeenAt?: string;
  }[];
  persistence: 'redis' | 'memory-fallback';
}

export interface DisciplineDocument {
  id: string;
  faculty: string;
  department: string;
  course_code: string | null;
  source_type: "CCMAS" | "INTERNATIONAL_REFERENCE";
  reference_name: string | null;
  level: number | null;
  document_ref: string;
  version: number;
  version_notes: string | null;
  is_active: boolean;
  updated_at: string;
  history?: DisciplineDocument[];
}

export interface DisciplineDocumentSplitCourse {
  course_code: string;
  level: number | null;
  content_preview: string;
  full_content: string;
  already_exists: boolean;
  content_verified: boolean;
}

export interface DisciplineDocumentSplitPreview {
  document_id: string;
  faculty: string;
  department: string;
  courses: DisciplineDocumentSplitCourse[];
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

export interface WaitlistEntry {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  university?: string | null;
  faculty?: string | null;
  department?: string | null;
  level?: number | null;
  main_struggle?: string | null;
  source: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  status: string;
  first_invited_at?: string | null;
  last_invited_at?: string | null;
  invite_count: number;
  last_invited_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaitlistResponse {
  entries: WaitlistEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: {
    total: number;
    invitedCount: number;
    neverSentCount: number;
    byNeed: { need: string; count: number }[];
    topUniversity?: { name: string; count: number; share: number } | null;
    byUniversity: { name: string; count: number }[];
    byFaculty: { name: string; count: number }[];
    byDepartment: { name: string; count: number }[];
    bySource: { name: string; count: number }[];
    traffic?: {
      pageViews: number;
      uniqueVisitors: number;
      formStarts: number;
      schoolSearches: number;
      schoolSelections: number;
      submitSuccesses: number;
      whatsappRedirects: number;
      submitConversionRate: number;
      whatsappRedirectRate: number;
      topSources: { name: string; count: number }[];
      topSchoolQueries: { query: string; count: number }[];
      topSelectedSchools: { name: string; count: number }[];
    };
  };
}

export interface AdminTournament {
  id: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "LIVE" | "COMPLETED" | "CANCELLED";
  campaign_type: "SIMPLE" | "MULTI_STAGE";
  format: "SHARED_COURSE" | "DUAL_COURSE";
  shared_course_code: string | null;
  source_material_ids: string[];
  question_count: number;
  question_timer_sec: number;
  max_participants: number | null;
  prize_summary: string | null;
  scheduled_at: string;
  registration_closes_at: string | null;
  late_join_cutoff_at: string | null;
  check_in_opens_at: string | null;
  check_in_closes_at: string | null;
  published_at: string | null;
  campaign_banner_url: string | null;
  campaign_accent_color: string | null;
  campaign_cta_label: string | null;
  campaign_cta_url: string | null;
  campaign_preheader: string | null;
  prediction_enabled: boolean;
  prediction_prize_summary: string | null;
  prediction_winner_count: number | null;
  prediction_closes_at: string | null;
  audience_scope: "EVERYONE" | "UNIVERSITY" | "FACULTY" | "DEPARTMENT";
  audience_university: string | null;
  audience_faculty: string | null;
  audience_department: string | null;
  entry_count: number;
  registered_count?: number;
  checked_in_count?: number;
  standby_count?: number;
  room_id?: string | null;
  stages?: Array<{
    id: string;
    name: string;
    stage_order: number;
    status: string;
    starts_at: string;
  }>;
}

export interface AdminCompetitionRoom {
  id: string;
  code: string;
  title: string;
  visibility: "PRIVATE" | "PUBLIC" | "TOURNAMENT";
  format: "SHARED_COURSE" | "DUAL_COURSE";
  status: "WAITING" | "READY" | "LIVE" | "FINISHED" | "CANCELLED";
  shared_course_code: string | null;
  created_at: string;
  starts_at: string | null;
  ended_at: string | null;
  host: {
    id: string;
    name: string;
  };
  participant_count: number;
  ready_count: number;
  finished_count: number;
  winner_name: string | null;
  tournament: {
    id: string;
    title: string;
  } | null;
}

export interface TournamentMaterialOption {
  id: string;
  title: string;
  course_code: string | null;
  university: string;
  faculty: string;
  department: string;
  level: number | null;
  semester: number | null;
  created_at: string;
}

export interface TournamentAudienceOptions {
  faculties: string[];
  departments: string[];
}

export interface CampaignDesign {
  bannerImageUrl?: string;
  accentColor?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  preheader?: string;
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

  listTournaments: async (): Promise<AdminTournament[]> => {
    const { data } = await api.get("/admin/competitions/tournaments");
    return data;
  },

  listTournamentMaterialOptions: async (params?: {
    university?: string;
    faculty?: string;
    department?: string;
  }): Promise<TournamentMaterialOption[]> => {
    const { data } = await api.get("/admin/competitions/tournament-materials", { params });
    return data;
  },

  listTournamentAudienceOptions: async (): Promise<TournamentAudienceOptions> => {
    const { data } = await api.get("/admin/competitions/audience-options");
    return data;
  },

  listCompetitionRooms: async (): Promise<AdminCompetitionRoom[]> => {
    const { data } = await api.get("/admin/competitions/rooms");
    return data;
  },

  createTournament: async (payload: any): Promise<AdminTournament> => {
    const { data } = await api.post("/admin/competitions/tournaments", payload);
    return data;
  },

  uploadTournamentBanner: async (file: { uri: string; name: string; mimeType?: string }) => {
    const formData = new FormData();
    formData.append("banner", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || "application/octet-stream",
    } as any);

    const { data } = await api.post("/admin/competitions/tournaments/banner-upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data as { url: string; fileName: string; key: string; contentType?: string };
  },

  publishTournament: async (id: string): Promise<AdminTournament> => {
    const { data } = await api.patch(`/admin/competitions/tournaments/${id}/publish`);
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

  listWaitlistEntries: async (params: any = {}): Promise<WaitlistResponse> => {
    const { data } = await api.get("/admin/waitlist", { params });
    return data;
  },

  sendWaitlistEmailCampaign: async (campaignData: any) => {
    const { data } = await api.post("/admin/waitlist/email-campaign", campaignData);
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

  getGeneratedTextbooksOverview: async (): Promise<GeneratedTextbookOverviewItem[]> => {
    const { data } = await api.get("/admin/generated-textbooks");
    return data;
  },

  getGeneratedTextbookDetail: async (outlineId: string): Promise<GeneratedTextbookDetail> => {
    const { data } = await api.get(`/admin/generated-textbooks/${outlineId}`);
    return data;
  },

  getAdminQueuedSections: async (): Promise<AdminQueuedSection[]> => {
    const { data } = await api.get("/admin/generated-textbooks/sections/admin-queued");
    return data;
  },

  updateGeneratedTextbookSection: async (sectionId: string, content: string) => {
    const { data } = await api.patch(`/admin/generated-textbooks/sections/${sectionId}`, { content });
    return data;
  },

  takeDownGeneratedTextbook: async (materialId: string) => {
    const { data } = await api.patch(`/admin/generated-textbooks/materials/${materialId}/takedown`);
    return data;
  },

  approveMaterial: async (id: string) => {
    const { data } = await api.patch(`/admin/materials/${id}/approve`);
    return data;
  },

  approveMaterials: async (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids.map((id) => id?.trim()).filter(Boolean)));
    const materials = await Promise.all(uniqueIds.map((id) => adminService.approveMaterial(id)));
    return {
      count: materials.length,
      materials,
    };
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

  uploadDisciplineDocumentFile: async (docData: any, file: { uri: string; name: string; mimeType?: string }) => {
    const formData = new FormData();
    formData.append("faculty", docData.faculty);
    formData.append("department", docData.department);
    if (docData.version_notes) formData.append("version_notes", docData.version_notes);
    if (docData.course_code) formData.append("course_code", docData.course_code);
    if (docData.source_type) formData.append("source_type", docData.source_type);
    if (docData.reference_name) formData.append("reference_name", docData.reference_name);
    if (docData.level != null && docData.level !== "") formData.append("level", String(docData.level));
    formData.append("document", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || "application/octet-stream",
    } as any);

    const { data } = await api.post("/admin/documents/upload-file", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  previewDisciplineDocumentSplit: async (documentId: string): Promise<DisciplineDocumentSplitPreview> => {
    const { data } = await api.get(`/admin/documents/${documentId}/split-preview`);
    return data;
  },

  confirmDisciplineDocumentSplit: async (
    documentId: string,
    selections: Array<{ course_code: string; level: number | null; content: string; include: boolean }>,
  ) => {
    const { data } = await api.post(`/admin/documents/${documentId}/split-confirm`, { selections });
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

  getRateLimitMonitoring: async (): Promise<AdminRateLimitMonitoring> => {
    const { data } = await api.get("/admin/system/rate-limits");
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

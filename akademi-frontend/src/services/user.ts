import api from "./api";
import { sessionService } from "./session";
import { materialService } from "./material";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  university?: string;
  faculty?: string;
  department?: string;
  level?: number;
  profile_photo_url?: string | null;
  avatar_url?: string | null;
  courses?: string[];
  is_verified?: boolean;
  admin_role?: string | null;
  stats?: {
    assignments: number;
    sessions: number;
    uploads: number;
  };
}

export interface FeatureAccess {
  id?: string;
  user_id?: string;
  feature?: string;
  access_type?: string;
  expires_at?: string;
  uses_remaining?: number | null;
  purchased_at?: string;
  payment_ref?: string;
  hasAccess?: boolean;
  plan?: "free" | "pro";
  expiresAt?: string;
}

export interface PurchaseSubscriptionResponse {
  paymentUrl: string;
  reference: string;
  productCode?: string;
  amount?: number;
  currency?: string;
  betaUnlocked?: boolean;
  message?: string;
}

export interface FeatureProduct {
  code: string;
  name: string;
  description: string;
  feature: string;
  access_type: string;
  amount: number;
  currency: string;
  durationHours?: number;
  uses?: number;
  scope_type: "MATERIAL" | "COURSE" | "GLOBAL";
}

export interface ProgressSummary {
  user: {
    id: string;
    name: string;
    university: string;
    faculty: string;
    department: string;
    level: number;
    courses: string[];
  };
  summary: {
    sessions: number;
    solved: number;
    correct: number;
    accuracy: number;
    uploads: number;
    approvedUploads: number;
    examPlans: number;
    mockAttempts: number;
    completedMocks: number;
    activeDays: number;
    streak: number;
    totalTutorMinutes: number;
  };
  weeklyActivity: Array<{
    day: string;
    date: string;
    sessions: number;
    solved: number;
    mocks: number;
    uploads: number;
  }>;
  courses: Array<{
    code: string;
    name?: string | null;
    sessions: number;
    solved: number;
    correct: number;
    mocks: number;
    uploads: number;
    averageMockScore: number | null;
  }>;
  recent: {
    sessions: Array<{
      id: string;
      courseCode?: string | null;
      topic?: string | null;
      duration?: number | null;
      messageCount: number;
      createdAt: string;
    }>;
    mocks: Array<{
      id: string;
      courseCode?: string | null;
      score: number;
      completedAt?: string | null;
    }>;
  };
  insight: string;
}

export const userService = {
  getProfile: async () => {
    const response = await api.get<UserProfile>("/users/me");
    return response.data;
  },

  updateProfile: async (data: Partial<UserProfile>) => {
    const response = await api.patch<UserProfile>("/users/me", data);
    return response.data;
  },

  updateAvatar: async (uri: string) => {
    const formData = new FormData();
    const filename = uri.split("/").pop();
    const match = /\.(\w+)$/.exec(filename || "");
    const type = match ? `image/${match[1]}` : `image`;

    formData.append("photo", {
      uri,
      name: filename,
      type,
    } as any);

    const response = await api.patch<UserProfile>("/users/me/photo", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  deleteAccount: async () => {
    const response = await api.delete("/users/me");
    return response.data;
  },

  changePassword: async (oldPassword: string, newPassword: string) => {
    const response = await api.post('/auth/change-password', { oldPassword, newPassword });
    return response.data;
  },

  logout: async () => {
    const response = await api.post("/auth/logout");
    return response.data;
  },

  getFeatureAccess: async () => {
    const response = await api.get<FeatureAccess[]>("/users/me/feature-access");
    return response.data;
  },

  purchaseSubscription: async (plan: "monthly" | "yearly") => {
    const response = await api.post<PurchaseSubscriptionResponse>("/feature-access/purchase", {
      feature: "EXAM_PREP",
      access_type: "TIME_WINDOW",
      amount: plan === "monthly" ? 2000 : 20000,
    });
    return response.data;
  },

  getFeatureProducts: async () => {
    const response = await api.get<FeatureProduct[]>("/feature-access/products");
    return response.data;
  },

  purchaseFeaturePass: async (productCode: string, scopeId: string, scopeType: "MATERIAL" | "COURSE" | "GLOBAL" = "MATERIAL") => {
    const response = await api.post<PurchaseSubscriptionResponse>("/feature-access/purchase", {
      productCode,
      scopeType,
      scopeId,
    });
    return response.data;
  },

  getSessions: async () => {
    return sessionService.getRecentSessions(100);
  },

  getProgress: async () => {
    const response = await api.get<ProgressSummary>("/users/me/progress");
    return response.data;
  },

  getUploads: async () => {
    return materialService.getMyUploads();
  },

  updatePushToken: async (pushToken: string) => {
    const response = await api.patch("/users/me", { push_token: pushToken });
    return response.data;
  },
};

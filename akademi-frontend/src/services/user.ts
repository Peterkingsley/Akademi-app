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
  hasAccess: boolean;
  plan: "free" | "pro";
  expiresAt?: string;
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
    const response = await api.get<FeatureAccess>("/users/me/feature-access");
    return response.data;
  },

  purchaseSubscription: async (plan: "monthly" | "yearly") => {
    const response = await api.post<{ paymentUrl: string }>("/feature-access/purchase", {
      feature: "ALL",
      access_type: "TIME_WINDOW",
      amount: plan === "monthly" ? 2000 : 20000,
    });
    return response.data;
  },

  getSessions: async () => {
    return sessionService.getRecentSessions(100);
  },

  getUploads: async () => {
    return materialService.getMyUploads();
  },

  updatePushToken: async (pushToken: string) => {
    const response = await api.patch("/users/me", { push_token: pushToken });
    return response.data;
  },
};

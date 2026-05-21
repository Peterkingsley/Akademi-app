import api from "./api";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "ai";
  timestamp: string;
  read: boolean;
}

export const notificationService = {
  list: async (): Promise<Notification[]> => {
    const { data } = await api.get("/notifications");
    return data.map((n: any) => ({
      ...n,
      timestamp: n.created_at,
    }));
  },

  markRead: async (id: string): Promise<Notification> => {
    const { data } = await api.patch(`/notifications/${id}/read`);
    return {
      ...data,
      timestamp: data.created_at,
    };
  },

  markAllRead: async (): Promise<void> => {
    await api.post("/notifications/mark-all-read");
  },
};

import prisma from '../../config/db';

export class NotificationsService {
  async listNotifications(userId: string) {
    return prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async markAsRead(id: string, userId: string) {
    return prisma.notification.update({
      where: { id, user_id: userId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { user_id: userId, read: false },
      data: { read: true },
    });
  }

  async createNotification(data: { user_id: string; title: string; message: string; type?: string }) {
    const notification = await prisma.notification.create({
      data,
    });

    // Send push notification
    this.sendPushNotification(data.user_id, data.title, data.message).catch(console.error);

    return notification;
  }

  private async sendPushNotification(userId: string, title: string, body: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { push_token: true },
    });

    if (!user?.push_token) return;

    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
        },
        body: JSON.stringify({
          to: user.push_token,
          title,
          body,
          sound: "default",
          data: { userId },
        }),
      });
    } catch (error) {
      console.error("Failed to send push notification:", error);
    }
  }
}

export const notificationsService = new NotificationsService();

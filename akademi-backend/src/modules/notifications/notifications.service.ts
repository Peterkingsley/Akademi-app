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
    return prisma.notification.create({
      data,
    });
  }
}

export const notificationsService = new NotificationsService();

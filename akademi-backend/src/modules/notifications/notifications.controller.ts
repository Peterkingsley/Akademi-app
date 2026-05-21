import { Request, Response } from 'express';
import { notificationsService } from './notifications.service';

export class NotificationsController {
  async list(req: Request, res: Response) {
    try {
      const notifications = await notificationsService.listNotifications(req.user!.userId);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async markRead(req: Request, res: Response) {
    try {
      const notification = await notificationsService.markAsRead(req.params.id, req.user!.userId);
      res.json(notification);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async markAllRead(req: Request, res: Response) {
    try {
      await notificationsService.markAllAsRead(req.user!.userId);
      res.json({ message: 'All notifications marked as read' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

export const notificationsController = new NotificationsController();

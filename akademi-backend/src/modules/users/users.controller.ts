import { Request, Response } from 'express';
import { UsersService } from './users.service';

const usersService = new UsersService();

export class UsersController {
  async getMe(req: Request, res: Response) {
    try {
      const profile = await usersService.getProfile(req.user!.userId);
      res.status(200).json(profile);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }

  async updateMe(req: Request, res: Response) {
    try {
      const profile = await usersService.updateProfile(req.user!.userId, req.body);
      res.status(200).json(profile);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async uploadPhoto(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No photo uploaded' });
      }
      const result = await usersService.uploadPhoto(req.user!.userId, req.file);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async deleteMe(req: Request, res: Response) {
    try {
      await usersService.deleteAccount(req.user!.userId);
      res.status(200).json({ message: 'Account deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getLearningProfile(req: Request, res: Response) {
    try {
      const profile = await usersService.getLearningProfile(req.user!.userId);
      res.status(200).json(profile);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getSessions(req: Request, res: Response) {
    try {
      const sessions = await usersService.getSessions(req.user!.userId);
      res.status(200).json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getProgress(req: Request, res: Response) {
    try {
      const progress = await usersService.getProgress(req.user!.userId);
      res.status(200).json(progress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getDevices(req: Request, res: Response) {
    try {
      const devices = await usersService.getDevices(req.user!.userId);
      res.status(200).json(devices);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async logoutDevice(req: Request, res: Response) {
    try {
      const { deviceId } = req.params;
      await usersService.logoutDevice(req.user!.userId, deviceId);
      res.status(200).json({ message: 'Device logged out successfully' });
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }

  async getFeatureAccess(req: Request, res: Response) {
    try {
      const access = await usersService.getFeatureAccess(req.user!.userId);
      res.status(200).json(access);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getUploads(req: Request, res: Response) {
    try {
      const uploads = await usersService.getUploads(req.user!.userId);
      res.status(200).json(uploads);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

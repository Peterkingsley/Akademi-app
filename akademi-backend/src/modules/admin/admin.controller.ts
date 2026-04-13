import { Request, Response } from 'express';
import { AdminService } from './admin.service';

const adminService = new AdminService();

export class AdminController {
  async login(req: Request, res: Response) {
    try {
      const result = await adminService.login(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  }

  // Pillar 1: Dashboard
  async getStats(req: Request, res: Response) {
    try {
      const stats = await adminService.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getCharts(req: Request, res: Response) {
    try {
      const charts = await adminService.getCharts();
      res.json(charts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getActivity(req: Request, res: Response) {
    try {
      const activity = await adminService.getActivity();
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getSystemHealth(req: Request, res: Response) {
    try {
      const health = await adminService.getSystemHealth();
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  // Pillar 2: User Management
  async listUsers(req: Request, res: Response) {
    try {
      const result = await adminService.listUsers(req.query as any);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getUserProfile(req: Request, res: Response) {
    try {
      const user = await adminService.getUserProfile(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async banUser(req: Request, res: Response) {
    try {
      const result = await adminService.banUser(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async unbanUser(req: Request, res: Response) {
    try {
      const result = await adminService.unbanUser(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async verifyUser(req: Request, res: Response) {
    try {
      const result = await adminService.verifyUser(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      await adminService.deleteUser(req.params.id);
      res.json({ message: 'User soft-deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async grantAccess(req: Request, res: Response) {
    try {
      const result = await adminService.grantAccess(req.params.id, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  // Pillar 3: Content Moderation
  async getFlaggedMaterials(req: Request, res: Response) {
    try {
      const materials = await adminService.getFlaggedMaterials();
      res.json(materials);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getPendingMaterials(req: Request, res: Response) {
    try {
      const materials = await adminService.getPendingMaterials();
      res.json(materials);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getVerifiedMaterials(req: Request, res: Response) {
    try {
      const materials = await adminService.getVerifiedMaterials();
      res.json(materials);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getArchivedMaterials(req: Request, res: Response) {
    try {
      const materials = await adminService.getArchivedMaterials();
      res.json(materials);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async approveMaterial(req: Request, res: Response) {
    try {
      const result = await adminService.approveMaterial(req.params.id, req.admin!.adminId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async takedownMaterial(req: Request, res: Response) {
    try {
      const result = await adminService.takedownMaterial(req.params.id, req.admin!.adminId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async restoreMaterial(req: Request, res: Response) {
    try {
      const result = await adminService.restoreMaterial(req.params.id, req.admin!.adminId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async forceVerify(req: Request, res: Response) {
    try {
      const result = await adminService.forceVerify(req.params.id, req.admin!.adminId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

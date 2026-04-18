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

  // Pillar 4: Discipline Documents
  async listDisciplineDocuments(req: Request, res: Response) {
    try {
      const docs = await adminService.listDisciplineDocuments(req.query as any);
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getDisciplineDocument(req: Request, res: Response) {
    try {
      const doc = await adminService.getDisciplineDocument(req.params.id);
      res.json(doc);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async uploadDisciplineDocument(req: Request, res: Response) {
    try {
      const result = await adminService.uploadDisciplineDocument(req.body, req.admin!.adminId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async rollbackDisciplineDocument(req: Request, res: Response) {
    try {
      const result = await adminService.rollbackDisciplineDocument(req.params.id, req.body.version, req.admin!.adminId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async deactivateDisciplineDocument(req: Request, res: Response) {
    try {
      const result = await adminService.deactivateDisciplineDocument(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getDepartmentCoverage(req: Request, res: Response) {
    try {
      const coverage = await adminService.getDepartmentCoverage();
      res.json(coverage);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  // Pillar 5: Platform Analytics
  async getOverviewAnalytics(req: Request, res: Response) {
    try {
      const analytics = await adminService.getOverviewAnalytics(req.query as any);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getGrowthAnalytics(req: Request, res: Response) {
    try {
      const analytics = await adminService.getGrowthAnalytics(req.query as any);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getFeatureUsageAnalytics(req: Request, res: Response) {
    try {
      const analytics = await adminService.getFeatureUsageAnalytics(req.query as any);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getRetentionAnalytics(req: Request, res: Response) {
    try {
      const analytics = await adminService.getRetentionAnalytics(req.query as any);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getContentAnalytics(req: Request, res: Response) {
    try {
      const analytics = await adminService.getContentAnalytics(req.query as any);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getConversionAnalytics(req: Request, res: Response) {
    try {
      const analytics = await adminService.getConversionAnalytics(req.query as any);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  // Pillar 6: Financial Management
  async getFinanceOverview(req: Request, res: Response) {
    try {
      const overview = await adminService.getFinanceOverview();
      res.json(overview);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getFinanceBreakdown(req: Request, res: Response) {
    try {
      const breakdown = await adminService.getFinanceBreakdown(req.query as any);
      res.json(breakdown);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getTransactions(req: Request, res: Response) {
    try {
      const transactions = await adminService.getTransactions(req.query as any);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getFailedPayments(req: Request, res: Response) {
    try {
      const failed = await adminService.getFailedPayments();
      res.json(failed);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getFinanceProjections(req: Request, res: Response) {
    try {
      const projections = await adminService.getFinanceProjections();
      res.json(projections);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getPaystackWebhookLogs(req: Request, res: Response) {
    try {
      const logs = await adminService.getPaystackWebhookLogs();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  // Pillar 7: AI & System Monitoring
  async getAIMonitoring(req: Request, res: Response) {
    try {
      const monitoring = await adminService.getAIMonitoring();
      res.json(monitoring);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getHealthMonitoring(req: Request, res: Response) {
    try {
      const health = await adminService.getHealthMonitoring();
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getErrorMonitoring(req: Request, res: Response) {
    try {
      const errors = await adminService.getErrorMonitoring();
      res.json(errors);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getWebSocketMonitoring(req: Request, res: Response) {
    try {
      const monitoring = await adminService.getWebSocketMonitoring();
      res.json(monitoring);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getCacheMonitoring(req: Request, res: Response) {
    try {
      const monitoring = await adminService.getCacheMonitoring();
      res.json(monitoring);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getJobsMonitoring(req: Request, res: Response) {
    try {
      const jobs = await adminService.getJobsMonitoring();
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async retryJob(req: Request, res: Response) {
    try {
      const result = await adminService.retryJob(req.params.name);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

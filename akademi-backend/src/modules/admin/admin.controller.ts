import { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { extractDisciplineDocumentText } from './document-extraction';
import { CompetitionsService } from '../competitions/competitions.service';
import { uploadFile } from '../../shared/storage/r2.service';

const adminService = new AdminService();
const competitionsService = new CompetitionsService();

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

  async listTournaments(req: Request, res: Response) {
    try {
      const tournaments = await competitionsService.listAdminTournaments();
      res.json(tournaments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async createTournament(req: Request, res: Response) {
    try {
      const result = await competitionsService.createTournament(req.admin!.adminId, req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async publishTournament(req: Request, res: Response) {
    try {
      const result = await competitionsService.publishTournament(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async listTournamentMaterialOptions(req: Request, res: Response) {
    try {
      const options = await competitionsService.listTournamentMaterialOptions({
        university: typeof req.query.university === 'string' ? req.query.university : undefined,
        faculty: typeof req.query.faculty === 'string' ? req.query.faculty : undefined,
        department: typeof req.query.department === 'string' ? req.query.department : undefined,
      });
      res.json(options);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async listTournamentAudienceOptions(_req: Request, res: Response) {
    try {
      const options = await competitionsService.listTournamentAudienceOptions();
      res.json(options);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async listCompetitionRooms(req: Request, res: Response) {
    try {
      const rooms = await competitionsService.listAdminRooms();
      res.json(rooms);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async uploadTournamentBanner(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No banner image uploaded' });
      }

      const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
      const key = `admin/tournaments/banners/${Date.now()}-${sanitizedName}`;
      const url = await uploadFile(key, req.file.buffer, req.file.mimetype || 'application/octet-stream');

      res.status(201).json({
        url,
        key,
        fileName: req.file.originalname,
        contentType: req.file.mimetype,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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

  async emailUsers(req: Request, res: Response) {
    try {
      const result = await adminService.emailUsers(req.body, req.admin!.adminId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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

  async getMaterialDownloadUrl(req: Request, res: Response) {
    try {
      const url = await adminService.getMaterialDownloadUrl(req.params.id, req.admin!.role);
      res.json({ url });
    } catch (error: any) {
      const status = error.message === 'Material not found' ? 404 : 403;
      res.status(status).json({ message: error.message });
    }
  }

  async listWaitlistEntries(req: Request, res: Response) {
    try {
      const result = await adminService.listWaitlistEntries(req.query as any);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async emailWaitlistEntries(req: Request, res: Response) {
    try {
      const result = await adminService.emailWaitlistEntries(req.body, req.admin!.adminId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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

  async approveMaterials(req: Request, res: Response) {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const result = await adminService.approveMaterials(ids, req.admin!.adminId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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

  async reingestAllMaterials(req: Request, res: Response) {
    try {
      const result = await adminService.reingestAllPdfMaterials(String(req.headers['x-admin-secret'] || ''));
      res.json(result);
    } catch (error: any) {
      const message = String(error?.message || 'Failed to re-queue materials');
      const status = message.toLowerCase().includes('secret') ? 403 : 500;
      res.status(status).json({ message });
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

  async uploadDisciplineDocumentFile(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No document file uploaded' });
      }

      const extractedText = (await extractDisciplineDocumentText(req.file)).trim();
      if (!extractedText) {
        return res.status(400).json({ message: 'No readable text could be extracted from this document.' });
      }

      const result = await adminService.uploadDisciplineDocument({
        ...req.body,
        document_ref: extractedText,
        version_notes: req.body.version_notes || `Uploaded from ${req.file.originalname}`,
      }, req.admin!.adminId);

      res.status(201).json({
        ...result,
        extractedTextLength: extractedText.length,
        sourceFileName: req.file.originalname,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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

  async listCommunityPatterns(req: Request, res: Response) {
    try {
      const patterns = await adminService.listCommunityPatterns(req.query as any);
      res.json(patterns);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async uploadCommunityPattern(req: Request, res: Response) {
    try {
      const result = await adminService.uploadCommunityPattern(req.body, req.admin!.adminId);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async deactivateCommunityPattern(req: Request, res: Response) {
    try {
      const result = await adminService.deactivateCommunityPattern(req.params.id);
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

  async getSchoolCoverageAudit(req: Request, res: Response) {
    try {
      const audit = await adminService.getSchoolCoverageAudit();
      res.json(audit);
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

  async getRateLimitMonitoring(req: Request, res: Response) {
    try {
      const monitoring = await adminService.getRateLimitMonitoring();
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

  async listAdmins(req: Request, res: Response) {
    try {
      const admins = await adminService.listAdmins();
      res.json(admins);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async inviteAdmin(req: Request, res: Response) {
    try {
      const result = await adminService.inviteAdmin(req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async suspendAdmin(req: Request, res: Response) {
    try {
      const result = await adminService.suspendAdmin(req.params.id, req.admin!.adminId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async unsuspendAdmin(req: Request, res: Response) {
    try {
      const result = await adminService.unsuspendAdmin(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async deleteAdmin(req: Request, res: Response) {
    try {
      const result = await adminService.deleteAdmin(req.params.id, req.admin!.adminId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getActivityLogs(req: Request, res: Response) {
    try {
      const result = await adminService.getActivityLogs(req.query as any);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getIPLogs(req: Request, res: Response) {
    try {
      const result = await adminService.getIPLogs(req.admin!.adminId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async toggle2FA(req: Request, res: Response) {
    try {
      const result = await adminService.toggle2FA(Boolean(req.body.enabled));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getSessionStatus(req: Request, res: Response) {
    try {
      const result = await adminService.getSessionStatus(req.admin!.adminId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

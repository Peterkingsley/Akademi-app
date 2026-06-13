import { Router } from 'express';
import { AdminController } from './admin.controller';
import { adminAuthenticate, authorizeRoles } from './admin.middleware';
import { AdminRole } from '@prisma/client';

const router = Router();
const adminController = new AdminController();

// Auth
router.post('/login', (req, res) => adminController.login(req, res));

// All subsequent routes require admin authentication
router.use(adminAuthenticate);

// Pillar 1: Dashboard
router.get('/dashboard/stats', (req, res) => adminController.getStats(req, res));
router.get('/dashboard/charts', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getCharts(req, res));
router.get('/dashboard/activity', (req, res) => adminController.getActivity(req, res));
router.get('/dashboard/system-health', (req, res) => adminController.getSystemHealth(req, res));

// Pillar 2: User Management
router.get('/users', (req, res) => adminController.listUsers(req, res));
router.post('/users/email-campaign', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.emailUsers(req, res));
router.get('/users/:id', (req, res) => adminController.getUserProfile(req, res));
router.patch('/users/:id/ban', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.banUser(req, res));
router.patch('/users/:id/unban', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.unbanUser(req, res));
router.patch('/users/:id/verify', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.verifyUser(req, res));
router.delete('/users/:id', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.deleteUser(req, res));
router.post('/users/:id/grant-access', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.grantAccess(req, res));

// Pillar 3: Content Moderation
router.get('/materials/flagged', (req, res) => adminController.getFlaggedMaterials(req, res));
router.get('/materials/pending', (req, res) => adminController.getPendingMaterials(req, res));
router.get('/materials/verified', (req, res) => adminController.getVerifiedMaterials(req, res));
router.get('/materials/archived', (req, res) => adminController.getArchivedMaterials(req, res));
router.get('/materials/:id/download', (req, res) => adminController.getMaterialDownloadUrl(req, res));
router.patch('/materials/:id/approve', (req, res) => adminController.approveMaterial(req, res));
router.patch('/materials/:id/takedown', (req, res) => adminController.takedownMaterial(req, res));
router.patch('/materials/:id/restore', (req, res) => adminController.restoreMaterial(req, res));
router.post('/materials/:id/force-verify', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.forceVerify(req, res));

// Pillar 4: Discipline Documents
router.get('/documents', (req, res) => adminController.listDisciplineDocuments(req, res));
router.get('/documents/coverage', (req, res) => adminController.getDepartmentCoverage(req, res));
router.get('/documents/:id', (req, res) => adminController.getDisciplineDocument(req, res));
router.post('/documents', authorizeRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MANAGER), (req, res) => adminController.uploadDisciplineDocument(req, res));
router.post('/documents/:id/rollback', authorizeRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MANAGER), (req, res) => adminController.rollbackDisciplineDocument(req, res));
router.patch('/documents/:id/deactivate', authorizeRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MANAGER), (req, res) => adminController.deactivateDisciplineDocument(req, res));

// Pillar 5: Platform Analytics
router.get('/analytics/overview', authorizeRoles(AdminRole.SUPER_ADMIN, AdminRole.ANALYST), (req, res) => adminController.getOverviewAnalytics(req, res));
router.get('/analytics/growth', authorizeRoles(AdminRole.SUPER_ADMIN, AdminRole.ANALYST), (req, res) => adminController.getGrowthAnalytics(req, res));
router.get('/analytics/feature-usage', authorizeRoles(AdminRole.SUPER_ADMIN, AdminRole.ANALYST), (req, res) => adminController.getFeatureUsageAnalytics(req, res));
router.get('/analytics/retention', authorizeRoles(AdminRole.SUPER_ADMIN, AdminRole.ANALYST), (req, res) => adminController.getRetentionAnalytics(req, res));
router.get('/analytics/content', authorizeRoles(AdminRole.SUPER_ADMIN, AdminRole.ANALYST), (req, res) => adminController.getContentAnalytics(req, res));
router.get('/analytics/conversion', authorizeRoles(AdminRole.SUPER_ADMIN, AdminRole.ANALYST), (req, res) => adminController.getConversionAnalytics(req, res));

// Pillar 6: Financial Management
router.get('/finance/overview', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getFinanceOverview(req, res));
router.get('/finance/breakdown', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getFinanceBreakdown(req, res));
router.get('/finance/transactions', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getTransactions(req, res));
router.get('/finance/failed-payments', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getFailedPayments(req, res));
router.get('/finance/projections', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getFinanceProjections(req, res));
router.get('/finance/webhooks', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getPaystackWebhookLogs(req, res));

// Pillar 7: AI & System Monitoring
router.get('/system/ai', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getAIMonitoring(req, res));
router.get('/system/health', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getHealthMonitoring(req, res));
router.get('/system/errors', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getErrorMonitoring(req, res));
router.get('/system/websocket', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getWebSocketMonitoring(req, res));
router.get('/system/cache', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getCacheMonitoring(req, res));
router.get('/system/jobs', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getJobsMonitoring(req, res));
router.post('/system/jobs/:name/retry', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.retryJob(req, res));

// Pillar 8: Admin Team & Security
router.get('/team', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.listAdmins(req, res));
router.post('/team/invite', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.inviteAdmin(req, res));
router.patch('/team/:id/suspend', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.suspendAdmin(req, res));
router.patch('/team/:id/unsuspend', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.unsuspendAdmin(req, res));
router.delete('/team/:id', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.deleteAdmin(req, res));
router.get('/team/activity-log', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getActivityLogs(req, res));
router.get('/security/ip-logs', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getIPLogs(req, res));
router.patch('/security/2fa', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.toggle2FA(req, res));
router.get('/security/session-status', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.getSessionStatus(req, res));

export default router;

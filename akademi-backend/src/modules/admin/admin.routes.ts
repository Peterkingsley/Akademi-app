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
router.patch('/materials/:id/approve', (req, res) => adminController.approveMaterial(req, res));
router.patch('/materials/:id/takedown', (req, res) => adminController.takedownMaterial(req, res));
router.patch('/materials/:id/restore', (req, res) => adminController.restoreMaterial(req, res));
router.post('/materials/:id/force-verify', authorizeRoles(AdminRole.SUPER_ADMIN), (req, res) => adminController.forceVerify(req, res));

export default router;

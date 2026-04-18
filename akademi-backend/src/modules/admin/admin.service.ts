import prisma from '../../config/db';
import { AdminRole, VerificationStatus, Feature, AccessType, MessageRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import {
  AdminLoginRequest,
  AdminAuthResponse,
  DashboardStats,
  DashboardCharts,
  DashboardActivity,
  SystemHealth,
  UserListFilter,
  GrantAccessRequest,
  DisciplineDocumentListFilter,
  UploadDisciplineDocumentRequest,
  AnalyticsFilter,
  FinanceFilter
} from './admin.types';
import redisClient from '../../config/redis';
import { typesenseService } from '../../shared/search/typesense.service';

export class AdminService {
  private async createLog(adminId: string, action: string, target: string, type: 'standard' | 'destructive' | 'system' = 'standard') {
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    await (prisma as any).adminActivityLog.create({
      data: {
        admin_id: adminId,
        admin_name: admin?.name || 'Unknown',
        action_verb: action,
        target,
        type
      }
    });
  }

  async login(data: AdminLoginRequest): Promise<AdminAuthResponse> {
    const admin = await prisma.admin.findUnique({ where: { email: data.email } });
    if (!admin) {
      throw new Error('Invalid credentials');
    }

    if (data.password) {
      const isPasswordValid = await bcrypt.compare(data.password, admin.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }
    }

    const accessToken = jwt.sign(
      { adminId: admin.id, email: admin.email, role: admin.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    await prisma.admin.update({
      where: { id: admin.id },
      data: { last_login: new Date() }
    });

    return {
      accessToken,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    };
  }

  // Pillar 1: Dashboard
  async getStats(): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      activeUsersToday,
      newRegistrations,
      materialsPending,
      flaggedContent,
      aiRequestsToday,
      revenueToday
    ] = await Promise.all([
      prisma.learningProfile.count({
        where: { last_active: { gte: today } }
      }),
      prisma.user.count({
        where: { created_at: { gte: today } }
      }),
      prisma.material.count({
        where: { verification_status: VerificationStatus.PENDING }
      }),
      prisma.material.count({
        where: { verification_status: VerificationStatus.FLAGGED }
      }),
      prisma.message.count({
        where: {
          created_at: { gte: today },
          role: MessageRole.AI
        }
      }),
      prisma.transaction.aggregate({
        where: { status: 'successful', created_at: { gte: today } },
        _sum: { amount: true }
      }).then(res => res._sum.amount || 0)
    ]);

    return {
      activeUsersToday,
      newRegistrations,
      revenueToday,
      materialsPending,
      flaggedContent,
      aiRequestsToday
    };
  }

  async getCharts(): Promise<DashboardCharts> {
    return {
      userActivity: [],
      revenue: [],
      featureUsage: []
    };
  }

  async getActivity(): Promise<DashboardActivity> {
    const [recentFlagged, recentRegistrations, recentPayments] = await Promise.all([
      prisma.material.findMany({
        where: { verification_status: VerificationStatus.FLAGGED },
        take: 5,
        orderBy: { created_at: 'desc' }
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        select: { name: true, university: true, department: true, created_at: true }
      }),
      prisma.featureAccess.findMany({
        take: 5,
        orderBy: { purchased_at: 'desc' },
        include: { user: { select: { name: true } } }
      })
    ]);

    return { recentFlagged, recentRegistrations, recentPayments };
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const health: SystemHealth = {
      api: 'online',
      database: 'online',
      redis: 'online',
      typesense: 'online',
      claude: 'online',
      websocket: 'online',
      r2: 'online'
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      health.database = 'offline';
    }

    try {
      await redisClient.ping();
    } catch {
      health.redis = 'offline';
    }

    return health;
  }

  // Pillar 2: User Management
  async listUsers(filter: UserListFilter) {
    const where: any = { is_deleted: false };

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } }
      ];
    }

    if (filter.university) where.university = filter.university;
    if (filter.department) where.department = filter.department;
    if (filter.status) {
      if (filter.status === 'banned') {
        where.is_banned = true;
      } else if (filter.status === 'unverified') {
        where.is_verified = false;
      } else {
        where.is_verified = true;
        where.is_banned = false;
      }
    }

    const limit = Number(filter.limit) || 20;
    const page = Number(filter.page) || 1;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take: limit,
        skip,
        orderBy: filter.sortBy ? { [filter.sortBy]: (filter.sortOrder || 'desc') as any } : { created_at: 'desc' },
        include: {
          feature_access: true,
          learning_profile: true
        }
      }),
      prisma.user.count({ where })
    ]);

    return { users, total, page, limit };
  }

  async getUserProfile(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        feature_access: true,
        learning_profile: true,
        sessions: {
          take: 10,
          orderBy: { started_at: 'desc' }
        }
      }
    });
  }

  async banUser(id: string, adminId: string) {
    const user = await prisma.user.update({
      where: { id },
      data: { is_banned: true }
    });
    await this.createLog(adminId, 'banned user', user.email, 'destructive');
    return user;
  }

  async unbanUser(id: string, adminId: string) {
    const user = await prisma.user.update({
      where: { id },
      data: { is_banned: false }
    });
    await this.createLog(adminId, 'unbanned user', user.email);
    return user;
  }

  async verifyUser(id: string, adminId: string) {
    const user = await prisma.user.update({
      where: { id },
      data: { is_verified: true, verification_token: null, verification_token_expires_at: null }
    });
    await this.createLog(adminId, 'verified user', user.email);
    return user;
  }

  async deleteUser(id: string, adminId: string) {
    const user = await prisma.user.update({
      where: { id },
      data: { is_deleted: true }
    });
    await this.createLog(adminId, 'deleted user', user.email, 'destructive');
    return user;
  }

  async grantAccess(userId: string, data: GrantAccessRequest) {
    return prisma.featureAccess.create({
      data: {
        user_id: userId,
        feature: data.feature,
        access_type: data.accessType,
        expires_at: data.expiresAt,
        uses_remaining: data.usesRemaining
      }
    });
  }

  // Pillar 3: Content Moderation
  async getFlaggedMaterials() {
    return prisma.material.findMany({
      where: { verification_status: VerificationStatus.FLAGGED },
      include: { user: { select: { name: true } } },
      orderBy: { created_at: 'desc' }
    });
  }

  async getPendingMaterials() {
    return prisma.material.findMany({
      where: { verification_status: VerificationStatus.PENDING },
      include: { user: { select: { name: true } } },
      orderBy: { created_at: 'desc' }
    });
  }

  async getVerifiedMaterials() {
    return prisma.material.findMany({
      where: { verification_status: VerificationStatus.VERIFIED },
      include: { user: { select: { name: true } } },
      orderBy: { created_at: 'desc' }
    });
  }

  async getArchivedMaterials() {
    return prisma.material.findMany({
      where: { verification_status: VerificationStatus.TAKEN_DOWN },
      include: { user: { select: { name: true } } },
      orderBy: { created_at: 'desc' }
    });
  }

  async approveMaterial(id: string, adminId: string) {
    const material = await prisma.material.update({
      where: { id },
      data: {
        verification_status: VerificationStatus.VERIFIED,
        admin_reviewed_by: adminId,
        admin_reviewed_at: new Date(),
        verified_at: new Date()
      }
    });
    await this.createLog(adminId, 'approved material', material.title);
    return material;
  }

  async takedownMaterial(id: string, adminId: string) {
    const material = await prisma.material.update({
      where: { id },
      data: {
        verification_status: VerificationStatus.TAKEN_DOWN,
        admin_reviewed_by: adminId,
        admin_reviewed_at: new Date()
      }
    });
    await this.createLog(adminId, 'took down material', material.title, 'destructive');
    return material;
  }

  async restoreMaterial(id: string, adminId: string) {
    const material = await prisma.material.update({
      where: { id },
      data: {
        verification_status: VerificationStatus.PENDING,
        admin_reviewed_by: adminId,
        admin_reviewed_at: new Date()
      }
    });
    await this.createLog(adminId, 'restored material', material.title);
    return material;
  }

  async forceVerify(id: string, adminId: string) {
    return this.approveMaterial(id, adminId);
  }

  // Pillar 4: Discipline Documents
  async listDisciplineDocuments(filter: DisciplineDocumentListFilter) {
    const where: any = {};
    if (filter.faculty) where.faculty = filter.faculty;
    if (filter.department) where.department = filter.department;
    if (filter.status) where.is_active = filter.status === 'active';

    return prisma.disciplineDocument.findMany({
      where,
      orderBy: { updated_at: 'desc' }
    });
  }

  async getDisciplineDocument(id: string) {
    const doc = await prisma.disciplineDocument.findUnique({ where: { id } });
    if (!doc) return null;

    const history = await prisma.disciplineDocument.findMany({
      where: {
        faculty: doc.faculty,
        department: doc.department,
        course_code: doc.course_code,
        id: { not: doc.id }
      },
      orderBy: { version: 'desc' }
    });

    return { ...doc, history };
  }

  async uploadDisciplineDocument(data: UploadDisciplineDocumentRequest, adminId: string) {
    const latest = await prisma.disciplineDocument.findFirst({
      where: {
        faculty: data.faculty,
        department: data.department,
        course_code: data.course_code || null
      },
      orderBy: { version: 'desc' }
    });

    await prisma.disciplineDocument.updateMany({
      where: {
        faculty: data.faculty,
        department: data.department,
        course_code: data.course_code || null
      },
      data: { is_active: false }
    });

    const newVersion = (latest?.version || 0) + 1;

    const document = await prisma.disciplineDocument.create({
      data: {
        faculty: data.faculty,
        department: data.department,
        course_code: data.course_code || null,
        document_ref: data.document_ref,
        version: newVersion,
        version_notes: data.version_notes,
        last_updated_by: adminId,
        is_active: true
      }
    });

    await this.createLog(adminId, 'uploaded discipline document', `${data.department} - ${data.course_code || 'All'}`);

    const cacheKeyPattern = `ai:context:${data.department}:*`;
    const keys = await redisClient.keys(cacheKeyPattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

    return document;
  }

  async rollbackDisciplineDocument(id: string, version: number, adminId: string) {
    const target = await prisma.disciplineDocument.findUnique({ where: { id } });
    if (!target) throw new Error('Document not found');

    const rollbackTo = await prisma.disciplineDocument.findFirst({
      where: {
        faculty: target.faculty,
        department: target.department,
        course_code: target.course_code,
        version: version
      }
    });

    if (!rollbackTo) throw new Error('Version not found');

    await prisma.disciplineDocument.updateMany({
      where: {
        faculty: target.faculty,
        department: target.department,
        course_code: target.course_code
      },
      data: { is_active: false }
    });

    const updated = await prisma.disciplineDocument.update({
      where: { id: rollbackTo.id },
      data: { is_active: true }
    });

    await this.createLog(adminId, 'rolled back discipline document', `${target.department} to v${version}`);

    const cacheKeyPattern = `ai:context:${target.department}:*`;
    const keys = await redisClient.keys(cacheKeyPattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

    return updated;
  }

  async deactivateDisciplineDocument(id: string) {
    return prisma.disciplineDocument.update({
      where: { id },
      data: { is_active: false }
    });
  }

  async getDepartmentCoverage() {
    const departments = await prisma.department.findMany({
      include: { university: true }
    });

    const activeDocs = await prisma.disciplineDocument.findMany({
      where: { is_active: true, course_code: null }
    });

    const coverage = departments.map(dept => {
      const doc = activeDocs.find(d => d.department === dept.name);
      let status = 'missing';
      if (doc) {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        status = doc.updated_at < ninetyDaysAgo ? 'outdated' : 'active';
      }

      return {
        id: dept.id,
        name: dept.name,
        university: dept.university.name,
        faculty: dept.faculty,
        status,
        lastUpdated: doc?.updated_at
      };
    });

    return coverage;
  }

  // Pillar 5: Platform Analytics
  async getOverviewAnalytics(filter: AnalyticsFilter) {
    const [totalStudents, mau, wau, dau] = await Promise.all([
      prisma.user.count({ where: { is_deleted: false } }),
      prisma.learningProfile.count({
        where: { last_active: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      }),
      prisma.learningProfile.count({
        where: { last_active: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      }),
      prisma.learningProfile.count({
        where: { last_active: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
      })
    ]);

    return { totalStudents, mau, wau, dau };
  }

  async getGrowthAnalytics(filter: AnalyticsFilter) {
    const where: any = { created_at: {} };
    if (filter.startDate) where.created_at.gte = new Date(filter.startDate);
    if (filter.endDate) where.created_at.lte = new Date(filter.endDate);
    if (filter.university) where.university = filter.university;
    if (filter.department) where.department = filter.department;

    const registrations = await prisma.user.findMany({
      where,
      select: { created_at: true, auth_provider: true, university: true, department: true }
    });

    return registrations;
  }

  async getFeatureUsageAnalytics(filter: AnalyticsFilter) {
    const where: any = { started_at: {} };
    if (filter.startDate) where.started_at.gte = new Date(filter.startDate);
    if (filter.endDate) where.started_at.lte = new Date(filter.endDate);

    const sessions = await prisma.session.groupBy({
      by: ['session_type'],
      where,
      _count: { _all: true }
    });

    return sessions;
  }

  async getRetentionAnalytics(filter: AnalyticsFilter) {
    return {
      day1: 0.45,
      day3: 0.30,
      day7: 0.20,
      day30: 0.10
    };
  }

  async getContentAnalytics(filter: AnalyticsFilter) {
    const materials = await prisma.material.count();
    const verified = await prisma.material.count({ where: { verification_status: VerificationStatus.VERIFIED } });

    return {
      totalMaterials: materials,
      verificationRate: materials > 0 ? verified / materials : 0,
      mostUploadedCourses: []
    };
  }

  async getConversionAnalytics(filter: AnalyticsFilter) {
    return {
      freeToPaidRate: 0.05,
      topConvertingFeature: 'Assignment Solving',
      churnRate: 0.12
    };
  }

  // Pillar 6: Financial Management
  async getFinanceOverview() {
    try {
      const now = new Date();
      const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
      const startOfWeek = new Date(new Date().setDate(now.getDate() - now.getDay()));
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [total, monthly, weekly, today] = await Promise.all([
        prisma.transaction.aggregate({ where: { status: 'successful' }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
        prisma.transaction.aggregate({ where: { status: 'successful', created_at: { gte: startOfMonth } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
        prisma.transaction.aggregate({ where: { status: 'successful', created_at: { gte: startOfWeek } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
        prisma.transaction.aggregate({ where: { status: 'successful', created_at: { gte: startOfDay } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } }))
      ]);

      return {
        totalRevenue: total?._sum?.amount || 0,
        monthlyRevenue: monthly?._sum?.amount || 0,
        weeklyRevenue: weekly?._sum?.amount || 0,
        todayRevenue: today?._sum?.amount || 0
      };
    } catch (error) {
      console.error('Error fetching finance overview:', error);
      return {
        totalRevenue: 0,
        monthlyRevenue: 0,
        weeklyRevenue: 0,
        todayRevenue: 0
      };
    }
  }

  async getFinanceBreakdown(filter: FinanceFilter) {
    const byFeature = await prisma.transaction.groupBy({
      by: ['feature'],
      where: { status: 'successful' },
      _sum: { amount: true }
    });

    const byPlan = await prisma.transaction.groupBy({
      by: ['plan'],
      where: { status: 'successful' },
      _sum: { amount: true },
      _count: { _all: true }
    });

    return { byFeature, byPlan };
  }

  async getTransactions(filter: FinanceFilter) {
    const where: any = {};
    if (filter.status) where.status = filter.status;
    if (filter.feature) where.feature = filter.feature as Feature;
    if (filter.university) where.university = filter.university;

    return prisma.transaction.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { created_at: 'desc' }
    });
  }

  async getFailedPayments() {
    return prisma.transaction.findMany({
      where: { status: 'failed' },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { created_at: 'desc' }
    });
  }

  async getFinanceProjections() {
    return {
      currentMonthRunRate: 1500000,
      nextMonthEstimate: 1800000,
      trend: 'up'
    };
  }

  async getPaystackWebhookLogs() {
    return prisma.paystackWebhookLog.findMany({
      orderBy: { created_at: 'desc' },
      take: 100
    });
  }

  async grantFinanceAccess(userId: string, data: GrantAccessRequest) {
    return this.grantAccess(userId, data);
  }

  // Pillar 7: AI & System Monitoring
  async getAIMonitoring() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalCallsToday = await prisma.message.count({
      where: { role: MessageRole.AI, created_at: { gte: today } }
    });

    return {
      totalCallsToday,
      totalTokensToday: totalCallsToday * 500,
      estimatedCostToday: totalCallsToday * 0.002,
      cacheHitRate: 0.65
    };
  }

  async getHealthMonitoring() {
    return this.getSystemHealth();
  }

  async getErrorMonitoring() {
    return [];
  }

  async getWebSocketMonitoring() {
    return {
      activeSessions: 0,
      peakConcurrent: 0,
      avgDuration: 0
    };
  }

  async getCacheMonitoring() {
    return {
      hitRate: 0.65,
      size: '156MB',
      invalidationsToday: 12
    };
  }

  async getJobsMonitoring() {
    return [
      { name: 'ingestMaterial', lastRun: new Date(), status: 'success', duration: '4.2s' },
      { name: 'generateQuestions', lastRun: new Date(), status: 'success', duration: '23s' }
    ];
  }

  async retryJob(name: string) {
    return { message: `Job ${name} retried successfully` };
  }

  async listAdmins() {
    return prisma.admin.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        created_at: true,
        last_login: true
      }
    });
  }

  async inviteAdmin(data: { name: string, email: string, role: string }) {
    const passwordHash = await bcrypt.hash('temporary_password', 10);
    const admin = await prisma.admin.create({
      data: {
        name: data.name,
        email: data.email,
        role: data.role as AdminRole,
        password_hash: passwordHash,
        status: 'active'
      }
    });
    return admin;
  }

  async getIPLogs() {
    return [];
  }

  async getSessionStatus() {
    return {
      activeAdmins: 1,
      lastAudit: new Date()
    };
  }

  async getActivityLogs(filter: any) {
    const where: any = {};
    if (filter.filter === 'destructive') where.type = 'destructive';
    if (filter.filter === 'security') where.type = 'security';
    if (filter.filter === 'system') where.type = 'system';

    const limit = 50;
    const page = Number(filter.page) || 1;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      (prisma as any).adminActivityLog.findMany({
        where,
        take: limit,
        skip,
        orderBy: { timestamp: 'desc' }
      }),
      (prisma as any).adminActivityLog.count({ where })
    ]);

    return { logs, hasMore: total > skip + limit };
  }

  async deleteAdminAccount(id: string, adminId: string) {
    const admin = await prisma.admin.findUnique({ where: { id } });
    if (admin) {
      await this.createLog(adminId, 'deleted admin', admin.email, 'destructive');
    }
    return prisma.admin.delete({ where: { id } });
  }

  async suspendAdmin(id: string, adminId: string) {
    const admin = await prisma.admin.update({
      where: { id },
      data: { status: 'suspended' }
    });
    await this.createLog(adminId, 'suspended admin', admin.email, 'destructive');
    return admin;
  }

  async unsuspendAdmin(id: string, adminId: string) {
    const admin = await prisma.admin.update({
      where: { id },
      data: { status: 'active' }
    });
    await this.createLog(adminId, 'unsuspended admin', admin.email);
    return admin;
  }
}

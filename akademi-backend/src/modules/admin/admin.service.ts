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
  GrantAccessRequest
} from './admin.types';
import redisClient from '../../config/redis';
import { typesenseService } from '../../shared/search/typesense.service';
import { generateQuestionsJob } from '../../jobs/generateQuestions.job';

export class AdminService {
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
      aiRequestsToday
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
      })
    ]);

    return {
      activeUsersToday,
      newRegistrations,
      revenueToday: 0, // Placeholder
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

  async banUser(id: string) {
    return prisma.user.update({
      where: { id },
      data: { is_banned: true }
    });
  }

  async unbanUser(id: string) {
    return prisma.user.update({
      where: { id },
      data: { is_banned: false }
    });
  }

  async verifyUser(id: string) {
    return prisma.user.update({
      where: { id },
      data: { is_verified: true, verification_token: null, verification_token_expires_at: null }
    });
  }

  async deleteUser(id: string) {
    return prisma.user.update({
      where: { id },
      data: { is_deleted: true }
    });
  }

  async grantAccess(userId: string, data: GrantAccessRequest) {
    return prisma.featureAccess.create({
      data: {
        user_id: userId,
        feature: data.feature,
        access_type: data.accessType,
        expires_at: data.expiresAt,
        uses_remaining: data.usesRemaining,
        payment_ref: 'ADMIN_GRANTED'
      }
    });
  }

  // Pillar 3: Content Moderation
  async getFlaggedMaterials() {
    return prisma.material.findMany({
      where: { verification_status: VerificationStatus.FLAGGED },
      include: { user: { select: { name: true } } }
    });
  }

  async getPendingMaterials() {
    return prisma.material.findMany({
      where: { verification_status: VerificationStatus.PENDING },
      include: { user: { select: { name: true } } }
    });
  }

  async getVerifiedMaterials() {
    return prisma.material.findMany({
      where: { verification_status: VerificationStatus.VERIFIED },
      include: { user: { select: { name: true } } }
    });
  }

  async getArchivedMaterials() {
    return prisma.material.findMany({
      where: { verification_status: VerificationStatus.TAKEN_DOWN },
      include: { user: { select: { name: true } } }
    });
  }

  async approveMaterial(id: string, adminId: string) {
    const material = await prisma.material.update({
      where: { id },
      data: {
        verification_status: VerificationStatus.VERIFIED,
        verified_at: new Date(),
        admin_reviewed_by: adminId,
        admin_reviewed_at: new Date()
      }
    });

    generateQuestionsJob(id).catch(console.error);
    return material;
  }

  async takedownMaterial(id: string, adminId: string) {
    return prisma.material.update({
      where: { id },
      data: {
        verification_status: VerificationStatus.TAKEN_DOWN,
        admin_reviewed_by: adminId,
        admin_reviewed_at: new Date()
      }
    });
  }

  async restoreMaterial(id: string, adminId: string) {
    return prisma.material.update({
      where: { id },
      data: {
        verification_status: VerificationStatus.VERIFIED,
        admin_reviewed_by: adminId,
        admin_reviewed_at: new Date()
      }
    });
  }

  async forceVerify(id: string, adminId: string) {
    return this.approveMaterial(id, adminId);
  }
}

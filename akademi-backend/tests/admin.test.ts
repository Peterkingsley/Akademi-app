import request from 'supertest';
import { app } from '../src/app';
import prisma from '../src/config/db';
import bcrypt from 'bcrypt';
import { AdminRole, VerificationStatus } from '@prisma/client';

describe('Admin Module', () => {
  let superAdminToken: string;
  let moderatorToken: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;

    await prisma.admin.deleteMany();
    await prisma.material.deleteMany();
    await prisma.user.deleteMany();

    const superAdminPassword = await bcrypt.hash('superadmin123', 12);
    const superAdmin = await prisma.admin.create({
      data: {
        name: 'Super Admin',
        email: 'super@akademi.ng',
        password_hash: superAdminPassword,
        role: AdminRole.SUPER_ADMIN,
      },
    });

    const moderatorPassword = await bcrypt.hash('moderator123', 12);
    const moderator = await prisma.admin.create({
      data: {
        name: 'Moderator',
        email: 'mod@akademi.ng',
        password_hash: moderatorPassword,
        role: AdminRole.MODERATOR,
      },
    });

    const superLogin = await request(app)
      .post('/admin/login')
      .send({ email: 'super@akademi.ng', password: 'superadmin123' });
    superAdminToken = superLogin.body.accessToken;

    const modLogin = await request(app)
      .post('/admin/login')
      .send({ email: 'mod@akademi.ng', password: 'moderator123' });
    moderatorToken = modLogin.body.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Pillar 1: Dashboard', () => {
    it('should get dashboard stats', async () => {
      if (!process.env.DATABASE_URL) return;
      const res = await request(app)
        .get('/admin/dashboard/stats')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('activeUsersToday');
    });

    it('should only allow Super Admin to view charts', async () => {
      if (!process.env.DATABASE_URL) return;
      const res = await request(app)
        .get('/admin/dashboard/charts')
        .set('Authorization', `Bearer ${moderatorToken}`);
      expect(res.status).toBe(403);

      const resSuper = await request(app)
        .get('/admin/dashboard/charts')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(resSuper.status).toBe(200);
    });
  });

  describe('Pillar 2: User Management', () => {
    let testUserId: string;

    beforeAll(async () => {
      if (!process.env.DATABASE_URL) return;
      const user = await prisma.user.create({
        data: {
          name: 'Test Student',
          email: 'student@example.com',
          university: 'Unilag',
          faculty: 'Science',
          department: 'CS',
          level: 100,
        },
      });
      testUserId = user.id;
    });

    it('should list users', async () => {
      if (!process.env.DATABASE_URL) return;
      const res = await request(app)
        .get('/admin/users')
        .set('Authorization', `Bearer ${moderatorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.users.length).toBeGreaterThan(0);
    });

    it('should allow super admin to ban a user', async () => {
      if (!process.env.DATABASE_URL) return;
      const res = await request(app)
        .patch(`/admin/users/${testUserId}/ban`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(200);

      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(user?.is_banned).toBe(true);
    });

    it('should not allow moderator to ban a user', async () => {
      if (!process.env.DATABASE_URL) return;
      const res = await request(app)
        .patch(`/admin/users/${testUserId}/ban`)
        .set('Authorization', `Bearer ${moderatorToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Pillar 3: Content Moderation', () => {
    let testMaterialId: string;

    beforeAll(async () => {
      if (!process.env.DATABASE_URL) return;
      const user = await prisma.user.findFirst();
      const material = await prisma.material.create({
        data: {
          title: 'Test Material',
          course_code: 'CS101',
          university: 'Unilag',
          faculty: 'Science',
          department: 'CS',
          level: 100,
          file_ref: 'test-ref',
          file_type: 'PDF',
          verification_status: VerificationStatus.FLAGGED,
          uploaded_by: user!.id,
          contributor_ids: [user!.id],
        },
      });
      testMaterialId = material.id;
    });

    it('should list flagged materials', async () => {
      if (!process.env.DATABASE_URL) return;
      const res = await request(app)
        .get('/admin/materials/flagged')
        .set('Authorization', `Bearer ${moderatorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should allow moderator to approve a material', async () => {
      if (!process.env.DATABASE_URL) return;
      const res = await request(app)
        .patch(`/admin/materials/${testMaterialId}/approve`)
        .set('Authorization', `Bearer ${moderatorToken}`);
      expect(res.status).toBe(200);

      const material = await prisma.material.findUnique({ where: { id: testMaterialId } });
      expect(material?.verification_status).toBe(VerificationStatus.VERIFIED);
    });
  });
});

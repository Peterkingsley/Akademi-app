import request from 'supertest';
import { app } from '../src/app';
import prisma from '../src/config/db';
import { DeviceType } from '@prisma/client';

describe('Auth Module', () => {
  beforeEach(async () => {
    // Skip DB cleanup if environment is not set up
    if (process.env.DATABASE_URL) {
      await prisma.refreshToken.deleteMany();
      await prisma.learningProfile.deleteMany();
      await prisma.user.deleteMany();
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const registerData = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    university: 'Unilag',
    faculty: 'Science',
    department: 'Computer Science',
    level: 100,
  };

  const loginData = {
    email: 'john@example.com',
    password: 'password123',
    deviceInfo: {
      name: 'iPhone 15',
      type: DeviceType.IOS,
    },
  };

  it('should register a new user', async () => {
    if (!process.env.DATABASE_URL) return;
    const res = await request(app).post('/auth/register').send(registerData);
    expect(res.status).toBe(201);
    expect(res.body.message).toContain('Registration successful');

    const user = await prisma.user.findUnique({ where: { email: registerData.email } });
    expect(user).toBeDefined();
    expect(user?.is_verified).toBe(false);
    expect(user?.verification_token?.length).toBe(6); // New OTP length
    expect(user?.courses).toEqual([]);

    const profile = await prisma.learningProfile.findUnique({ where: { user_id: user?.id } });
    expect(profile).toBeDefined();
  });

  it('should register a new user who provides course codes and semester dates', async () => {
    if (!process.env.DATABASE_URL) return;
    const res = await request(app)
      .post('/auth/register')
      .send({
        ...registerData,
        email: 'withcourses@example.com',
        semester: 1,
        semesterStart: '2026-01-01',
        semesterEnd: '2026-05-01',
        courses: ['CSC 101'],
      });
    expect(res.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: 'withcourses@example.com' } });
    expect(user?.courses).toEqual(['CSC 101']);

    const studentCourses = await prisma.studentCourse.findMany({ where: { user_id: user?.id } });
    expect(studentCourses).toHaveLength(1);
    expect(studentCourses[0].code).toBe('CSC 101');
  });

  it('should reject a registration that provides a course code but no semester dates', async () => {
    if (!process.env.DATABASE_URL) return;
    const res = await request(app)
      .post('/auth/register')
      .send({
        ...registerData,
        email: 'missingdates@example.com',
        courses: ['CSC 101'],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Semester is required');
  });

  it('should not login if email is not verified', async () => {
    if (!process.env.DATABASE_URL) return;
    await request(app).post('/auth/register').send(registerData);
    const res = await request(app).post('/auth/login').send(loginData);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Email not verified');
  });

  it('should login after email verification', async () => {
    if (!process.env.DATABASE_URL) return;
    await request(app).post('/auth/register').send(registerData);
    let user = await prisma.user.findUnique({ where: { email: registerData.email } });

    await request(app).post('/auth/verify-email').send({
      email: registerData.email,
      token: user?.verification_token,
    });

    const res = await request(app).post('/auth/login').send(loginData);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(registerData.email);
  });

  it('should refresh token', async () => {
    if (!process.env.DATABASE_URL) return;
    await request(app).post('/auth/register').send(registerData);
    const user = await prisma.user.findUnique({ where: { email: registerData.email } });
    await request(app).post('/auth/verify-email').send({
      email: registerData.email,
      token: user?.verification_token,
    });

    const loginRes = await request(app).post('/auth/login').send(loginData);
    const { refreshToken } = loginRes.body;

    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('should logout', async () => {
    if (!process.env.DATABASE_URL) return;
    await request(app).post('/auth/register').send(registerData);
    const user = await prisma.user.findUnique({ where: { email: registerData.email } });
    await request(app).post('/auth/verify-email').send({
      email: registerData.email,
      token: user?.verification_token,
    });

    const loginRes = await request(app).post('/auth/login').send(loginData);
    const { accessToken, refreshToken } = loginRes.body;

    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);

    const tokenRecord = await prisma.refreshToken.findFirst({
      where: { user_id: user?.id },
    });
    expect(tokenRecord?.is_active).toBe(false);
  });
});

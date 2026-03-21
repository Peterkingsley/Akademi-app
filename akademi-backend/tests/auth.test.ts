import request from 'supertest';
import { app } from '../src/app';
import prisma from '../src/config/db';
import { DeviceType } from '@prisma/client';

describe('Auth Module', () => {
  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.learningProfile.deleteMany();
    await prisma.user.deleteMany();
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
    const res = await request(app).post('/auth/register').send(registerData);
    expect(res.status).toBe(201);
    expect(res.body.message).toContain('Registration successful');

    const user = await prisma.user.findUnique({ where: { email: registerData.email } });
    expect(user).toBeDefined();
    expect(user?.is_verified).toBe(false);

    const profile = await prisma.learningProfile.findUnique({ where: { user_id: user?.id } });
    expect(profile).toBeDefined();
  });

  it('should not login if email is not verified', async () => {
    await request(app).post('/auth/register').send(registerData);
    const res = await request(app).post('/auth/login').send(loginData);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Email not verified');
  });

  it('should login after email verification', async () => {
    await request(app).post('/auth/register').send(registerData);
    const user = await prisma.user.findUnique({ where: { email: registerData.email } });

    await request(app).post('/auth/verify-email').send({ token: user?.verification_token });

    const res = await request(app).post('/auth/login').send(loginData);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('should refresh token', async () => {
    await request(app).post('/auth/register').send(registerData);
    const user = await prisma.user.findUnique({ where: { email: registerData.email } });
    await request(app).post('/auth/verify-email').send({ token: user?.verification_token });

    const loginRes = await request(app).post('/auth/login').send(loginData);
    const { refreshToken } = loginRes.body;

    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('should logout', async () => {
    await request(app).post('/auth/register').send(registerData);
    const user = await prisma.user.findUnique({ where: { email: registerData.email } });
    await request(app).post('/auth/verify-email').send({ token: user?.verification_token });

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

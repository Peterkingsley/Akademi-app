import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/db';
import { DeviceType, FileType, VerificationStatus } from '@prisma/client';

describe('Materials Module', () => {
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    await prisma.message.deleteMany();
    await prisma.session.deleteMany();
    await prisma.material.deleteMany();
    await prisma.learningProfile.deleteMany();
    await prisma.user.deleteMany();

    const registerData = {
      name: 'John Material',
      email: 'john.material@example.com',
      password: 'password123',
      university: 'Unilag',
      faculty: 'Science',
      department: 'Computer Science',
      level: 100,
    };

    await request(app).post('/auth/register').send(registerData);
    const user = await prisma.user.findUnique({ where: { email: registerData.email } });
    userId = user!.id;
    await request(app).post('/auth/verify-email').send({ token: user?.verification_token });

    const loginRes = await request(app).post('/auth/login').send({
      email: registerData.email,
      password: registerData.email.split('@')[0] === 'john.material' ? 'password123' : 'wrong', // fixed to use same password
      deviceInfo: { name: 'Test Device', type: DeviceType.ANDROID },
    });
    accessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {

  });

  it('should initiate a material upload', async () => {
    const uploadData = {
      title: 'Intro to CS Notes',
      course_code: 'CSC101',
      university: 'Unilag',
      faculty: 'Science',
      department: 'Computer Science',
      level: 100,
      file_type: FileType.PDF,
    };

    const res = await request(app)
      .post('/materials/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(uploadData);

    expect(res.status).toBe(201);
    expect(res.body.materialId).toBeDefined();
    expect(res.body.presignedUrl).toContain('r2.cloudflarestorage.com');

    const material = await prisma.material.findUnique({ where: { id: res.body.materialId } });
    expect(material?.title).toBe(uploadData.title);
    expect(material?.verification_status).toBe(VerificationStatus.PENDING);
  });

  it('should list pending uploads for a user', async () => {
    const res = await request(app)
      .get('/materials/pending')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].verification_status).toBe(VerificationStatus.PENDING);
  });

  it('should list verified materials with filters', async () => {
    // Create a verified material manually
    await prisma.material.create({
      data: {
        title: 'Verified Chemistry',
        course_code: 'CHM101',
        university: 'Unilag',
        faculty: 'Science',
        department: 'Chemistry',
        level: 100,
        file_ref: 'verified/chem.pdf',
        file_type: FileType.PDF,
        verification_status: VerificationStatus.VERIFIED,
        uploaded_by: userId,
        contributor_ids: [userId],
      },
    });

    const res = await request(app)
      .get('/materials?university=Unilag&department=Chemistry')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Verified Chemistry');
  });

  it('should get a single material details', async () => {
    const material = await prisma.material.findFirst({ where: { title: 'Verified Chemistry' } });

    const res = await request(app)
      .get(`/materials/${material?.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(material?.id);
    expect(res.body.user.name).toBe('John Material');
  });

  it('should get a download URL', async () => {
    const material = await prisma.material.findFirst({ where: { title: 'Verified Chemistry' } });

    const res = await request(app)
      .get(`/materials/${material?.id}/download`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('r2.cloudflarestorage.com');
  });

  it('should report a material', async () => {
    const material = await prisma.material.findFirst({ where: { title: 'Verified Chemistry' } });

    const res = await request(app)
      .post(`/materials/${material?.id}/report`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Inappropriate content' });

    expect(res.status).toBe(200);

    const updated = await prisma.material.findUnique({ where: { id: material?.id } });
    expect(updated?.verification_status).toBe(VerificationStatus.FLAGGED);
  });
});

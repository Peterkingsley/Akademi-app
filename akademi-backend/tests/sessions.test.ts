import request from 'supertest';
import { app } from '../src/app';
import prisma from '../src/config/db';
import { DeviceType, SessionType, ReplyMode, Feature, AccessType, MessageRole } from '@prisma/client';

describe('Sessions Module', () => {
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    await prisma.message.deleteMany();
    await prisma.session.deleteMany();
    await prisma.featureAccess.deleteMany();
    await prisma.learningProfile.deleteMany();
    await prisma.user.deleteMany();

    const registerData = {
      name: 'Jane Session',
      email: 'jane.session@example.com',
      password: 'password123',
      university: 'OAU',
      faculty: 'Arts',
      department: 'English',
      level: 200,
    };

    await request(app).post('/auth/register').send(registerData);
    const user = await prisma.user.findUnique({ where: { email: registerData.email } });
    userId = user!.id;
    await request(app).post('/auth/verify-email').send({ token: user?.verification_token });

    const loginRes = await request(app).post('/auth/login').send({
      email: registerData.email,
      password: 'password123',
      deviceInfo: { name: 'Test Device', type: DeviceType.IOS },
    });
    accessToken = loginRes.body.accessToken;

    // Grant feature access for assignment solving
    await prisma.featureAccess.create({
      data: {
        user_id: userId,
        feature: Feature.ASSIGNMENT_SOLVING,
        access_type: AccessType.USE_BASED,
        uses_remaining: 5,
        payment_ref: 'test_ref',
      },
    });
  });

  afterAll(async () => {

  });

  it('should start a new assignment session (paid feature)', async () => {
    const sessionData = {
      session_type: SessionType.ASSIGNMENT,
      reply_mode: ReplyMode.DIRECT,
      course_code: 'ENG201',
    };

    const res = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(sessionData);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.session_type).toBe(SessionType.ASSIGNMENT);

    const access = await prisma.featureAccess.findFirst({
        where: { user_id: userId, feature: Feature.ASSIGNMENT_SOLVING }
    });
    expect(access?.uses_remaining).toBe(4);
  });

  it('should start a study session (free feature)', async () => {
    const sessionData = {
      session_type: SessionType.STUDY,
      course_code: 'ENG202',
    };

    const res = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(sessionData);

    expect(res.status).toBe(201);
    expect(res.body.session_type).toBe(SessionType.STUDY);
  });

  it('should not start a session without access', async () => {
    const sessionData = {
      session_type: SessionType.TUTOR,
      course_code: 'ENG203',
    };

    const res = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(sessionData);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('access');
  });

  it('should list sessions for a user', async () => {
    const res = await request(app)
      .get('/sessions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('should send a message and get AI response', async () => {
    const session = await prisma.session.findFirst({ where: { user_id: userId, session_type: SessionType.ASSIGNMENT } });

    const messageData = {
      content: 'Can you help me with this assignment?',
      reply_mode: ReplyMode.STUDY,
    };

    const res = await request(app)
      .post(`/sessions/${session?.id}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(messageData);

    expect(res.status).toBe(201);
    expect(res.body.role).toBe(MessageRole.AI);
    expect(res.body.content).toContain('mock AI response');

    const messages = await prisma.message.findMany({ where: { session_id: session?.id } });
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe(MessageRole.STUDENT);
    expect(messages[1].role).toBe(MessageRole.AI);
  });

  it('should list messages in a session', async () => {
    const session = await prisma.session.findFirst({ where: { user_id: userId, session_type: SessionType.ASSIGNMENT } });

    const res = await request(app)
      .get(`/sessions/${session?.id}/messages`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('should end a session', async () => {
    const session = await prisma.session.findFirst({ where: { user_id: userId, session_type: SessionType.ASSIGNMENT } });

    const res = await request(app)
      .patch(`/sessions/${session?.id}/end`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ended_at).toBeDefined();

    // Try sending another message
    const res2 = await request(app)
      .post(`/sessions/${session?.id}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'One more thing' });

    expect(res2.status).toBe(400);
    expect(res2.body.message).toContain('ended');
  });

  it('should get session summary', async () => {
    const session = await prisma.session.findFirst({ where: { user_id: userId } });

    const res = await request(app)
      .get(`/sessions/${session?.id}/summary`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
  });
});

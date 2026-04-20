import request from 'supertest';
import { app } from '../src/app';
import prisma from '../src/config/db';
import { DeviceType, VocabularyLevel } from '@prisma/client';
import { S3Client } from '@aws-sdk/client-s3';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env';

jest.mock('../src/config/db', () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
  admin: {
    findUnique: jest.fn(),
  },
  refreshToken: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  learningProfile: {
    findUnique: jest.fn(),
  },
  session: {
    findMany: jest.fn(),
  },
  featureAccess: {
    findMany: jest.fn(),
  },
  material: {
    findMany: jest.fn(),
  },
  $disconnect: jest.fn(),
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    admin: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    learningProfile: {
      findUnique: jest.fn(),
    },
    session: {
      findMany: jest.fn(),
    },
    featureAccess: {
      findMany: jest.fn(),
    },
    material: {
      findMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  }
}));

jest.mock('@aws-sdk/client-s3');

describe('Users Module', () => {
  const userId = 'user-123';
  const accessToken = jwt.sign({ userId, email: 'john@example.com' }, config.jwtSecret);

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: userId, email: 'john@example.com', is_deleted: false });
    (prisma.admin.findUnique as jest.Mock).mockResolvedValue(null);
  });

  it('should get current user profile', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: userId,
      name: 'John Doe',
      email: 'john@example.com',
      is_deleted: false
    });
    (prisma.admin.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('John Doe');
  });

  it('should update user profile', async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({
      id: userId,
      name: 'John Updated',
    });

    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'John Updated' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('John Updated');
  });

  it('should soft delete account', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: userId, profile_photo_url: 'some-url', is_deleted: false });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: userId, is_deleted: true });

    const res = await request(app)
      .delete('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: userId },
      data: expect.objectContaining({ is_deleted: true })
    }));
  });
});

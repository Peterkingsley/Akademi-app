import request from 'supertest';
import { app } from '../src/app';
import prisma from '../src/config/db';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env';
import { Feature } from '@prisma/client';

jest.mock('../src/config/db', () => ({
  user: {
    findUnique: jest.fn(),
  },
  admin: {
    findUnique: jest.fn(),
  },
  featureAccess: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  $disconnect: jest.fn(),
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    admin: {
      findUnique: jest.fn(),
    },
    featureAccess: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $disconnect: jest.fn(),
  }
}));

describe('Global Feature Bypass', () => {
  const userId = 'user-123';
  const accessToken = jwt.sign({ userId, email: 'john@example.com' }, config.jwtSecret);

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: userId, email: 'john@example.com', is_deleted: false });
    (prisma.admin.findUnique as jest.Mock).mockResolvedValue(null);
  });

  it('should return all features when unlockAllFeatures is true', async () => {
    // Force config to true for this test
    const originalValue = config.unlockAllFeatures;
    (config as any).unlockAllFeatures = true;

    try {
      const res = await request(app)
        .get('/users/me/feature-access')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(Object.values(Feature).length);
      expect(res.body[0].payment_ref).toBe('BYPASS');
    } finally {
      (config as any).unlockAllFeatures = originalValue;
    }
  });

  it('should return real access when unlockAllFeatures is false', async () => {
    const originalValue = config.unlockAllFeatures;
    (config as any).unlockAllFeatures = false;

    try {
      (prisma.featureAccess.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .get('/users/me/feature-access')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(0);
      expect(prisma.featureAccess.findMany).toHaveBeenCalled();
    } finally {
      (config as any).unlockAllFeatures = originalValue;
    }
  });
});

import { AuthService } from '../../src/modules/auth/auth.service';
import prisma from '../../src/config/db';
import bcrypt from 'bcrypt';
import { DeviceType } from '@prisma/client';

jest.mock('../../src/config/db', () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  learningProfile: { create: jest.fn() },
  refreshToken: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $disconnect: jest.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;
  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  it('should register a user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'user-id', email: 'test@example.com' });
    await authService.register({
      name: 'Test', email: 'test@example.com', password: 'pass',
      university: 'U', faculty: 'F', department: 'D', level: 100
    });
    expect(prisma.user.create).toHaveBeenCalled();
  });
});

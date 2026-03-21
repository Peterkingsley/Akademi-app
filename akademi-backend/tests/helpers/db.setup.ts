import prisma from '../../src/config/db';
import { seedTestData } from './seed';

beforeAll(async () => {
  if (process.env.SKIP_DB_SETUP === 'true') return;
  try {
    await seedTestData();
  } catch (e) {
    console.error('Failed to seed test database:', e);
  }
});

afterEach(async () => {
  if (process.env.SKIP_DB_SETUP === 'true') return;
  try {
    await prisma.message.deleteMany();
    await prisma.session.deleteMany();
    await prisma.questionAttempt.deleteMany();
    await prisma.mockAttempt.deleteMany();
    await prisma.prepTask.deleteMany();
    await prisma.examPrepPlan.deleteMany();
    await prisma.featureAccess.deleteMany();
    await prisma.refreshToken.deleteMany();
  } catch (e) {}
});

afterAll(async () => {
  await prisma.$disconnect();
});

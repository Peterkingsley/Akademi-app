import prisma from '../../src/config/db';
import { VerificationStatus, FileType, VocabularyLevel, AuthProvider } from '@prisma/client';

export async function seedTestData() {
  await prisma.user.deleteMany();
  await prisma.university.deleteMany();
  // ... (simplified seed for brevity)
}

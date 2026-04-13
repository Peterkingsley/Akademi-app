import { PrismaClient, AdminRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'peterkingslayer098@gmail.com';
  const name = 'Peter Kingslayer';
  const password = process.env.ADMIN_PASSWORD || 'AkademiAdmin2024!';
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: {
      name,
      password_hash: passwordHash,
      role: AdminRole.SUPER_ADMIN,
    },
    create: {
      name,
      email,
      password_hash: passwordHash,
      role: AdminRole.SUPER_ADMIN,
    },
  });

  console.log('Admin seeded successfully:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

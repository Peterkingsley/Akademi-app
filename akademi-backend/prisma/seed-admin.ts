import { PrismaClient, AdminRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'peterkingslayer098@gmail.com';
  const name = process.env.ADMIN_NAME || 'Peter Kingslayer';
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.trim() === '') {
    throw new Error(
      'ADMIN_PASSWORD is required to seed the SUPER_ADMIN account. ' +
        'Set it in the environment; there is no default fallback.',
    );
  }

  const existing = await prisma.admin.findUnique({ where: { email } });

  if (existing) {
    // Never overwrite the password of an existing admin: an out-of-band
    // rotation must survive re-runs of the seed on every deploy. Only keep the
    // non-secret profile fields in sync.
    const admin = await prisma.admin.update({
      where: { email },
      data: { name, role: AdminRole.SUPER_ADMIN },
    });
    console.log('Admin already exists; password left unchanged:', admin.email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.admin.create({
    data: {
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

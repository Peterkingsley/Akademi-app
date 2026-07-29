import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const models = await prisma.itemModel.findMany({ select: { id: true, archetypeId: true } });
  const items = await prisma.item.findMany();
  console.log('ItemModel count:', models.length);
  console.log('Item count:', items.length);
  await prisma.$disconnect();
})();

import prisma from '../config/db';

async function main() {
  const km = await prisma.knowledgeModel.findFirst({ where: { courseCode: 'MTH 102', scope: 'COURSE' } });
  if (!km) { console.log('No KnowledgeModel found.'); return; }
  const itemModels = await prisma.itemModel.count({ where: { modelId: km.id } });
  const items = await prisma.item.count({ where: { itemModel: { modelId: km.id } } });
  console.log(`KnowledgeModel: ${km.id} (status=${km.status})`);
  console.log(`ItemModels: ${itemModels}`);
  console.log(`Items written so far: ${items}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

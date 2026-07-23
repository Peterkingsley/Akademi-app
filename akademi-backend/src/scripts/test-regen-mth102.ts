import prisma from '../config/db';
import { forceRegenerateTextbookOutline } from '../modules/textbooks/textbook-trigger';

async function main() {
  const result = await forceRegenerateTextbookOutline('MTH 102', null);
  console.log(`Triggered MTH 102 regeneration. Result: ${result}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

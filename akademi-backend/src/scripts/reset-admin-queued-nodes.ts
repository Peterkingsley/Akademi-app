import 'dotenv/config';
import prisma from '../config/db';

async function main() {
  const nodesToReset = await prisma.generatedTextbookOutlineNode.findMany({
    where: {
      status: 'ADMIN_QUEUED',
      section: {
        quality_check_notes: {
          contains: 'The automated quality check itself failed to run',
        },
      },
    },
    include: { section: true },
  });

  console.log(`Found ${nodesToReset.length} ADMIN_QUEUED nodes affected by capacity exhaustion.`);

  for (const node of nodesToReset) {
    await prisma.generatedTextbookOutlineNode.update({
      where: { id: node.id },
      data: {
        status: 'AWAITING_CAPACITY',
        retry_count: 0,
      },
    });

    // Also clear the misleading quality check notes so it doesn't look like a content failure
    if (node.section?.id) {
      await prisma.generatedTextbookSection.update({
        where: { id: node.section.id },
        data: {
          quality_check_notes: null,
          quality_check_passed: false,
        },
      });
    }
  }

  console.log('Reset complete. Nodes are now AWAITING_CAPACITY and will be picked up by the capacity sweeper.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });

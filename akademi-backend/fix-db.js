const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting manual database migration fix...');
  try {
    // 1. Delete the duplicate failed migration record for 20260324170000_sync_schema
    // ID: 95572333-9651-4851-8f5a-c1041eba1e4c
    const deleteResult = await prisma.$executeRaw`
      DELETE FROM _prisma_migrations
      WHERE migration_name = '20260324170000_sync_schema'
      AND finished_at IS NULL
      AND id = '95572333-9651-4851-8f5a-c1041eba1e4c';
    `;
    console.log('Cleaned up failed 20260324170000_sync_schema migration records:', deleteResult);

    // 2. Mark 20260522090202_add_question_scoring_fields as finished
    // ID: dec5f016-3787-48e6-9ebd-e9fa2a07abad
    const updateResult = await prisma.$executeRaw`
      UPDATE _prisma_migrations
      SET finished_at = NOW(),
          applied_steps_count = 1,
          logs = NULL
      WHERE migration_name = '20260522090202_add_question_scoring_fields'
      AND finished_at IS NULL
      AND id = 'dec5f016-3787-48e6-9ebd-e9fa2a07abad';
    `;
    console.log('Marked 20260522090202_add_question_scoring_fields as finished:', updateResult);

    const visualCueColumns = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'visual_cues'
      AND column_name IN ('generation_status', 'generation_error');
    `;

    const hasVisualCueGenerationColumns = Array.isArray(visualCueColumns) && visualCueColumns.length >= 2;

    if (hasVisualCueGenerationColumns) {
      const resetVisualCuesResult = await prisma.$executeRaw`
        UPDATE visual_cues
        SET generation_status = 'PENDING',
            generation_error = NULL
        WHERE generation_status IN ('PROCESSING', 'FAILED');
      `;
      console.log('Reset stuck whiteboard visual cue generation statuses:', resetVisualCuesResult);
    } else {
      console.log('Skipped whiteboard visual cue reset: generation columns are not present yet.');
    }

    console.log('Database migration fix completed successfully.');
  } catch (error) {
    console.error('Error during database migration fix:', error);
    // We don't want to fail the build if the fix fails (e.g., if it already ran)
  } finally {
    await prisma.$disconnect();
  }
}

main();

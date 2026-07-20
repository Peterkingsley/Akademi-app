import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillMaterialUniversity() {
  const materials = await prisma.material.findMany({
    where: {
      is_akademi_generated: true,
    },
    include: {
      generated_outline: true,
    },
  });

  console.log(`[backfill-material-university] Found ${materials.length} generated materials to audit.`);

  let updatedCount = 0;

  for (const material of materials) {
    if (!material.generated_outline) {
      continue;
    }

    const { scope_type, university_id } = material.generated_outline;

    let targetUniversity = 'AKADEMI_NATIONAL';
    if (scope_type === 'SCHOOL_SPECIFIC' && university_id) {
      const uni = await prisma.university.findUnique({
        where: { id: university_id }
      });
      if (uni) {
        targetUniversity = uni.name.trim();
      }
    }

    if (material.university !== targetUniversity) {
      await prisma.material.update({
        where: { id: material.id },
        data: { university: targetUniversity },
      });
      console.log(`[backfill-material-university] Updated material ${material.id} (course: ${material.course_code}) from '${material.university}' to '${targetUniversity}'`);
      updatedCount++;
    }
  }

  console.log(`[backfill-material-university] Backfill complete. Updated ${updatedCount} materials.`);
}

backfillMaterialUniversity()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

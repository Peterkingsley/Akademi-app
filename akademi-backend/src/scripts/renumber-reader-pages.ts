import prisma from '../config/db';

const BATCH_SIZE = 200;

type Summary = { updated: number; skipped: number };

async function renumberReaderPages(): Promise<Summary> {
  const summary: Summary = { updated: 0, skipped: 0 };
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.material.findMany({
      where: { reader_structure: { not: null as any } },
      select: { id: true, reader_structure: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const structure = row.reader_structure as { pages?: Array<Record<string, unknown>> } | null;
      if (!structure || !Array.isArray(structure.pages) || structure.pages.length === 0) {
        summary.skipped += 1;
        continue;
      }

      const renumbered = structure.pages.map((page, index) => ({
        ...page,
        pageNumber: index + 1,
      }));

      await prisma.material.update({
        where: { id: row.id },
        data: {
          reader_structure: {
            ...structure,
            pages: renumbered,
          } as any,
        },
      });
      summary.updated += 1;
    }

    cursor = rows[rows.length - 1].id;
    if (rows.length < BATCH_SIZE) break;
  }

  return summary;
}

async function main() {
  console.log('Renumbering Material.reader_structure pages to be document-global...');
  const summary = await renumberReaderPages();
  console.log(`  updated=${summary.updated} skipped=${summary.skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

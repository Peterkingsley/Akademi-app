// One-time, manually-triggered reset of the legacy Akademi-generated-textbook pipeline output.
// Soft-delete only — no hard deletes, no DROP/TRUNCATE. Defaults to dry-run; pass --apply to
// actually write. Safe to re-run: every write is scoped to rows not already touched, so a second
// run (accidental or deliberate) is a no-op.
//
// Scope, precisely (see Phase 1 investigation for why):
//   - Material: sets unpublished_at on every is_akademi_generated row that doesn't have it yet.
//     Does NOT touch verification_status — that field belongs to the admin content-moderation
//     flow (admin.service.ts's takedownMaterial), which notifies the uploader and records
//     admin_reviewed_by/at. Reusing it here would fire 16 false "taken down after admin review"
//     notifications and corrupt that audit trail for what is actually an infrastructure reset,
//     not a moderation action.
//   - GeneratedTextbookSection: sets deleted_at on every row that doesn't have it yet. This is
//     the ONLY generated-content model that needed a new column — diagram fields (needs_diagram,
//     diagram_description, diagram_image_url) and audit fields (quality_check_passed,
//     quality_check_notes) all live as columns on this same table, not separate models, so one
//     soft-delete covers all three things the task described as separate ("sections, diagram
//     results, audit results").
//
// Explicitly NOT touched, per the task's constraints:
//   - DisciplineDocument (CCMAS source documents, and international references)
//   - GeneratedTextbookOutline / GeneratedTextbookOutlineNode (decomposed curriculum outlines /
//     topic trees) — including terminology_registry, which lives on GeneratedTextbookOutline
//   - Any Material where is_akademi_generated is false (student-uploaded material)

import prisma from '../config/db';

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');

  console.log(`Running in ${apply ? 'APPLY' : 'DRY-RUN'} mode.${apply ? '' : ' Re-run with --apply to write to the database.'}\n`);

  // ─── Materials ───────────────────────────────────────────
  const materialsPublishedBefore = await prisma.material.count({
    where: { is_akademi_generated: true, unpublished_at: null },
  });
  const materialsAlreadyUnpublished = await prisma.material.count({
    where: { is_akademi_generated: true, unpublished_at: { not: null } },
  });

  console.log('Material (is_akademi_generated = true):');
  console.log(`  before: ${materialsPublishedBefore} published, ${materialsAlreadyUnpublished} already unpublished`);

  if (apply && materialsPublishedBefore > 0) {
    await prisma.material.updateMany({
      where: { is_akademi_generated: true, unpublished_at: null },
      data: { unpublished_at: new Date() },
    });
  }

  const materialsPublishedAfter = apply
    ? await prisma.material.count({ where: { is_akademi_generated: true, unpublished_at: null } })
    : materialsPublishedBefore;
  console.log(`  after:  ${materialsPublishedAfter} published${apply ? '' : ' (dry-run — unchanged)'}\n`);

  // ─── Generated sections (content + diagram + audit fields) ─
  const sectionsLiveBefore = await prisma.generatedTextbookSection.count({ where: { deleted_at: null } });
  const sectionsAlreadyDeleted = await prisma.generatedTextbookSection.count({ where: { deleted_at: { not: null } } });

  console.log('GeneratedTextbookSection (content, diagram, and audit fields all live on this table):');
  console.log(`  before: ${sectionsLiveBefore} live, ${sectionsAlreadyDeleted} already soft-deleted`);

  if (apply && sectionsLiveBefore > 0) {
    await prisma.generatedTextbookSection.updateMany({
      where: { deleted_at: null },
      data: { deleted_at: new Date() },
    });
  }

  const sectionsLiveAfter = apply
    ? await prisma.generatedTextbookSection.count({ where: { deleted_at: null } })
    : sectionsLiveBefore;
  console.log(`  after:  ${sectionsLiveAfter} live${apply ? '' : ' (dry-run — unchanged)'}\n`);

  // ─── Explicitly untouched — printed so a diff between runs makes it obvious if anything
  // outside scope moved ───
  const [outlineCount, nodeCount, disciplineDocCount, studentUploadedCount] = await Promise.all([
    prisma.generatedTextbookOutline.count(),
    prisma.generatedTextbookOutlineNode.count(),
    prisma.disciplineDocument.count(),
    prisma.material.count({ where: { is_akademi_generated: false } }),
  ]);

  console.log('Untouched by this script (reference counts, should not change run to run):');
  console.log(`  GeneratedTextbookOutline (decomposed curriculum / topic trees): ${outlineCount}`);
  console.log(`  GeneratedTextbookOutlineNode: ${nodeCount}`);
  console.log(`  DisciplineDocument (CCMAS source + international reference documents): ${disciplineDocCount}`);
  console.log(`  Material where is_akademi_generated = false (student-uploaded): ${studentUploadedCount}`);

  console.log(apply ? '\nReset complete.' : '\nDry run complete. No changes were made.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

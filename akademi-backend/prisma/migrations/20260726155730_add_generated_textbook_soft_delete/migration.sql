-- Soft-delete support for the legacy textbook generation pipeline reset.
-- Deliberately scoped to only these two columns: schema.prisma currently has other,
-- unrelated model additions (the KnowledgeModel pipeline, TextbookGenerationQueueEntry) that
-- were never migrated. This migration does not touch those — it captures only the two new
-- fields needed to soft-delete generated textbook content.

ALTER TABLE "materials" ADD COLUMN "unpublished_at" TIMESTAMP(3);
CREATE INDEX "materials_unpublished_at_idx" ON "materials"("unpublished_at");

ALTER TABLE "generated_textbook_sections" ADD COLUMN "deleted_at" TIMESTAMP(3);
CREATE INDEX "generated_textbook_sections_deleted_at_idx" ON "generated_textbook_sections"("deleted_at");

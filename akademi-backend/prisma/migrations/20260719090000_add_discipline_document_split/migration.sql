-- Traceability pointer from a per-course-code CCMAS document back to the department-wide
-- document it was split from (admin.service.ts's previewDisciplineDocumentSplit /
-- confirmDisciplineDocumentSplit). Additive/nullable only.

ALTER TABLE "discipline_documents"
  ADD COLUMN IF NOT EXISTS "split_from_document_id" TEXT;

CREATE INDEX IF NOT EXISTS "discipline_documents_split_from_document_id_idx" ON "discipline_documents"("split_from_document_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'discipline_documents_split_from_document_id_fkey'
  ) THEN
    ALTER TABLE "discipline_documents"
      ADD CONSTRAINT "discipline_documents_split_from_document_id_fkey" FOREIGN KEY ("split_from_document_id") REFERENCES "discipline_documents"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- Add nullable source_page_start/source_page_end to questions, tracking the (document-global) reader
-- page range a question was generated from. Additive and nullable only: existing rows stay NULL (there's
-- no reliable way to know which page old questions came from), and no existing behavior changes until
-- code starts writing/reading these columns for page-range-scoped CBT generation.

ALTER TABLE "questions"
ADD COLUMN IF NOT EXISTS "source_page_start" INTEGER,
ADD COLUMN IF NOT EXISTS "source_page_end" INTEGER;

CREATE INDEX IF NOT EXISTS "questions_material_id_source_page_start_source_page_end_idx" ON "questions"("material_id", "source_page_start", "source_page_end");

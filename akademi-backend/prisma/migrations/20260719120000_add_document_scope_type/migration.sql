-- National core (~70%, identical regardless of source school) vs. school-specific (~30%, each
-- school's own elective picks) scoping for discipline documents and their generated outlines.
-- Additive/nullable-only; NATIONAL_CORE default keeps every existing row valid as-is, no data
-- backfill required.

DO $$ BEGIN
  CREATE TYPE "DocumentScopeType" AS ENUM ('NATIONAL_CORE', 'SCHOOL_SPECIFIC');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "discipline_documents"
  ADD COLUMN IF NOT EXISTS "scope_type" "DocumentScopeType" NOT NULL DEFAULT 'NATIONAL_CORE',
  ADD COLUMN IF NOT EXISTS "university_id" TEXT;

CREATE INDEX IF NOT EXISTS "discipline_documents_course_code_source_type_scope_type_uni_idx" ON "discipline_documents"("course_code", "source_type", "scope_type", "university_id");

ALTER TABLE "generated_textbook_outlines"
  ADD COLUMN IF NOT EXISTS "scope_type" "DocumentScopeType" NOT NULL DEFAULT 'NATIONAL_CORE',
  ADD COLUMN IF NOT EXISTS "university_id" TEXT;

CREATE INDEX IF NOT EXISTS "generated_textbook_outlines_course_code_scope_type_uni_idx" ON "generated_textbook_outlines"("course_code", "scope_type", "university_id");

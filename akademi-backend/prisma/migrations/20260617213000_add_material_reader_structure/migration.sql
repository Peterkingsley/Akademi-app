ALTER TABLE "materials"
ADD COLUMN IF NOT EXISTS "reader_structure" JSONB;

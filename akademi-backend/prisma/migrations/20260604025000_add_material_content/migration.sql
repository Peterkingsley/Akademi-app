-- Add extracted text storage used by the MVP material ingestion pipeline.
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "content" TEXT;

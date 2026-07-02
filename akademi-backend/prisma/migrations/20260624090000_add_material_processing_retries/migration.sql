CREATE TYPE "MaterialProcessingStatus" AS ENUM ('UPLOADED', 'QUEUED', 'EXTRACTING', 'EXTRACTED', 'FAILED');

ALTER TABLE "materials"
ADD COLUMN "processing_status" "MaterialProcessingStatus" NOT NULL DEFAULT 'UPLOADED',
ADD COLUMN "processing_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "processing_error" TEXT,
ADD COLUMN "processing_started_at" TIMESTAMP(3),
ADD COLUMN "processing_completed_at" TIMESTAMP(3),
ADD COLUMN "next_retry_at" TIMESTAMP(3);

CREATE INDEX "materials_processing_status_next_retry_at_idx"
ON "materials"("processing_status", "next_retry_at");

ALTER TABLE "visual_cues"
ADD COLUMN "image_url" TEXT,
ADD COLUMN "image_key" TEXT,
ADD COLUMN "generation_status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN "generation_error" TEXT,
ADD COLUMN "generation_prompt" TEXT,
ADD COLUMN "generated_at" TIMESTAMP(3);

CREATE INDEX "visual_cues_generation_status_idx" ON "visual_cues"("generation_status");

ALTER TABLE "tutor_visual_assets"
ADD COLUMN "image_url" TEXT,
ADD COLUMN "image_key" TEXT,
ADD COLUMN "generation_status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN "generation_error" TEXT,
ADD COLUMN "generation_prompt" TEXT,
ADD COLUMN "generated_at" TIMESTAMP(3);

CREATE INDEX "tutor_visual_assets_generation_status_idx" ON "tutor_visual_assets"("generation_status");

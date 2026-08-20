CREATE TABLE "teaching_analysis_cache" (
  "id" TEXT NOT NULL,
  "cache_key" TEXT NOT NULL,
  "source_hash" TEXT NOT NULL,
  "material_id" TEXT,
  "learner_level" TEXT NOT NULL,
  "user_focus" TEXT,
  "prompt_version" TEXT NOT NULL,
  "analysis" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "teaching_analysis_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teaching_analysis_cache_cache_key_key" ON "teaching_analysis_cache"("cache_key");
CREATE INDEX "teaching_analysis_cache_material_id_idx" ON "teaching_analysis_cache"("material_id");
CREATE INDEX "teaching_analysis_cache_source_hash_idx" ON "teaching_analysis_cache"("source_hash");

CREATE TABLE "teaching_episodes" (
  "id" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "material_id" TEXT,
  "source_hash" TEXT NOT NULL,
  "complexity" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "request_config" JSONB NOT NULL,
  "analysis" JSONB NOT NULL,
  "blueprint" JSONB NOT NULL,
  "dialogue" JSONB NOT NULL,
  "fidelity_review" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "teaching_episodes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "teaching_episodes_requested_by_created_at_idx" ON "teaching_episodes"("requested_by", "created_at");
CREATE INDEX "teaching_episodes_material_id_idx" ON "teaching_episodes"("material_id");

-- Akademi Generated Textbooks — Phase A schema.
-- Additive/nullable-only, matching the repo's existing migration style. No destructive
-- changes, no required backfill of existing discipline_documents/materials rows.

-- Enums
DO $$ BEGIN
  CREATE TYPE "DisciplineDocumentSourceType" AS ENUM ('CCMAS', 'INTERNATIONAL_REFERENCE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OutlineNodeStatus" AS ENUM ('PENDING', 'GENERATING', 'GENERATED', 'FAILED_QUALITY_CHECK', 'ADMIN_QUEUED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- discipline_documents: source_type/reference_name/level, and (finally) a real course_code
-- scoping key via the new composite index. course_code itself already existed, unused.
ALTER TABLE "discipline_documents"
  ADD COLUMN IF NOT EXISTS "source_type" "DisciplineDocumentSourceType" NOT NULL DEFAULT 'CCMAS',
  ADD COLUMN IF NOT EXISTS "reference_name" TEXT,
  ADD COLUMN IF NOT EXISTS "level" INTEGER;

CREATE INDEX IF NOT EXISTS "discipline_documents_course_code_source_type_idx" ON "discipline_documents"("course_code", "source_type");

-- generated_textbook_outlines
CREATE TABLE IF NOT EXISTS "generated_textbook_outlines" (
    "id" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "ccmas_version" INTEGER NOT NULL,
    "ccmas_document_id" TEXT NOT NULL,
    "material_id" TEXT,
    "terminology_registry" JSONB NOT NULL DEFAULT '{}',
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_textbook_outlines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "generated_textbook_outlines_material_id_key" ON "generated_textbook_outlines"("material_id");
CREATE INDEX IF NOT EXISTS "generated_textbook_outlines_course_code_idx" ON "generated_textbook_outlines"("course_code");
CREATE INDEX IF NOT EXISTS "generated_textbook_outlines_course_code_is_current_idx" ON "generated_textbook_outlines"("course_code", "is_current");
CREATE INDEX IF NOT EXISTS "generated_textbook_outlines_ccmas_document_id_idx" ON "generated_textbook_outlines"("ccmas_document_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generated_textbook_outlines_ccmas_document_id_fkey'
  ) THEN
    ALTER TABLE "generated_textbook_outlines"
      ADD CONSTRAINT "generated_textbook_outlines_ccmas_document_id_fkey" FOREIGN KEY ("ccmas_document_id") REFERENCES "discipline_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generated_textbook_outlines_material_id_fkey'
  ) THEN
    ALTER TABLE "generated_textbook_outlines"
      ADD CONSTRAINT "generated_textbook_outlines_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- generated_textbook_outline_nodes
CREATE TABLE IF NOT EXISTS "generated_textbook_outline_nodes" (
    "id" TEXT NOT NULL,
    "outline_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "order_index" INTEGER NOT NULL,
    "depth" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "learning_outcome" TEXT NOT NULL,
    "is_international_addition" BOOLEAN NOT NULL DEFAULT false,
    "status" "OutlineNodeStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_textbook_outline_nodes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "generated_textbook_outline_nodes_outline_id_parent_id_order_idx" ON "generated_textbook_outline_nodes"("outline_id", "parent_id", "order_index");
CREATE INDEX IF NOT EXISTS "generated_textbook_outline_nodes_outline_id_status_idx" ON "generated_textbook_outline_nodes"("outline_id", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generated_textbook_outline_nodes_outline_id_fkey'
  ) THEN
    ALTER TABLE "generated_textbook_outline_nodes"
      ADD CONSTRAINT "generated_textbook_outline_nodes_outline_id_fkey" FOREIGN KEY ("outline_id") REFERENCES "generated_textbook_outlines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generated_textbook_outline_nodes_parent_id_fkey'
  ) THEN
    ALTER TABLE "generated_textbook_outline_nodes"
      ADD CONSTRAINT "generated_textbook_outline_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "generated_textbook_outline_nodes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

-- generated_textbook_sections
CREATE TABLE IF NOT EXISTS "generated_textbook_sections" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "needs_diagram" BOOLEAN NOT NULL DEFAULT false,
    "diagram_description" TEXT,
    "diagram_image_url" TEXT,
    "quality_check_passed" BOOLEAN NOT NULL DEFAULT false,
    "quality_check_notes" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_textbook_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "generated_textbook_sections_node_id_key" ON "generated_textbook_sections"("node_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generated_textbook_sections_node_id_fkey'
  ) THEN
    ALTER TABLE "generated_textbook_sections"
      ADD CONSTRAINT "generated_textbook_sections_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "generated_textbook_outline_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- materials: is_akademi_generated / generated_outline_id
ALTER TABLE "materials"
  ADD COLUMN IF NOT EXISTS "is_akademi_generated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "generated_outline_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "materials_generated_outline_id_key" ON "materials"("generated_outline_id");
CREATE INDEX IF NOT EXISTS "materials_course_code_is_akademi_generated_idx" ON "materials"("course_code", "is_akademi_generated");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'materials_generated_outline_id_fkey'
  ) THEN
    ALTER TABLE "materials"
      ADD CONSTRAINT "materials_generated_outline_id_fkey" FOREIGN KEY ("generated_outline_id") REFERENCES "generated_textbook_outlines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

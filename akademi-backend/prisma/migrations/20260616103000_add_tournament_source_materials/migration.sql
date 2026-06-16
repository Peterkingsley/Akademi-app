ALTER TABLE "tournaments" ADD COLUMN "source_material_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

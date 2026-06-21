ALTER TABLE "sessions"
ADD COLUMN "material_id" TEXT;

CREATE INDEX "sessions_material_id_idx" ON "sessions"("material_id");
CREATE INDEX "sessions_user_id_material_id_session_type_idx" ON "sessions"("user_id", "material_id", "session_type");

ALTER TABLE "sessions"
ADD CONSTRAINT "sessions_material_id_fkey"
FOREIGN KEY ("material_id") REFERENCES "materials"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

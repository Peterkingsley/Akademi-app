ALTER TABLE "materials"
ADD COLUMN IF NOT EXISTS "semester" INTEGER,
ADD COLUMN IF NOT EXISTS "semester_start" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "semester_end" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "academic_year" TEXT;

CREATE INDEX IF NOT EXISTS "materials_course_code_level_semester_idx"
ON "materials"("course_code", "level", "semester");

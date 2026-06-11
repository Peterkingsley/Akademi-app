ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "semester" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "source_url" TEXT;

CREATE INDEX IF NOT EXISTS "courses_level_semester_idx" ON "courses"("level", "semester");

CREATE TABLE IF NOT EXISTS "student_courses" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "department_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT,
  "level" INTEGER NOT NULL,
  "semester" INTEGER NOT NULL,
  "semester_start" TIMESTAMP(3) NOT NULL,
  "semester_end" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'student',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "student_courses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_courses_user_id_code_level_semester_key"
  ON "student_courses"("user_id", "code", "level", "semester");

CREATE INDEX IF NOT EXISTS "student_courses_department_id_level_semester_idx"
  ON "student_courses"("department_id", "level", "semester");

CREATE INDEX IF NOT EXISTS "student_courses_code_idx"
  ON "student_courses"("code");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_courses_user_id_fkey'
  ) THEN
    ALTER TABLE "student_courses"
      ADD CONSTRAINT "student_courses_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_courses_department_id_fkey'
  ) THEN
    ALTER TABLE "student_courses"
      ADD CONSTRAINT "student_courses_department_id_fkey"
      FOREIGN KEY ("department_id") REFERENCES "departments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

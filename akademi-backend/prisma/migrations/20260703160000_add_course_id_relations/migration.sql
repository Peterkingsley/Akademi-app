-- Add nullable course_id FK columns linking Material/Question/ExamPrepPlan to the Course catalog table.
-- course_code stays as-is (denormalized display cache); course_id is additive and best-effort backfilled
-- separately (see src/scripts/backfill-course-ids.ts). Existing behavior is unaffected until code starts
-- reading/writing course_id.

ALTER TABLE "materials"
ADD COLUMN IF NOT EXISTS "course_id" TEXT;

ALTER TABLE "questions"
ADD COLUMN IF NOT EXISTS "course_id" TEXT;

ALTER TABLE "exam_prep_plans"
ADD COLUMN IF NOT EXISTS "course_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'materials_course_id_fkey'
  ) THEN
    ALTER TABLE "materials"
      ADD CONSTRAINT "materials_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'questions_course_id_fkey'
  ) THEN
    ALTER TABLE "questions"
      ADD CONSTRAINT "questions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_prep_plans_course_id_fkey'
  ) THEN
    ALTER TABLE "exam_prep_plans"
      ADD CONSTRAINT "exam_prep_plans_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "materials_course_id_idx" ON "materials"("course_id");
CREATE INDEX IF NOT EXISTS "questions_course_id_idx" ON "questions"("course_id");
CREATE INDEX IF NOT EXISTS "exam_prep_plans_course_id_idx" ON "exam_prep_plans"("course_id");

-- exam_date becomes optional: plans can now exist before a date is chosen (course hub auto-provisions
-- a plan on first Mock Exam tap, ahead of the user picking a date via the "customize" screen).
ALTER TABLE "exam_prep_plans"
ALTER COLUMN "exam_date" DROP NOT NULL;

-- Consolidate any pre-existing duplicate (user_id, course_code) plans before enforcing uniqueness,
-- so get-or-create-by-course semantics are safe going forward. Keeps the most recently created plan
-- per pair and reassigns child rows (mock_exams, prep_tasks) from the discarded duplicates onto it.
DO $$
DECLARE
  keep_map RECORD;
BEGIN
  FOR keep_map IN
    SELECT user_id, course_code, (array_agg(id ORDER BY created_at DESC, id DESC))[1] AS keep_id
    FROM "exam_prep_plans"
    WHERE course_code IS NOT NULL
    GROUP BY user_id, course_code
    HAVING count(*) > 1
  LOOP
    UPDATE "mock_exams"
    SET plan_id = keep_map.keep_id
    WHERE plan_id IN (
      SELECT id FROM "exam_prep_plans"
      WHERE user_id = keep_map.user_id AND course_code = keep_map.course_code AND id <> keep_map.keep_id
    );

    UPDATE "prep_tasks"
    SET plan_id = keep_map.keep_id
    WHERE plan_id IN (
      SELECT id FROM "exam_prep_plans"
      WHERE user_id = keep_map.user_id AND course_code = keep_map.course_code AND id <> keep_map.keep_id
    );

    DELETE FROM "exam_prep_plans"
    WHERE user_id = keep_map.user_id AND course_code = keep_map.course_code AND id <> keep_map.keep_id;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_prep_plans_user_id_course_code_key'
  ) THEN
    ALTER TABLE "exam_prep_plans"
      ADD CONSTRAINT "exam_prep_plans_user_id_course_code_key" UNIQUE ("user_id", "course_code");
  END IF;
END $$;

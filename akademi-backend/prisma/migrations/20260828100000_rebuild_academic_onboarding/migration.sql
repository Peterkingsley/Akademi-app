ALTER TABLE "users"
  ALTER COLUMN "university" DROP NOT NULL,
  ALTER COLUMN "faculty" DROP NOT NULL,
  ALTER COLUMN "department" DROP NOT NULL,
  ALTER COLUMN "level" DROP NOT NULL,
  ADD COLUMN "phone_number" TEXT,
  ADD COLUMN "support_contact_opt_in" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "student_courses"
  ALTER COLUMN "semester" SET DEFAULT 1,
  ALTER COLUMN "semester_start" DROP NOT NULL,
  ALTER COLUMN "semester_end" DROP NOT NULL;

UPDATE "users"
SET "needs_onboarding" = false
WHERE "university" IS NOT NULL
  AND "faculty" IS NOT NULL
  AND "department" IS NOT NULL
  AND "level" IS NOT NULL;

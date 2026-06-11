ALTER TABLE "exam_prep_plans"
ADD COLUMN IF NOT EXISTS "assessment_type" TEXT NOT NULL DEFAULT 'EXAM';


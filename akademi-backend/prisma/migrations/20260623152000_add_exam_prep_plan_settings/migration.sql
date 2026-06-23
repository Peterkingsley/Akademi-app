ALTER TABLE "exam_prep_plans"
ADD COLUMN "duration_minutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN "objective_question_count" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN "theory_question_count" INTEGER NOT NULL DEFAULT 5;

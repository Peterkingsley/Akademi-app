CREATE TYPE "QuestionGenerationStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

ALTER TABLE "materials"
ADD COLUMN "question_generation_status" "QuestionGenerationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "question_generation_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "question_generation_error" TEXT,
ADD COLUMN "question_generation_started_at" TIMESTAMP(3),
ADD COLUMN "question_generation_completed_at" TIMESTAMP(3),
ADD COLUMN "question_generation_next_retry_at" TIMESTAMP(3);

CREATE INDEX "materials_question_generation_status_question_generation_next_retry_at_idx"
ON "materials"("question_generation_status", "question_generation_next_retry_at");

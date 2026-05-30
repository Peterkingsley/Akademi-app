-- AlterTable
ALTER TABLE "questions"
  ADD COLUMN IF NOT EXISTS "options" JSONB,
  ADD COLUMN IF NOT EXISTS "correct_answer" TEXT,
  ADD COLUMN IF NOT EXISTS "explanation" TEXT;

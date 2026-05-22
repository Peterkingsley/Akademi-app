-- AlterTable
ALTER TABLE "questions" ADD COLUMN "options" JSONB,
ADD COLUMN "correct_answer" TEXT,
ADD COLUMN "explanation" TEXT;

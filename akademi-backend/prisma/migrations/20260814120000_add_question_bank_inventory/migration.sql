CREATE TYPE "QuestionBankInventoryStatus" AS ENUM ('BUILDING', 'HEALTHY', 'LOW', 'REFILLING', 'FAILED', 'EXHAUSTED');
CREATE TYPE "QuestionType" AS ENUM ('RECALL', 'APPLICATION', 'CALCULATION', 'REASONING', 'MISCONCEPTION');

ALTER TABLE "materials"
ADD COLUMN "question_bank_inventory_status" "QuestionBankInventoryStatus" NOT NULL DEFAULT 'BUILDING',
ADD COLUMN "question_bank_last_refill_at" TIMESTAMP(3),
ADD COLUMN "question_bank_refill_cooldown_until" TIMESTAMP(3),
ADD COLUMN "question_bank_hour_window_started_at" TIMESTAMP(3),
ADD COLUMN "question_bank_hour_batch_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "materials_question_bank_inventory_status_question_bank_refill_cooldown_until_idx"
ON "materials"("question_bank_inventory_status", "question_bank_refill_cooldown_until");

ALTER TABLE "questions"
ADD COLUMN "question_type" "QuestionType" NOT NULL DEFAULT 'APPLICATION';

CREATE INDEX "questions_material_id_question_type_idx" ON "questions"("material_id", "question_type");

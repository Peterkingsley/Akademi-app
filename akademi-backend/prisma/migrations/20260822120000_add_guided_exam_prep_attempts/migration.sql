ALTER TABLE "question_attempts"
ADD COLUMN "session_id" TEXT,
ADD COLUMN "reasoning" TEXT,
ADD COLUMN "reasoning_quality" INTEGER,
ADD COLUMN "feedback_payload" JSONB;

CREATE INDEX "question_attempts_session_id_idx" ON "question_attempts"("session_id");

CREATE UNIQUE INDEX "question_attempts_session_id_question_id_key"
ON "question_attempts"("session_id", "question_id");

ALTER TABLE "question_attempts"
ADD CONSTRAINT "question_attempts_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "sessions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

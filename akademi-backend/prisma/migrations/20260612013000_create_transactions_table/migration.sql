CREATE TABLE IF NOT EXISTS "transactions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "feature" "Feature" NOT NULL,
  "plan" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "university" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "transactions_reference_key" ON "transactions"("reference");
CREATE INDEX IF NOT EXISTS "transactions_user_id_idx" ON "transactions"("user_id");
CREATE INDEX IF NOT EXISTS "transactions_status_created_at_idx" ON "transactions"("status", "created_at");

DO $$ BEGIN
  ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

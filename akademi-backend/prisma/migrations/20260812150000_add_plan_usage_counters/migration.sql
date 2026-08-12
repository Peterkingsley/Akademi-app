CREATE TYPE "UsageMetric" AS ENUM ('SOLVE_QUESTION', 'STUDY_ASK', 'CBT_SESSION', 'COMPETITION_ENTRY', 'AI_TUTOR_SECONDS');

CREATE TABLE "user_usage_counters" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "metric" "UsageMetric" NOT NULL,
  "period_key" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_usage_counters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_usage_counters_value_nonnegative" CHECK ("value" >= 0)
);

CREATE UNIQUE INDEX "user_usage_counters_user_id_metric_period_key_key" ON "user_usage_counters"("user_id", "metric", "period_key");
CREATE INDEX "user_usage_counters_user_id_period_key_idx" ON "user_usage_counters"("user_id", "period_key");
ALTER TABLE "user_usage_counters" ADD CONSTRAINT "user_usage_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

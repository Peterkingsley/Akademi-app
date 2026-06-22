CREATE TYPE "TournamentCampaignType" AS ENUM ('SIMPLE', 'MULTI_STAGE');
CREATE TYPE "TournamentStageStatus" AS ENUM ('SCHEDULED', 'CHECK_IN', 'LIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TournamentInterestType" AS ENUM ('PARTICIPANT', 'SPECTATOR');
CREATE TYPE "TournamentPredictionStatus" AS ENUM ('OPEN', 'LOCKED', 'CORRECT', 'INCORRECT', 'WINNER');

ALTER TABLE "tournaments"
ADD COLUMN "campaign_type" "TournamentCampaignType" NOT NULL DEFAULT 'SIMPLE',
ADD COLUMN "prediction_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "prediction_prize_summary" TEXT,
ADD COLUMN "prediction_winner_count" INTEGER,
ADD COLUMN "prediction_closes_at" TIMESTAMP(3),
ADD COLUMN "share_template" TEXT;

ALTER TABLE "tournament_entries"
ADD COLUMN "share_token" TEXT;

DROP INDEX IF EXISTS "competition_rooms_tournament_id_key";
CREATE INDEX IF NOT EXISTS "competition_rooms_tournament_id_idx" ON "competition_rooms"("tournament_id");

CREATE UNIQUE INDEX "tournament_entries_share_token_key" ON "tournament_entries"("share_token");

CREATE TABLE "tournament_stages" (
  "id" TEXT NOT NULL,
  "tournament_id" TEXT NOT NULL,
  "room_id" TEXT,
  "name" TEXT NOT NULL,
  "stage_order" INTEGER NOT NULL,
  "status" "TournamentStageStatus" NOT NULL DEFAULT 'SCHEDULED',
  "starts_at" TIMESTAMP(3) NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "question_timer_style" TEXT NOT NULL DEFAULT 'PER_QUESTION',
  "question_count" INTEGER NOT NULL,
  "question_timer_sec" INTEGER,
  "question_source" TEXT,
  "difficulty_level" TEXT,
  "qualification_count" INTEGER,
  "minimum_participants" INTEGER,
  "fallback_rule" TEXT,
  "result_visibility" TEXT NOT NULL DEFAULT 'QUALIFIERS',
  "qualification_locked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tournament_stages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tournament_stage_participants" (
  "id" TEXT NOT NULL,
  "stage_id" TEXT NOT NULL,
  "tournament_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "correct_answers" INTEGER NOT NULL DEFAULT 0,
  "wrong_answers" INTEGER NOT NULL DEFAULT 0,
  "average_response_ms" INTEGER,
  "rank" INTEGER,
  "qualified" BOOLEAN NOT NULL DEFAULT false,
  "eliminated" BOOLEAN NOT NULL DEFAULT false,
  "joined_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tournament_stage_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tournament_spectator_interests" (
  "id" TEXT NOT NULL,
  "tournament_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "interest_type" "TournamentInterestType" NOT NULL,
  "supporting_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tournament_spectator_interests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tournament_predictions" (
  "id" TEXT NOT NULL,
  "tournament_id" TEXT NOT NULL,
  "stage_id" TEXT,
  "user_id" TEXT NOT NULL,
  "predicted_user_id" TEXT NOT NULL,
  "status" "TournamentPredictionStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  CONSTRAINT "tournament_predictions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tournament_cheers" (
  "id" TEXT NOT NULL,
  "tournament_id" TEXT NOT NULL,
  "stage_id" TEXT,
  "spectator_user_id" TEXT NOT NULL,
  "participant_user_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tournament_cheers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tournament_stages_tournament_id_stage_order_key" ON "tournament_stages"("tournament_id", "stage_order");
CREATE UNIQUE INDEX "tournament_stages_room_id_key" ON "tournament_stages"("room_id");
CREATE INDEX "tournament_stages_tournament_id_idx" ON "tournament_stages"("tournament_id");
CREATE INDEX "tournament_stages_status_idx" ON "tournament_stages"("status");
CREATE INDEX "tournament_stages_starts_at_idx" ON "tournament_stages"("starts_at");

CREATE UNIQUE INDEX "tournament_stage_participants_stage_id_user_id_key" ON "tournament_stage_participants"("stage_id", "user_id");
CREATE INDEX "tournament_stage_participants_tournament_id_idx" ON "tournament_stage_participants"("tournament_id");
CREATE INDEX "tournament_stage_participants_user_id_idx" ON "tournament_stage_participants"("user_id");
CREATE INDEX "tournament_stage_participants_qualified_idx" ON "tournament_stage_participants"("qualified");

CREATE UNIQUE INDEX "tournament_spectator_interests_tournament_id_user_id_interest_type_key" ON "tournament_spectator_interests"("tournament_id", "user_id", "interest_type");
CREATE INDEX "tournament_spectator_interests_tournament_id_idx" ON "tournament_spectator_interests"("tournament_id");
CREATE INDEX "tournament_spectator_interests_user_id_idx" ON "tournament_spectator_interests"("user_id");

CREATE UNIQUE INDEX "tournament_predictions_tournament_id_stage_id_user_id_key" ON "tournament_predictions"("tournament_id", "stage_id", "user_id");
CREATE INDEX "tournament_predictions_tournament_id_idx" ON "tournament_predictions"("tournament_id");
CREATE INDEX "tournament_predictions_predicted_user_id_idx" ON "tournament_predictions"("predicted_user_id");

CREATE INDEX "tournament_cheers_tournament_id_idx" ON "tournament_cheers"("tournament_id");
CREATE INDEX "tournament_cheers_stage_id_idx" ON "tournament_cheers"("stage_id");
CREATE INDEX "tournament_cheers_spectator_user_id_participant_user_id_created_at_idx" ON "tournament_cheers"("spectator_user_id", "participant_user_id", "created_at");

ALTER TABLE "tournament_stages" ADD CONSTRAINT "tournament_stages_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_stages" ADD CONSTRAINT "tournament_stages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "competition_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tournament_stage_participants" ADD CONSTRAINT "tournament_stage_participants_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "tournament_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_stage_participants" ADD CONSTRAINT "tournament_stage_participants_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_stage_participants" ADD CONSTRAINT "tournament_stage_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tournament_spectator_interests" ADD CONSTRAINT "tournament_spectator_interests_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_spectator_interests" ADD CONSTRAINT "tournament_spectator_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tournament_predictions" ADD CONSTRAINT "tournament_predictions_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_predictions" ADD CONSTRAINT "tournament_predictions_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "tournament_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_predictions" ADD CONSTRAINT "tournament_predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_predictions" ADD CONSTRAINT "tournament_predictions_predicted_user_id_fkey" FOREIGN KEY ("predicted_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tournament_cheers" ADD CONSTRAINT "tournament_cheers_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_cheers" ADD CONSTRAINT "tournament_cheers_spectator_user_id_fkey" FOREIGN KEY ("spectator_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_cheers" ADD CONSTRAINT "tournament_cheers_participant_user_id_fkey" FOREIGN KEY ("participant_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

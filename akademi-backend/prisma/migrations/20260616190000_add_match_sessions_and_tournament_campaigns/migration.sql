CREATE TYPE "MatchSessionStatus" AS ENUM ('LIVE', 'FINISHED');

ALTER TABLE "tournaments"
ADD COLUMN "campaign_banner_url" TEXT,
ADD COLUMN "campaign_accent_color" TEXT,
ADD COLUMN "campaign_cta_label" TEXT,
ADD COLUMN "campaign_cta_url" TEXT,
ADD COLUMN "campaign_preheader" TEXT,
ADD COLUMN "late_join_cutoff_at" TIMESTAMP(3),
ADD COLUMN "check_in_opens_at" TIMESTAMP(3),
ADD COLUMN "check_in_closes_at" TIMESTAMP(3);

ALTER TABLE "tournament_entries"
ADD COLUMN "checked_in_at" TIMESTAMP(3);

CREATE TABLE "competition_match_sessions" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "status" "MatchSessionStatus" NOT NULL DEFAULT 'LIVE',
  "current_index" INTEGER NOT NULL DEFAULT 0,
  "question_started_at" TIMESTAMP(3) NOT NULL,
  "question_expires_at" TIMESTAMP(3) NOT NULL,
  "question_ids" JSONB NOT NULL DEFAULT '[]',
  "answered_user_ids" JSONB NOT NULL DEFAULT '{}',
  "scoreboard" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "competition_match_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "competition_match_sessions_room_id_key" ON "competition_match_sessions"("room_id");
CREATE INDEX "competition_match_sessions_status_idx" ON "competition_match_sessions"("status");

ALTER TABLE "competition_match_sessions"
ADD CONSTRAINT "competition_match_sessions_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "competition_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

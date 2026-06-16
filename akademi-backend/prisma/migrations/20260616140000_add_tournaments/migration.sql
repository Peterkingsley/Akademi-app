CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TournamentEntryStatus" AS ENUM ('REGISTERED', 'CHECKED_IN', 'ELIMINATED', 'WINNER');

CREATE TABLE "tournaments" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
  "format" "CompetitionFormat" NOT NULL DEFAULT 'SHARED_COURSE',
  "shared_course_code" TEXT,
  "question_count" INTEGER NOT NULL DEFAULT 10,
  "question_timer_sec" INTEGER NOT NULL DEFAULT 20,
  "max_participants" INTEGER,
  "prize_summary" TEXT,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "registration_closes_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "created_by_admin_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tournament_entries" (
  "id" TEXT NOT NULL,
  "tournament_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "status" "TournamentEntryStatus" NOT NULL DEFAULT 'REGISTERED',
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tournament_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tournament_entries_tournament_id_user_id_key" ON "tournament_entries"("tournament_id", "user_id");
CREATE INDEX "tournaments_status_idx" ON "tournaments"("status");
CREATE INDEX "tournaments_scheduled_at_idx" ON "tournaments"("scheduled_at");
CREATE INDEX "tournament_entries_user_id_idx" ON "tournament_entries"("user_id");
CREATE INDEX "tournament_entries_tournament_id_idx" ON "tournament_entries"("tournament_id");

ALTER TABLE "tournament_entries"
ADD CONSTRAINT "tournament_entries_tournament_id_fkey"
FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tournament_entries"
ADD CONSTRAINT "tournament_entries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "CompetitionVisibility" AS ENUM ('PRIVATE', 'PUBLIC', 'TOURNAMENT');
CREATE TYPE "CompetitionStatus" AS ENUM ('WAITING', 'LIVE', 'FINISHED', 'CANCELLED');
CREATE TYPE "CompetitionFormat" AS ENUM ('SHARED_COURSE', 'DUAL_COURSE');
CREATE TYPE "CompetitionParticipantStatus" AS ENUM ('INVITED', 'JOINED', 'READY', 'ELIMINATED', 'LEFT');

CREATE TABLE "competition_rooms" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "host_user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "visibility" "CompetitionVisibility" NOT NULL DEFAULT 'PRIVATE',
  "format" "CompetitionFormat" NOT NULL DEFAULT 'SHARED_COURSE',
  "status" "CompetitionStatus" NOT NULL DEFAULT 'WAITING',
  "max_participants" INTEGER NOT NULL DEFAULT 2,
  "question_count" INTEGER NOT NULL DEFAULT 10,
  "question_timer_sec" INTEGER NOT NULL DEFAULT 20,
  "shared_course_code" TEXT,
  "starts_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "winner_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "competition_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "competition_participants" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "course_code" TEXT,
  "score" INTEGER NOT NULL DEFAULT 0,
  "correct_answers" INTEGER NOT NULL DEFAULT 0,
  "wrong_answers" INTEGER NOT NULL DEFAULT 0,
  "average_response_ms" INTEGER,
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ready_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "status" "CompetitionParticipantStatus" NOT NULL DEFAULT 'JOINED',

  CONSTRAINT "competition_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "competition_rooms_code_key" ON "competition_rooms"("code");
CREATE INDEX "competition_rooms_host_user_id_idx" ON "competition_rooms"("host_user_id");
CREATE INDEX "competition_rooms_status_idx" ON "competition_rooms"("status");
CREATE INDEX "competition_rooms_visibility_idx" ON "competition_rooms"("visibility");
CREATE UNIQUE INDEX "competition_participants_room_id_user_id_key" ON "competition_participants"("room_id", "user_id");
CREATE INDEX "competition_participants_user_id_idx" ON "competition_participants"("user_id");
CREATE INDEX "competition_participants_room_id_idx" ON "competition_participants"("room_id");

ALTER TABLE "competition_rooms"
ADD CONSTRAINT "competition_rooms_host_user_id_fkey"
FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competition_participants"
ADD CONSTRAINT "competition_participants_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "competition_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competition_participants"
ADD CONSTRAINT "competition_participants_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

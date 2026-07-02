CREATE TYPE "TutorConfidenceBucket" AS ENUM ('MASTERY', 'PARTIAL', 'CONFUSED');

CREATE TABLE "tutor_session_states" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "current_topic" TEXT,
  "current_section_id" TEXT,
  "current_section_title" TEXT,
  "confidence_score" INTEGER NOT NULL DEFAULT 50,
  "confidence_bucket" "TutorConfidenceBucket" NOT NULL DEFAULT 'PARTIAL',
  "visuals_shown" JSONB NOT NULL DEFAULT '[]',
  "questions_asked" INTEGER NOT NULL DEFAULT 0,
  "lesson_plan" JSONB NOT NULL DEFAULT '[]',
  "last_decision" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tutor_session_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tutor_visual_assets" (
  "id" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "concept" TEXT NOT NULL,
  "course_code" TEXT,
  "department" TEXT,
  "difficulty" TEXT NOT NULL DEFAULT 'Beginner',
  "visual_type" TEXT NOT NULL,
  "render_mode" TEXT NOT NULL DEFAULT 'native',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "prerequisites" JSONB NOT NULL DEFAULT '[]',
  "created_by" TEXT NOT NULL DEFAULT 'AI_ORCHESTRATOR',
  "effectiveness_score" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "created_for_user_id" TEXT,
  "reuse_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tutor_visual_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tutor_confidence_events" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "student_input" TEXT NOT NULL,
  "confidence_score" INTEGER NOT NULL,
  "confidence_bucket" "TutorConfidenceBucket" NOT NULL,
  "decision" TEXT NOT NULL,
  "visual_triggered" BOOLEAN NOT NULL DEFAULT false,
  "current_section_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tutor_confidence_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tutor_session_states_session_id_key" ON "tutor_session_states"("session_id");
CREATE INDEX "tutor_session_states_confidence_bucket_idx" ON "tutor_session_states"("confidence_bucket");

CREATE INDEX "tutor_visual_assets_course_code_idx" ON "tutor_visual_assets"("course_code");
CREATE INDEX "tutor_visual_assets_department_idx" ON "tutor_visual_assets"("department");
CREATE INDEX "tutor_visual_assets_topic_idx" ON "tutor_visual_assets"("topic");
CREATE INDEX "tutor_visual_assets_concept_idx" ON "tutor_visual_assets"("concept");

CREATE INDEX "tutor_confidence_events_session_id_idx" ON "tutor_confidence_events"("session_id");
CREATE INDEX "tutor_confidence_events_user_id_idx" ON "tutor_confidence_events"("user_id");
CREATE INDEX "tutor_confidence_events_confidence_bucket_idx" ON "tutor_confidence_events"("confidence_bucket");

ALTER TABLE "tutor_session_states" ADD CONSTRAINT "tutor_session_states_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tutor_visual_assets" ADD CONSTRAINT "tutor_visual_assets_created_for_user_id_fkey" FOREIGN KEY ("created_for_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tutor_confidence_events" ADD CONSTRAINT "tutor_confidence_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tutor_confidence_events" ADD CONSTRAINT "tutor_confidence_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

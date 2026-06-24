CREATE TYPE "StudyCompanionPhase" AS ENUM (
  'MATERIAL_SELECTION_REQUIRED',
  'MATERIAL_SELECTED',
  'ROADMAP_GENERATED',
  'TEACHING_PASS_1_BIG_PICTURE',
  'TEACHING_PASS_2_DETAILS',
  'TEACHING_PASS_3_CONNECTIONS',
  'TEACHBACK_1_REQUESTED',
  'TEACHBACK_1_EVALUATION',
  'GAP_RETEACH',
  'TEACHBACK_2_REQUESTED',
  'TEACHBACK_2_EVALUATION',
  'MEMORY_DUMP_REQUESTED',
  'MEMORY_DUMP_EVALUATION',
  'MASTERY_PASSED',
  'MASTERY_FAILED',
  'SECTION_COMPLETED',
  'NEXT_SECTION_READY',
  'SESSION_COMPLETED'
);

CREATE TYPE "StudyRoadmapStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'NEEDS_REVIEW', 'MASTERED');
CREATE TYPE "MasteryStatus" AS ENUM ('PASSED', 'FAILED');

ALTER TABLE "sessions"
ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "study_companion_states" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "material_id" TEXT NOT NULL,
  "course_code" TEXT NOT NULL,
  "current_phase" "StudyCompanionPhase" NOT NULL DEFAULT 'MATERIAL_SELECTED',
  "current_section_index" INTEGER NOT NULL DEFAULT 0,
  "last_completed_index" INTEGER NOT NULL DEFAULT -1,
  "last_mastery_score" INTEGER,
  "mastery_threshold" INTEGER NOT NULL DEFAULT 80,
  "roadmap" JSONB NOT NULL DEFAULT '[]',
  "progress" JSONB NOT NULL DEFAULT '{}',
  "section_context" JSONB NOT NULL DEFAULT '{}',
  "refresh_question" TEXT,
  "refresh_answer" TEXT,
  "pending_prompt" TEXT,
  "session_summary" TEXT,
  "external_support_used" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "study_companion_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teachback_attempts" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "companion_state_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "material_id" TEXT NOT NULL,
  "section_index" INTEGER NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "phase" "StudyCompanionPhase" NOT NULL,
  "prompt" TEXT,
  "student_response" TEXT NOT NULL,
  "evaluation" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "passed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teachback_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "memory_dump_attempts" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "companion_state_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "material_id" TEXT NOT NULL,
  "section_index" INTEGER NOT NULL,
  "prompt" TEXT,
  "student_response" TEXT NOT NULL,
  "evaluation" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "memory_dump_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mastery_records" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "companion_state_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "material_id" TEXT NOT NULL,
  "course_code" TEXT NOT NULL,
  "section_index" INTEGER NOT NULL,
  "section_title" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "status" "MasteryStatus" NOT NULL,
  "failed_concepts" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mastery_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "study_companion_states_session_id_key" ON "study_companion_states"("session_id");
CREATE INDEX "study_companion_states_user_id_material_id_course_code_idx" ON "study_companion_states"("user_id", "material_id", "course_code");
CREATE INDEX "study_companion_states_current_phase_idx" ON "study_companion_states"("current_phase");

CREATE INDEX "teachback_attempts_session_id_section_index_attempt_number_idx" ON "teachback_attempts"("session_id", "section_index", "attempt_number");
CREATE INDEX "teachback_attempts_companion_state_id_section_index_idx" ON "teachback_attempts"("companion_state_id", "section_index");

CREATE INDEX "memory_dump_attempts_session_id_section_index_idx" ON "memory_dump_attempts"("session_id", "section_index");
CREATE INDEX "memory_dump_attempts_companion_state_id_section_index_idx" ON "memory_dump_attempts"("companion_state_id", "section_index");

CREATE INDEX "mastery_records_user_id_course_code_material_id_idx" ON "mastery_records"("user_id", "course_code", "material_id");
CREATE INDEX "mastery_records_companion_state_id_section_index_idx" ON "mastery_records"("companion_state_id", "section_index");

ALTER TABLE "study_companion_states"
ADD CONSTRAINT "study_companion_states_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_companion_states"
ADD CONSTRAINT "study_companion_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_companion_states"
ADD CONSTRAINT "study_companion_states_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teachback_attempts"
ADD CONSTRAINT "teachback_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teachback_attempts"
ADD CONSTRAINT "teachback_attempts_companion_state_id_fkey" FOREIGN KEY ("companion_state_id") REFERENCES "study_companion_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teachback_attempts"
ADD CONSTRAINT "teachback_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teachback_attempts"
ADD CONSTRAINT "teachback_attempts_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "memory_dump_attempts"
ADD CONSTRAINT "memory_dump_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_dump_attempts"
ADD CONSTRAINT "memory_dump_attempts_companion_state_id_fkey" FOREIGN KEY ("companion_state_id") REFERENCES "study_companion_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_dump_attempts"
ADD CONSTRAINT "memory_dump_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_dump_attempts"
ADD CONSTRAINT "memory_dump_attempts_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mastery_records"
ADD CONSTRAINT "mastery_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mastery_records"
ADD CONSTRAINT "mastery_records_companion_state_id_fkey" FOREIGN KEY ("companion_state_id") REFERENCES "study_companion_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mastery_records"
ADD CONSTRAINT "mastery_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mastery_records"
ADD CONSTRAINT "mastery_records_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

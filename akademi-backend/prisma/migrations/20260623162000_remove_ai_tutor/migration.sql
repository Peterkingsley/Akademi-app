DROP TABLE IF EXISTS "visual_cues" CASCADE;
DROP TABLE IF EXISTS "lesson_segments" CASCADE;
DROP TABLE IF EXISTS "tutor_confidence_events" CASCADE;
DROP TABLE IF EXISTS "tutor_session_states" CASCADE;
DROP TABLE IF EXISTS "tutor_visual_assets" CASCADE;

DELETE FROM "messages"
WHERE "session_id" IN (
  SELECT "id" FROM "sessions" WHERE "session_type" = 'TUTOR'
);

DELETE FROM "sessions"
WHERE "session_type" = 'TUTOR';

ALTER TYPE "SessionType" RENAME TO "SessionType_old";
CREATE TYPE "SessionType" AS ENUM ('ASSIGNMENT', 'STUDY', 'EXAM_PREP');
ALTER TABLE "sessions"
  ALTER COLUMN "session_type" TYPE "SessionType"
  USING "session_type"::text::"SessionType";
DROP TYPE "SessionType_old";

ALTER TYPE "Feature" RENAME TO "Feature_old";
CREATE TYPE "Feature" AS ENUM ('ASSIGNMENT_SOLVING', 'EXAM_PREP', 'QUESTION_REPLY', 'WRONGLY_REPLY');
DELETE FROM "feature_access" WHERE "feature" = 'LIVE_TUTORING';
DELETE FROM "transactions" WHERE "feature" = 'LIVE_TUTORING';
ALTER TABLE "feature_access"
  ALTER COLUMN "feature" TYPE "Feature"
  USING "feature"::text::"Feature";
ALTER TABLE "transactions"
  ALTER COLUMN "feature" TYPE "Feature"
  USING "feature"::text::"Feature";
DROP TYPE "Feature_old";

DROP TYPE IF EXISTS "TutorConfidenceBucket";

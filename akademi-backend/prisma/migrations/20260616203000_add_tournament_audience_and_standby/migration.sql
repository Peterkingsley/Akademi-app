CREATE TYPE "TournamentAudienceScope" AS ENUM ('EVERYONE', 'UNIVERSITY', 'FACULTY', 'DEPARTMENT');

ALTER TYPE "TournamentEntryStatus" ADD VALUE IF NOT EXISTS 'STANDBY';

ALTER TABLE "tournaments"
ADD COLUMN "audience_scope" "TournamentAudienceScope" NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN "audience_university" TEXT,
ADD COLUMN "audience_faculty" TEXT,
ADD COLUMN "audience_department" TEXT;

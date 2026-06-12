DO $$ BEGIN
  CREATE TYPE "AdminStatus" AS ENUM ('active', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "admins"
ADD COLUMN IF NOT EXISTS "status" "AdminStatus" NOT NULL DEFAULT 'active';

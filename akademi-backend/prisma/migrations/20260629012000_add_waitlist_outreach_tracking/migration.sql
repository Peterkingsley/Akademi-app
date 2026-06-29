ALTER TABLE "waitlist_entries"
ADD COLUMN IF NOT EXISTS "faculty" TEXT,
ADD COLUMN IF NOT EXISTS "first_invited_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "last_invited_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "invite_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "last_invited_by" TEXT;

CREATE INDEX IF NOT EXISTS "waitlist_entries_faculty_idx" ON "waitlist_entries"("faculty");
CREATE INDEX IF NOT EXISTS "waitlist_entries_invite_count_idx" ON "waitlist_entries"("invite_count");

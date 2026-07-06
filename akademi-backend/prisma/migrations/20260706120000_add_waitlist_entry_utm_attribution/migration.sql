ALTER TABLE "waitlist_entries"
  ADD COLUMN IF NOT EXISTS "utm_source" TEXT,
  ADD COLUMN IF NOT EXISTS "utm_medium" TEXT,
  ADD COLUMN IF NOT EXISTS "utm_campaign" TEXT;

CREATE INDEX IF NOT EXISTS "waitlist_entries_utm_source_idx" ON "waitlist_entries"("utm_source");

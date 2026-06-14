CREATE TABLE IF NOT EXISTS "waitlist_entries" (
  "id" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "university" TEXT,
  "department" TEXT,
  "level" INTEGER,
  "main_struggle" TEXT,
  "source" TEXT NOT NULL DEFAULT 'landing_page',
  "status" TEXT NOT NULL DEFAULT 'WAITLISTED',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_entries_email_key" ON "waitlist_entries"("email");
CREATE INDEX IF NOT EXISTS "waitlist_entries_email_idx" ON "waitlist_entries"("email");
CREATE INDEX IF NOT EXISTS "waitlist_entries_university_idx" ON "waitlist_entries"("university");
CREATE INDEX IF NOT EXISTS "waitlist_entries_department_idx" ON "waitlist_entries"("department");
CREATE INDEX IF NOT EXISTS "waitlist_entries_created_at_idx" ON "waitlist_entries"("created_at");

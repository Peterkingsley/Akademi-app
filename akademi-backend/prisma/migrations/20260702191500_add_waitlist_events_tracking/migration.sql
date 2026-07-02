CREATE TABLE IF NOT EXISTS "waitlist_events" (
  "id" TEXT NOT NULL,
  "event_name" TEXT NOT NULL,
  "visitor_id" TEXT NOT NULL,
  "session_id" TEXT,
  "page_url" TEXT,
  "page_path" TEXT,
  "referrer" TEXT,
  "utm_source" TEXT,
  "utm_medium" TEXT,
  "utm_campaign" TEXT,
  "utm_content" TEXT,
  "utm_term" TEXT,
  "school_query" TEXT,
  "school_name" TEXT,
  "ip_hash" TEXT,
  "user_agent" TEXT,
  "device_type" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "waitlist_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "waitlist_events_event_name_idx" ON "waitlist_events"("event_name");
CREATE INDEX IF NOT EXISTS "waitlist_events_visitor_id_idx" ON "waitlist_events"("visitor_id");
CREATE INDEX IF NOT EXISTS "waitlist_events_session_id_idx" ON "waitlist_events"("session_id");
CREATE INDEX IF NOT EXISTS "waitlist_events_page_path_idx" ON "waitlist_events"("page_path");
CREATE INDEX IF NOT EXISTS "waitlist_events_utm_source_idx" ON "waitlist_events"("utm_source");
CREATE INDEX IF NOT EXISTS "waitlist_events_school_query_idx" ON "waitlist_events"("school_query");
CREATE INDEX IF NOT EXISTS "waitlist_events_school_name_idx" ON "waitlist_events"("school_name");
CREATE INDEX IF NOT EXISTS "waitlist_events_created_at_idx" ON "waitlist_events"("created_at");

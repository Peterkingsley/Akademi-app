CREATE TABLE IF NOT EXISTS "university_requests" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "university_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "university_requests_created_at_idx" ON "university_requests"("created_at");

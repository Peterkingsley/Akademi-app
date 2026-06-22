-- CreateTable
CREATE TABLE "paystack_webhook_logs" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paystack_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_segments" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "message_id" TEXT,
    "concept_title" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "estimated_duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visual_cues" (
    "id" TEXT NOT NULL,
    "segment_id" TEXT NOT NULL,
    "visual_type" TEXT NOT NULL,
    "render_mode" TEXT NOT NULL,
    "start_ms" INTEGER NOT NULL,
    "end_ms" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visual_cues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_segments_session_id_idx" ON "lesson_segments"("session_id");

-- CreateIndex
CREATE INDEX "lesson_segments_message_id_idx" ON "lesson_segments"("message_id");

-- CreateIndex
CREATE INDEX "visual_cues_segment_id_idx" ON "visual_cues"("segment_id");

-- AddForeignKey
ALTER TABLE "lesson_segments" ADD CONSTRAINT "lesson_segments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_segments" ADD CONSTRAINT "lesson_segments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visual_cues" ADD CONSTRAINT "visual_cues_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "lesson_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lesson_segments"
ADD COLUMN "caption_chunks" JSONB NOT NULL DEFAULT '[]';

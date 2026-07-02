CREATE TABLE "tutor_turn_traces" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT,
    "course_code" TEXT,
    "section_index" INTEGER,
    "section_title" TEXT,
    "phase" TEXT NOT NULL,
    "turn_type" TEXT,
    "action" TEXT,
    "teacher_brain_used" BOOLEAN NOT NULL DEFAULT false,
    "student_memory_used" BOOLEAN NOT NULL DEFAULT false,
    "lesson_plan_used" BOOLEAN NOT NULL DEFAULT false,
    "relevant_material_used" BOOLEAN NOT NULL DEFAULT false,
    "calculation_context_used" BOOLEAN NOT NULL DEFAULT false,
    "diagram_context_used" BOOLEAN NOT NULL DEFAULT false,
    "quality_guardrail_used" BOOLEAN NOT NULL DEFAULT false,
    "quality_issues" JSONB NOT NULL DEFAULT '[]',
    "prompt_tokens_estimate" INTEGER,
    "response_chars" INTEGER,
    "latency_ms" INTEGER,
    "ai_latency_ms" INTEGER,
    "error_message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_turn_traces_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tutor_turn_traces_session_id_idx" ON "tutor_turn_traces"("session_id");
CREATE INDEX "tutor_turn_traces_user_id_material_id_idx" ON "tutor_turn_traces"("user_id", "material_id");
CREATE INDEX "tutor_turn_traces_phase_idx" ON "tutor_turn_traces"("phase");
CREATE INDEX "tutor_turn_traces_created_at_idx" ON "tutor_turn_traces"("created_at");

ALTER TABLE "tutor_turn_traces" ADD CONSTRAINT "tutor_turn_traces_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tutor_turn_traces" ADD CONSTRAINT "tutor_turn_traces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tutor_turn_traces" ADD CONSTRAINT "tutor_turn_traces_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

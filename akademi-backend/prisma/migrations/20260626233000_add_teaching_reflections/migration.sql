CREATE TABLE "teaching_reflections" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "companion_state_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "section_index" INTEGER NOT NULL,
    "section_title" TEXT NOT NULL,
    "strategy_used" TEXT,
    "pace_used" TEXT,
    "repair_mode_used" TEXT,
    "analogy_used" BOOLEAN NOT NULL DEFAULT false,
    "worked_example_used" BOOLEAN NOT NULL DEFAULT false,
    "visual_explanation_used" BOOLEAN NOT NULL DEFAULT false,
    "calculation_steps_used" BOOLEAN NOT NULL DEFAULT false,
    "exam_framing_used" BOOLEAN NOT NULL DEFAULT false,
    "challenge_used" BOOLEAN NOT NULL DEFAULT false,
    "mastery_score" INTEGER,
    "concept_understanding" INTEGER,
    "procedural_accuracy" INTEGER,
    "reasoning_quality" INTEGER,
    "confidence" INTEGER,
    "hidden_confusion_risk" INTEGER,
    "what_worked" JSONB NOT NULL DEFAULT '[]',
    "what_failed" JSONB NOT NULL DEFAULT '[]',
    "recommended_next_strategy" TEXT,
    "recommended_next_pace" TEXT,
    "recommended_interventions" JSONB NOT NULL DEFAULT '[]',
    "compressed_reflection" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teaching_reflections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "teaching_reflections_user_id_material_id_course_code_idx" ON "teaching_reflections"("user_id", "material_id", "course_code");
CREATE INDEX "teaching_reflections_session_id_section_index_idx" ON "teaching_reflections"("session_id", "section_index");
CREATE INDEX "teaching_reflections_strategy_used_idx" ON "teaching_reflections"("strategy_used");

ALTER TABLE "teaching_reflections" ADD CONSTRAINT "teaching_reflections_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teaching_reflections" ADD CONSTRAINT "teaching_reflections_companion_state_id_fkey" FOREIGN KEY ("companion_state_id") REFERENCES "study_companion_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teaching_reflections" ADD CONSTRAINT "teaching_reflections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teaching_reflections" ADD CONSTRAINT "teaching_reflections_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

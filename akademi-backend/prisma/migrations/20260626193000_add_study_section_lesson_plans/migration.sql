CREATE TABLE "study_section_lesson_plans" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "companion_state_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "section_index" INTEGER NOT NULL,
    "section_title" TEXT NOT NULL,
    "lesson_objective" TEXT NOT NULL,
    "prerequisite_refresh" JSONB NOT NULL DEFAULT '[]',
    "teaching_sequence" JSONB NOT NULL DEFAULT '[]',
    "analogy_plan" JSONB NOT NULL DEFAULT '[]',
    "calculation_plan" JSONB NOT NULL DEFAULT '[]',
    "diagram_plan" JSONB NOT NULL DEFAULT '[]',
    "checkpoint_focus" JSONB NOT NULL DEFAULT '[]',
    "exam_focus" JSONB NOT NULL DEFAULT '[]',
    "fallback_plan" JSONB NOT NULL DEFAULT '[]',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_section_lesson_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "study_section_lesson_plans_session_id_section_index_idx" ON "study_section_lesson_plans"("session_id", "section_index");
CREATE INDEX "study_section_lesson_plans_user_id_material_id_course_code_idx" ON "study_section_lesson_plans"("user_id", "material_id", "course_code");

ALTER TABLE "study_section_lesson_plans" ADD CONSTRAINT "study_section_lesson_plans_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_section_lesson_plans" ADD CONSTRAINT "study_section_lesson_plans_companion_state_id_fkey" FOREIGN KEY ("companion_state_id") REFERENCES "study_companion_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_section_lesson_plans" ADD CONSTRAINT "study_section_lesson_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_section_lesson_plans" ADD CONSTRAINT "study_section_lesson_plans_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

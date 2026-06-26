CREATE TABLE "learning_intelligence_records" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "companion_state_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "section_index" INTEGER NOT NULL,
    "section_title" TEXT NOT NULL,
    "mastery_score" INTEGER,
    "concept_understanding" INTEGER NOT NULL DEFAULT 50,
    "procedural_accuracy" INTEGER NOT NULL DEFAULT 50,
    "reasoning_quality" INTEGER NOT NULL DEFAULT 50,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "hidden_confusion_risk" INTEGER NOT NULL DEFAULT 50,
    "retention_risk" INTEGER NOT NULL DEFAULT 50,
    "calculation_weakness" BOOLEAN NOT NULL DEFAULT false,
    "diagram_weakness" BOOLEAN NOT NULL DEFAULT false,
    "prerequisite_weakness" BOOLEAN NOT NULL DEFAULT false,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "recommended_action" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_intelligence_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "learning_intelligence_records_user_id_material_id_course_code_idx" ON "learning_intelligence_records"("user_id", "material_id", "course_code");
CREATE INDEX "learning_intelligence_records_session_id_section_index_idx" ON "learning_intelligence_records"("session_id", "section_index");
CREATE INDEX "learning_intelligence_records_hidden_confusion_risk_idx" ON "learning_intelligence_records"("hidden_confusion_risk");
CREATE INDEX "learning_intelligence_records_retention_risk_idx" ON "learning_intelligence_records"("retention_risk");

ALTER TABLE "learning_intelligence_records" ADD CONSTRAINT "learning_intelligence_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_intelligence_records" ADD CONSTRAINT "learning_intelligence_records_companion_state_id_fkey" FOREIGN KEY ("companion_state_id") REFERENCES "study_companion_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_intelligence_records" ADD CONSTRAINT "learning_intelligence_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_intelligence_records" ADD CONSTRAINT "learning_intelligence_records_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "lecturer_teaching_constraints" (
    "id" TEXT NOT NULL,
    "material_id" TEXT,
    "course_code" TEXT,
    "university" TEXT,
    "faculty" TEXT,
    "department" TEXT,
    "level" INTEGER,
    "semester" INTEGER,
    "created_by" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "required_order" JSONB NOT NULL DEFAULT '[]',
    "must_cover_topics" JSONB NOT NULL DEFAULT '[]',
    "do_not_skip_topics" JSONB NOT NULL DEFAULT '[]',
    "preferred_terminology" JSONB NOT NULL DEFAULT '{}',
    "required_methods" JSONB NOT NULL DEFAULT '[]',
    "forbidden_methods" JSONB NOT NULL DEFAULT '[]',
    "assessment_focus" JSONB NOT NULL DEFAULT '[]',
    "unit_policy" TEXT,
    "proof_policy" TEXT,
    "calculation_policy" TEXT,
    "diagram_policy" TEXT,
    "strictness" TEXT NOT NULL DEFAULT 'medium',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lecturer_teaching_constraints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lecturer_teaching_constraints_material_id_idx" ON "lecturer_teaching_constraints"("material_id");
CREATE INDEX "lecturer_teaching_constraints_course_code_university_department_idx" ON "lecturer_teaching_constraints"("course_code", "university", "department");
CREATE INDEX "lecturer_teaching_constraints_created_by_idx" ON "lecturer_teaching_constraints"("created_by");
CREATE INDEX "lecturer_teaching_constraints_is_active_idx" ON "lecturer_teaching_constraints"("is_active");

ALTER TABLE "lecturer_teaching_constraints"
ADD CONSTRAINT "lecturer_teaching_constraints_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lecturer_teaching_constraints"
ADD CONSTRAINT "lecturer_teaching_constraints_material_id_fkey"
FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

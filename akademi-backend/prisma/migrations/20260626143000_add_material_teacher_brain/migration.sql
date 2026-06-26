-- CreateTable
CREATE TABLE "material_teacher_brains" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "course_code" TEXT,
    "university" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "chapter_summaries" JSONB NOT NULL DEFAULT '[]',
    "concept_graph" JSONB NOT NULL DEFAULT '[]',
    "prerequisites" JSONB NOT NULL DEFAULT '[]',
    "formulas" JSONB NOT NULL DEFAULT '[]',
    "calculation_methods" JSONB NOT NULL DEFAULT '[]',
    "diagrams" JSONB NOT NULL DEFAULT '[]',
    "misconceptions" JSONB NOT NULL DEFAULT '[]',
    "exam_angles" JSONB NOT NULL DEFAULT '[]',
    "teacher_notes" JSONB NOT NULL DEFAULT '{}',
    "subject_family" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_teacher_brains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_teacher_brains_material_id_key" ON "material_teacher_brains"("material_id");

-- CreateIndex
CREATE INDEX "material_teacher_brains_course_code_idx" ON "material_teacher_brains"("course_code");

-- CreateIndex
CREATE INDEX "material_teacher_brains_department_idx" ON "material_teacher_brains"("department");

-- CreateIndex
CREATE INDEX "material_teacher_brains_subject_family_idx" ON "material_teacher_brains"("subject_family");

-- AddForeignKey
ALTER TABLE "material_teacher_brains" ADD CONSTRAINT "material_teacher_brains_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

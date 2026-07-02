-- CreateTable
CREATE TABLE "student_material_memories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "section_index" INTEGER NOT NULL,
    "section_title" TEXT NOT NULL,
    "mastered" BOOLEAN NOT NULL DEFAULT false,
    "mastery_score" INTEGER,
    "understood" JSONB NOT NULL DEFAULT '[]',
    "weak_points" JSONB NOT NULL DEFAULT '[]',
    "misconceptions" JSONB NOT NULL DEFAULT '[]',
    "calculation_issues" JSONB NOT NULL DEFAULT '[]',
    "diagram_issues" JSONB NOT NULL DEFAULT '[]',
    "preferred_explanation_style" TEXT,
    "revisit_later" JSONB NOT NULL DEFAULT '[]',
    "compressed_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_material_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_material_memories_user_id_material_id_course_code_idx" ON "student_material_memories"("user_id", "material_id", "course_code");

-- CreateIndex
CREATE INDEX "student_material_memories_user_id_material_id_section_index_idx" ON "student_material_memories"("user_id", "material_id", "section_index");

-- AddForeignKey
ALTER TABLE "student_material_memories" ADD CONSTRAINT "student_material_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_material_memories" ADD CONSTRAINT "student_material_memories_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

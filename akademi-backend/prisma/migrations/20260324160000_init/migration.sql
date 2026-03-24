-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "VocabularyLevel" AS ENUM ('BASIC', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ReplyMode" AS ENUM ('DIRECT', 'STUDY', 'QUESTION', 'WRONGLY');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('ASSIGNMENT', 'STUDY', 'TUTOR', 'EXAM_PREP');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('STUDENT', 'AI');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('PDF', 'IMAGE', 'DOC');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FLAGGED', 'TAKEN_DOWN');

-- CreateEnum
CREATE TYPE "ChunkStatus" AS ENUM ('PENDING', 'UPLOADED', 'ASSEMBLED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "Feature" AS ENUM ('ASSIGNMENT_SOLVING', 'LIVE_TUTORING', 'EXAM_PREP', 'QUESTION_REPLY', 'WRONGLY_REPLY');

-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('TIME_WINDOW', 'USE_BASED', 'FREE_TRIAL');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "university" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "profile_photo_url" TEXT,
    "auth_provider" "AuthProvider" NOT NULL DEFAULT 'EMAIL',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" TEXT,
    "verification_token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningProfile" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subject_strengths" JSONB NOT NULL DEFAULT '{}',
    "subject_weaknesses" JSONB NOT NULL DEFAULT '{}',
    "preferred_reply_mode" "ReplyMode",
    "question_patterns" JSONB NOT NULL DEFAULT '{}',
    "vocabulary_level" "VocabularyLevel" NOT NULL DEFAULT 'BASIC',
    "session_count" INTEGER NOT NULL DEFAULT 0,
    "last_active" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPattern" (
    "id" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "question_pattern" JSONB NOT NULL DEFAULT '{}',
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "file_ref" TEXT NOT NULL,
    "file_type" "FileType" NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "upload_count" INTEGER NOT NULL DEFAULT 1,
    "contributor_ids" JSONB NOT NULL DEFAULT '[]',
    "verified_at" TIMESTAMP(3),
    "uploaded_by" TEXT NOT NULL,
    "admin_reviewed_by" TEXT,
    "admin_reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialEmbedding" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadChunk" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "chunk_ref" TEXT NOT NULL,
    "total_chunks" INTEGER NOT NULL,
    "status" "ChunkStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_type" "SessionType" NOT NULL,
    "reply_mode" "ReplyMode",
    "course_code" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "reply_mode" "ReplyMode",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "approach_guide" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureAccess" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feature" "Feature" NOT NULL,
    "access_type" "AccessType" NOT NULL,
    "expires_at" TIMESTAMP(3),
    "uses_remaining" INTEGER,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_ref" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FeatureAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'MODERATOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3),

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "device_type" "DeviceType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplineDocument" (
    "id" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "course_code" TEXT,
    "document_ref" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "last_updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DisciplineDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamPrepPlan" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "exam_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamPrepPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepTask" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExam" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockAttempt" (
    "id" TEXT NOT NULL,
    "mock_exam_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "MockAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAttempt" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MockExamToQuestion" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MockExamToQuestion_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_university_idx" ON "User"("university");

-- CreateIndex
CREATE INDEX "User_department_idx" ON "User"("department");

-- CreateIndex
CREATE UNIQUE INDEX "LearningProfile_user_id_key" ON "LearningProfile"("user_id");

-- CreateIndex
CREATE INDEX "CommunityPattern_department_idx" ON "CommunityPattern"("department");

-- CreateIndex
CREATE INDEX "CommunityPattern_course_code_idx" ON "CommunityPattern"("course_code");

-- CreateIndex
CREATE INDEX "Material_course_code_idx" ON "Material"("course_code");

-- CreateIndex
CREATE INDEX "Material_university_idx" ON "Material"("university");

-- CreateIndex
CREATE INDEX "Material_department_idx" ON "Material"("department");

-- CreateIndex
CREATE INDEX "Material_level_idx" ON "Material"("level");

-- CreateIndex
CREATE INDEX "Material_verification_status_idx" ON "Material"("verification_status");

-- CreateIndex
CREATE INDEX "Session_user_id_idx" ON "Session"("user_id");

-- CreateIndex
CREATE INDEX "Session_course_code_idx" ON "Session"("course_code");

-- CreateIndex
CREATE INDEX "Message_session_id_idx" ON "Message"("session_id");

-- CreateIndex
CREATE INDEX "Question_course_code_idx" ON "Question"("course_code");

-- CreateIndex
CREATE INDEX "Question_department_idx" ON "Question"("department");

-- CreateIndex
CREATE INDEX "Question_difficulty_idx" ON "Question"("difficulty");

-- CreateIndex
CREATE INDEX "FeatureAccess_user_id_idx" ON "FeatureAccess"("user_id");

-- CreateIndex
CREATE INDEX "FeatureAccess_feature_idx" ON "FeatureAccess"("feature");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "RefreshToken_user_id_idx" ON "RefreshToken"("user_id");

-- CreateIndex
CREATE INDEX "RefreshToken_is_active_idx" ON "RefreshToken"("is_active");

-- CreateIndex
CREATE INDEX "DisciplineDocument_department_idx" ON "DisciplineDocument"("department");

-- CreateIndex
CREATE INDEX "DisciplineDocument_course_code_idx" ON "DisciplineDocument"("course_code");

-- CreateIndex
CREATE INDEX "DisciplineDocument_is_active_idx" ON "DisciplineDocument"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "University_name_key" ON "University"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_university_id_key" ON "Department"("name", "university_id");

-- CreateIndex
CREATE INDEX "ExamPrepPlan_user_id_idx" ON "ExamPrepPlan"("user_id");

-- CreateIndex
CREATE INDEX "_MockExamToQuestion_B_index" ON "_MockExamToQuestion"("B");

-- AddForeignKey
ALTER TABLE "LearningProfile" ADD CONSTRAINT "LearningProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialEmbedding" ADD CONSTRAINT "MaterialEmbedding_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadChunk" ADD CONSTRAINT "UploadChunk_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureAccess" ADD CONSTRAINT "FeatureAccess_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamPrepPlan" ADD CONSTRAINT "ExamPrepPlan_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepTask" ADD CONSTRAINT "PrepTask_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "ExamPrepPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "ExamPrepPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockAttempt" ADD CONSTRAINT "MockAttempt_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockAttempt" ADD CONSTRAINT "MockAttempt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MockExamToQuestion" ADD CONSTRAINT "_MockExamToQuestion_A_fkey" FOREIGN KEY ("A") REFERENCES "MockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MockExamToQuestion" ADD CONSTRAINT "_MockExamToQuestion_B_fkey" FOREIGN KEY ("B") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
CREATE TYPE "AccessType" AS ENUM ('TIME_WINDOW', 'USE_BASED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "university" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "profile_photo_url" TEXT,
    "auth_provider" "AuthProvider" NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" TEXT,
    "verification_token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subject_strengths" JSONB NOT NULL,
    "subject_weaknesses" JSONB NOT NULL,
    "preferred_reply_mode" "ReplyMode",
    "question_patterns" JSONB NOT NULL,
    "vocabulary_level" "VocabularyLevel" NOT NULL,
    "session_count" INTEGER NOT NULL DEFAULT 0,
    "last_active" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_patterns" (
    "id" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "question_pattern" JSONB NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "file_ref" TEXT NOT NULL,
    "file_type" "FileType" NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL,
    "upload_count" INTEGER NOT NULL DEFAULT 1,
    "contributor_ids" JSONB NOT NULL,
    "verified_at" TIMESTAMP(3),
    "uploaded_by" TEXT NOT NULL,
    "admin_reviewed_by" TEXT,
    "admin_reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_embeddings" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_chunks" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "chunk_ref" TEXT NOT NULL,
    "total_chunks" INTEGER NOT NULL,
    "status" "ChunkStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
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

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "reply_mode" "ReplyMode",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
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

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_access" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feature" "Feature" NOT NULL,
    "access_type" "AccessType" NOT NULL,
    "expires_at" TIMESTAMP(3),
    "uses_remaining" INTEGER,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_ref" TEXT NOT NULL,

    CONSTRAINT "feature_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3),

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "device_type" "DeviceType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discipline_documents" (
    "id" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "course_code" TEXT,
    "document_ref" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "last_updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "discipline_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_university_idx" ON "users"("university");

-- CreateIndex
CREATE INDEX "users_department_idx" ON "users"("department");

-- CreateIndex
CREATE UNIQUE INDEX "learning_profiles_user_id_key" ON "learning_profiles"("user_id");

-- CreateIndex
CREATE INDEX "community_patterns_department_idx" ON "community_patterns"("department");

-- CreateIndex
CREATE INDEX "community_patterns_course_code_idx" ON "community_patterns"("course_code");

-- CreateIndex
CREATE INDEX "materials_course_code_idx" ON "materials"("course_code");

-- CreateIndex
CREATE INDEX "materials_university_idx" ON "materials"("university");

-- CreateIndex
CREATE INDEX "materials_department_idx" ON "materials"("department");

-- CreateIndex
CREATE INDEX "materials_level_idx" ON "materials"("level");

-- CreateIndex
CREATE INDEX "materials_verification_status_idx" ON "materials"("verification_status");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_course_code_idx" ON "sessions"("course_code");

-- CreateIndex
CREATE INDEX "messages_session_id_idx" ON "messages"("session_id");

-- CreateIndex
CREATE INDEX "questions_course_code_idx" ON "questions"("course_code");

-- CreateIndex
CREATE INDEX "questions_department_idx" ON "questions"("department");

-- CreateIndex
CREATE INDEX "questions_difficulty_idx" ON "questions"("difficulty");

-- CreateIndex
CREATE INDEX "feature_access_user_id_idx" ON "feature_access"("user_id");

-- CreateIndex
CREATE INDEX "feature_access_feature_idx" ON "feature_access"("feature");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_is_active_idx" ON "refresh_tokens"("is_active");

-- CreateIndex
CREATE INDEX "discipline_documents_department_idx" ON "discipline_documents"("department");

-- CreateIndex
CREATE INDEX "discipline_documents_course_code_idx" ON "discipline_documents"("course_code");

-- CreateIndex
CREATE INDEX "discipline_documents_is_active_idx" ON "discipline_documents"("is_active");

-- AddForeignKey
ALTER TABLE "learning_profiles" ADD CONSTRAINT "learning_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_admin_reviewed_by_fkey" FOREIGN KEY ("admin_reviewed_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_embeddings" ADD CONSTRAINT "material_embeddings_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_chunks" ADD CONSTRAINT "upload_chunks_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_access" ADD CONSTRAINT "feature_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discipline_documents" ADD CONSTRAINT "discipline_documents_last_updated_by_fkey" FOREIGN KEY ("last_updated_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

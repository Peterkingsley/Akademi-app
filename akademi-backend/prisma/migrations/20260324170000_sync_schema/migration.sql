-- Rename tables to match @@map directives
ALTER TABLE "User" RENAME TO "users";
ALTER TABLE "LearningProfile" RENAME TO "learning_profiles";
ALTER TABLE "CommunityPattern" RENAME TO "community_patterns";
ALTER TABLE "Material" RENAME TO "materials";
ALTER TABLE "MaterialEmbedding" RENAME TO "material_embeddings";
ALTER TABLE "UploadChunk" RENAME TO "upload_chunks";
ALTER TABLE "Session" RENAME TO "sessions";
ALTER TABLE "Message" RENAME TO "messages";
ALTER TABLE "Question" RENAME TO "questions";
ALTER TABLE "FeatureAccess" RENAME TO "feature_access";
ALTER TABLE "Admin" RENAME TO "admins";
ALTER TABLE "RefreshToken" RENAME TO "refresh_tokens";
ALTER TABLE "DisciplineDocument" RENAME TO "discipline_documents";
ALTER TABLE "University" RENAME TO "universities";
ALTER TABLE "Department" RENAME TO "departments";
ALTER TABLE "ExamPrepPlan" RENAME TO "exam_prep_plans";
ALTER TABLE "PrepTask" RENAME TO "prep_tasks";
ALTER TABLE "MockExam" RENAME TO "mock_exams";
ALTER TABLE "MockAttempt" RENAME TO "mock_attempts";
ALTER TABLE "QuestionAttempt" RENAME TO "question_attempts";

-- Add missing is_banned column to users table
ALTER TABLE "users" ADD COLUMN "is_banned" BOOLEAN NOT NULL DEFAULT false;

-- Scoped to exactly what commit 5202cf9 (KnowledgeModel schema) introduced, plus this session's
-- two additions (OperationVocabulary model, Archetype.memberCount column). Deliberately excludes
-- everything else `prisma migrate diff --from-url` reported: pre-existing, unrelated drift between
-- the live database and schema.prisma (constraint/index renames, a dropped FK on
-- materials.generated_outline_id, two dropped indexes on transactions, several course_code columns
-- turned nullable, and the still-unmigrated TextbookGenerationQueueEntry table from before this
-- session). None of that is part of this change and none of it is touched here.

-- CreateEnum
CREATE TYPE "KCType" AS ENUM ('FACT', 'CONCEPT', 'PRINCIPLE', 'PROCEDURE');

-- CreateEnum
CREATE TYPE "TierSource" AS ENUM ('MODELLED', 'EMPIRICAL');

-- CreateEnum
CREATE TYPE "MisconceptionKind" AS ENUM ('SLIP', 'MISAPPLICATION', 'INTUITIVE_THEORY');

-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('STANDARD', 'NON_EXAMPLE', 'ERRONEOUS');

-- CreateEnum
CREATE TYPE "Variability" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SupportLevel" AS ENUM ('FULL', 'FADED', 'SOLO');

-- CreateEnum
CREATE TYPE "FloorPolicy" AS ENUM ('ASSUME', 'JIT_REFRESH', 'TEACH');

-- CreateEnum
CREATE TYPE "GapResolution" AS ENUM ('JIT_REFRESH', 'FORWARD_REF', 'RELOCATE', 'PROMOTE', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "PerturbationResult" AS ENUM ('RADICAL', 'INCIDENTAL', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('DRAFT', 'VALIDATING', 'FAILED', 'READY', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('HARD', 'SOFT', 'WARN');

-- CreateEnum
CREATE TYPE "Surface" AS ENUM ('TEXTBOOK', 'CBT');

-- CreateEnum
CREATE TYPE "TeachingBlockKind" AS ENUM ('SELECTION_TABLE', 'JIT_REFRESH', 'PRIOR_KNOWLEDGE');

-- CreateEnum
CREATE TYPE "ModelScope" AS ENUM ('COURSE', 'TOPIC');

-- CreateTable
CREATE TABLE "CourseFloor" (
    "id" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "assumesCompleted" TEXT[],
    "floorPolicy" "FloorPolicy" NOT NULL DEFAULT 'JIT_REFRESH',
    "assumedKCIds" TEXT[],

    CONSTRAINT "CourseFloor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioPool" (
    "id" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "slotKind" TEXT NOT NULL,
    "values" TEXT[],

    CONSTRAINT "ScenarioPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminologyEntry" (
    "id" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "notation" TEXT,
    "firstUsedIn" TEXT,

    CONSTRAINT "TerminologyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationVocabulary" (
    "id" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "entries" JSONB NOT NULL,
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationVocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeModel" (
    "id" TEXT NOT NULL,
    "topicId" TEXT,
    "scope" "ModelScope" NOT NULL DEFAULT 'TOPIC',
    "courseCode" TEXT NOT NULL,
    "academicLevel" INTEGER NOT NULL,
    "learningOutcome" TEXT NOT NULL,
    "ccmasVersion" TEXT NOT NULL,
    "status" "ModelStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeComponent" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "type" "KCType" NOT NULL,
    "statement" TEXT NOT NULL,
    "steps" TEXT[],
    "isSelection" BOOLEAN NOT NULL DEFAULT false,
    "traceEvidence" INTEGER NOT NULL,

    CONSTRAINT "KnowledgeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KCDependency" (
    "id" TEXT NOT NULL,
    "dependentId" TEXT NOT NULL,
    "prerequisiteId" TEXT,
    "gapDescription" TEXT,
    "resolution" "GapResolution" NOT NULL DEFAULT 'UNRESOLVED',
    "resolvedAt" TEXT,

    CONSTRAINT "KCDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Archetype" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "canonicalStem" TEXT NOT NULL,
    "sourcedFrom" TEXT NOT NULL,
    "distinctBecause" TEXT NOT NULL,
    "actionSignature" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Archetype_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DifficultyFactor" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "whyHard" TEXT NOT NULL,
    "recruitsKCId" TEXT,
    "perturbationResult" "PerturbationResult" NOT NULL,

    CONSTRAINT "DifficultyFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchetypeRadical" (
    "archetypeId" TEXT NOT NULL,
    "factorId" TEXT NOT NULL,

    CONSTRAINT "ArchetypeRadical_pkey" PRIMARY KEY ("archetypeId","factorId")
);

-- CreateTable
CREATE TABLE "Misconception" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "belief" TEXT NOT NULL,
    "kind" "MisconceptionKind" NOT NULL,
    "relatedKCId" TEXT NOT NULL,
    "atStep" INTEGER,
    "producesAnswer" TEXT NOT NULL,
    "confrontation" TEXT,
    "confrontable" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "evidenceCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Misconception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemModel" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "archetypeId" TEXT,
    "publicId" TEXT NOT NULL,
    "targetKCIds" TEXT[],
    "radicalIds" TEXT[],
    "tier" INTEGER NOT NULL,
    "tierSource" "TierSource" NOT NULL DEFAULT 'MODELLED',
    "bloom" TEXT NOT NULL,
    "stemTemplate" TEXT NOT NULL,
    "incidentalSlots" JSONB NOT NULL,
    "variability" "Variability" NOT NULL,
    "solutionProcedure" TEXT[],
    "branchCoverageRequired" BOOLEAN NOT NULL DEFAULT false,
    "kind" "ItemKind" NOT NULL DEFAULT 'STANDARD',
    "erroneousSourceId" TEXT,
    "prompts" TEXT[],
    "minTraceEvidence" INTEGER NOT NULL,
    "harvestedStemRef" TEXT,

    CONSTRAINT "ItemModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemModelBranch" (
    "id" TEXT NOT NULL,
    "itemModelId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "conclusion" TEXT NOT NULL,

    CONSTRAINT "ItemModelBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRung" (
    "id" TEXT NOT NULL,
    "itemModelId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "support" "SupportLevel" NOT NULL,
    "stepsRemoved" INTEGER[],
    "selfExplanationPrompt" TEXT,

    CONSTRAINT "SupportRung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistractorRule" (
    "id" TEXT NOT NULL,
    "itemModelId" TEXT NOT NULL,
    "misconceptionId" TEXT NOT NULL,
    "derivation" TEXT NOT NULL,

    CONSTRAINT "DistractorRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "itemModelId" TEXT NOT NULL,
    "surface" "Surface" NOT NULL,
    "seed" TEXT NOT NULL,
    "branchId" TEXT,
    "rungOrdinal" INTEGER,
    "renderedStem" TEXT NOT NULL,
    "renderedSolution" TEXT[],
    "renderedDistractors" JSONB,
    "targetKCIds" TEXT[],
    "solveAgreement" INTEGER NOT NULL,
    "judgedTier" INTEGER,
    "errorMarked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JitBlock" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "forKCId" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "anchorItemModelId" TEXT,
    "content" TEXT NOT NULL,
    "fullTreatmentAt" TEXT,
    "reason" TEXT NOT NULL,

    CONSTRAINT "JitBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingBlock" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "kind" "TeachingBlockKind" NOT NULL,
    "forKCId" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "TeachingBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelocationRequest" (
    "id" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "kcPublicId" TEXT NOT NULL,
    "fromTopicId" TEXT NOT NULL,
    "toTopicId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RelocationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationFinding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "subjectId" TEXT,
    "detail" TEXT NOT NULL,

    CONSTRAINT "ValidationFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseFloor_courseCode_key" ON "CourseFloor"("courseCode");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioPool_courseCode_slotKind_key" ON "ScenarioPool"("courseCode", "slotKind");

-- CreateIndex
CREATE UNIQUE INDEX "TerminologyEntry_courseCode_term_key" ON "TerminologyEntry"("courseCode", "term");

-- CreateIndex
CREATE UNIQUE INDEX "OperationVocabulary_courseCode_key" ON "OperationVocabulary"("courseCode");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeModel_courseCode_topicId_key" ON "KnowledgeModel"("courseCode", "topicId");

-- CreateIndex
CREATE INDEX "KnowledgeModel_courseCode_status_idx" ON "KnowledgeModel"("courseCode", "status");

-- CreateIndex
CREATE INDEX "KnowledgeComponent_modelId_type_idx" ON "KnowledgeComponent"("modelId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeComponent_modelId_publicId_key" ON "KnowledgeComponent"("modelId", "publicId");

-- CreateIndex
CREATE INDEX "KCDependency_dependentId_idx" ON "KCDependency"("dependentId");

-- CreateIndex
CREATE INDEX "KCDependency_resolution_idx" ON "KCDependency"("resolution");

-- CreateIndex
CREATE UNIQUE INDEX "Archetype_modelId_publicId_key" ON "Archetype"("modelId", "publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Archetype_modelId_actionSignature_key" ON "Archetype"("modelId", "actionSignature");

-- CreateIndex
CREATE UNIQUE INDEX "DifficultyFactor_modelId_publicId_key" ON "DifficultyFactor"("modelId", "publicId");

-- CreateIndex
CREATE INDEX "Misconception_modelId_kind_confrontable_idx" ON "Misconception"("modelId", "kind", "confrontable");

-- CreateIndex
CREATE UNIQUE INDEX "Misconception_modelId_publicId_key" ON "Misconception"("modelId", "publicId");

-- CreateIndex
CREATE INDEX "ItemModel_modelId_tier_idx" ON "ItemModel"("modelId", "tier");

-- CreateIndex
CREATE INDEX "ItemModel_modelId_kind_idx" ON "ItemModel"("modelId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ItemModel_modelId_publicId_key" ON "ItemModel"("modelId", "publicId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemModelBranch_itemModelId_publicId_key" ON "ItemModelBranch"("itemModelId", "publicId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRung_itemModelId_ordinal_key" ON "SupportRung"("itemModelId", "ordinal");

-- CreateIndex
CREATE INDEX "Item_itemModelId_surface_idx" ON "Item"("itemModelId", "surface");

-- CreateIndex
CREATE INDEX "Item_surface_seed_idx" ON "Item"("surface", "seed");

-- CreateIndex
CREATE INDEX "TeachingBlock_modelId_kind_idx" ON "TeachingBlock"("modelId", "kind");

-- CreateIndex
CREATE INDEX "RelocationRequest_courseCode_applied_idx" ON "RelocationRequest"("courseCode", "applied");

-- CreateIndex
CREATE INDEX "ValidationRun_modelId_gate_attempt_idx" ON "ValidationRun"("modelId", "gate", "attempt");

-- CreateIndex
CREATE INDEX "ValidationFinding_runId_severity_idx" ON "ValidationFinding"("runId", "severity");

-- AddForeignKey
ALTER TABLE "KnowledgeComponent" ADD CONSTRAINT "KnowledgeComponent_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "KnowledgeModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KCDependency" ADD CONSTRAINT "KCDependency_dependentId_fkey" FOREIGN KEY ("dependentId") REFERENCES "KnowledgeComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KCDependency" ADD CONSTRAINT "KCDependency_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "KnowledgeComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archetype" ADD CONSTRAINT "Archetype_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "KnowledgeModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DifficultyFactor" ADD CONSTRAINT "DifficultyFactor_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "KnowledgeModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchetypeRadical" ADD CONSTRAINT "ArchetypeRadical_archetypeId_fkey" FOREIGN KEY ("archetypeId") REFERENCES "Archetype"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchetypeRadical" ADD CONSTRAINT "ArchetypeRadical_factorId_fkey" FOREIGN KEY ("factorId") REFERENCES "DifficultyFactor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Misconception" ADD CONSTRAINT "Misconception_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "KnowledgeModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemModel" ADD CONSTRAINT "ItemModel_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "KnowledgeModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemModel" ADD CONSTRAINT "ItemModel_archetypeId_fkey" FOREIGN KEY ("archetypeId") REFERENCES "Archetype"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemModel" ADD CONSTRAINT "ItemModel_erroneousSourceId_fkey" FOREIGN KEY ("erroneousSourceId") REFERENCES "Misconception"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemModelBranch" ADD CONSTRAINT "ItemModelBranch_itemModelId_fkey" FOREIGN KEY ("itemModelId") REFERENCES "ItemModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRung" ADD CONSTRAINT "SupportRung_itemModelId_fkey" FOREIGN KEY ("itemModelId") REFERENCES "ItemModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistractorRule" ADD CONSTRAINT "DistractorRule_itemModelId_fkey" FOREIGN KEY ("itemModelId") REFERENCES "ItemModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistractorRule" ADD CONSTRAINT "DistractorRule_misconceptionId_fkey" FOREIGN KEY ("misconceptionId") REFERENCES "Misconception"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_itemModelId_fkey" FOREIGN KEY ("itemModelId") REFERENCES "ItemModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JitBlock" ADD CONSTRAINT "JitBlock_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "KnowledgeModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingBlock" ADD CONSTRAINT "TeachingBlock_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "KnowledgeModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRun" ADD CONSTRAINT "ValidationRun_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "KnowledgeModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationFinding" ADD CONSTRAINT "ValidationFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ValidationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

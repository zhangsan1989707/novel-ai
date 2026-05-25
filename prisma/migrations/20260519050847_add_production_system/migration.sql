-- CreateEnum
CREATE TYPE "PipelineStep" AS ENUM ('BLUEPRINT', 'ARC_PLAN', 'CHAPTER_LIST', 'WRITE', 'VALIDATE', 'POLISH', 'DESLOP', 'SUMMARIZE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PAUSED');

-- CreateEnum
CREATE TYPE "ArcStage" AS ENUM ('OPENING', 'GROWTH', 'EXPANSION', 'MID_CONFLICT', 'PRE_FINALE', 'FINALE');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('QIDIAN', 'FANQIE', 'FEILU', 'JINJIANG', 'QIMAO');

-- CreateEnum
CREATE TYPE "LengthType" AS ENUM ('SHORT', 'MEDIUM', 'LONG', 'ULTRA_LONG');

-- AlterTable
ALTER TABLE "novel_projects" ADD COLUMN     "conflictIntensity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "corePitch" TEXT,
ADD COLUMN     "darkness" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
ADD COLUMN     "humor" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
ADD COLUMN     "lengthType" "LengthType",
ADD COLUMN     "mysteryDensity" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
ADD COLUMN     "pace" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "pipelineJobId" INTEGER,
ADD COLUMN     "platform" "Platform",
ADD COLUMN     "powerGrowth" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "romance" DOUBLE PRECISION NOT NULL DEFAULT 0.2;

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FULL_PIPELINE',
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "currentStep" "PipelineStep",
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "totalChapters" INTEGER NOT NULL DEFAULT 0,
    "currentChapter" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "payload" JSONB DEFAULT '{}',
    "result" JSONB DEFAULT '{}',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_checkpoints" (
    "id" TEXT NOT NULL,
    "jobId" INTEGER NOT NULL,
    "step" "PipelineStep" NOT NULL,
    "input" JSONB DEFAULT '{}',
    "output" JSONB DEFAULT '{}',
    "error" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_blueprints" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "corePitch" TEXT NOT NULL,
    "worldDirection" TEXT,
    "mainlineDirection" TEXT,
    "growthDirection" TEXT,
    "endingDirection" TEXT,
    "constraints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arc_plans" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "arcNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "ArcStage" NOT NULL,
    "description" TEXT,
    "batchSize" INTEGER NOT NULL DEFAULT 15,
    "startChapter" INTEGER NOT NULL,
    "endChapter" INTEGER,
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keyEvents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arc_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "villains" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'stage',
    "isFinalBoss" BOOLEAN NOT NULL DEFAULT false,
    "arcNumber" INTEGER,
    "description" TEXT,
    "motivation" TEXT,
    "abilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "introducedAt" INTEGER,
    "defeatedAt" INTEGER,
    "lifecycle" TEXT DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "villains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_states" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "mapLevel" INTEGER NOT NULL DEFAULT 1,
    "factionCount" INTEGER NOT NULL DEFAULT 1,
    "powerLevel" INTEGER NOT NULL DEFAULT 1,
    "civilizationLevel" INTEGER NOT NULL DEFAULT 1,
    "classStructure" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currentExpansion" TEXT,
    "lastExpandedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generation_jobs_projectId_idx" ON "generation_jobs"("projectId");

-- CreateIndex
CREATE INDEX "generation_jobs_status_idx" ON "generation_jobs"("status");

-- CreateIndex
CREATE INDEX "pipeline_checkpoints_jobId_idx" ON "pipeline_checkpoints"("jobId");

-- CreateIndex
CREATE INDEX "pipeline_checkpoints_jobId_step_idx" ON "pipeline_checkpoints"("jobId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "book_blueprints_projectId_key" ON "book_blueprints"("projectId");

-- CreateIndex
CREATE INDEX "arc_plans_projectId_idx" ON "arc_plans"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "arc_plans_projectId_arcNumber_key" ON "arc_plans"("projectId", "arcNumber");

-- CreateIndex
CREATE INDEX "villains_projectId_idx" ON "villains"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "world_states_projectId_key" ON "world_states"("projectId");

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_checkpoints" ADD CONSTRAINT "pipeline_checkpoints_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_blueprints" ADD CONSTRAINT "book_blueprints_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arc_plans" ADD CONSTRAINT "arc_plans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "villains" ADD CONSTRAINT "villains_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_states" ADD CONSTRAINT "world_states_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

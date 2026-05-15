-- CreateEnum
CREATE TYPE "CharacterRole" AS ENUM ('PROTAGONIST', 'ANTAGONIST', 'SUPPORTING', 'MINOR');

-- CreateEnum
CREATE TYPE "PlotlineType" AS ENUM ('FORESHADOW', 'SUBPLOT', 'CONFLICT');

-- CreateEnum
CREATE TYPE "PlotlineStatus" AS ENUM ('OPEN', 'RESOLVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('PLANNER', 'WRITER', 'POLISHER', 'VALIDATOR', 'SUMMARIZER');

-- AlterTable
ALTER TABLE "novel_chapters" ADD COLUMN     "chapterOutline" JSONB,
ADD COLUMN     "lastAgentType" "AgentType",
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "validationReport" JSONB;

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "role" "CharacterRole" NOT NULL DEFAULT 'SUPPORTING',
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "appearance" TEXT,
    "personality" TEXT,
    "catchphrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "background" TEXT,
    "relationships" JSONB DEFAULT '{}',
    "currentState" JSONB DEFAULT '{}',
    "firstChapter" INTEGER,
    "lastUpdated" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plotlines" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "type" "PlotlineType" NOT NULL DEFAULT 'FORESHADOW',
    "description" TEXT NOT NULL,
    "plantedAt" INTEGER NOT NULL,
    "resolvedAt" INTEGER,
    "plannedAt" INTEGER,
    "status" "PlotlineStatus" NOT NULL DEFAULT 'OPEN',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plotlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_states" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "emotionalArc" JSONB NOT NULL DEFAULT '[]',
    "mainConflict" TEXT,
    "subConflicts" JSONB DEFAULT '[]',
    "currentChapter" INTEGER NOT NULL DEFAULT 0,
    "totalPlanned" INTEGER NOT NULL DEFAULT 100,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_events" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "chapterNo" INTEGER,
    "description" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_logs" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "chapterNo" INTEGER NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "status" TEXT NOT NULL,
    "inputPrompt" TEXT,
    "outputContent" TEXT,
    "errorMessage" TEXT,
    "tokenCount" INTEGER,
    "durationMs" INTEGER,
    "validationResult" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_summaries" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "chapterNo" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "keyEvents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emotionalTone" TEXT,
    "plantedPlotlines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolvedPlotlines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volume_summaries" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "volumeNumber" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "keyEvents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emotionalArc" JSONB NOT NULL DEFAULT '[]',
    "plantedPlotlines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolvedPlotlines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chapterOverview" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "volume_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_summaries" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "mainPlot" TEXT NOT NULL,
    "subPlots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "characterArcs" JSONB NOT NULL DEFAULT '[]',
    "thematicElements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalPlotlines" INTEGER NOT NULL DEFAULT 0,
    "resolvedPlotlines" INTEGER NOT NULL DEFAULT 0,
    "openPlotlines" INTEGER NOT NULL DEFAULT 0,
    "structureAnalysis" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "characters_projectId_idx" ON "characters"("projectId");

-- CreateIndex
CREATE INDEX "plotlines_projectId_idx" ON "plotlines"("projectId");

-- CreateIndex
CREATE INDEX "plotlines_status_idx" ON "plotlines"("status");

-- CreateIndex
CREATE UNIQUE INDEX "story_states_projectId_key" ON "story_states"("projectId");

-- CreateIndex
CREATE INDEX "story_events_projectId_idx" ON "story_events"("projectId");

-- CreateIndex
CREATE INDEX "story_events_chapterNo_idx" ON "story_events"("chapterNo");

-- CreateIndex
CREATE INDEX "agent_logs_projectId_chapterNo_idx" ON "agent_logs"("projectId", "chapterNo");

-- CreateIndex
CREATE INDEX "agent_logs_createdAt_idx" ON "agent_logs"("createdAt");

-- CreateIndex
CREATE INDEX "chapter_summaries_projectId_idx" ON "chapter_summaries"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_summaries_projectId_chapterNo_key" ON "chapter_summaries"("projectId", "chapterNo");

-- CreateIndex
CREATE INDEX "volume_summaries_projectId_idx" ON "volume_summaries"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "volume_summaries_projectId_volumeNumber_key" ON "volume_summaries"("projectId", "volumeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "book_summaries_projectId_key" ON "book_summaries"("projectId");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plotlines" ADD CONSTRAINT "plotlines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_states" ADD CONSTRAINT "story_states_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_events" ADD CONSTRAINT "story_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_logs" ADD CONSTRAINT "agent_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_summaries" ADD CONSTRAINT "chapter_summaries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volume_summaries" ADD CONSTRAINT "volume_summaries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_summaries" ADD CONSTRAINT "book_summaries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

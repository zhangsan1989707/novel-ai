-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'WRITING', 'COMPLETED', 'PAUSED');

-- CreateEnum
CREATE TYPE "ChapterStatus" AS ENUM ('DRAFT', 'GENERATING', 'COMPLETED', 'REVIEWING');

-- CreateEnum
CREATE TYPE "WriterType" AS ENUM ('REAL_AUTHOR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('UNTRAINED', 'TRAINING', 'TRAINED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AIVendor" AS ENUM ('OPENAI', 'ANTHROPIC', 'ALIBABA', 'DEEPSEEK', 'MINIMAX', 'VOLCENGINE');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_model_configs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" "AIVendor" NOT NULL,
    "modelId" TEXT NOT NULL,
    "apiKey" TEXT,
    "apiEndpoint" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_projects" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "genre" TEXT,
    "writingStyle" TEXT,
    "targetWordCount" INTEGER,
    "currentWordCount" INTEGER NOT NULL DEFAULT 0,
    "chapterWordCount" INTEGER NOT NULL DEFAULT 3000,
    "outline" TEXT,
    "outlineStages" JSONB,
    "worldSetting" TEXT,
    "powerSystem" TEXT,
    "protagonistProfile" TEXT,
    "protagonistGoal" TEXT,
    "antagonistSetting" TEXT,
    "endingPlan" TEXT,
    "writingPrompt" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "coverImage" TEXT,
    "totalVolumes" INTEGER NOT NULL DEFAULT 4,
    "aiModelId" INTEGER,
    "creatorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "novel_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_chapters" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "summary" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "generationPrompt" TEXT,
    "generationParams" JSONB,
    "generationCount" INTEGER NOT NULL DEFAULT 0,
    "lastGeneratedTime" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ChapterStatus" NOT NULL DEFAULT 'DRAFT',
    "virtualWriterId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "novel_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_writers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "writerType" "WriterType" NOT NULL DEFAULT 'CUSTOM',
    "styleFeatures" TEXT,
    "vocabularyFeatures" TEXT,
    "sentenceFeatures" TEXT,
    "rhetoricFeatures" TEXT,
    "themeFeatures" TEXT,
    "trainingStatus" "TrainingStatus" NOT NULL DEFAULT 'UNTRAINED',
    "trainingProgress" INTEGER NOT NULL DEFAULT 0,
    "trainedAt" TIMESTAMP(3),
    "documentCount" INTEGER NOT NULL DEFAULT 0,
    "totalWordCount" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT,
    "creatorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "virtual_writers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writer_documents" (
    "id" SERIAL NOT NULL,
    "virtualWriterId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "writer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_versions" (
    "id" SERIAL NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "prompt" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_analysis" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "volumeNumber" INTEGER NOT NULL DEFAULT -1,
    "analysisType" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "analysisData" JSONB NOT NULL,
    "rawContent" TEXT,
    "wordCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "novel_projects_creatorId_idx" ON "novel_projects"("creatorId");

-- CreateIndex
CREATE INDEX "novel_projects_status_idx" ON "novel_projects"("status");

-- CreateIndex
CREATE INDEX "novel_chapters_projectId_idx" ON "novel_chapters"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "novel_chapters_projectId_chapterNumber_key" ON "novel_chapters"("projectId", "chapterNumber");

-- CreateIndex
CREATE INDEX "virtual_writers_creatorId_idx" ON "virtual_writers"("creatorId");

-- CreateIndex
CREATE INDEX "writer_documents_virtualWriterId_idx" ON "writer_documents"("virtualWriterId");

-- CreateIndex
CREATE INDEX "chapter_versions_chapterId_idx" ON "chapter_versions"("chapterId");

-- CreateIndex
CREATE INDEX "book_analysis_projectId_idx" ON "book_analysis"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "book_analysis_projectId_volumeNumber_analysisType_dimension_key" ON "book_analysis"("projectId", "volumeNumber", "analysisType", "dimension");

-- AddForeignKey
ALTER TABLE "novel_projects" ADD CONSTRAINT "novel_projects_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "ai_model_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_projects" ADD CONSTRAINT "novel_projects_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_chapters" ADD CONSTRAINT "novel_chapters_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_chapters" ADD CONSTRAINT "novel_chapters_virtualWriterId_fkey" FOREIGN KEY ("virtualWriterId") REFERENCES "virtual_writers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_writers" ADD CONSTRAINT "virtual_writers_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writer_documents" ADD CONSTRAINT "writer_documents_virtualWriterId_fkey" FOREIGN KEY ("virtualWriterId") REFERENCES "virtual_writers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_versions" ADD CONSTRAINT "chapter_versions_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "novel_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_analysis" ADD CONSTRAINT "book_analysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

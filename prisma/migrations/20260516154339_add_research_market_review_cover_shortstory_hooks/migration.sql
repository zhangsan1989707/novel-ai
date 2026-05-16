-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'TASK', 'QUOTA', 'ERROR');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- AlterEnum
ALTER TYPE "AgentType" ADD VALUE 'RESEARCHER';

-- AlterTable
ALTER TABLE "novel_projects" ADD COLUMN     "storyType" TEXT NOT NULL DEFAULT 'LONG';

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "projectId" INTEGER,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_trends" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "rankDate" TIMESTAMP(3) NOT NULL,
    "avgWordCount" INTEGER NOT NULL DEFAULT 0,
    "updateFreq" TEXT,
    "hotTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "trendDirection" TEXT,
    "analysisData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_trends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_books" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "rankPosition" INTEGER,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "synopsis" TEXT,
    "analysisData" JSONB NOT NULL DEFAULT '{}',
    "rankDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_refs" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyFacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creativeMaterials" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "usageSuggestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "usedInChapter" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cover_designs" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "colorScheme" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "composition" TEXT,
    "elements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mood" TEXT,
    "style" TEXT,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cover_designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "chapterNo" INTEGER,
    "content" TEXT NOT NULL,
    "reviews" JSONB NOT NULL DEFAULT '[]',
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consensus" TEXT,
    "criticalIssues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "improvementPriority" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "short_stories" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "structure" TEXT NOT NULL DEFAULT 'three_act',
    "targetWordCount" INTEGER NOT NULL DEFAULT 10000,
    "currentWordCount" INTEGER NOT NULL DEFAULT 0,
    "premise" TEXT,
    "emotionalDesign" JSONB DEFAULT '{}',
    "reversalDesign" JSONB DEFAULT '{}',
    "hookDesign" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "short_stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "short_story_sections" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "sectionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "sectionType" TEXT NOT NULL DEFAULT 'setup',
    "emotionalTarget" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "short_story_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "market_trends_platform_genre_rankDate_idx" ON "market_trends"("platform", "genre", "rankDate");

-- CreateIndex
CREATE INDEX "market_books_platform_genre_idx" ON "market_books"("platform", "genre");

-- CreateIndex
CREATE INDEX "market_books_platform_rankDate_idx" ON "market_books"("platform", "rankDate");

-- CreateIndex
CREATE INDEX "research_refs_projectId_idx" ON "research_refs"("projectId");

-- CreateIndex
CREATE INDEX "cover_designs_projectId_idx" ON "cover_designs"("projectId");

-- CreateIndex
CREATE INDEX "review_reports_projectId_idx" ON "review_reports"("projectId");

-- CreateIndex
CREATE INDEX "review_reports_projectId_chapterNo_idx" ON "review_reports"("projectId", "chapterNo");

-- CreateIndex
CREATE UNIQUE INDEX "short_stories_projectId_key" ON "short_stories"("projectId");

-- CreateIndex
CREATE INDEX "short_story_sections_storyId_idx" ON "short_story_sections"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "short_story_sections_storyId_sectionNumber_key" ON "short_story_sections"("storyId", "sectionNumber");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_refs" ADD CONSTRAINT "research_refs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_designs" ADD CONSTRAINT "cover_designs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_stories" ADD CONSTRAINT "short_stories_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_story_sections" ADD CONSTRAINT "short_story_sections_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "short_stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

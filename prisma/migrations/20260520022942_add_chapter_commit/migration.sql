-- CreateTable
CREATE TABLE "chapter_commits" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "chapterId" INTEGER,
    "chapterNo" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'pipeline',
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "projectionStatus" JSONB NOT NULL DEFAULT '{}',
    "replayCount" INTEGER NOT NULL DEFAULT 0,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_commits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapter_commits_projectId_idx" ON "chapter_commits"("projectId");

-- CreateIndex
CREATE INDEX "chapter_commits_projectId_chapterNo_idx" ON "chapter_commits"("projectId", "chapterNo");

-- AddForeignKey
ALTER TABLE "chapter_commits" ADD CONSTRAINT "chapter_commits_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_commits" ADD CONSTRAINT "chapter_commits_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "novel_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

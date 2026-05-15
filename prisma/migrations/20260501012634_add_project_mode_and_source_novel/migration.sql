-- AlterTable
ALTER TABLE "novel_projects" ADD COLUMN     "projectMode" TEXT NOT NULL DEFAULT 'CREATE';

-- CreateTable
CREATE TABLE "source_novels" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "originalText" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "sourceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_novels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_novels_projectId_key" ON "source_novels"("projectId");

-- AddForeignKey
ALTER TABLE "source_novels" ADD CONSTRAINT "source_novels_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

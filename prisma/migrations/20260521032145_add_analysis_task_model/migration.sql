/*
  Warnings:

  - You are about to drop the `rag_documents` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AnalysisTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "rag_documents" DROP CONSTRAINT "rag_documents_project_id_fkey";

-- AlterTable
ALTER TABLE "project_maintenance_tasks" ALTER COLUMN "payload" DROP NOT NULL,
ALTER COLUMN "result" DROP NOT NULL;

-- DropTable
DROP TABLE "rag_documents";

-- CreateTable
CREATE TABLE "analysis_tasks" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "volumeNumber" INTEGER NOT NULL DEFAULT -1,
    "dimensions" JSONB NOT NULL,
    "contextChapterCount" INTEGER NOT NULL DEFAULT 3,
    "status" "AnalysisTaskStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "progressMessage" TEXT,
    "totalDimensions" INTEGER NOT NULL,
    "completedDimensions" INTEGER NOT NULL DEFAULT 0,
    "currentDimension" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysis_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analysis_tasks_projectId_idx" ON "analysis_tasks"("projectId");

-- CreateIndex
CREATE INDEX "analysis_tasks_projectId_status_idx" ON "analysis_tasks"("projectId", "status");

-- CreateIndex
CREATE INDEX "analysis_tasks_projectId_createdAt_idx" ON "analysis_tasks"("projectId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "analysis_tasks" ADD CONSTRAINT "analysis_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "project_maintenance_tasks_status_nextRunAt_priority_createdAt_i" RENAME TO "project_maintenance_tasks_status_nextRunAt_priority_created_idx";

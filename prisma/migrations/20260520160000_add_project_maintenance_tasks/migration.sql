-- CreateTable
CREATE TABLE "project_maintenance_tasks" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "taskType" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_maintenance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_maintenance_tasks_projectId_idx" ON "project_maintenance_tasks"("projectId");

-- CreateIndex
CREATE INDEX "project_maintenance_tasks_status_nextRunAt_priority_createdAt_idx" ON "project_maintenance_tasks"("status", "nextRunAt", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "project_maintenance_tasks_projectId_taskType_status_idx" ON "project_maintenance_tasks"("projectId", "taskType", "status");

-- AddForeignKey
ALTER TABLE "project_maintenance_tasks" ADD CONSTRAINT "project_maintenance_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

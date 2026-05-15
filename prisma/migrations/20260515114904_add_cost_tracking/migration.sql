-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "creatorId" INTEGER,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "model_pricings" (
    "id" SERIAL NOT NULL,
    "vendor" "AIVendor" NOT NULL,
    "modelId" TEXT NOT NULL,
    "inputPrice" DECIMAL(65,30) NOT NULL,
    "outputPrice" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_pricings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_quotas" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "monthlyLimit" DECIMAL(65,30) NOT NULL,
    "alertThreshold" DECIMAL(65,30) NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usages" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "vendor" "AIVendor" NOT NULL,
    "modelId" TEXT NOT NULL,
    "usageType" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "inputCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "outputCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "usageMonth" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "model_pricings_vendor_modelId_key" ON "model_pricings"("vendor", "modelId");

-- CreateIndex
CREATE UNIQUE INDEX "user_quotas_userId_key" ON "user_quotas"("userId");

-- CreateIndex
CREATE INDEX "ai_usages_userId_usageMonth_idx" ON "ai_usages"("userId", "usageMonth");

-- CreateIndex
CREATE INDEX "ai_usages_projectId_idx" ON "ai_usages"("projectId");

-- CreateIndex
CREATE INDEX "novel_chapters_projectId_status_idx" ON "novel_chapters"("projectId", "status");

-- CreateIndex
CREATE INDEX "plotlines_projectId_status_plantedAt_idx" ON "plotlines"("projectId", "status", "plantedAt");

-- CreateIndex
CREATE INDEX "story_events_projectId_createdAt_idx" ON "story_events"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quotas" ADD CONSTRAINT "user_quotas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usages" ADD CONSTRAINT "ai_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usages" ADD CONSTRAINT "ai_usages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

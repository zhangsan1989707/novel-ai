-- CreateTable
CREATE TABLE "style_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'USER_UPLOADED',
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "authorLabel" TEXT,
    "displayLabel" TEXT NOT NULL,
    "profileJson" JSONB NOT NULL,
    "promptCard" TEXT,
    "sampleStats" JSONB,
    "sourceNovelId" TEXT,
    "virtualWriterId" INTEGER,
    "creatorId" INTEGER NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_profiles_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "novel_projects" ADD COLUMN "styleProfileId" TEXT;
ALTER TABLE "novel_projects" ADD COLUMN "styleStrength" DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE "novel_projects" ADD COLUMN "styleSafetyMode" TEXT NOT NULL DEFAULT 'SAFE';

-- CreateIndex
CREATE INDEX "style_profiles_creatorId_idx" ON "style_profiles"("creatorId");

-- AddForeignKey
ALTER TABLE "style_profiles" ADD CONSTRAINT "style_profiles_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_projects" ADD CONSTRAINT "novel_projects_styleProfileId_fkey" FOREIGN KEY ("styleProfileId") REFERENCES "style_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

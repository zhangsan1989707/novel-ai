-- CreateTable chapter_completion_reports
CREATE TABLE IF NOT EXISTS "chapter_completion_reports" (
  "id" TEXT NOT NULL,
  "projectId" INTEGER NOT NULL,
  "chapterNo" INTEGER NOT NULL,
  "actualWordCount" INTEGER NOT NULL,
  "targetWordCount" INTEGER NOT NULL,
  "chapterGoalCompleted" BOOLEAN NOT NULL DEFAULT false,
  "mainConflictProgressed" BOOLEAN NOT NULL DEFAULT false,
  "mainConflictResolved" BOOLEAN NOT NULL DEFAULT false,
  "endingHookExists" BOOLEAN NOT NULL DEFAULT false,
  "abruptTruncationDetected" BOOLEAN NOT NULL DEFAULT false,
  "completionScore" INTEGER NOT NULL,
  "issues" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chapter_completion_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chapter_completion_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "chapter_completion_reports_projectId_chapterNo_key"
  ON "chapter_completion_reports"("projectId", "chapterNo");

CREATE INDEX IF NOT EXISTS "chapter_completion_reports_projectId_idx"
  ON "chapter_completion_reports"("projectId");

CREATE INDEX IF NOT EXISTS "chapter_completion_reports_projectId_completionScore_idx"
  ON "chapter_completion_reports"("projectId", "completionScore");

-- CreateTable arc_event_ledger
CREATE TABLE IF NOT EXISTS "arc_event_ledger" (
  "id" TEXT NOT NULL,
  "projectId" INTEGER NOT NULL,
  "arcPlanId" TEXT,
  "arcNumber" INTEGER,
  "eventKey" TEXT NOT NULL,
  "eventDescription" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "plannedChapterNo" INTEGER,
  "actualChapterNo" INTEGER,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "arc_event_ledger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "arc_event_ledger_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "arc_event_ledger_projectId_eventKey_key"
  ON "arc_event_ledger"("projectId", "eventKey");

CREATE INDEX IF NOT EXISTS "arc_event_ledger_projectId_status_idx"
  ON "arc_event_ledger"("projectId", "status");

CREATE INDEX IF NOT EXISTS "arc_event_ledger_projectId_actualChapterNo_idx"
  ON "arc_event_ledger"("projectId", "actualChapterNo");

-- CreateTable cheat_ability_states
CREATE TABLE IF NOT EXISTS "cheat_ability_states" (
  "id" TEXT NOT NULL,
  "projectId" INTEGER NOT NULL UNIQUE,
  "cheatName" TEXT NOT NULL,
  "oneLineRule" TEXT NOT NULL,
  "unlockedAbilities" JSONB NOT NULL DEFAULT '[]',
  "usageHistory" JSONB NOT NULL DEFAULT '[]',
  "currentMarkValue" INTEGER NOT NULL DEFAULT 0,
  "currentBacklashValue" INTEGER NOT NULL DEFAULT 0,
  "cooldownActiveUntilChapter" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cheat_ability_states_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cheat_ability_states_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AddField NovelChapter.completionReport
ALTER TABLE "novel_chapters" ADD COLUMN IF NOT EXISTS "completionReport" JSONB;

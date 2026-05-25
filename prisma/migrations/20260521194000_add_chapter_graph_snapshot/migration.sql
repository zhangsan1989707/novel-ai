CREATE TABLE IF NOT EXISTS "chapter_graph_snapshots" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "graph" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "sourceUpdatedAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_graph_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chapter_graph_snapshots_projectId_key"
ON "chapter_graph_snapshots" ("projectId");

ALTER TABLE "chapter_graph_snapshots"
ADD CONSTRAINT "chapter_graph_snapshots_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

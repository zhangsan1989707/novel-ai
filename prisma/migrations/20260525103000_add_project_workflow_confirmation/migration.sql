ALTER TABLE "novel_projects"
ADD COLUMN "workflowStage" TEXT NOT NULL DEFAULT 'BLUEPRINT_CONFIRM',
ADD COLUMN "blueprintConfirmedAt" TIMESTAMP(3),
ADD COLUMN "arcPlanConfirmedAt" TIMESTAMP(3);

UPDATE "novel_projects" p
SET
  "blueprintConfirmedAt" = NOW(),
  "arcPlanConfirmedAt" = NOW(),
  "workflowStage" = 'GENERATE'
WHERE EXISTS (
  SELECT 1
  FROM "novel_chapters" c
  WHERE c."projectId" = p."id"
);

UPDATE "novel_projects" p
SET "workflowStage" = CASE
  WHEN p."workflowStage" = 'GENERATE' THEN 'GENERATE'
  WHEN EXISTS (
    SELECT 1
    FROM "arc_plans" a
    WHERE a."projectId" = p."id"
  ) THEN 'ARC_PLAN_CONFIRM'
  WHEN EXISTS (
    SELECT 1
    FROM "book_blueprints" b
    WHERE b."projectId" = p."id"
  ) THEN 'BLUEPRINT_CONFIRM'
  ELSE 'BLUEPRINT_CONFIRM'
END;

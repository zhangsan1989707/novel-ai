-- CreateIndex
CREATE INDEX "ai_model_configs_isDefault_idx" ON "ai_model_configs" ("isDefault");

-- CreateIndex: 复合索引，优化按用户+状态查询项目的场景
CREATE INDEX "novel_projects_creatorId_status_idx" ON "novel_projects" ("creatorId", "status");

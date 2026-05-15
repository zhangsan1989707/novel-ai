-- 添加性能优化索引
-- 执行: npx prisma migrate dev --name add_performance_indexes

-- NovelChapter 表索引优化
-- 优化排序查询（按章节号排序）
CREATE INDEX IF NOT EXISTS idx_novel_chapters_project_chapter_number 
ON novel_chapters(project_id, chapter_number);

-- 优化后台任务查询（待处理的章节）
CREATE INDEX IF NOT EXISTS idx_novel_chapters_status_updated 
ON novel_chapters(status, updated_at);

-- AgentLog 表索引优化
-- 优化按类型和时间分析
CREATE INDEX IF NOT EXISTS idx_agent_logs_project_agent_created 
ON agent_logs(project_id, agent_type, created_at);

-- 优化按状态查询（重试任务）
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_status 
ON agent_logs(agent_type, status);

-- AIUsage 表索引优化
-- 优化用户月度配额查询（已有索引，确保存在）
CREATE INDEX IF NOT EXISTS idx_ai_usages_user_usage_month 
ON ai_usages(user_id, usage_month);

-- Character 表索引优化
-- 优化按项目查询所有角色
CREATE INDEX IF NOT EXISTS idx_characters_project_role 
ON characters(project_id, role);

-- Plotline 表优化
-- 确保复合索引存在
CREATE INDEX IF NOT EXISTS idx_plotlines_project_status 
ON plotlines(project_id, status);

-- StoryEvent 表索引优化
-- 优化按时间范围查询
CREATE INDEX IF NOT EXISTS idx_story_events_project_created 
ON story_events(project_id, created_at);

-- 为 JSON 字段添加 GIN 索引（PostgreSQL 特定）
-- 情绪曲线索引
CREATE INDEX IF NOT EXISTS idx_story_states_emotional_arc 
ON story_states USING GIN (emotional_arc);

-- 角色关系索引
CREATE INDEX IF NOT EXISTS idx_characters_relationships 
ON characters USING GIN (relationships);

-- 角色当前状态索引
CREATE INDEX IF NOT EXISTS idx_characters_current_state 
ON characters USING GIN (current_state);

-- 分析数据索引
CREATE INDEX IF NOT EXISTS idx_book_analysis_data 
ON book_analysis USING GIN (analysis_data);

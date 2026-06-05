# Changelog

所有重要的项目变更都将记录在此文件中。

> 最后更新：2026-06-05

## [0.1.0] - Current

### 最新变更 (2026-06-01 ~ 2026-06-05)

#### 章节连续性增强
- **章节连续性系统** (`chapter-continuity.ts`): 跨章节连续性锚点、禁止跳跃、语义审计
- **串行章节流程** (`serial-chapter-flow`): 上一章结尾承诺必须在下一章兑现
- **开篇承诺检测**: 决策钩子、系统提示、倒计时、门/到达等 hook 类型检测
- **动态词汇**: 根据上下文动态调整写作词汇

#### 项目运行态统一 (2026-06-01)
- 新增 `ProjectRuntimeStage`、`ChapterRuntimeStatus`、`ProjectRuntimeSummary`
- 统一 `/pipeline/status` 与 `/pipeline/stream` 的快照构建逻辑
- 项目详情 API 返回 `runtimeSummary`
- 顶部 badge、控制面板、侧栏进度、章节目录全部接入统一运行态

#### 质量审计修复 (2026-06-01)
- 修复 Writer maxTokens 低估导致章节截断 (系数 1.1 → 2.5)
- 修复 continueChapter 修复上下文不足
- 修复章节开篇缺乏衔接机制
- 修复质量门禁评分权重偏差
- 修复 Reviewer 审核结果解析
- 修复 Polisher 未检测去 AI 味
- 修复 Orchestrator finishReason 传递

#### 开发基础设施 (2026-05-31 ~ 2026-06-01)
- 统一错误处理体系 (`src/lib/errors/`)
- Agent 模块单元测试 (planner/validator)
- 核心模块文档 (agents/ai/memory/engine)
- API 文档 (projects)
- 项目详情 500 兼容修复

### 早期功能 (v0.1.0)

#### 核心功能
- **多智能体协作系统** (11 种 Agent)
  - Planner Agent - 章节大纲策划
  - Writer Agent - 章节正文生成
  - Polisher Agent - 文笔润色优化
  - Validator Agent - 质量校验验证
  - Summarizer Agent - 章节摘要生成
  - Researcher Agent - 资料研究
  - Reviewer Agent - 多人评审
  - Reader Agent - 读者视角审核
  - Deslopper Agent - 去AI味处理
  - NarrativeDirector Agent - 叙事导演
  - QualityAnalyzer Agent - 质量分析

- **项目管理**
  - 项目 CRUD 操作
  - 项目状态管理 (DRAFT/WRITING/COMPLETED/PAUSED)
  - 两种创作模式 (CREATE/ANALYZE)
  - 长篇/短篇支持

- **章节管理**
  - 章节 CRUD 操作
  - 拖拽排序 (dnd-kit)
  - 版本历史记录
  - 批量生成支持
  - SSE 流式生成
  - 章节提交与重播

- **角色系统**
  - 角色档案管理
  - 角色关系图可视化 (React Flow)
  - 角色声音指纹系统
  - 角色类型区分 (主角/反派/配角/次要)

- **伏笔追踪**
  - 伏笔/支线/冲突管理
  - 自动伏笔回收
  - 伏笔计划章节设置
  - 伏笔追踪表可视化

- **故事状态**
  - 情绪曲线追踪
  - 主线/支线冲突状态
  - 章节进度管理
  - 世界状态管理

- **分层摘要系统**
  - L1: 章节摘要 (200-300字)
  - L2: 卷摘要 (500-800字)
  - L3: 全书摘要 (1000-1500字)

- **去 AI 味系统**
  - 60+ 分层禁用词库 (L1/L2/L3)
  - 10 种禁止模式检测
  - 多维评分系统 (词汇/模式/结构/节奏/沉浸度)
  - 章节质量分析面板
  - 批量去 AI 味优化
  - 三档优化强度 (轻/中/重)

- **长篇工业化控制**
  - Book Blueprint 蓝图系统
  - Arc Plan 弧线规划
  - 动态章节批次系统
  - 防提前结局验证
  - 世界扩张引擎
  - 反派生命周期管理
  - 上下文预算管理
  - Pipeline Checkpoint 断点续传

- **AI 分析功能**
  - 情节分析
  - 风格分析
  - 章节节奏热力图
  - 风格一致性检查
  - 维度关联分析
  - 分层摘要生成
  - 角色提取

- **导出功能**
  - TXT 导出
  - Markdown 导出
  - JSON 导出
  - EPUB 导出

- **虚拟作家**
  - 风格特征定义
  - 文档上传和处理
  - 写作风格学习
  - 训练状态管理

- **风格配置系统**
  - 风格提取与验证
  - 多维度风格数据 (prose/vocabulary/sentence/rhetoric/narrative/plot/character)
  - 风格安全模式
  - 项目风格集成

- **市场分析**
  - 平台排行榜分析
  - 市场趋势追踪
  - 竞品分析
  - 灵感市场

- **封面生成**
  - AI 封面生成
  - 封面管理

- **成本追踪**
  - AI 调用记录
  - Token 使用统计
  - 月度配额管理
  - 费用预警

- **RAG 向量检索**
  - 基于 pgvector 的智能检索
  - 向量索引重建

- **故事导向系统**
  - 可调节创作参数 (pace/darkness/humor/romance/conflict)

- **项目健康度**
  - 伏笔回收率
  - 章节完成率
  - 角色一致性
  - 自动维护任务

#### 技术特性
- **8 家 AI 提供商**: OpenAI / Anthropic / 阿里云 / DeepSeek / MiniMax / 火山引擎 / 智谱 AI / 秘塔 AI
- **智能路由**: 按任务类型自动选择最优模型
- **模型降级**: 超时→重试→降级→暂停
- **上下文压缩**: 固定窗口/滑动窗口/摘要替换
- **开发工具**: Vitest (280 tests) / Playwright / ESLint / Pino 日志

#### 数据库模型 (30+)
User, AIModelConfig, NovelProject, NovelChapter, ChapterVersion, VirtualWriter, WriterDocument, BookAnalysis, SourceNovel, Character, Plotline, StoryState, StoryEvent, AgentLog, ChapterSummary, VolumeSummary, BookSummary, ModelPricing, UserQuota, AIUsage, Notification, MarketTrend, MarketBook, ResearchRef, CoverDesign, ReviewReport, ShortStory, ShortStorySection, GenerationJob, PipelineCheckpoint, ChapterCommit, AnalysisTask, ArcPlan, BookBlueprint, Villain, WorldState, ProjectMaintenanceTask, StyleProfile

---

## 旧版本

[0.0.1] - Initial release (待补充)

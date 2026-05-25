# Tasks

## Phase 1: 基础设施（数据模型 + 类型定义）

- [ ] **Task 1: 新增 Prisma 数据模型**
  - [ ] 1.1 新增 `GenerationJob` 模型（id, projectId, type, status, currentStep, retryCount, payload, result, checkpoint）
  - [ ] 1.2 新增 `PipelineCheckpoint` 模型（id, jobId, step, input, output, error, status）
  - [ ] 1.3 新增 `ArcPlan` 模型（id, projectId, arcNumber, name, stage, description, batchSize）
  - [ ] 1.4 新增 `BookBlueprint` 模型（id, projectId, corePitch, worldDirection, mainlineDirection, growthDirection, endingDirection）
  - [ ] 1.5 新增 `StorySteering` 字段到 `NovelProject`（pace, darkness, humor, romance, powerGrowth, conflictIntensity, mysteryDensity）
  - [ ] 1.6 新增 `platform` 和 `lengthType` 字段到 `NovelProject`
  - [ ] 1.7 新增 `Villain` 模型（id, projectId, name, tier, isFinalBoss, lifecycle）
  - [ ] 1.8 新增 `WorldState` 模型（id, projectId, mapLevel, factionCount, powerLevel, civilizationLevel）
  - [ ] 运行 `prisma migrate dev` 创建迁移

- [ ] **Task 2: 新增 TypeScript 类型定义**
  - [ ] 2.1 定义 `Platform` 枚举（qidian/fanqie/feilu/jinjiang/qimao）
  - [ ] 2.2 定义 `LengthType` 枚举（short/medium/long/ultra_long）
  - [ ] 2.3 定义 `ArcStage` 枚举（opening/growth/expansion/mid_conflict/pre_finale/finale）
  - [ ] 2.4 定义 `StorySteering` 接口
  - [ ] 2.5 定义 `GenerationJob` 相关类型
  - [ ] 2.6 定义 `PlatformTemplate` 接口
  - [ ] 2.7 定义 `PipelineStep` 枚举

## Phase 2: 后端核心引擎（可并行开发）

- [ ] **Task 3: PlatformStyleEngine 平台模板引擎**
  - [ ] 3.1 创建 `src/lib/engine/platform-style.ts`
  - [ ] 3.2 实现 5 个平台的模板配置（起点/番茄/飞卢/晋江/七猫）
  - [ ] 3.3 实现 `getPlatformTemplate(platform)` 方法
  - [ ] 3.4 实现 `getStylePrompt(platform, genre, style)` 生成平台适配提示词

- [ ] **Task 4: BatchPlanner 动态批次规划器**
  - [ ] 4.1 创建 `src/lib/engine/batch-planner.ts`
  - [ ] 4.2 实现 `calculateBatchSize(platform, stage, worldComplexity, plotDensity)` 方法
  - [ ] 4.3 批次大小范围 10-30 章，根据参数动态计算

- [ ] **Task 5: OutlineValidator 防提前结局校验器**
  - [ ] 5.1 创建 `src/lib/engine/outline-validator.ts`
  - [ ] 5.2 实现 `validateOutline(chapters, progressRatio)` 方法
  - [ ] 5.3 定义禁止关键词列表（终局、大结局、最终决战、天下太平、一切结束、终焉）
  - [ ] 5.4 进度 < 85% 时检测并标记违规内容
  - [ ] 5.5 返回校验结果（passed, warnings, violations）

- [ ] **Task 6: WorldExpansionEngine 世界扩张引擎**
  - [ ] 6.1 创建 `src/lib/engine/world-expansion.ts`
  - [ ] 6.2 实现 `shouldExpandWorld(currentArc, worldState)` 判断是否需要扩张
  - [ ] 6.3 实现 `generateExpansionPrompt(currentArc, worldState)` 生成扩张提示词
  - [ ] 6.4 扩张维度：地图、势力、修炼体系上限、阶级、文明层级

- [ ] **Task 7: VillainLifecycleManager 反派生命周期管理**
  - [ ] 7.1 创建 `src/lib/engine/villain-lifecycle.ts`
  - [ ] 7.2 实现 `classifyVillain(villain, progressRatio)` 分类（阶段Boss/终极Boss）
  - [ ] 7.3 实现 `shouldIntroduceFinalBoss(progressRatio)` 判断可否引入终极Boss
  - [ ] 7.4 终极Boss 只在进度 > 70% 时才能出场

- [ ] **Task 8: StorySteering 方向控制系统**
  - [ ] 8.1 创建 `src/lib/engine/story-steering.ts`
  - [ ] 8.2 实现 `applySteering(basePrompt, steering)` 将方向参数注入提示词
  - [ ] 8.3 实现 `parseSteeringAction(action)` 解析用户操作（更爽/更快/更黑暗等）
  - [ ] 8.4 定义 7 个维度的调节范围和默认值

- [ ] **Task 9: ContextBudgetManager 上下文预算管理**
  - [ ] 9.1 创建 `src/lib/engine/context-budget.ts`
  - [ ] 9.2 实现 `buildChapterContext(projectId, chapterNumber)` 构建当前章节上下文
  - [ ] 9.3 实现预算分配比例（blueprint 10%, arcPlan 15%, summaries 25%, plotlines 15%, characters 15%, styleGuide 10%, currentOutline 10%）
  - [ ] 9.4 实现 `trimContext(context, maxTokens)` 超限裁剪（优先丢老正文、过期角色、已关闭伏笔）
  - [ ] 9.5 保留规则：当前目标、活跃伏笔、主角状态、世界规则绝不被裁剪

- [ ] **Task 10: LongNovelController 长篇意识系统**
  - [ ] 10.1 创建 `src/lib/engine/long-novel-controller.ts`
  - [ ] 10.2 集成 BatchPlanner + OutlineValidator + WorldExpansionEngine + VillainLifecycleManager
  - [ ] 10.3 实现 `getNextBatchContext(projectId)` 为下一批次生成做准备
  - [ ] 10.4 实现 `shouldAdvanceArc(projectId)` 判断是否推进到下一阶段

- [ ] **Task 11: NarrativeDirector Agent**
  - [ ] 11.1 创建 `src/lib/agents/narrative-director.ts`
  - [ ] 11.2 实现 `directChapter(chapterNumber, projectId)` 为每章生成导演指令
  - [ ] 11.3 协调：StorySteering + ArcPlan + PlatformTemplate + WorldState + VillainState
  - [ ] 11.4 输出注入 Writer Agent 的导演上下文

- [ ] **Task 12: ModelFallbackPolicy 模型降级策略**
  - [ ] 12.1 创建 `src/lib/ai/model-fallback.ts`
  - [ ] 12.2 实现 Agent 到模型优先级的映射（Planner→高质量, Writer→中文长文本, Validator→便宜逻辑, Summarizer→快速便宜, Deslopper→中等）
  - [ ] 12.3 实现 `executeWithFallback(agentType, fn)` 超时→重试→降级→暂停 链路

- [ ] **Task 13: GenerationJob + PipelineCheckpoint 异步任务系统**
  - [ ] 13.1 创建 `src/lib/engine/generation-job.ts`
  - [ ] 13.2 实现 `createJob(projectId, type)` 创建异步任务
  - [ ] 13.3 实现 `executeJob(jobId)` 按序执行流水线步骤
  - [ ] 13.4 每步完成后保存 PipelineCheckpoint
  - [ ] 13.5 实现 `resumeJob(jobId)` 从 checkpoint 恢复
  - [ ] 13.6 实现流水线状态轮询/SSE 推送

## Phase 3: 前端（可与 Phase 2 并行开发）

- [ ] **Task 14: 极简项目创建页**
  - [ ] 14.1 重构 `src/app/(main)/projects/new/page.tsx`
  - [ ] 14.2 极简表单：平台选择、题材选择、一句话卖点、风格选择、长度类型选择
  - [ ] 14.3 高级模式折叠面板：主角设定、世界观、禁忌、参考书
  - [ ] 14.4 「开始创作」按钮触发全自动流水线
  - [ ] 14.5 表单验证和提交逻辑

- [ ] **Task 15: 项目详情页重构（创作总控台）**
  - [ ] 15.1 重构 `src/app/(main)/projects/[projectId]/page.tsx`
  - [ ] 15.2 流水线进度面板（当前步骤、阶段进度、预计剩余章节）
  - [ ] 15.3 StorySteering 面板（7 个维度滑块 + 快捷按钮）
  - [ ] 15.4 章节预览列表（只读，按 Arc 分组）
  - [ ] 15.5 工具箱入口
  - [ ] 15.6 移除复杂的目录 Tab、正文 Tab 独立操作

- [ ] **Task 16: 编辑器降级为预览器**
  - [ ] 16.1 重构 `src/components/chapter/ChapterEditor.tsx`
  - [ ] 16.2 主区域改为只读预览模式
  - [ ] 16.3 工具栏：AI 续写、AI 重写、AI 改风格、AI 去 AI 味
  - [ ] 16.4 手工编辑移到独立的手动编辑面板（非默认显示）

- [ ] **Task 17: 工具箱系统**
  - [ ] 17.1 创建 `src/components/ai/Toolbox.tsx`
  - [ ] 17.2 工具列表：AI 去 AI 味、AI 改番茄风格、AI 爽文增强、AI 扩写、AI 压缩、AI 对话增强、AI 打脸增强
  - [ ] 17.3 每个工具独立弹窗/面板
  - [ ] 17.4 不进入主流程

- [ ] **Task 18: StorySteering 面板**
  - [ ] 18.1 创建 `src/components/ai/StorySteeringPanel.tsx`
  - [ ] 18.2 7 个维度滑块（pace, darkness, humor, romance, powerGrowth, conflictIntensity, mysteryDensity）
  - [ ] 18.3 快捷按钮（更爽、更快、更黑暗、增加感情线、增加打脸、减少系统感）
  - [ ] 18.4 实时更新到后端

## Phase 4: API + 集成

- [ ] **Task 19: 流水线 API**
  - [ ] 19.1 创建 `src/app/api/novel/projects/[projectId]/pipeline/start/route.ts` — 启动流水线
  - [ ] 19.2 创建 `src/app/api/novel/projects/[projectId]/pipeline/status/route.ts` — 查询状态
  - [ ] 19.3 创建 `src/app/api/novel/projects/[projectId]/pipeline/resume/route.ts` — 恢复任务
  - [ ] 19.4 创建 `src/app/api/novel/projects/[projectId]/steering/route.ts` — StorySteering 更新

- [ ] **Task 20: 三级目录 API 重构**
  - [ ] 20.1 重构 `src/app/api/novel/ai/generate-chapter-list/route.ts` 为阶段批次生成
  - [ ] 20.2 新增 `src/app/api/novel/projects/[projectId]/blueprint/route.ts` — Book Blueprint
  - [ ] 20.3 新增 `src/app/api/novel/projects/[projectId]/arc-plan/route.ts` — Arc Plan

- [ ] **Task 21: 工具箱 API**
  - [ ] 21.1 新增或复用已有 API 支持工具箱各工具
  - [ ] 21.2 AI 改番茄风格、爽文增强、扩写、压缩、对话增强、打脸增强

- [ ] **Task 22: 全文构建测试**
  - [ ] 22.1 `npm run build` 无类型错误
  - [ ] 22.2 新旧 API 兼容性检查
  - [ ] 22.3 部署到测试环境

## Task Dependencies

```
Phase 1 (基础设施)
  ├─ Task 1 (Prisma 模型) ───── 无依赖
  └─ Task 2 (类型定义) ──────── 无依赖，可与 Task 1 并行

Phase 2 (后端引擎) — 依赖 Phase 1 完成
  ├─ Task 3 (PlatformStyleEngine) ─── 无内部依赖
  ├─ Task 4 (BatchPlanner) ───────── 无内部依赖
  ├─ Task 5 (OutlineValidator) ───── 无内部依赖
  ├─ Task 6 (WorldExpansionEngine) ── 无内部依赖
  ├─ Task 7 (VillainLifecycleManager) 无内部依赖
  ├─ Task 8 (StorySteering) ───────── 无内部依赖
  ├─ Task 9 (ContextBudgetManager) ── 无内部依赖
  ├─ Task 12 (ModelFallbackPolicy) ── 无内部依赖
  ├─ Task 10 (LongNovelController) ── 依赖 Task 4,5,6,7
  ├─ Task 11 (NarrativeDirector) ──── 依赖 Task 3,8,10
  └─ Task 13 (GenerationJob) ──────── 依赖 Task 1,11

Phase 3 (前端) — 可与 Phase 2 并行开发
  ├─ Task 14 (项目创建页) ─────── 依赖 Task 2 (类型)
  ├─ Task 15 (项目详情页) ─────── 依赖 Task 2 (类型)
  ├─ Task 16 (编辑器降级) ─────── 依赖 Task 2 (类型)
  ├─ Task 17 (工具箱) ──────────── 依赖 Task 2 (类型)
  └─ Task 18 (StorySteering面板) ─ 依赖 Task 2 (类型)

Phase 4 (API + 集成) — 依赖 Phase 2 + Phase 3
  ├─ Task 19 (流水线 API) ──── 依赖 Task 13
  ├─ Task 20 (目录 API) ────── 依赖 Task 4,5,10
  ├─ Task 21 (工具箱 API) ──── 依赖 Task 17
  └─ Task 22 (构建测试) ────── 依赖全部
```
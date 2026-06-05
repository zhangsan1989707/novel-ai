# Novel AI 项目全面分析报告

> 生成时间：2026-06-05  
> 项目版本：v0.1.0  
> 代码规模：219 个 TS 库文件 + 100 个 TSX 组件 + 135 个 API 路由

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构](#2-技术架构)
3. [数据库模型](#3-数据库模型)
4. [核心功能模块](#4-核心功能模块)
5. [API接口体系](#5-api接口体系)
6. [多智能体协作系统](#6-多智能体协作系统)
7. [AI服务集成](#7-ai服务集成)
8. [前端组件架构](#8-前端组件架构)
9. [业务逻辑流程](#9-业务逻辑流程)
10. [技术亮点与创新](#10-技术亮点与创新)
11. [当前状态](#11-当前状态)

---

## 1. 项目概述

### 1.1 项目定位

Novel AI 是一个基于多智能体协作的 **AI 网络小说工业化生产系统**。核心壁垒不是"AI 会写小说"，而是**长篇稳定工业化控制**：无限续写、防崩坏、防提前结局、世界扩张、平台节奏适配。

### 1.2 项目模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **创作模式 (CREATE)** | 从零开始创作小说，AI 辅助生成 | 新书创作 |
| **拆解模式 (ANALYZE)** | 导入已有小说进行结构分析 | 学习分析 |

### 1.3 核心数据

| 指标 | 数值 |
|------|------|
| TypeScript 库文件 | 219 |
| React 组件 | 100 |
| API 路由 | 135 |
| Prisma 模型 | 30+ |
| Agent 类型 | 11 |
| AI 提供商 | 8 |
| 单元测试 | 280 (35 files) |

---

## 2. 技术架构

### 2.1 技术栈

| 类别 | 技术选型 | 版本 |
|------|----------|------|
| **前端框架** | Next.js | 16.2.4 |
| **React** | React | 19.2.4 |
| **数据库** | PostgreSQL + Prisma | 6.19.3 |
| **AI 提供商** | 8 家厂商 | - |
| **样式方案** | Tailwind CSS | 4 |
| **状态管理** | React Hook Form + Zod | 4.4.1 |
| **可视化** | D3.js + React Flow | - |
| **拖拽排序** | @dnd-kit | 6.3.1 |
| **测试框架** | Vitest + Playwright | - |
| **认证** | NextAuth.js | 5.0 beta |
| **日志** | Pino | 10.3.1 |

### 2.2 AI 服务提供商 (8家)

| 厂商 | 枚举值 | 默认模型 |
|------|--------|----------|
| OpenAI | `OPENAI` | gpt-4o |
| Anthropic | `ANTHROPIC` | claude-3.5-sonnet |
| 阿里云 | `ALIBABA` | qwen-max |
| DeepSeek | `DEEPSEEK` | deepseek-chat |
| MiniMax | `MINIMAX` | abab6.5s |
| 火山引擎 | `VOLCENGINE` | doubao-pro-32k |
| 智谱 AI | `ZHIPU` | glm-4 |
| 秘塔 AI | `MIMO` | - |

### 2.3 目录结构

```
novel-ai/
├── prisma/                              # 数据库模型 (schema + migrations)
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── (main)/                    # 主应用路由组
│   │   │   ├── projects/              # 项目管理
│   │   │   │   ├── new/               # 新建项目
│   │   │   │   └── [projectId]/       # 项目详情 + 章节
│   │   │   ├── settings/               # 系统设置
│   │   │   ├── cost/                   # 成本统计
│   │   │   └── market/                 # 市场分析
│   │   └── api/                        # API 路由 (135个)
│   │       ├── novel/                  # 小说相关
│   │       │   ├── ai/                 # AI 能力 (20个)
│   │       │   ├── engine/             # 引擎 (8个)
│   │       │   ├── projects/           # 项目管理 (15个)
│   │       │   ├── deslop/             # 去AI味 (2个)
│   │       │   └── chapter-quality/    # 质量分析 (3个)
│   │       ├── short-story/            # 短篇 (8个)
│   │       ├── market/                 # 市场 (3个)
│   │       ├── agents/                 # Agent
│   │       ├── hooks/                  # 钩子
│   │       ├── notifications/          # 通知
│   │       └── styles/                 # 风格
│   ├── components/                      # React 组件 (100个)
│   │   ├── ai/                         # AI 功能 (30个)
│   │   │   ├── StreamViewer.tsx        # 流式生成
│   │   │   ├── DeslopPanel.tsx         # 去AI味面板
│   │   │   ├── ChapterQualityPanel.tsx # 质量分析
│   │   │   ├── ReviewPanel.tsx         # 审核
│   │   │   ├── PlotlineTracker.tsx     # 伏笔追踪
│   │   │   ├── CharacterRelationshipGraph.tsx  # 角色关系图
│   │   │   ├── ChapterRhythmHeatmap.tsx # 节奏热力图
│   │   │   ├── GeneratePanel.tsx       # 生成面板
│   │   │   ├── ContinuationPanel.tsx   # 续写面板
│   │   │   ├── BatchProgress.tsx       # 批量进度
│   │   │   ├── BookAnalysisPanel.tsx   # 书籍分析
│   │   │   └── ...
│   │   ├── chapter/                     # 章节组件
│   │   ├── project/                    # 项目组件
│   │   ├── ui/                         # 通用 UI
│   │   ├── writer/                     # 虚拟作家
│   │   └── layout/                     # 布局
│   ├── lib/                            # 核心业务逻辑 (219个)
│   │   ├── engine/                     # 小说引擎 (60个文件)
│   │   │   ├── orchestrator.ts         # 主编排器
│   │   │   ├── production-pipeline.ts  # 生产流水线
│   │   │   ├── project-runtime.ts      # 统一运行态
│   │   │   ├── project-pipeline-snapshot.ts # 快照构建
│   │   │   ├── chapter-continuity.ts   # 章节连续性
│   │   │   ├── chapter-repair.ts       # 章节修复
│   │   │   ├── chapter-commit.ts       # 章节提交
│   │   │   ├── quality-gate.ts         # 质量门禁
│   │   │   ├── context-budget.ts       # 上下文预算
│   │   │   ├── context-compression.ts  # 上下文压缩
│   │   │   ├── long-novel-controller.ts # 长篇控制器
│   │   │   ├── story-state.ts          # 故事状态
│   │   │   ├── story-steering.ts       # 故事导向
│   │   │   ├── world-expansion.ts      # 世界扩张
│   │   │   ├── villain-lifecycle.ts    # 反派生命周期
│   │   │   ├── truncation-detector.ts  # 截断检测
│   │   │   ├── blueprint-console.ts    # 蓝图书写
│   │   │   ├── rag-vector.ts           # RAG 检索
│   │   │   ├── validation/             # 验证模块
│   │   │   └── ...
│   │   ├── agents/                     # Agent 智能体 (18个)
│   │   │   ├── planner.ts              # 策划 Agent
│   │   │   ├── writer.ts               # 写作 Agent
│   │   │   ├── polisher.ts             # 润色 Agent
│   │   │   ├── validator.ts            # 校验 Agent
│   │   │   ├── summarizer.ts           # 摘要 Agent
│   │   │   ├── researcher.ts           # 研究 Agent
│   │   │   ├── reviewer.ts             # 评审 Agent
│   │   │   ├── reader.ts               # 读者 Agent
│   │   │   ├── deslopper.ts            # 去AI味 Agent
│   │   │   ├── narrative-director.ts   # 叙事导演
│   │   │   ├── quality-analyzer.ts     # 质量分析
│   │   │   ├── feedback-loop.ts        # 反馈循环
│   │   │   ├── model-strategy.ts       # 模型策略
│   │   │   ├── correction-builder.ts   # 修正构建
│   │   │   ├── adapters.ts             # 适配器
│   │   │   ├── base.ts                 # 基础接口
│   │   │   ├── prompts.ts              # 提示词模板
│   │   │   └── registry.ts             # 注册表
│   │   ├── ai/                         # AI 服务封装 (27个)
│   │   │   ├── service.ts              # AI 服务主类
│   │   │   ├── factory.ts              # 工厂模式
│   │   │   ├── smart-router.ts         # 智能路由
│   │   │   ├── model-fallback.ts       # 模型降级
│   │   │   ├── context-manager.ts      # 上下文管理
│   │   │   ├── speed-mode.ts           # 速度模式
│   │   │   ├── traceable-provider.ts   # 可追踪 Provider
│   │   │   ├── providers/              # 8 家提供商实现
│   │   │   └── ...
│   │   ├── memory/                     # 记忆系统 (7个)
│   │   │   ├── memory-orchestrator.ts  # 记忆编排
│   │   │   ├── character-memory.ts     # 角色记忆
│   │   │   ├── chapter-summary.ts      # 章节摘要
│   │   │   ├── volume-summary.ts       # 卷摘要
│   │   │   └── ...
│   │   ├── prompts/                    # 提示词库
│   │   │   ├── chapter/              # 章节提示词
│   │   │   │   ├── writing-v2.ts      # 增强写作
│   │   │   │   ├── planning-v2.ts     # 增强策划
│   │   │   │   └── ...
│   │   │   ├── novel/                 # 小说提示词
│   │   │   ├── deslop/                # 去AI味提示词
│   │   │   ├── analysis/              # 分析提示词
│   │   │   └── shared/               # 共享模板
│   │   ├── knowledge/                  # 写作知识库 (7个)
│   │   │   ├── anti-ai.ts            # 禁用词库 (60+词)
│   │   │   ├── chapter-quality.ts    # 质量分析
│   │   │   ├── hooks.ts              # 知识钩子
│   │   │   └── ...
│   │   ├── export/                    # 导出服务
│   │   │   └── adapters/epub.ts      # EPUB 适配器
│   │   ├── cost-tracker/              # 成本追踪
│   │   └── hooks/                     # 工作流钩子
│   └── types/                          # TypeScript 类型
├── docs/                                # 项目文档 (20+个)
├── scripts/                             # 部署脚本
├── package.json
├── CLAUDE.md                            # 项目配置
├── AGENTS.md                            # Agent 开发指南
├── CHANGELOG.md                         # 变更日志
├── CODE_WIKI.md                         # 代码架构
├── README.md                            # 项目介绍
└── TODO_ISSUES.md                       # TODO 跟踪
```

---

## 3. 数据库模型

### 3.1 ER 图概览

```
User (用户)
├── NovelProject (小说项目)
│   ├── NovelChapter (章节)
│   │   ├── ChapterVersion (版本历史)
│   │   └── ChapterCommit (章节提交)
│   ├── VirtualWriter (虚拟作家)
│   │   └── WriterDocument (训练文档)
│   ├── BookAnalysis (书籍分析)
│   ├── SourceNovel (源小说)
│   ├── Character (角色档案)
│   ├── Plotline (伏笔追踪)
│   ├── StoryState (故事状态)
│   ├── StoryEvent (故事事件)
│   ├── ChapterSummary (章节摘要 L1)
│   ├── VolumeSummary (卷摘要 L2)
│   ├── BookSummary (全书摘要 L3)
│   ├── ShortStory (短篇小说)
│   ├── CoverDesign (封面设计)
│   ├── ResearchRef (研究资料)
│   ├── ReviewReport (评审报告)
│   ├── ArcPlan (弧线规划)
│   ├── BookBlueprint (全书蓝图)
│   ├── Villain (反派)
│   ├── WorldState (世界状态)
│   ├── GenerationJob (生成任务)
│   ├── PipelineCheckpoint (流水线检查点)
│   ├── ProjectMaintenanceTask (维护任务)
│   ├── StyleProfile (风格配置)
│   └── AIModelConfig (AI 模型配置)
├── Notification (通知)
├── AIUsage (AI 使用记录)
└── UserQuota (用户配额)
```

### 3.2 核心枚举

```typescript
ProjectStatus: DRAFT | WRITING | COMPLETED | PAUSED
ChapterStatus: DRAFT | GENERATING | COMPLETED | REVIEWING
CharacterRole: PROTAGONIST | ANTAGONIST | SUPPORTING | MINOR
PlotlineType: FORESHADOW | SUBPLOT | CONFLICT
PlotlineStatus: OPEN | RESOLVED | ABANDONED
AgentType: PLANNER | WRITER | POLISHER | VALIDATOR | SUMMARIZER | RESEARCHER | REVIEWER | READER | DESLOPPER | NARRATIVE_DIRECTOR | QUALITY_ANALYZER
AIVendor: OPENAI | ANTHROPIC | ALIBABA | DEEPSEEK | MINIMAX | VOLCENGINE | ZHIPU | MIMO
```

### 3.3 分层摘要系统

| 层级 | 模型 | 字数范围 | 存储内容 |
|------|------|----------|----------|
| L1 | ChapterSummary | 200-300字 | 摘要 + 关键事件 + 情绪基调 + 伏笔 |
| L2 | VolumeSummary | 500-800字 | 摘要 + 关键事件 + 情绪曲线 + 章节概览 |
| L3 | BookSummary | 1000-1500字 | 主线概述 + 支线 + 角色弧线 + 主题元素 |

---

## 4. 核心功能模块

### 4.1 小说引擎 (60 个文件)

```
src/lib/engine/
├── orchestrator.ts              # 主编排器：Planner → Writer → Polisher → Reviewer → Validator → Deslopper → QualityGate
├── production-pipeline.ts       # 生产级流水线：Blueprint → ArcPlan → ChapterList → Write
├── project-runtime.ts           # 统一运行态：ProjectRuntimeStage / ChapterRuntimeStatus / ProjectRuntimeSummary
├── project-pipeline-snapshot.ts # 快照构建：status 和 stream 共用
├── chapter-continuity.ts        # 章节连续性：锚点 + 审计 + 串行流程
├── chapter-repair.ts            # 章节修复：截断修复 + 上下文增强
├── chapter-commit.ts            # 章节提交：projection writer + 重放
├── quality-gate.ts              # 质量门禁：多维度评分 + 阻断规则
├── context-budget.ts            # 上下文预算：Blueprint(10%) + ArcPlan(15%) + Summaries(25%) + Plotlines(15%) + Characters(15%) + StyleGuide(10%) + Outline(10%)
├── context-compression.ts       # 上下文压缩：固定窗口/滑动窗口/摘要替换
├── long-novel-controller.ts     # 长篇控制器：节奏 + 扩张 + 防提前结局
├── story-state.ts               # 故事状态：情绪曲线 + 冲突 + 进度
├── story-steering.ts            # 故事导向：pace/darkness/humor/romance/conflict
├── world-expansion.ts           # 世界扩张：地图 + 势力 + 层级 + 文明
├── villain-lifecycle.ts         # 反派生命周期：阶段Boss vs 终极Boss
├── truncation-detector.ts       # 截断检测：isLikelyTruncated
├── blueprint-console.ts         # 蓝图书写：核心卖点 + 世界方向 + 主线方向
├── batch-planner.ts             # 批量规划：自动决定 batchSize
├── rag-vector.ts                # RAG 检索：pgvector
├── pipeline-checkpoint.ts       # 检查点：断点续传
├── generation-job.ts            # 生成任务：type/status/currentStep/payload
├── project-health.ts            # 健康度：伏笔回收率/章节完成率
├── auto-maintenance.ts          # 自动维护
└── validation/                  # 验证模块
```

### 4.2 章节生成流水线

```
┌─────────────────────────────────────────────────────────────┐
│                    章节生成流水线                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [策划] ──> [写作] ──> [润色] ──> [评审] ──> [校验]         │
│                                                              │
│                              │                               │
│                              ▼                               │
│                    [去AI味] ──> [质量门禁]                     │
│                                                              │
│                         │                                    │
│                    ┌────┴────┐                               │
│                    │ 通过？    │                               │
│                    └────┬────┘                               │
│                     是  │  否                                 │
│                      ▼  │  ▼                                 │
│               [摘要]    │ [修复] ──> 重试                      │
│                 │       │                                     │
│                 ▼       │                                     │
│             [提交]      │                                     │
│             存入DB      │                                     │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 去 AI 味系统

#### 禁用词库分层

| 层级 | 数量 | 示例 | 处理方式 |
|------|------|------|----------|
| L1 必换 | 14个 | 不禁、顿时、瞬间、赫然、蓦然、骤然、陡然、悄然、旋即 | 立即替换 |
| L2 建议 | 20个 | 缓缓、微微、淡淡、轻轻、默默、深深、渐渐、竟然、居然 | 优先替换 |
| L3 可选 | 20个 | 首先、其次、最后、总之、综上所述、此时此刻、换言之 | 提升质量 |

#### 禁止模式 (10种)

- 排比句堆砌
- 段落结构过于工整
- 每段都以人名开头
- 总结性陈述句结尾
- 过度比喻
- 心理描写直白
- 过度使用副词
- 句式过于对称
- AI风格结尾
- 连续短句

#### 多维评分

| 维度 | 权重 | 检测内容 |
|------|------|----------|
| 词汇自然度 | 25% | L1/L2/L3 禁用词统计 |
| 模式多样性 | 20% | 排比句、对称句检测 |
| 结构变化 | 20% | 段落长度方差分析 |
| 节奏韵律 | 15% | 句子长度分布、副词密度 |
| 沉浸体验 | 20% | 感官描写密度、对话占比 |

---

## 5. API接口体系

### 5.1 API 路由总览 (135个)

| 模块 | 路径 | 数量 | 主要功能 |
|------|------|------|----------|
| 项目管理 | `/api/novel/projects/*` | 15 | CRUD、导出、生成、引导 |
| 章节管理 | `/api/novel/projects/[id]/chapters/*` | 8 | CRUD、排序、摘要增强 |
| AI 能力 | `/api/novel/ai/*` | 20 | 生成、分析、校验、风格 |
| 引擎 | `/api/novel/engine/*` | 8 | 引擎状态、上下文、角色 |
| 流水线 | `/api/novel/projects/[id]/pipeline/*` | 5 | 启动/暂停/恢复/状态/流 |
| 封面 | `/api/novel/cover/*` | 4 | 生成、列表 |
| 去AI味 | `/api/novel/deslop/*` | 2 | 检测、重写 |
| 质量分析 | `/api/novel/ai/chapter-quality/*` | 3 | 分析、优化、批量优化 |
| 短篇 | `/api/short-story/*` | 8 | 写作、大纲、情感、反转 |
| 市场 | `/api/market/*` | 3 | 分析、推荐、趋势 |
| 风格 | `/api/styles/*` | 5 | CRUD、应用 |
| 蓝图 | `/api/novel/projects/[id]/blueprint*` | 2 | 蓝图读写、控制台 |
| 弧线 | `/api/novel/projects/[id]/arc-plans` | 1 | 弧线规划 |
| 章节图谱 | `/api/novel/projects/[id]/chapter-graph` | 1 | 图谱分析 |
| 章节提交 | `/api/novel/projects/[id]/chapter-commits/*` | 2 | 提交、重播 |
| 分析任务 | `/api/novel/projects/[id]/analysis-task*` | 2 | 任务管理 |
| RAG | `/api/novel/projects/[id]/rag/rebuild` | 1 | 向量索引重建 |
| 导向 | `/api/novel/projects/[id]/steering` | 1 | 故事导向 |
| 其他 | `/api/agents/*`, `/api/hooks/*` 等 | 15 | 通用功能 |

### 5.2 核心 API 列表

#### AI 能力

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/novel/ai/generate-chapter-list` | 生成章节目录 |
| POST | `/api/novel/ai/generate-outline` | 生成大纲 |
| POST | `/api/novel/ai/generate-idea` | 生成创意 |
| POST | `/api/novel/ai/revision` | 章节修订 |
| POST | `/api/novel/ai/validate-chapter` | 章节校验 |
| POST | `/api/novel/ai/analyze-plot` | 剧情分析 |
| POST | `/api/novel/ai/analyze-style` | 风格分析 |
| POST | `/api/novel/ai/chapter-rhythm` | 章节节奏 |
| POST | `/api/novel/ai/chapter-quality/analyze` | 质量分析 |
| POST | `/api/novel/ai/chapter-quality/optimize` | 质量优化 |
| POST | `/api/novel/ai/chapter-quality/batch-optimize` | 批量优化 |

#### 流水线

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/novel/projects/[id]/pipeline/start` | 启动流水线 |
| POST | `/api/novel/projects/[id]/pipeline/pause` | 暂停 |
| POST | `/api/novel/projects/[id]/pipeline/resume` | 恢复 |
| GET | `/api/novel/projects/[id]/pipeline/status` | 状态 |
| GET | `/api/novel/projects/[id]/pipeline/stream` | SSE 流 |

---

## 6. 多智能体协作系统

### 6.1 Agent 类型 (11种)

| Agent | 枚举值 | 职责 | 输入 | 输出 |
|-------|--------|------|------|------|
| **Planner** | `PLANNER` | 策划章节大纲 | 章节目标、角色信息、伏笔 | ChapterOutline |
| **Writer** | `WRITER` | 生成章节正文 | 大纲、上下文、设定 | string |
| **Polisher** | `POLISHER` | 文笔润色优化 | 原文、风格要求 | string |
| **Validator** | `VALIDATOR` | 质量校验验证 | 章节内容、设定 | ValidationReport |
| **Summarizer** | `SUMMARIZER` | 章节摘要生成 | 章节正文 | ChapterSummaryData |
| **Researcher** | `RESEARCHER` | 资料收集研究 | 研究主题 | ResearchRef[] |
| **Reviewer** | `REVIEWER` | 多人评审 | 章节内容 | ReviewReport |
| **Reader** | `READER` | 读者视角审核 | 章节内容 | ReaderFeedback |
| **Deslopper** | `DESLOPPER` | 去 AI 味处理 | 原文 | string |
| **NarrativeDirector** | `NARRATIVE_DIRECTOR` | 叙事导演 | 全书状态 | 方向指导 |
| **QualityAnalyzer** | `QUALITY_ANALYZER` | 质量分析 | 章节内容 | QualityReport |

### 6.2 Agent 适配器模式

```typescript
interface AgentDefinition<Input, Output> {
  type: AgentType
  name: string
  description: string
  execute(input: Input): Promise<Output>
}
```

### 6.3 模型职责分配

| Agent | 推荐模型 | 原因 |
|-------|----------|------|
| Planner | 高质量模型 (claude-3.5-sonnet) | 需要创意和结构规划 |
| Writer | 中文长文本模型 (qwen-max) | 需要高质量中文输出 |
| Polisher | 中等模型 (gpt-4o) | 需要语言理解 |
| Validator | 便宜逻辑模型 (deepseek-chat) | 需要逻辑判断 |
| Summarizer | 快速便宜模型 (qwen-plus) | 需要摘要能力 |
| Reviewer | 高质量模型 (claude-3.5-sonnet) | 需要深度分析 |
| Deslopper | 中等模型 (deepseek-chat) | 需要文本改写 |

---

## 7. AI 服务集成

### 7.1 服务封装

```typescript
class AIService {
  static async createProvider(options: {
    projectId?: number
    usageType: string
    vendor?: AIVendor
  }): Promise<AIProvider>
}
```

### 7.2 智能路由

按任务类型自动选择最优模型：

| 任务类型 | 模型池 |
|----------|--------|
| PLANNING | claude-3.5-sonnet, gpt-4o |
| WRITING | claude-3.5-sonnet, qwen-max |
| POLISHING | gpt-4o, glm-4 |
| VALIDATION | deepseek-chat, qwen-plus |
| COST_SENSITIVE | deepseek-chat, abab6.5s |

### 7.3 模型降级策略

```
超时 → 重试 → 降级模型 → 仍失败则暂停任务
```

### 7.4 上下文管理

- 上下文预算分配：Blueprint(10%) + ArcPlan(15%) + Summaries(25%) + Plotlines(15%) + Characters(15%) + StyleGuide(10%) + Outline(10%)
- 超限裁剪：优先丢弃老正文 > 过期角色 > 已关闭伏笔 > 旧阶段目标
- 保留：当前目标 + 活跃伏笔 + 主角状态 + 世界规则

---

## 8. 前端组件架构

### 8.1 组件层次

```
Layout (Header, Sidebar)
  └── Page Components (ProjectsPage, ProjectDetailPage, ChapterEditorPage)
        └── Feature Components
              ├── AI Components (30个): StreamViewer, DeslopPanel, ChapterQualityPanel, ...
              ├── Chapter Components: ChapterList, ChapterEditor
              ├── Project Components: ProjectCard, BatchGenerator
              └── UI Components: Button, Input, Modal, Card, Badge, Toast, ...
```

### 8.2 核心 AI 组件

| 组件 | 功能 |
|------|------|
| `StreamViewer` | SSE 流式生成内容显示 |
| `DeslopPanel` | 去 AI 味检测和重写面板 |
| `ChapterQualityPanel` | 章节质量分析和一键优化 |
| `ReviewPanel` | 多人审核面板 |
| `RevisionPanel` | 章节修订面板 |
| `PlotlineTracker` | 伏笔追踪器 |
| `CharacterRelationshipGraph` | 角色关系图 (React Flow) |
| `ChapterRhythmHeatmap` | 章节节奏热力图 (D3.js) |
| `PlotAnalyzer` | 剧情分析器 |
| `BatchProgress` | 批量生成进度 |
| `GeneratePanel` | 生成配置面板 |
| `ContinuationPanel` | 续写面板 |
| `BookAnalysisPanel` | 书籍分析面板 |
| `AgentManager` | Agent 管理 |
| `MarketScanPanel` | 市场扫描 |
| `StreamViewer` | 流式生成 (支持自动去AI味) |

---

## 9. 业务逻辑流程

### 9.1 小说创作主流程

```
用户输入极简设定
  ↓
AI 生成 Book Blueprint (核心卖点 + 世界方向 + 主线方向)
  ↓
AI 生成 Arc Plan (当前阶段)
  ↓
AI 决定批次大小
  ↓
AI 生成当前目录
  ↓
OutlineValidator (防提前结局)
  ↓
逐章生成正文 (策划→写作→润色→评审→校验→去AI味→质量门禁)
  ↓
生成摘要 → 更新 StoryState → 更新 Plotline
  ↓
进入下一阶段 (世界扩张 → 反派升级 → 新 Arc)
```

### 9.2 章节连续性流程 (新增)

```
生成章节 N-1
  ↓
提取 ContinuityAnchor (结尾原文 + 必须继续点 + 禁止跳跃)
  ↓
构建 OpeningObligation (决策钩子/系统提示/倒计时/门/到达等)
  ↓
注入 Planner prompt (第一场景必须处理 obligation)
  ↓
注入 Writer prompt (前300-500字必须兑现上一章结尾承诺)
  ↓
生成章节 N
  ↓
Continuity Audit (serial_flow_break 检测)
  ↓
通过 → 提交 / 失败 → 修复
```

---

## 10. 技术亮点与创新

### 10.1 分层摘要系统

解决长篇小说 (760+ 章节) token 超限问题，通过摘要聚合而非简单截断保留关键信息。

### 10.2 多维质量评估

5 维度评分 (词汇/模式/结构/节奏/沉浸度)，结合 60+ 禁用词库和 10 种禁止模式。

### 10.3 智能路由

按任务类型自动选择最优 AI 模型，兼顾质量和成本。

### 10.4 章节连续性锚点

上一章结尾承诺必须在下一章兑现，通过 `OpeningObligation` 和 `serial_flow_break` 审计确保阅读流畅性。

### 10.5 长篇工业化控制

- Book Blueprint: 只定义核心方向，不写死全书
- Arc Plan: 阶段规划，当前只生成当前批次
- 世界扩张: 地图/势力/层级/文明持续扩展
- 反派生命周期: 阶段 Boss 不是终极 Boss
- 防提前结局: 进度 < 85% 禁止终局语义

### 10.6 上下文预算管理

精确的 token 预算分配，确保各维度信息都能进入生成上下文。

---

## 11. 当前状态

### 11.1 完成度

| 模块 | 状态 | 说明 |
|------|------|------|
| 项目 CRUD | ✅ | 创作/拆解双模式 |
| 章节管理 | ✅ | CRUD + 拖拽 + 版本 |
| 章节生成 | ✅ | SSE + 批量 + 修复 |
| Agent 流水线 | ✅ | 11 Agent + 质量门禁 |
| 分层摘要 | ✅ | L1/L2/L3 三层 |
| 去 AI 味 | ✅ | 60+词库 + 多维评分 |
| 角色管理 | ✅ | 档案 + 关系图 + 声音指纹 |
| 伏笔追踪 | ✅ | 埋设/回收/状态 |
| 长篇控制 | ✅ | 蓝图 + 弧线 + 世界扩张 |
| 章节连续性 | ✅ | 锚点 + 审计 + 串行流程 |
| 统一运行态 | ✅ | runtimeSummary |
| 上下文管理 | ✅ | 预算 + 压缩 + 策略 |
| 导出 | ✅ | TXT/MD/JSON/EPUB |
| 成本追踪 | ✅ | Token + 配额 + 预警 |
| 风格系统 | ✅ | 提取 + 验证 + 应用 |
| 市场分析 | ✅ | 趋势 + 竞品 + 灵感 |
| 虚拟作家 | ✅ | 训练 + 风格学习 |
| RAG 检索 | ✅ | pgvector + 索引重建 |
| 封面生成 | ✅ | AI 生成 + 管理 |
| 通知系统 | ✅ | 系统/任务/配额/错误 |
| 文档体系 | ✅ | 20+ 文档 |

### 11.2 待处理 (P1)

- 旧 engine API 标记 legacy
- 蓝图/ArcPlan 阶段 heartbeat event
- 导出入口 runtimeSummary 提示
- Job cancel 用户态文案
- 主链路 smoke test

### 11.3 测试覆盖

- 280 个单元测试，35 个测试文件，全部通过
- 覆盖：Agent 行为、工具函数、prompt、章节提交、流水线 worker、工作流阶段
- E2E: Playwright 覆盖创建和门禁展示

---

## 附录

### A. 文档索引

| 文档 | 路径 | 内容 |
|------|------|------|
| Agent 开发指南 | AGENTS.md | 开发规则和架构约束 |
| 项目配置 | CLAUDE.md | 环境变量、开发规范 |
| 代码架构 | CODE_WIKI.md | 详细架构文档 |
| 功能清单 | docs/FEATURE_CHECKLIST.md | 完整功能清单 (42节) |
| 开发进度 | docs/DEV_PROGRESS.md | 开发进度和状态 |
| 开发决策 | docs/DEV_DECISIONS.md | 关键架构决策 |
| TODO 跟踪 | docs/DEV_TODO.md | P0/P1/P2/P3 优先级 |
| TODO Issues | TODO_ISSUES.md | 代码 TODO 记录 |
| 质量审计 | docs/quality-audit-2026-06-01.md | 全流程质量审计 |
| 连续性设计 | docs/superpowers/specs/2026-06-02-chapter-continuity-p0-design.md | 章节连续性 P0 |
| 串行流程 | docs/superpowers/specs/2026-06-03-serial-chapter-flow-design.md | 串行章节流程 |
| 质量优化 | docs/superpowers/plans/2026-05-31-quality-optimization.md | 质量优化计划 |
| 改造清单 | docs/改造清单v1.md | 工业化改造清单 |
| 优化建议 | docs/优化建议.md | 全面优化建议 |
| 部署文档 | docs/DEPLOYMENT.md | 部署指南 |

### B. 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接 |
| `DEFAULT_AI_VENDOR` | 否 | 默认 AI 提供商 |
| `DEFAULT_AI_MODEL_ID` | 否 | 默认模型 ID |
| `DEEPSEEK_API_KEY` | 否 | DeepSeek Key |
| `OPENAI_API_KEY` | 否 | OpenAI Key |
| `ANTHROPIC_API_KEY` | 否 | Anthropic Key |
| `ALIBABA_API_KEY` | 否 | 阿里云 Key |
| `MINIMAX_API_KEY` | 否 | MiniMax Key |
| `VOLCENGINE_API_KEY` | 否 | 火山引擎 Key |
| `ZHIPU_API_KEY` | 否 | 智谱 AI Key |
| `MIMO_API_KEY` | 否 | 秘塔 AI Key |

---

*文档生成完毕。项目处于活跃开发状态，P0 全部完成，P1 进行中。*

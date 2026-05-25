# Novel AI 项目全面分析报告

> 生成时间：2026-05-25  
> 项目版本：v0.2.0

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

---

## 1. 项目概述

### 1.1 项目定位

Novel AI 是一个基于多智能体协作的 AI 网络小说创作平台，支持从创意到完稿的全流程创作辅助。

### 1.2 项目模式

系统支持两种创作模式：

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **创作模式 (CREATE)** | 从零开始创作小说，AI 辅助生成 | 新书创作 |
| **拆解模式 (ANALYZE)** | 导入已有小说进行结构分析 | 学习分析 |

### 1.3 核心特性

- 🤖 **多智能体协作**：9+ Agent 流水线架构
- 📚 **智能创作**：自动生成书名、章节目录、伏笔追踪、角色关系图、故事导向
- 🔬 **拆解分析**：自动提取世界观和力量体系、书籍分析仪表板、章节图谱、分析任务管理
- 💡 **去AI味与反检测**：专业网文写作规范、AI 内容检测与重写
- 🧠 **RAG 向量检索**：基于 pgvector 的智能检索增强、记忆编排
- 💰 **成本控制**：分层摘要系统、AI调用成本追踪、智能路由、模型降级
- 📦 **导出系统**：支持 EPUB 格式导出
- 🎬 **流水线管理**：章节提交与重播、项目引导流程
- 🛠️ **项目健康度**：自动维护任务、健康度检查

---

## 2. 技术架构

### 2.1 技术栈

| 类别 | 技术选型 | 版本 |
|------|----------|------|
| **前端框架** | Next.js | 16.2.4 |
| **React** | React | 19.2.4 |
| **数据库** | PostgreSQL + Prisma + pgvector | 6.19.3 |
| **AI 提供商** | 多厂商支持 (8家) | - |
| **样式方案** | Tailwind CSS | 4 |
| **状态管理** | React Hook Form + Zod | 4.4.1 |
| **可视化** | D3.js + React Flow | - |
| **拖拽排序** | @dnd-kit | 6.3.1 |
| **测试框架** | Vitest + Playwright | - |
| **认证** | NextAuth.js | 5.0 beta |

### 2.2 AI 服务提供商

| 厂商 | 模型ID示例 | 用途 |
|------|-----------|------|
| OpenAI | gpt-4o, gpt-4o-mini | 通用对话 |
| Anthropic | claude-3.5-sonnet | 高质量写作 |
| 阿里云 | qwen-plus, qwen-max | 中文优化 |
| DeepSeek | deepseek-chat, deepseek-coder | 性价比高 |
| MiniMax | abab6.5s | 中文创作 |
| 火山引擎 | doubao-pro | 字节系 |
| 智谱 AI | glm-4, glm-4-flash | 中文理解 |
| 秘塔 AI | - | AI 检测与反检测 |

### 2.3 项目目录结构

```
novel-ai/
├── prisma/                              # 数据库模型定义
│   └── schema.prisma                     # 完整数据模型 (880行)
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── (main)/                    # 主应用路由组
│   │   │   ├── projects/              # 项目管理页面
│   │   │   │   ├── new/               # 新建项目
│   │   │   │   └── [projectId]/       # 项目详情
│   │   │   │       └── chapters/      # 章节管理
│   │   │   │           ├── page.tsx    # 章节列表
│   │   │   │           ├── new/        # 新建章节
│   │   │   │           └── [chapterId]/
│   │   │   │               ├── page.tsx      # 章节编辑
│   │   │   │               └── generate/     # AI生成
│   │   │   ├── settings/               # 系统设置
│   │   │   ├── cost/                   # 成本统计
│   │   │   └── market/                 # 市场分析
│   │   ├── api/                        # API 路由 (86个)
│   │   │   ├── novel/                  # 小说相关
│   │   │   ├── projects/               # 项目管理
│   │   │   ├── engine/                 # 引擎API
│   │   │   ├── market/                 # 市场分析
│   │   │   ├── agents/                 # Agent API
│   │   │   └── notifications/          # 通知
│   │   └── page.tsx                    # 首页重定向
│   ├── components/                      # React 组件 (~50个)
│   │   ├── ai/                         # AI功能组件 (30个)
│   │   │   ├── StreamViewer.tsx        # 流式生成视图
│   │   │   ├── DeslopPanel.tsx         # 去AI味面板
│   │   │   ├── ChapterQualityPanel.tsx # 质量分析面板
│   │   │   ├── ReviewPanel.tsx         # 审核面板
│   │   │   ├── PlotlineTracker.tsx     # 伏笔追踪
│   │   │   ├── CharacterRelationshipGraph.tsx  # 角色关系图
│   │   │   ├── ChapterRhythmHeatmap.tsx # 节奏热力图
│   │   │   └── ...
│   │   ├── chapter/                     # 章节组件
│   │   ├── project/                    # 项目组件
│   │   ├── ui/                         # 通用UI组件
│   │   └── writer/                      # 虚拟作家
│   ├── lib/                            # 核心业务逻辑
│   │   ├── agents/                     # Agent智能体 (14个文件)
│   │   │   ├── adapters.ts             # Agent适配器
│   │   │   ├── base.ts                 # Agent基类
│   │   │   ├── planner.ts              # 策划Agent
│   │   │   ├── writer.ts               # 写作Agent
│   │   │   ├── polisher.ts             # 润色Agent
│   │   │   ├── validator.ts            # 校验Agent
│   │   │   ├── summarizer.ts           # 摘要Agent
│   │   │   ├── researcher.ts           # 研究Agent
│   │   │   ├── reviewer.ts             # 审核Agent
│   │   │   └── deslopper.ts           # 去AI味Agent
│   │   ├── ai/                         # AI服务封装 (18个文件)
│   │   │   ├── service.ts              # AI服务主类
│   │   │   ├── factory.ts              # 工厂模式
│   │   │   ├── providers/              # 提供商实现
│   │   │   ├── context-manager.ts       # 上下文管理
│   │   │   ├── smart-router.ts         # 智能路由
│   │   │   └── model-compare.ts       # 模型对比
│   │   ├── engine/                     # 小说引擎核心 (12个文件)
│   │   │   ├── orchestrator.ts         # 编排器
│   │   │   ├── pipeline.ts             # 流水线
│   │   │   ├── task-queue.ts          # 任务队列
│   │   │   ├── context-assembler.ts   # 上下文组装
│   │   │   ├── context-compression.ts  # 上下文压缩
│   │   │   └── story-state.ts         # 故事状态
│   │   ├── memory/                      # 记忆系统 (5个文件)
│   │   │   ├── index.ts               # 记忆主入口
│   │   │   ├── character-memory.ts    # 角色记忆
│   │   │   └── volume-summary.ts      # 卷摘要
│   │   ├── prompts/                    # 提示词库 (30+个)
│   │   │   ├── chapter/              # 章节相关提示词
│   │   │   ├── novel/                 # 小说相关提示词
│   │   │   ├── deslop/                # 去AI味提示词
│   │   │   └── analysis/              # 分析提示词
│   │   ├── knowledge/                  # 写作知识库
│   │   │   ├── anti-ai.ts            # 禁用词库
│   │   │   ├── chapter-quality.ts    # 质量分析
│   │   │   └── hooks.ts              # 知识钩子
│   │   ├── export/                    # 导出服务
│   │   ├── cost-tracker/              # 成本追踪
│   │   └── ...
│   └── types/                          # TypeScript类型定义
├── scripts/                             # 部署脚本
├── docs/                                # 文档
├── CODE_WIKI.md                        # 代码架构文档
└── package.json
```

---

## 3. 数据库模型

### 3.1 ER 图概览

```
┌─────────────┐       ┌─────────────────┐       ┌──────────────┐
│    User     │──────<│  NovelProject   │──────<│ NovelChapter │
└─────────────┘       └─────────────────┘       └──────────────┘
      │                      │
      │                      │
      ├──────────────────────┼──────────────────────┐
      │                      │                      │
      ▼                      ▼                      ▼
┌─────────────┐       ┌──────────────┐       ┌──────────────┐
│VirtualWriter│       │  Character   │       │   Plotline   │
└─────────────┘       └──────────────┘       └──────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │  StoryState  │
                      └──────────────┘
```

### 3.2 核心模型

#### 3.2.1 NovelProject - 小说项目

```prisma
model NovelProject {
  id                  Int             @id @default(autoincrement())
  title               String
  description         String?
  genre               String?         // 玄幻/奇幻/仙侠/都市/科幻/历史/游戏/悬疑/言情
  writingStyle        String?         // 轻松幽默/热血激昂/暗黑沉重/唯美文艺/悬疑烧脑
  targetWordCount     Int?            // 目标总字数
  currentWordCount    Int             @default(0)
  chapterWordCount    Int             @default(3000)  // 每章目标字数
  
  // 大纲设定
  outline             String?
  outlineStages       Json?          // {stage1: [], stage2: [], stage3: [], stage4: []}
  
  // 详细设定
  worldSetting        String?         // 世界观设定
  powerSystem         String?         // 力量体系
  protagonistProfile  String?         // 主角人设
  protagonistGoal     String?         // 主角目标
  antagonistSetting   String?         // 反派设定
  endingPlan          String?         // 结局规划
  
  // 项目模式
  projectMode         String          @default("CREATE")  // CREATE | ANALYZE
  storyType           String          @default("LONG")     // LONG | SHORT
  
  status              ProjectStatus   @default(DRAFT)
  coverImage          String?
  totalVolumes        Int             @default(4)
  
  // 关联关系
  chapters            NovelChapter[]
  characters          Character[]
  plotlines           Plotline[]
  chapterSummaries    ChapterSummary[]
  volumeSummaries     VolumeSummary[]
  bookSummary         BookSummary?
  aiUsages            AIUsage[]
  // ...更多关联
}
```

#### 3.2.2 NovelChapter - 章节

```prisma
model NovelChapter {
  id                  Int             @id @default(autoincrement())
  projectId           Int
  chapterNumber       Int             // 章节编号
  title               String
  content             String?         @db.Text
  summary             String?         @db.Text
  wordCount           Int             @default(0)
  
  generationPrompt    String?         @db.Text
  generationParams    Json?
  generationCount     Int             @default(0)
  lastGeneratedTime   DateTime?
  
  sortOrder           Int             @default(0)
  status              ChapterStatus   @default(DRAFT)
  
  // 引擎字段
  chapterOutline      Json?          // 策划Agent输出的章节大纲
  validationReport    Json?          // 校验Agent的验证报告
  retryCount          Int             @default(0)
  
  versions            ChapterVersion[]
}
```

#### 3.2.3 Character - 角色档案

```prisma
model Character {
  id              String            @id @default(cuid())
  projectId       Int
  name            String
  role            CharacterRole    @default(SUPPORTING)  // PROTAGONIST/ANTAGONIST/SUPPORTING/MINOR
  
  appearance      String?          @db.Text
  personality     String?          @db.Text
  catchphrases    String[]         @default([])
  background      String?          @db.Text
  
  // 关系管理
  relationships   Json?            @default("{}")  // {角色名: 关系描述}
  currentState    Json?           @default("{}")  // 位置、情绪、阵营
  
  firstChapter    Int?
  lastUpdated     Int?
  
  // 复用库
  isPublic        Boolean          @default(false)
  tags            String[]         @default([])
}
```

#### 3.2.4 Plotline - 伏笔追踪

```prisma
model Plotline {
  id              String           @id @default(cuid())
  projectId       Int
  type            PlotlineType     @default(FORESHADOW)  // FORESHADOW/SUBPLOT/CONFLICT
  description     String           @db.Text
  plantedAt       Int              // 埋入章节号
  resolvedAt      Int?             // 回收章节号
  plannedAt       Int?             // 计划回收章节号
  status          PlotlineStatus  @default(OPEN)  // OPEN/RESOLVED/ABANDONED
  metadata        Json?            @default("{}")
}
```

### 3.3 分层摘要系统

解决长篇（760+章）大文本 token 超限问题：

```
┌────────────────────────────────────────────┐
│         BookSummary (L3 - 全书摘要)         │
│  - 1000-1500字整体摘要                      │
│  - 主线概述、支线列表                        │
│  - 角色成长弧线、主题元素                    │
└────────────────────────────────────────────┘
                      ▲
                      │ 聚合
                      │
┌────────────────────────────────────────────┐
│       VolumeSummary (L2 - 卷摘要)           │
│  - 500-800字卷摘要                          │
│  - 关键事件、情绪曲线                        │
│  - 章节概览                                 │
└────────────────────────────────────────────┘
                      ▲
                      │ 聚合
                      │
┌────────────────────────────────────────────┐
│     ChapterSummary (L1 - 章节摘要)           │
│  - 200-300字章节摘要                         │
│  - 关键事件、情绪基调                         │
│  - 伏笔埋设/回收                            │
└────────────────────────────────────────────┘
```

---

## 4. 核心功能模块

### 4.1 小说引擎 (Novel Engine)

小说引擎是系统的核心编排器，协调多个 Agent 完成章节创作。

```
┌─────────────────────────────────────────────────────────────┐
│                    章节生成流水线                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [1. 策划]  ──>  [2. 写作]  ──>  [3. 润色]  ──>  [4. 校验]  │
│     │               │               │               │       │
│     ▼               ▼               ▼               ▼       │
│  章节大纲        章节正文        文笔优化        质量验证     │
│                                                              │
│                              │                               │
│                              ▼                               │
│                    [5. 摘要] ──> 存入记忆系统                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 核心文件

| 文件 | 功能 |
|------|------|
| `orchestrator.ts` | 总编排器，协调各Agent |
| `pipeline.ts` | 流水线定义 |
| `task-queue.ts` | 任务队列管理 |
| `context-assembler.ts` | 上下文组装 |
| `context-compression.ts` | 上下文压缩 |
| `story-state.ts` | 故事状态管理 |

### 4.2 记忆系统 (Memory System)

记忆系统管理创作过程中的上下文信息：

```
┌──────────────────────────────────────────────┐
│              记忆系统架构                      │
├──────────────────────────────────────────────┤
│                                               │
│  ┌─────────────────┐  ┌─────────────────┐   │
│  │  CharacterMemory │  │ PlotlineMemory  │   │
│  │   角色记忆        │  │   伏笔记忆       │   │
│  └─────────────────┘  └─────────────────┘   │
│                                               │
│  ┌─────────────────┐  ┌─────────────────┐   │
│  │  ChapterSummary  │  │ VolumeSummary   │   │
│  │   章节摘要(L1)   │  │   卷摘要(L2)     │   │
│  └─────────────────┘  └─────────────────┘   │
│                                               │
│  ┌─────────────────┐                         │
│  │  BookSummary    │  (L3 - 全书摘要)          │
│  └─────────────────┘                         │
│                                               │
└──────────────────────────────────────────────┘
```

### 4.3 AI 服务层 (AI Service)

AI 服务层封装多个厂商，提供统一的 AI 调用接口：

```
┌──────────────────────────────────────────────┐
│              AI Service Layer                │
├──────────────────────────────────────────────┤
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │            AIService (主类)              │ │
│  │  - createProvider()  工厂方法            │ │
│  │  - generate()       生成接口             │ │
│  │  - batchGenerate()   批量生成             │ │
│  └─────────────────────────────────────────┘ │
│                      │                        │
│                      ▼                        │
│  ┌─────────────────────────────────────────┐ │
│  │           AI Provider (适配器)            │ │
│  └─────────────────────────────────────────┘ │
│                      │                        │
│     ┌───────┬───────┬───────┬───────┐        │
│     ▼       ▼       ▼       ▼       ▼        │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐        │
│  │OpenAI│ │Anthropic│ │阿里 │ │Deep│ │MiniMax│
│  └────┘ └────┘ └────┘ └────┘ └────┘        │
│                                               │
└──────────────────────────────────────────────┘
```

### 4.4 去 AI 味系统 (Deslop System)

专业网文写作规范，消除 AI 生成文本的"机器感"：

#### 禁用词库分层

| 层级 | 数量 | 示例 | 处理方式 |
|------|------|------|----------|
| L1 必换 | 14个 | 不禁、顿时、瞬间、赫然 | 立即替换 |
| L2 建议 | 20个 | 缓缓、微微、淡淡、竟然 | 优先替换 |
| L3 可选 | 20个 | 首先、其次、总之 | 提升质量 |

#### 禁止模式

- 排比句堆砌
- 段落结构过于工整
- 每段都以人名开头
- 总结性陈述句结尾
- 过度比喻
- 心理描写直白
- 句式过于对称
- AI风格结尾

### 4.5 扫榜选材系统 (Market System)

分析市场趋势，辅助创作决策：

```
┌──────────────────────────────────────────────┐
│              扫榜选材系统                      │
├──────────────────────────────────────────────┤
│                                               │
│  ┌─────────────┐  ┌─────────────┐            │
│  │ MarketTrend │  │ MarketBook  │            │
│  │  市场趋势    │  │  书籍数据    │            │
│  └─────────────┘  └─────────────┘            │
│                                               │
│  功能：                                        │
│  - 平台/题材排行榜分析                         │
│  - 热门标签提取                               │
│  - 字数/更新频率统计                          │
│  - 趋势方向判断                               │
│                                               │
└──────────────────────────────────────────────┘
```

### 4.6 成本追踪系统 (Cost Tracker)

追踪 AI 调用成本，控制创作费用：

```
┌──────────────────────────────────────────────┐
│              成本追踪系统                      │
├──────────────────────────────────────────────┤
│                                               │
│  ┌─────────────────┐  ┌─────────────────┐   │
│  │   ModelPricing   │  │    UserQuota    │   │
│  │   模型定价配置    │  │    用户配额      │   │
│  └─────────────────┘  └─────────────────┘   │
│                                               │
│  ┌─────────────────┐                         │
│  │     AIUsage      │  调用记录               │
│  │   token/费用     │                         │
│  └─────────────────┘                         │
│                                               │
│  功能：                                        │
│  - 分厂商/模型统计                             │
│  - 月度配额管理                               │
│  - 预警机制                                   │
│  - 成本预估                                   │
│                                               │
└──────────────────────────────────────────────┘
```

---

## 5. API 接口体系

### 5.1 API 路由概览

总计 **86 个** API 路由，分为以下模块：

| 模块 | 路径 | 数量 | 主要功能 |
|------|------|------|----------|
| 项目管理 | `/api/novel/projects/*` | 15 | CRUD、导出、生成 |
| 章节管理 | `/api/novel/projects/[id]/chapters/*` | 8 | 章节CRUD、排序 |
| AI 能力 | `/api/novel/ai/*` | 20 | 生成、分析、校验 |
| 引擎 | `/api/novel/engine/*` | 8 | 引擎状态、上下文 |
| 封面 | `/api/novel/cover/*` | 4 | 封面生成 |
| 拆解 | `/api/novel/deslop/*` | 2 | 去AI味 |
| 质量分析 | `/api/novel/ai/chapter-quality/*` | 3 | 章节质量分析 |
| 短篇 | `/api/short-story/*` | 8 | 短篇创作 |
| 市场 | `/api/market/*` | 3 | 市场分析 |
| 其他 | `/api/agents/*`, `/api/hooks/*` 等 | 15 | 通用功能 |

### 5.2 核心 API 列表

#### 5.2.1 项目管理

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/novel/projects` | 获取项目列表 |
| POST | `/api/novel/projects` | 创建项目 |
| GET | `/api/novel/projects/[projectId]` | 获取项目详情 |
| PUT | `/api/novel/projects/[projectId]` | 更新项目 |
| DELETE | `/api/novel/projects/[projectId]` | 删除项目 |
| POST | `/api/novel/projects/[projectId]/export` | 导出小说 |
| POST | `/api/novel/projects/[projectId]/generate` | 生成章节 |
| POST | `/api/novel/projects/[projectId]/generate/stream` | 流式生成 |

#### 5.2.2 AI 能力

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/novel/ai/generate-chapter-list` | 生成章节目录 |
| POST | `/api/novel/ai/generate-outline` | 生成大纲 |
| POST | `/api/novel/ai/generate-idea` | 生成创意 |
| POST | `/api/novel/ai/revision` | 章节修订 |
| POST | `/api/novel/ai/validate-chapter` | 章节校验 |
| POST | `/api/novel/ai/analyze-plot` | 剧情分析 |
| POST | `/api/novel/ai/analyze-style` | 风格分析 |
| POST | `/api/novel/ai/check-style-consistency` | 风格一致性检查 |
| POST | `/api/novel/ai/chapter-rhythm` | 章节节奏分析 |
| POST | `/api/novel/ai/hierarchical-summary` | 分层摘要生成 |

#### 5.2.3 质量分析

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/novel/ai/chapter-quality/analyze` | 分析章节AI质量 |
| POST | `/api/novel/ai/chapter-quality/optimize` | 优化章节去AI味 |
| POST | `/api/novel/ai/chapter-quality/batch-optimize` | 批量优化 |

#### 5.2.4 去 AI 味

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/novel/deslop/detect` | 检测AI味道 |
| POST | `/api/novel/deslop/rewrite` | 重写去味 |

---

## 6. 多智能体协作系统

### 6.1 Agent 类型定义

```typescript
enum AgentType {
  PLANNER    // 策划 Agent - 生成章节大纲
  WRITER     // 写作 Agent - 生成章节正文
  POLISHER   // 润色 Agent - 文笔润色优化
  VALIDATOR  // 校验 Agent - 质量校验验证
  SUMMARIZER // 摘要 Agent - 章节摘要生成
  RESEARCHER // 研究 Agent - 写作资料研究
  REVIEWER   // 审核 Agent - 多角度审核
  DESLOPPER  // 去味 Agent - 去除AI味
}
```

### 6.2 Agent 流水线

```
┌─────────────────────────────────────────────────────────────────┐
│                        Pipeline Execution                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐│
│  │ PLANNER  │────>│  WRITER  │────>│ POLISHER │────>│VALIDATOR ││
│  │ 策划大纲  │     │  生成正文  │     │  文笔润色  │     │  质量校验  ││
│  └──────────┘     └──────────┘     └──────────┘     └──────────┘│
│                                                                   │
│                           │                                       │
│                           ▼                                       │
│                    ┌──────────────┐                              │
│                    │  SUMMARIZER  │                              │
│                    │   生成摘要     │                              │
│                    └──────────────┘                              │
│                                                                   │
│                           │                                       │
│                           ▼                                       │
│                    ┌──────────────┐                              │
│                    │  存入记忆系统   │                              │
│                    └──────────────┘                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 各 Agent 职责

| Agent | 输入 | 输出 | 核心功能 |
|-------|------|------|----------|
| **Planner** | 章节目标、角色信息、伏笔 | 章节大纲 | 生成详细章节规划 |
| **Writer** | 大纲、上下文、设定 | 章节正文 | 基于大纲生成内容 |
| **Polisher** | 原文、风格要求 | 润色后正文 | 提升文笔质量 |
| **Validator** | 章节内容、设定 | 验证报告 | 检查一致性/逻辑 |
| **Summarizer** | 章节正文 | 摘要 | 提取关键信息 |
| **Reviewer** | 章节内容 | 多维度评审 | 综合质量评估 |
| **Deslopper** | 原文 | 改写后正文 | 去除AI味道 |

### 6.4 Agent 适配器模式

使用适配器模式统一 Agent 调用接口：

```typescript
interface AgentDefinition<Input, Output> {
  type: AgentType
  name: string
  description: string
  execute(input: Input): Promise<Output>
}

// 使用示例
const plannerAdapter: AgentDefinition<PlannerInput, PlannerOutput> = {
  type: 'PLANNER',
  name: '策划 Agent',
  execute: async (input) => { /* ... */ }
}
```

---

## 7. AI 服务集成

### 7.1 服务封装

```typescript
class AIService {
  // 工厂方法创建 Provider
  static async createProvider(options: {
    projectId?: number
    usageType: string
    vendor?: AIVendor
  }): Promise<AIProvider>
  
  // 生成接口
  async generate(prompt: string, options?: GenerateOptions): Promise<AIResult>
  
  // 批量生成
  async batchGenerate(prompts: string[], options?: GenerateOptions): Promise<AIResult[]>
}
```

### 7.2 智能路由

根据任务类型自动选择最优模型：

```typescript
// 任务类型 -> 模型映射
const MODEL_ROUTING = {
  // 策划任务 - 需要创意
  PLANNING: ['claude-3.5-sonnet', 'gpt-4o'],
  
  // 写作任务 - 需要质量
  WRITING: ['claude-3.5-sonnet', 'qwen-max'],
  
  // 润色任务 - 需要理解
  POLISHING: ['gpt-4o', 'glm-4'],
  
  // 校验任务 - 需要逻辑
  VALIDATION: ['deepseek-chat', 'qwen-plus'],
  
  // 成本敏感任务
  COST_SENSITIVE: ['deepseek-chat', 'abab6.5s'],
}
```

### 7.3 上下文管理

管理对话历史，防止 token 溢出：

```
┌──────────────────────────────────────────────┐
│            Context Management                  │
├──────────────────────────────────────────────┤
│                                               │
│  1. 计算当前 token 数量                       │
│  2. 如果超过阈值：                            │
│     - 压缩历史消息                            │
│     - 或截断早期内容                           │
│     - 或使用摘要替换                           │
│  3. 确保最新上下文完整                        │
│                                               │
│  策略：                                        │
│  - 固定窗口: 保留最近N条                       │
│  - 滑动窗口: 保留时间范围内                    │
│  - 摘要替换: 用摘要替换早期对话                 │
│                                               │
└──────────────────────────────────────────────┘
```

---

## 8. 前端组件架构

### 8.1 组件层次

```
┌─────────────────────────────────────────────────────────────┐
│                    Component Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Layout Components                     ││
│  │   Header, Sidebar, Footer                               ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                                │
│                              ▼                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Page Components                       ││
│  │   ProjectsPage, ProjectDetailPage, ChapterEditorPage   ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                                │
│                              ▼                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Feature Components                     ││
│  │   AI Components: StreamViewer, DeslopPanel, ReviewPanel││
│  │   Chapter Components: ChapterList, ChapterEditor      ││
│  │   Project Components: ProjectCard, BatchGenerator      ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                                │
│                              ▼                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                      UI Components                       ││
│  │   Button, Input, Modal, Card, Badge, Toast, etc.        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 核心组件列表

#### AI 功能组件 (30个)

| 组件 | 功能 |
|------|------|
| `StreamViewer.tsx` | 流式生成内容显示 |
| `DeslopPanel.tsx` | 去AI味面板 |
| `ChapterQualityPanel.tsx` | 章节质量分析 |
| `ReviewPanel.tsx` | 审核面板 |
| `RevisionPanel.tsx` | 修订面板 |
| `PlotlineTracker.tsx` | 伏笔追踪器 |
| `CharacterRelationshipGraph.tsx` | 角色关系图 |
| `ChapterRhythmHeatmap.tsx` | 章节节奏热力图 |
| `PlotAnalyzer.tsx` | 剧情分析器 |
| `BatchProgress.tsx` | 批量进度 |
| `GeneratePanel.tsx` | 生成面板 |
| `ContinuationPanel.tsx` | 续写面板 |
| `BookAnalysisPanel.tsx` | 书籍分析面板 |
| `WorkflowHooksPanel.tsx` | 工作流钩子 |
| `AgentManager.tsx` | Agent管理 |
| `MarketScanPanel.tsx` | 市场扫描 |
| `SuggestionButtons.tsx` | 建议按钮 |
| `ContinuationResults.tsx` | 续写结果 |

#### 章节组件

| 组件 | 功能 |
|------|------|
| `ChapterList.tsx` | 章节列表（拖拽排序） |
| `ChapterEditor.tsx` | 章节编辑器 |

### 8.3 状态管理

使用 React Hook Form + Zod 进行表单验证：

```typescript
// 表单验证示例
const schema = z.object({
  title: z.string().min(1, '标题不能为空'),
  genre: z.string().optional(),
  writingStyle: z.string().optional(),
  targetWordCount: z.number().min(10000),
})

// 使用
const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: { /* ... */ }
})
```

---

## 9. 业务逻辑流程

### 9.1 小说创作流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    Novel Creation Flow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [1. 项目创建]                                                    │
│      │                                                           │
│      ├──> 填写基本信息（类型、风格、字数目标）                         │
│      ├──> 设定世界观、力量体系、主角人设                            │
│      └──> 生成大纲（可选）                                         │
│                                                                  │
│  [2. 章节规划]                                                    │
│      │                                                           │
│      ├──> 自动生成章节目录（支持3种标题风格）                         │
│      ├──> 手动调整章节顺序                                         │
│      └──> 设定每卷结构                                             │
│                                                                  │
│  [3. 章节生成]                                                    │
│      │                                                           │
│      ├──> 选择章节                                                │
│      ├──> 配置生成参数（字数、温度、上下文）                          │
│      ├──> 启动流式生成                                            │
│      └──> 实时预览                                                │
│                                                                  │
│  [4. 质量优化]                                                    │
│      │                                                           │
│      ├──> AI质量分析（多维评分）                                    │
│      ├──> 去AI味优化                                              │
│      ├──> 审核修订                                                │
│      └──> 保存定稿                                                │
│                                                                  │
│  [5. 导出发布]                                                    │
│      │                                                           │
│      ├──> 导出格式（txt/md/json/epub）                            │
│      └──> 打包下载                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 拆解分析流程

```
┌─────────────────────────────────────────────────────────────────┐
│                  Novel Analysis Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [1. 导入小说]                                                    │
│      │                                                           │
│      └──> 上传小说文本文件                                        │
│                                                                  │
│  [2. 自动分析]                                                    │
│      │                                                           │
│      ├──> 提取世界观/力量体系                                      │
│      ├──> 识别主要角色                                            │
│      ├──> 分析人物关系                                          │
│      ├──> 梳理剧情线                                            │
│      ├──> 追踪伏笔埋设/回收                                      │
│      └──> 分析章节节奏                                          │
│                                                                  │
│  [3. 可视化展示]                                                  │
│      │                                                           │
│      ├──> 角色关系图                                            │
│      ├──> 伏笔追踪表                                            │
│      ├──> 情绪曲线图                                            │
│      └──> 章节节奏热力图                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. 技术亮点与创新

### 10.1 分层摘要系统

创新性地解决长篇小说 token 超限问题：

- **L1**: 章节摘要（200-300字）
- **L2**: 卷摘要（500-800字）
- **L3**: 全书摘要（1000-1500字）

通过摘要聚合而非简单截断，保留关键信息的同时大幅压缩 token。

### 10.2 多维质量评估

除传统评分外，新增多维度 AI 味道检测：

| 维度 | 检测方法 |
|------|----------|
| 词汇自然度 | L1/L2/L3禁用词统计 |
| 模式多样性 | 排比句、对称句检测 |
| 结构变化 | 段落长度方差分析 |
| 节奏韵律 | 句子长度分布 |
| 沉浸体验 | 感官描写密度 |

### 10.3 智能路由

根据任务类型自动选择最优 AI 模型：

- 策划任务 → 创意型模型
- 写作任务 → 质量型模型
- 校验任务 → 逻辑型模型
- 成本敏感 → 性价比模型

### 10.4 去 AI 味策略

专业网文写作规范，消除"机器感"：

- 分层禁用词库（60+词）
- 禁止模式识别（8种）
- 三档优化强度（轻/中/重）
- 人类写作特征模拟

### 10.5 伏笔追踪系统

自动管理伏笔生命周期：

- 埋设时记录位置和预期
- 进行中追踪状态
- 回收时验证合理性
- 支持跨卷级伏笔

### 10.6 RAG 向量检索系统

基于 pgvector 的智能检索增强：

- 向量化存储章节内容
- 智能上下文检索
- RAG 向量重建 API
- 记忆编排优化生成

### 10.7 章节提交与重播系统

完整的章节状态管理：

- 保存完整生成状态
- 从历史提交点重播生成
- 状态回滚机制
- 完整生成历史追溯

### 10.8 项目健康度检查与自动维护

智能项目管理功能：

- 伏笔回收率监控
- 章节完成度统计
- 自动维护任务队列
- 健康度评分与建议

### 10.9 反检测与去 AI 味增强

双系统结合优化：

- 检测 AI 生成内容
- 自动化重写降低 AI 痕迹
- 专业禁用词库
- 多样化写作特征模拟

### 10.10 分析任务管理系统

异步分析任务处理：

- 任务状态追踪
- 取消与重试机制
- 进度实时更新
- 分析结果持久化

---

## 附录

### A. 环境变量配置

```env
# 数据库
DATABASE_URL="postgresql://..."

# AI API Keys
DEEPSEEK_API_KEY="..."
OPENAI_API_KEY="..."
ANTHROPIC_API_KEY="..."
# ...

# 默认配置
DEFAULT_AI_VENDOR="DEEPSEEK"
DEFAULT_AI_MODEL_ID="deepseek-chat"
```

### B. 常用命令

```bash
# 开发
npm run dev          # 启动开发服务器 (端口3200)
npm run build        # 构建生产版本
npm start            # 启动生产服务器

# 数据库
npm run db:migrate:dev   # 运行迁移
npm run db:generate       # 生成Prisma Client

# 测试
npm test             # 单元测试
npm run test:e2e     # E2E测试

# Docker
npm run docker:start    # 启动Docker
npm run docker:build    # 构建镜像
```

### C. 相关文档

| 文档 | 路径 | 内容 |
|------|------|------|
| README | README.md | 项目介绍 |
| 代码架构 | CODE_WIKI.md | 详细架构文档 |
| 开发指南 | CLAUDE.md | 项目配置说明 |
| 去AI味 | 去ai味提示词.md | 提示词策略 |

---

*文档生成完毕，如需补充或修正，请联系项目维护者。*

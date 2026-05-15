# Novel AI 项目代码文档

## 1. 项目概述

Novel AI 是一个基于多智能体协作的 AI 小说创作平台。该项目采用 Next.js 作为全栈框架，结合 PostgreSQL 数据库和多种大语言模型 API，实现智能化的网络小说创作流程。

### 1.1 技术栈

| 类别 | 技术选型 | 说明 |
|------|----------|------|
| 前端框架 | Next.js 16.2.4 | React 19.2.4，支持 App Router |
| 数据库 | PostgreSQL | 通过 Prisma 6.19.3 操作 |
| AI 提供商 | 多厂商支持 | OpenAI、Anthropic、阿里云、DeepSeek、MiniMax、火山引擎 |
| 样式方案 | Tailwind CSS 4 | 原子化 CSS 框架 |
| 状态管理 | React Hook Form + Zod | 表单验证与状态管理 |
| 图表可视化 | D3.js + React Flow | 角色关系图、情绪曲线等 |
| 测试框架 | Vitest + Playwright | 单元测试与端到端测试 |

### 1.2 目录结构

```
novel-ai/
├── prisma/                          # 数据库模型定义
│   ├── schema.prisma                 # 数据模型
│   └── migrations/                  # 数据库迁移文件
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (main)/                  # 主应用路由
│   │   │   ├── projects/            # 项目管理页面
│   │   │   │   ├── [projectId]/     # 项目详情
│   │   │   │   │   └── chapters/    # 章节管理
│   │   │   │   └── page.tsx         # 项目列表
│   │   │   └── settings/            # 设置页面
│   │   ├── api/                     # API 路由
│   │   │   ├── novel/               # 小说相关 API
│   │   │   ├── projects/            # 项目管理 API
│   │   │   └── engine/              # 小说引擎 API
│   │   └── page.tsx                 # 首页重定向
│   ├── components/                  # React 组件
│   │   ├── ai/                      # AI 功能组件
│   │   ├── chapter/                 # 章节相关组件
│   │   ├── project/                 # 项目相关组件
│   │   ├── ui/                      # 通用 UI 组件
│   │   └── writer/                  # 虚拟作家组件
│   ├── lib/                         # 核心业务逻辑
│   │   ├── agents/                  # Agent 智能体实现
│   │   ├── ai/                      # AI 提供商封装
│   │   ├── engine/                  # 小说引擎核心
│   │   ├── memory/                  # 记忆系统
│   │   └── export/                  # 导出服务
│   └── types/                       # TypeScript 类型定义
└── package.json                     # 项目依赖配置
```

---

## 2. 核心模块架构

### 2.1 多智能体协作系统

项目采用五阶段 Agent 流水线架构，每个 Agent 负责特定的创作任务：

| Agent 类型 | 职责 | 核心输入 | 输出 |
|------------|------|----------|------|
| Planner Agent | 策划大纲 | 项目设定、角色档案、伏笔状态 | 章节大纲 JSON |
| Writer Agent | 正文写作 | 章节大纲、世界观、角色档案 | 章节正文 |
| Polisher Agent | 文笔润色 | 原始正文、写作风格 | 润色后正文 |
| Validator Agent | 质量校验 | 正文内容、世界设定、伏笔追踪 | 校验报告 |
| Summarizer Agent | 章节摘要 | 章节标题与正文 | 摘要、关键事件、情绪基调 |

### 2.2 数据模型关系

```
User (用户)
├── NovelProject (小说项目)
│   ├── NovelChapter (章节)
│   │   └── ChapterVersion (版本历史)
│   ├── VirtualWriter (虚拟作家)
│   │   └── WriterDocument (训练文档)
│   ├── BookAnalysis (书籍分析)
│   ├── SourceNovel (源小说，拆解模式)
│   ├── Character (角色档案)
│   ├── Plotline (伏笔追踪)
│   ├── StoryState (故事状态)
│   ├── StoryEvent (故事事件)
│   ├── ChapterSummary (章节摘要)
│   ├── VolumeSummary (卷摘要)
│   ├── BookSummary (全书摘要)
│   └── AIModelConfig (AI 模型配置)
```

---

## 3. 关键模块详解

### 3.1 AI 智能体模块 (`src/lib/agents/`)

#### 3.1.1 策划 Agent (`planner.ts`)

**核心功能**：根据项目设定和上下文信息生成章节大纲。

**关键函数**：

```typescript
async function plannerAgent(
  input: PlannerInput,
  onChunk?: (text: string) => void
): Promise<{ outline: ChapterOutline; tokens?: number }>
```

**输入参数**：

- `projectId`: 项目 ID
- `chapterNo`: 章节编号
- `characterProfiles`: 当前角色列表
- `openPlotlines`: 未回收的伏笔
- `emotionalArc`: 情绪曲线数据
- `targetWordCount`: 目标字数

**输出结构**：

```typescript
interface ChapterOutline {
  chapterTitle: string      // 章节标题
  chapterGoal: string       // 本章目标
  mainConflict: string     // 主要冲突
  keyScenes: KeyScene[]    // 关键场景（2-4个）
  ending: string            // 章节结局
  foreshadows: string[]    // 本章新埋伏笔
  resolvedPlotlines: string[] // 回收的伏笔ID
}
```

#### 3.1.2 写作 Agent (`writer.ts`)

**核心功能**：基于章节大纲生成完整的章节正文，支持流式输出。

**关键函数**：

```typescript
async function writerAgent(
  input: WriterInput,
  onChunk?: (text: string) => void
): Promise<{ content: string; tokens?: number }>
```

**特点**：

- 支持流式生成，实时返回 tokens
- 自动注入角色档案和写作风格
- 上下文感知，参考前几章摘要

#### 3.1.3 校验 Agent (`validator.ts`)

**核心功能**：验证章节内容的连贯性、一致性和伏笔回收情况。

**校验维度**：

- 角色行为一致性
- 时间线逻辑
- 世界观符合度
- 伏笔追踪回收
- 内容重复检测

### 3.2 AI 提供商模块 (`src/lib/ai/`)

#### 3.2.1 提供商工厂 (`factory.ts`)

**核心函数**：

```typescript
// 获取 AI Provider 实例（带缓存）
function getAIProvider(vendor: AIVendor, config?: AIConfig): AIProvider

// 从环境变量创建 Provider
function createProviderFromEnv(vendor: AIVendor): AIProvider

// 获取默认配置
function getDefaultAIConfig(): { vendor: AIVendor; modelId: string; apiKey: string }

// 获取支持的提供商列表
function getSupportedAIProviders(): { vendor: AIVendor; name: string }[]
```

**支持的 AI 提供商**：

| 提供商 | 枚举值 | 默认模型 |
|--------|--------|----------|
| OpenAI | `AIVendor.OPENAI` | gpt-4o |
| Anthropic | `AIVendor.ANTHROPIC` | claude-3-5-sonnet |
| 阿里云 | `AIVendor.ALIBABA` | qwen-max |
| DeepSeek | `AIVendor.DEEPSEEK` | deepseek-chat |
| MiniMax | `AIVendor.MINIMAX` | MiniMax-Text-01 |
| 火山引擎 | `AIVendor.VOLCENGINE` | doubao-pro-32k |

#### 3.2.2 提供商基类 (`base.ts`)

所有 AI 提供商需实现以下接口：

```typescript
interface AIProvider {
  // 普通生成
  generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult>
  
  // 流式生成
  generateStream(prompt: string, options?: GenerateOptions): AsyncGenerator<string>
  
  // 配置更新
  setConfig(config: AIConfig): void
}
```

### 3.3 小说引擎模块 (`src/lib/engine/`)

#### 3.3.1 编排器 (`orchestrator.ts`)

**核心流水线**：

```typescript
async function runChapterGenerationPipeline(
  projectId: number,
  chapterNo: number,
  emit: SSEEmitter  // 实时事件回调
): Promise<GenerationResult>
```

**执行流程**：

1. 初始化故事状态
2. 获取上下文数据（角色、伏笔、摘要）
3. 执行策划 Agent → 生成大纲
4. 执行写作 Agent → 生成正文（流式）
5. 执行润色 Agent → 文笔优化
6. 执行校验 Agent → 质量验证
7. 失败重试（最多 3 次）
8. 执行摘要 Agent → 生成摘要
9. 更新记忆系统（角色、伏笔、情绪）

#### 3.3.2 故事状态管理 (`story-state.ts`)

**核心接口**：

```typescript
// 初始化故事状态
async function initStoryState(projectId: number, totalChapters: number): Promise<StoryState>

// 获取故事状态
async function getStoryState(projectId: number): Promise<StoryState | null>

// 更新情绪曲线
async function updateEmotionalArc(
  projectId: number,
  chapterNo: number,
  value: number  // 0-100
): Promise<void>

// 更新章节进度
async function updateChapterProgress(projectId: number, chapterNo: number): Promise<void>

// 记录故事事件
async function recordStoryEvent(
  projectId: number,
  eventType: string,
  description: string,
  chapterNo?: number
): Promise<StoryEvent>
```

### 3.4 记忆系统模块 (`src/lib/memory/`)

#### 3.4.1 角色记忆 (`character-memory.ts`)

```typescript
// 获取角色档案
async function getCharacterProfilesForChapter(
  projectId: number,
  chapterNo: number
): Promise<CharacterProfile[]>

// 批量更新角色状态
async function batchUpdateCharacterProfiles(
  projectId: number,
  updates: Record<string, Record<string, unknown>>
): Promise<void>
```

#### 3.4.2 章节摘要 (`chapter-summary.ts`)

```typescript
// 保存章节摘要
async function saveChapterSummary(
  projectId: number,
  chapterNo: number,
  data: ChapterSummaryData
): Promise<ChapterSummary>

// 获取最近章节摘要
async function getRecentChapterSummaries(
  projectId: number,
  count: number
): Promise<ChapterSummary[]>
```

#### 3.4.3 伏笔追踪 (`plotline-tracker.ts`)

```typescript
// 创建伏笔
async function createPlotline(
  projectId: number,
  data: CreatePlotlineInput
): Promise<Plotline>

// 批量创建伏笔
async function batchCreatePlotlines(
  projectId: number,
  plotlines: CreatePlotlineInput[]
): Promise<Plotline[]>

// 获取开放伏笔
async function getOpenPlotlines(projectId: number): Promise<Plotline[]>

// 回收伏笔
async function batchResolvePlotlines(
  plotlineIds: string[],
  chapterNo: number
): Promise<void>
```

#### 3.4.4 分层摘要系统

为解决长篇小说（760+ 章节）的 token 超限问题，采用三层摘要架构：

| 层级 | 粒度 | 存储模型 | 字数范围 |
|------|------|----------|----------|
| L1 | 章节 | ChapterSummary | 200-300 字 |
| L2 | 卷 | VolumeSummary | 500-800 字 |
| L3 | 全书 | BookSummary | 1000-1500 字 |

### 3.5 导出服务模块 (`src/lib/export/`)

**导出格式支持**：

| 格式 | 说明 | 支持元数据 | 支持压缩 |
|------|------|------------|----------|
| TXT | 纯文本格式 | 可选 | 待实现 |
| MD | Markdown 格式 | 可选 | 待实现 |
| JSON | 结构化数据 | 必含 | 待实现 |

**核心函数**：

```typescript
async function exportNovel(
  projectId: number,
  options: ExportOptions
): Promise<ExportResult>

async function exportChapters(
  projectId: number,
  chapterIds: number[],
  options: ExportOptions
): Promise<ExportResult>
```

---

## 4. API 路由设计

### 4.1 项目管理 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/projects` | GET/POST | 获取/创建项目列表 |
| `/api/projects/[projectId]` | GET/PUT/DELETE | 项目 CRUD |
| `/api/projects/[projectId]/chapters` | GET/POST | 章节列表/创建 |
| `/api/projects/[projectId]/chapters/[chapterId]` | GET/PUT/DELETE | 章节 CRUD |
| `/api/projects/[projectId]/generate` | POST | 章节生成 |
| `/api/projects/[projectId]/export` | POST | 导出小说 |

### 4.2 引擎 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/engine/[projectId]/[chapterNo]` | GET | 章节生成状态 |
| `/api/engine/[projectId]/characters` | GET/POST | 角色管理 |
| `/api/engine/[projectId]/character-graph` | GET | 角色关系图 |
| `/api/engine/[projectId]/memory` | GET | 获取记忆上下文 |
| `/api/engine/[projectId]/story-events` | GET/POST | 故事事件 |

### 4.3 AI 分析 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/novel/ai/analyze-plot` | POST | 情节分析 |
| `/api/novel/ai/analyze-style/[projectId]` | GET | 风格分析 |
| `/api/novel/ai/chapter-rhythm/[projectId]` | GET | 章节节奏热力图 |
| `/api/novel/ai/validate-chapter` | POST | 章节校验 |
| `/api/novel/ai/generate-outline` | POST | 大纲生成 |

---

## 5. 核心类型定义

### 5.1 数据库枚举 (`src/types/`)

```typescript
// 项目状态
enum ProjectStatus {
  DRAFT      // 草稿
  WRITING    // 写作中
  COMPLETED  // 已完成
  PAUSED     // 暂停
}

// 章节状态
enum ChapterStatus {
  DRAFT
  GENERATING
  COMPLETED
  REVIEWING
}

// 角色类型
enum CharacterRole {
  PROTAGONIST  // 主角
  ANTAGONIST   // 反派
  SUPPORTING   // 配角
  MINOR        // 次要
}

// 伏笔类型
enum PlotlineType {
  FORESHADOW  // 伏笔
  SUBPLOT     // 支线
  CONFLICT    // 冲突
}

// AI 提供商
enum AIVendor {
  OPENAI
  ANTHROPIC
  ALIBABA
  DEEPSEEK
  MINIMAX
  VOLCENGINE
}
```

### 5.2 引擎类型 (`src/lib/engine/types.ts`)

```typescript
// 章节大纲
interface ChapterOutline {
  chapterTitle: string
  chapterGoal: string
  mainConflict: string
  keyScenes: KeyScene[]
  ending: string
  foreshadows: string[]
  resolvedPlotlines: string[]
}

// 校验报告
interface ValidationReport {
  result: 'pass' | 'retry'
  score: number
  issues: ValidationIssue[]
  characterUpdates: Record<string, Record<string, unknown>>
  newPlotlines: string[]
  resolvedPlotlines: string[]
}

// SSE 事件
interface SSEEvent {
  type: 'start' | 'token' | 'agent_switch' | 'validation' | 'done' | 'error' | 'wordCount'
  data: Record<string, unknown>
}
```

---

## 6. 依赖关系

### 6.1 主要依赖

```json
{
  "dependencies": {
    "next": "16.2.4",
    "react": "19.2.4",
    "@prisma/client": "6.19.3",
    "zod": "4.4.1",
    "react-hook-form": "7.74.0",
    "@dnd-kit/core": "6.3.1",
    "@xyflow/react": "12.10.2",
    "d3": "7.9.0",
    "lucide-react": "1.14.0",
    "jszip": "3.10.1",
    "epubjs": "0.3.93"
  }
}
```

### 6.2 环境变量配置

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串 | postgresql://... |
| `DEFAULT_AI_VENDOR` | 否 | 默认 AI 提供商 | DEEPSEEK |
| `DEFAULT_AI_MODEL_ID` | 否 | 默认模型 ID | deepseek-chat |
| `DEFAULT_AI_API_KEY` | 否 | 默认 API Key | sk-xxx |
| `DEEPSEEK_API_KEY` | 否 | DeepSeek API Key | sk-xxx |
| `OPENAI_API_KEY` | 否 | OpenAI API Key | sk-xxx |
| `ANTHROPIC_API_KEY` | 否 | Anthropic API Key | sk-xxx |
| `NODE_TLS_REJECT_UNAUTHORIZED` | 否 | 开发环境 SSL 设置 | 0 |

---

## 7. 项目运行

### 7.1 开发环境

```bash
# 安装依赖
npm install

# 数据库迁移
npx prisma migrate dev

# 启动开发服务器（端口 3200）
npm run dev

# 运行测试
npm test

# 运行端到端测试
npm run test:e2e

# 代码检查
npm run lint
```

### 7.2 生产构建

```bash
# 构建应用
npm run build

# 启动生产服务器
npm start
```

### 7.3 测试框架

项目使用 Vitest 进行单元测试，Playwright 进行端到端测试：

- 单元测试：`src/__tests__/unit/`
- 端到端测试：`src/__tests__/e2e/`

---

## 8. 设计模式与最佳实践

### 8.1 Provider 模式

AI 提供商采用工厂模式，通过 `AIProviderFactory` 统一管理不同厂商的 API 调用。这种设计使得新增 AI 提供商时无需修改业务代码。

### 8.2 Agent 流水线模式

章节生成采用流水线设计，每个 Agent 串联执行，通过 SSE 实现实时进度反馈。这种模式便于扩展新的处理阶段。

### 8.3 分层摘要策略

针对长文本上下文超限问题，采用三层摘要架构平衡信息密度与 token 限制：

- 章节级：精细摘要
- 卷级：中等摘要
- 全书级：高层摘要

查询时根据上下文长度动态选择合适的摘要层级。

### 8.4 伏笔追踪机制

通过独立的伏笔模型记录伏笔的埋入和回收状态，确保：

- 新章节可感知所有未回收伏笔
- 伏笔回收时自动关联章节
- 支持伏笔计划回收章节设置

---

## 9. 扩展指南

### 9.1 添加新的 AI 提供商

1. 在 `src/lib/ai/providers/` 创建新的 Provider 文件
2. 实现 `AIProvider` 接口
3. 在 `src/lib/ai/providers/index.ts` 导出
4. 在 `src/lib/ai/factory.ts` 注册 Provider

### 9.2 添加新的 Agent 类型

1. 在 `src/lib/agents/` 创建新的 Agent 文件
2. 定义 Agent 输入输出类型
3. 在 `src/lib/engine/orchestrator.ts` 的流水线中集成

### 9.3 添加新的导出格式

1. 在 `src/lib/export/types.ts` 添加新格式定义
2. 在 `src/lib/export/service.ts` 实现导出逻辑
3. 在对应的 API 路由中支持新格式

---

## 10. 注意事项

- 项目使用 Next.js App Router，所有 API 路由均为服务端点
- 数据库操作统一通过 `src/lib/prisma.ts` 的 Prisma Client 实例
- AI Provider 实例带缓存，配置变更需重启服务
- 章节生成支持 SSE 流式输出，前端需处理 `text/event-stream`
- 生产环境需配置真实的数据库和 AI API 密钥

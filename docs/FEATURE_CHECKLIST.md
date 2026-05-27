# Novel AI 功能清单

> 本文档整理了 Novel AI 网络小说创作平台的完整功能模块，供 AI 进行分析和研究。

## 1. 项目概述

### 1.1 基本信息

| 属性 | 值 |
|------|-----|
| 项目名称 | Novel AI |
| 项目类型 | AI 网络小说创作平台 |
| 技术栈 | Next.js 16.2.4 + React 19.2.4 + PostgreSQL + Prisma 6.19.3 |
| 支持平台 | Web (桌面端/移动端响应式) |

### 1.2 项目模式

| 模式 | 说明 | 使用场景 |
|------|------|----------|
| **创作模式 (CREATE)** | 从零开始创作小说，AI 辅助生成大纲和正文 | 新作品创作 |
| **拆解模式 (ANALYZE)** | 导入已有小说进行结构分析和学习 | 学习借鉴、风格提取 |

---

## 2. AI 智能体系统

### 2.1 Agent 类型定义

| Agent 类型 | 枚举值 | 职责 | 输出 |
|------------|--------|------|------|
| Planner | `PLANNER` | 策划章节大纲 | ChapterOutline |
| Writer | `WRITER` | 生成章节正文 | string |
| Polisher | `POLISHER` | 文笔润色优化 | string |
| Validator | `VALIDATOR` | 质量校验验证 | ValidationReport |
| Summarizer | `SUMMARIZER` | 章节摘要生成 | ChapterSummaryData |
| Researcher | `RESEARCHER` | 资料收集研究 | ResearchRef[] |
| Reviewer | `REVIEWER` | 多人评审 | ReviewReport |
| Deslopper | `DESLOPPER` | 去 AI 味处理 | string |

### 2.2 Agent 实现文件

```
src/lib/agents/
├── planner.ts          # 策划 Agent
├── writer.ts           # 写作 Agent
├── polisher.ts         # 润色 Agent
├── validator.ts        # 校验 Agent
├── summarizer.ts       # 摘要 Agent
├── researcher.ts       # 研究 Agent
├── reviewer.ts         # 评审 Agent
├── deslopper.ts        # 去 AI 味 Agent
├── narrative-director.ts  # 叙事导演 Agent
├── quality-analyzer.ts    # 质量分析 Agent
├── feedback-loop.ts       # 反馈循环
├── model-strategy.ts      # 模型策略
├── adapters.ts            # 适配器
├── base.ts                # 基础接口
├── prompts.ts             # 提示词模板
└── registry.ts            # Agent 注册表
```

### 2.3 校验维度

- **角色行为一致性**：检测角色行为是否符合人设
- **时间线逻辑**：检测时间顺序是否合理
- **世界观符合度**：检测是否符合设定
- **伏笔追踪回收**：检测伏笔是否正确埋设和回收
- **内容重复检测**：检测是否有重复内容

---

## 3. AI 提供商支持

### 3.1 支持的 AI 厂商

| 厂商 | 枚举值 | 默认模型 | API 配置 |
|------|--------|----------|----------|
| OpenAI | `OPENAI` | gpt-4o | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC` | claude-3-5-sonnet | `ANTHROPIC_API_KEY` |
| 阿里云 | `ALIBABA` | qwen-max | `ALIBABA_API_KEY` |
| DeepSeek | `DEEPSEEK` | deepseek-chat | `DEEPSEEK_API_KEY` |
| MiniMax | `MINIMAX` | MiniMax-Text-01 | `MINIMAX_API_KEY` |
| 火山引擎 | `VOLCENGINE` | doubao-pro-32k | `VOLCENGINE_API_KEY` |
| 智谱 AI | `ZHIPU` | glm-4 | `ZHIPU_API_KEY` |
| 秘塔 AI | `MIMO` | - | `MIMO_API_KEY` |

### 3.2 AI 提供商实现

```
src/lib/ai/providers/
├── openai.ts              # OpenAI Provider
├── anthropic.ts           # Anthropic Provider
├── deepseek.ts            # DeepSeek Provider
├── alibaba.ts             # 阿里云 Provider
├── minimax.ts             # MiniMax Provider
├── volcengine.ts          # 火山引擎 Provider
├── zhipu.ts               # 智谱 AI Provider
├── mimo.ts                # 秘塔 AI Provider
└── openai-compatible.ts   # OpenAI 兼容格式 Provider
```

### 3.3 AI 功能模块

```
src/lib/ai/
├── factory.ts             # Provider 工厂
├── base.ts                # Provider 基类
├── service.ts             # AI 服务
├── smart-router.ts         # 智能路由
├── model-fallback.ts      # 模型降级
├── model-compare.ts       # 模型对比
├── invocation-manager.ts   # 调用管理
├── context-manager.ts      # 上下文管理
├── chapter-quality.ts      # 章节质量评估
├── style-analyzer.ts      # 风格分析
├── scoring.ts             # 评分系统
├── stream.ts              # 流式处理
├── traceable-provider.ts  # 可追踪 Provider
└── types.ts               # 类型定义
```

---

## 4. 小说引擎核心功能

### 4.1 引擎模块

```
src/lib/engine/
├── orchestrator.ts           # 编排器（核心流水线）
├── pipeline.ts               # 流水线定义
├── pipeline-runtime.ts       # 流水线运行时
├── production-pipeline.ts    # 生产流水线
├── long-novel-controller.ts  # 长篇小说控制器
├── types.ts                  # 引擎类型
├── context-assembler.ts       # 上下文组装器
├── context-budget.ts          # 上下文预算
├── context-compression.ts     # 上下文压缩
├── context-strategy.ts        # 上下文策略
├── generation-job.ts          # 生成任务
├── task-queue.ts             # 任务队列
├── queue.ts                  # 队列管理
├── story-state.ts             # 故事状态
├── story-steering.ts          # 故事导向
├── blueprint-console.ts       # 蓝图纸质控制台
├── batch-planner.ts          # 批量规划器
├── draft-manager.ts           # 草稿管理器
├── chapter-projections.ts     # 章节预测
├── outline-validator.ts       # 大纲验证
├── rag-vector.ts              # RAG 向量检索
├── analysis-task-manager.ts   # 分析任务管理
├── auto-maintenance.ts        # 自动维护
├── villain-lifecycle.ts       # 反派生命周期
├── world-expansion.ts         # 世界扩展
├── platform-style.ts         # 平台风格适配
├── production-mapping.ts      # 生产映射
├── project-health.ts          # 项目健康度
└── validation/
    ├── validator.ts           # 验证器
    └── types.ts               # 验证类型
```

### 4.2 流水线步骤

| 步骤 | 枚举值 | 说明 |
|------|--------|------|
| 蓝图书写 | `BLUEPRINT` | 生成全书蓝图 |
| 弧线规划 | `ARC_PLAN` | 规划故事弧 |
| 章节列表 | `CHAPTER_LIST` | 生成章节目录 |
| 写作 | `WRITE` | 章节正文生成 |
| 校验 | `VALIDATE` | 质量校验 |
| 润色 | `POLISH` | 文笔润色 |
| 去 AI 味 | `DESLOP` | 消除机器感 |
| 摘要 | `SUMMARIZE` | 生成章节摘要 |

### 4.3 故事状态管理

| 功能 | 说明 |
|------|------|
| 初始化故事状态 | `initStoryState(projectId, totalChapters)` |
| 获取故事状态 | `getStoryState(projectId)` |
| 更新情绪曲线 | `updateEmotionalArc(projectId, chapterNo, value)` |
| 更新章节进度 | `updateChapterProgress(projectId, chapterNo)` |
| 记录故事事件 | `recordStoryEvent(projectId, eventType, description, chapterNo)` |

---

## 5. 记忆系统

### 5.1 记忆模块

```
src/lib/memory/
├── character-memory.ts     # 角色记忆
├── chapter-summary.ts     # 章节摘要
├── volume-summary.ts      # 卷摘要
├── book-summary.ts       # 全书摘要
├── plotline-tracker.ts    # 伏笔追踪
├── memory-orchestrator.ts # 记忆编排器
└── index.ts              # 导出
```

### 5.2 分层摘要系统

为解决长篇小说（760+ 章节）的 token 超限问题，采用三层摘要架构：

| 层级 | 粒度 | 模型 | 字数范围 |
|------|------|------|----------|
| L1 | 章节 | ChapterSummary | 200-300 字 |
| L2 | 卷 | VolumeSummary | 500-800 字 |
| L3 | 全书 | BookSummary | 1000-1500 字 |

### 5.3 伏笔追踪功能

| 功能 | 说明 |
|------|------|
| 创建伏笔 | `createPlotline(projectId, data)` |
| 批量创建伏笔 | `batchCreatePlotlines(projectId, plotlines)` |
| 获取开放伏笔 | `getOpenPlotlines(projectId)` |
| 回收伏笔 | `batchResolvePlotlines(plotlineIds, chapterNo)` |

---

## 6. 创作功能

### 6.1 创作 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/ai/generate-idea` | POST | 生成小说创意 |
| `/api/novel/ai/generate-title` | POST | 生成小说标题 |
| `/api/novel/ai/generate-synopsis` | POST | 生成小说简介 |
| `/api/novel/ai/generate-outline` | POST | 生成大纲 |
| `/api/novel/ai/generate-chapter-list` | POST | 生成章节目录 |
| `/api/novel/ai/generate-book-summary` | POST | 生成全书摘要 |
| `/api/novel/ai/generate-volume-summary` | POST | 生成卷摘要 |
| `/api/novel/ai/revision` | POST | 章节修订 |
| `/api/novel/ai/validate-chapter` | POST | 章节校验 |

### 6.2 章节标题风格

| 风格 | 枚举值 | 特点 | 示例 |
|------|--------|------|------|
| 网文风格 | `webnovel` | 吸睛有悬念 | "他竟然是隐藏的首富？" |
| 传统风格 | `traditional` | 简洁概括 | "第三章 意外的相遇" |
| 诗词风格 | `poetry` | 文艺对仗 | "第三回 风雪夜归人" |

### 6.3 章节生成参数

```typescript
interface GenerateChapterListRequest {
  projectTitle: string        // 小说标题（必填）
  genre?: string             // 类型
  writingStyle?: string       // 写作风格
  worldSetting?: string       // 世界观设定
  protagonistProfile?: string // 主角人设
  protagonistGoal?: string    // 主角目标
  antagonistSetting?: string  // 反派设定
  endingPlan?: string        // 结局规划
  totalChapters: number      // 章节数量（默认50，最大500）
  titleStyle: 'webnovel' | 'traditional' | 'poetry'  // 标题风格
  aiModelId?: number         // AI 模型配置 ID
  vendor?: AIVendor          // AI 提供商
  temperature?: number        // 温度参数（默认0.7）
}
```

---

## 7. 分析功能

### 7.1 分析 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/ai/analyze-plot` | POST | 情节分析 |
| `/api/novel/ai/analyze-style/[projectId]` | GET | 风格分析 |
| `/api/novel/ai/chapter-rhythm/[projectId]` | GET | 章节节奏热力图 |
| `/api/novel/ai/check-style-consistency/[projectId]` | GET | 风格一致性检查 |
| `/api/novel/ai/dimension-correlation/[projectId]` | GET | 维度关联分析 |
| `/api/novel/ai/hierarchical-summary/[projectId]` | GET | 分层摘要 |
| `/api/novel/ai/extract-characters` | POST | 提取角色 |
| `/api/novel/ai/plotline/[plotlineId]` | GET/PUT | 伏笔详情 |
| `/api/novel/ai/plotline-table/[projectId]` | GET | 伏笔表格 |

### 7.2 章节质量分析

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/ai/chapter-quality/analyze` | POST | 章节质量分析 |
| `/api/novel/ai/chapter-quality/optimize` | POST | 章节质量优化 |
| `/api/novel/ai/chapter-quality/batch-optimize` | POST | 批量章节优化 |

### 7.3 分析维度

| 维度 | 说明 |
|------|------|
| 角色关系 | CHARACTER_RELATION |
| 剧情线 | PLOT_LINE |
| 伏笔分析 | FORESHADOWING |
| 章节节奏 | CHAPTER_RHYTHM |
| 情绪曲线 | EMOTIONAL_ARC |
| 风格一致性 | STYLE_CONSISTENCY |

---

## 8. 短篇小说功能

### 8.1 短篇 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/short-story/write` | POST | 短篇写作 |
| `/api/short-story/outline` | POST | 短篇大纲生成 |
| `/api/short-story/emotion` | POST | 情感设计 |
| `/api/short-story/reversal` | POST | 反转设计 |
| `/api/short-story/hooks` | POST | 钩子设计 |
| `/api/short-story/[projectId]` | GET | 获取短篇项目 |

### 8.2 短篇结构

| 结构类型 | 枚举值 | 说明 |
|----------|--------|------|
| 三幕式 | `three_act` | 经典三幕结构 |
| 英雄之旅 | `hero_journey` | 英雄成长弧线 |
| 起承转合 | `classical_chinese` | 传统四段式 |

---

## 9. 去 AI 味功能

### 9.1 去 AI 味 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/deslop/detect` | POST | AI 味检测 |
| `/api/novel/deslop/rewrite` | POST | AI 味重写 |
| `/api/novel/anti-detect/detect` | POST | 反检测 |
| `/api/novel/anti-detect/rewrite` | POST | 反检测重写 |

### 9.2 去 AI 味规则

| 规则 | 说明 |
|------|------|
| 禁止排比句堆砌 | 检测并替换过度排比 |
| 禁止过度比喻 | 检测并简化复杂比喻 |
| 口语化表达 | 引入口语化和意识流 |
| 情绪行为细节 | 通过行为而非直接描写表达情绪 |
| 段落长短参差 | 避免均匀段落长度 |

---

## 10. 角色管理

### 10.1 角色 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/characters` | GET/POST | 获取/创建角色 |
| `/api/engine/[projectId]/characters` | GET/POST | 项目角色管理 |
| `/api/engine/[projectId]/characters/[characterId]` | GET/PUT/DELETE | 角色 CRUD |
| `/api/engine/[projectId]/character-graph` | GET | 角色关系图 |

### 10.2 角色类型

| 类型 | 枚举值 | 说明 |
|------|--------|------|
| 主角 | `PROTAGONIST` | 故事核心人物 |
| 反派 | `ANTAGONIST` | 主要对立角色 |
| 配角 | `SUPPORTING` | 重要配角 |
| 次要 | `MINOR` | 背景角色 |

### 10.3 角色属性

| 属性 | 类型 | 说明 |
|------|------|------|
| name | string | 角色名称 |
| role | CharacterRole | 角色类型 |
| aliases | string[] | 别名 |
| appearance | string | 外貌描述 |
| personality | string | 性格特点 |
| catchphrases | string[] | 口头禅 |
| background | string | 背景故事 |
| relationships | JSON | 关系网络 |
| currentState | JSON | 当前状态 |
| firstChapter | int | 首次出场章节 |
| lastUpdated | int | 最后更新章节 |

---

## 11. 伏笔系统

### 11.1 伏笔类型

| 类型 | 枚举值 | 说明 |
|------|--------|------|
| 伏笔 | `FORESHADOW` | 预先埋设的线索 |
| 支线 | `SUBPLOT` | 独立于主线的剧情 |
| 冲突 | `CONFLICT` | 核心矛盾冲突 |

### 11.2 伏笔状态

| 状态 | 枚举值 | 说明 |
|------|--------|------|
| 开放 | `OPEN` | 未回收 |
| 已回收 | `RESOLVED` | 已处理 |
| 废弃 | `ABANDONED` | 已放弃 |

---

## 12. 导出功能

### 12.1 导出 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/projects/[projectId]/export` | POST | 导出小说 |
| `/api/novel/projects/[projectId]/export/download` | GET | 下载导出文件 |
| `/api/novel/projects/[projectId]/export-data` | GET | 导出数据 |

### 12.2 导出格式

| 格式 | 说明 | 元数据 | 压缩 |
|------|------|--------|------|
| TXT | 纯文本格式 | 可选 | 待实现 |
| MD | Markdown 格式 | 可选 | 待实现 |
| JSON | 结构化数据 | 必含 | 待实现 |
| EPUB | 电子书格式 | 必含 | 支持 |

### 12.3 导出模块

```
src/lib/export/
├── service.ts              # 导出服务
├── export-manager.ts       # 导出管理器
├── types.ts                # 导出类型
└── adapters/
    ├── epub.ts             # EPUB 适配器
    └── index.ts            # 适配器索引
```

---

## 13. 市场分析功能

### 13.1 市场 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/market/analyze` | POST | 市场分析 |
| `/api/market/recommend` | POST | 市场推荐 |
| `/api/market/trends` | GET | 市场趋势 |
| `/api/novel/research/[refId]` | GET | 研究资料 |
| `/api/novel/research` | GET/POST | 研究资料管理 |
| `/api/novel/review/[reportId]` | GET | 评审报告 |
| `/api/novel/review` | GET/POST | 评审管理 |
| `/api/novel/inspiration` | GET/POST | 灵感获取 |

### 13.2 平台支持

| 平台 | 枚举值 |
|------|--------|
| 起点中文网 | `QIDIAN` |
| 番茄小说 | `FANQIE` |
| 飞卢小说 | `FEILU` |
| 晋江文学城 | `JINJIANG` |
| 七猫小说 | `QIMAO` |

---

## 14. 封面生成功能

### 14.1 封面 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/cover/generate` | POST | 生成封面 |
| `/api/novel/cover/list/[projectId]` | GET | 封面列表 |
| `/api/novel/cover/capability` | GET | 封面能力 |
| `/api/novel/cover/[designId]` | GET | 封面详情 |

### 14.2 封面模块

```
src/lib/cover/
└── service.ts  # 封面生成服务
```

---

## 15. 成本控制功能

### 15.1 成本 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/cost` | GET | 获取成本统计 |
| `/api/novel/cost/estimate` | POST | 成本估算 |

### 15.2 成本追踪模块

```
src/lib/cost-tracker/
└── index.ts  # 成本追踪服务
```

### 15.3 配额管理

| 功能 | 说明 |
|------|------|
| 月度限制 | `monthlyLimit` |
| 警报阈值 | `alertThreshold` |
| 锁定状态 | `isLocked` |

---

## 16. 虚拟作家功能

### 16.1 虚拟作家 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/virtual-writers` | GET/POST | 虚拟作家列表/创建 |
| `/api/novel/virtual-writers/[writerId]` | GET/PUT/DELETE | 作家 CRUD |
| `/api/novel/virtual-writers/[writerId]/train` | POST | 训练作家 |
| `/api/novel/virtual-writers/[writerId]/documents` | GET/POST | 文档管理 |

### 16.2 作家类型

| 类型 | 枚举值 | 说明 |
|------|--------|------|
| 真实作者 | `REAL_AUTHOR` | 模仿真实作者 |
| 自定义 | `CUSTOM` | 自定义风格 |

### 16.3 训练状态

| 状态 | 枚举值 | 说明 |
|------|--------|------|
| 未训练 | `UNTRAINED` | - |
| 训练中 | `TRAINING` | - |
| 已训练 | `TRAINED` | - |
| 训练失败 | `FAILED` | - |

---

## 17. 流水线与任务管理

### 17.1 流水线 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/projects/[projectId]/pipeline/start` | POST | 启动流水线 |
| `/api/novel/projects/[projectId]/pipeline/pause` | POST | 暂停流水线 |
| `/api/novel/projects/[projectId]/pipeline/resume` | POST | 恢复流水线 |
| `/api/novel/projects/[projectId]/pipeline/status` | GET | 流水线状态 |
| `/api/novel/projects/[projectId]/pipeline/stream` | GET | 流水线流式输出 |

### 17.2 任务状态

| 状态 | 枚举值 | 说明 |
|------|--------|------|
| 等待中 | `PENDING` | - |
| 运行中 | `RUNNING` | - |
| 已完成 | `COMPLETED` | - |
| 失败 | `FAILED` | - |
| 已暂停 | `PAUSED` | - |

### 17.3 章节生成 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/projects/[projectId]/generate` | POST | 单章生成 |
| `/api/novel/projects/[projectId]/generate/stream` | GET | 流式生成 |
| `/api/novel/projects/[projectId]/generate/batch` | POST | 批量生成 |

---

## 18. 数据分析与可视化

### 18.1 可视化组件

```
src/components/ai/
├── CharacterRelationshipGraph.tsx  # 角色关系图
├── CharacterNode.tsx               # 角色节点
├── RelationshipEdge.tsx            # 关系边
├── ChapterRhythmHeatmap.tsx        # 章节节奏热力图
├── DimensionCorrelationView.tsx   # 维度关联视图
└── BatchProgress.tsx              # 批量进度
```

### 18.2 分析模块

```
src/lib/analysis/
├── chapter-graph.ts    # 章节图谱分析
├── chapter-utils.ts    # 章节工具
└── config.ts          # 分析配置
```

---

## 19. 钩子与扩展系统

### 19.1 钩子 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/hooks` | GET/POST | 钩子列表/创建 |
| `/api/hooks/[hookId]` | GET/PUT/DELETE | 钩子 CRUD |
| `/api/short-story/hooks` | POST | 短篇钩子 |

### 19.2 钩子模块

```
src/lib/hooks/
├── types.ts       # 钩子类型定义
├── registry.ts    # 钩子注册表
└── builtins.ts    # 内置钩子
```

---

## 20. 用户与认证

### 20.1 用户功能

| 功能 | 说明 |
|------|------|
| 用户注册 | Email/Password |
| 社交登录 | NextAuth 支持 |
| 用户配额 | 额度管理 |
| 通知系统 | 消息通知 |

### 20.2 认证 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth 路由 |

### 20.3 用户模型

```prisma
model User {
  id               Int
  email            String
  name             String?
  password         String?
  image            String?
  projects         NovelProject[]
  virtualWriters   VirtualWriter[]
  notifications    Notification[]
  aiUsages         AIUsage[]
}
```

---

## 21. 通知系统

### 21.1 通知 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/notifications` | GET | 通知列表 |
| `/api/notifications/read-all` | POST | 全部已读 |
| `/api/notifications/[id]/read` | POST | 单条已读 |

### 21.2 通知类型

| 类型 | 枚举值 | 说明 |
|------|--------|------|
| 系统通知 | `SYSTEM` | - |
| 任务通知 | `TASK` | - |
| 配额通知 | `QUOTA` | - |
| 错误通知 | `ERROR` | - |

### 21.3 通知优先级

| 优先级 | 枚举值 |
|--------|--------|
| 低 | `LOW` |
| 普通 | `NORMAL` |
| 高 | `HIGH` |

---

## 22. 项目健康度

### 22.1 健康度检查

| 检查项 | 说明 |
|--------|------|
| 伏笔回收率 | 已回收伏笔 / 总伏笔 |
| 章节完成率 | 已完成章节 / 总章节 |
| 角色一致性 | 角色行为是否符合设定 |
| 故事节奏 | 章节节奏是否合理 |

### 22.2 健康度模块

```
src/lib/notifications/
└── project-health.ts  # 项目健康度通知
```

---

## 23. 写作风格与知识库

### 23.1 知识库模块

```
src/lib/knowledge/
├── styles.ts           # 写作风格知识
├── genre-formulas.ts  # 类型公式
├── emotional-arcs.ts  # 情感曲线
├── hooks.ts            # 钩子知识
├── chapter-quality.ts  # 章节质量知识
└── anti-ai.ts         # 去 AI 味知识
```

### 23.2 类型公式

支持的网文类型：
- 玄幻
- 都市
- 仙侠
- 科幻
- 游戏
- 历史
- 悬疑
- 轻小说

---

## 24. 世界观与力量体系

### 24.1 世界状态

| 属性 | 类型 | 说明 |
|------|------|------|
| mapLevel | int | 地图层级 |
| factionCount | int | 势力数量 |
| powerLevel | int | 力量等级 |
| civilizationLevel | int | 文明等级 |
| classStructure | string[] | 阶级结构 |
| regions | string[] | 区域 |
| currentExpansion | string | 当前扩展方向 |

### 24.2 反派生命周期

```
src/lib/engine/
└── villain-lifecycle.ts  # 反派生命周期管理
```

---

## 25. 蓝图书写

### 25.1 蓝图 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/projects/[projectId]/blueprint` | GET/PUT | 蓝图书写 |
| `/api/novel/projects/[projectId]/blueprint-console` | POST | 蓝图控制台 |
| `/api/novel/projects/[projectId]/arc-plans` | GET/POST | 弧线规划 |

### 25.2 弧线阶段

| 阶段 | 枚举值 | 说明 |
|------|--------|------|
| 开端 | `OPENING` | 故事引入 |
| 成长 | `GROWTH` | 角色成长 |
| 扩展 | `EXPANSION` | 世界扩展 |
| 中段冲突 | `MID_CONFLICT` | 核心冲突 |
| 前置高潮 | `PRE_FINALE` | 高潮前奏 |
| 结局 | `FINALE` | 故事收尾 |

---

## 26. 项目维护

### 26.1 自动维护任务

| 任务类型 | 说明 |
|----------|------|
| 摘要更新 | 更新分层摘要 |
| 伏笔清理 | 清理废弃伏笔 |
| 角色状态同步 | 同步角色状态 |
| 世界状态更新 | 更新世界设定 |

### 26.2 维护模块

```
src/lib/engine/
└── auto-maintenance.ts  # 自动维护
```

---

## 27. RAG 向量检索

### 27.1 RAG API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/projects/[projectId]/rag/rebuild` | POST | 重建向量索引 |

### 27.2 RAG 模块

```
src/lib/engine/
└── rag-vector.ts  # RAG 向量检索
```

---

## 28. 创作延续功能

### 28.1 延续 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/projects/[projectId]/continuation` | POST | 创作延续 |
| `/api/novel/projects/[projectId]/continuation/context` | GET | 延续上下文 |

### 28.2 续写控制

| 功能 | 说明 |
|------|------|
| 上下文组装 | 组装续写所需上下文 |
| 字数控制 | 控制续写长度 |
| 风格保持 | 保持原有写作风格 |

---

## 29. 故事导向

### 29.1 导向 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/projects/[projectId]/steering` | POST | 故事导向调整 |

### 29.2 导向参数

| 参数 | 说明 |
|------|------|
| 冲突强度 | `conflictIntensity` (0-1) |
| 黑暗程度 | `darkness` (0-1) |
| 幽默程度 | `humor` (0-1) |
| 节奏 | `pace` (0-1) |
| 浪漫程度 | `romance` (0-1) |
| 神秘程度 | `mysteryDensity` (0-1) |
| 力量成长 | `powerGrowth` (0-1) |

---

## 30. 数据模型关系图

```
User (用户)
├── NovelProject (小说项目)
│   ├── NovelChapter (章节)
│   │   ├── ChapterVersion (版本历史)
│   │   └── ChapterCommit (章节提交)
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
│   ├── ShortStory (短篇小说)
│   ├── CoverDesign (封面设计)
│   ├── ResearchRef (研究资料)
│   ├── ReviewReport (评审报告)
│   ├── ArcPlan (弧线规划)
│   ├── BookBlueprint (全书蓝图)
│   ├── Villain (反派)
│   ├── WorldState (世界状态)
│   ├── GenerationJob (生成任务)
│   ├── ProjectMaintenanceTask (维护任务)
│   └── AIModelConfig (AI 模型配置)
├── Notification (通知)
├── AIUsage (AI 使用记录)
└── UserQuota (用户配额)
```

---

## 31. 技术架构总结

### 31.1 前端架构

```
src/app/
├── (main)/                    # 主应用路由
│   ├── projects/             # 项目管理页面
│   ├── settings/             # 设置页面
│   └── cost/                # 成本页面
├── api/                      # API 路由
│   ├── novel/               # 小说 API
│   ├── projects/            # 项目 API
│   ├── engine/              # 引擎 API
│   ├── market/              # 市场 API
│   └── ...
└── login/                   # 登录页面
```

### 31.2 组件架构

```
src/components/
├── ai/                     # AI 功能组件
├── chapter/                # 章节组件
├── project/                # 项目组件
├── ui/                     # 通用 UI
├── writer/                 # 虚拟作家
├── layout/                 # 布局组件
└── inspiration/           # 灵感组件
```

### 31.3 核心模式

| 模式 | 应用场景 |
|------|----------|
| Provider 模式 | AI 提供商管理 |
| 流水线模式 | 章节生成流程 |
| 工厂模式 | 对象创建 |
| 观察者模式 | SSE 实时推送 |
| 策略模式 | 上下文压缩策略 |

---

## 32. 环境变量

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接 | `postgresql://...` |
| `DEFAULT_AI_VENDOR` | 否 | 默认 AI 提供商 | `DEEPSEEK` |
| `DEFAULT_AI_MODEL_ID` | 否 | 默认模型 ID | `deepseek-chat` |
| `DEFAULT_AI_API_KEY` | 否 | 默认 API Key | `sk-xxx` |
| `DEEPSEEK_API_KEY` | 否 | DeepSeek Key | `sk-xxx` |
| `OPENAI_API_KEY` | 否 | OpenAI Key | `sk-xxx` |
| `ANTHROPIC_API_KEY` | 否 | Anthropic Key | `sk-xxx` |
| `ALIBABA_API_KEY` | 否 | 阿里云 Key | `sk-xxx` |
| `MINIMAX_API_KEY` | 否 | MiniMax Key | `sk-xxx` |
| `VOLCENGINE_API_KEY` | 否 | 火山引擎 Key | `sk-xxx` |
| `NODE_TLS_REJECT_UNAUTHORIZED` | 否 | SSL 设置 | `0` |

---

## 33. 数据库模型一览

### 33.1 核心模型

| 模型名 | 说明 | 关键字段 |
|--------|------|----------|
| User | 用户 | email, password, image |
| NovelProject | 项目 | title, genre, status, mode |
| NovelChapter | 章节 | chapterNumber, title, content, status |
| Character | 角色 | name, role, relationships |
| Plotline | 伏笔 | type, status, plantedAt, resolvedAt |
| StoryState | 故事状态 | emotionalArc, mainConflict |
| ChapterSummary | 章节摘要 | summary, keyEvents, emotionalTone |
| VolumeSummary | 卷摘要 | volumeNumber, summary |
| BookSummary | 全书摘要 | mainPlot, subPlots |

### 33.2 分析模型

| 模型名 | 说明 |
|--------|------|
| BookAnalysis | 书籍分析结果 |
| AnalysisTask | 分析任务 |
| ChapterGraphSnapshot | 章节图谱快照 |
| ReviewReport | 评审报告 |
| ResearchRef | 研究资料 |

### 33.3 生成模型

| 模型名 | 说明 |
|--------|------|
| GenerationJob | 生成任务 |
| PipelineCheckpoint | 流水线检查点 |
| ChapterCommit | 章节提交 |
| ChapterVersion | 章节版本 |

### 33.4 配置模型

| 模型名 | 说明 |
|--------|------|
| AIModelConfig | AI 模型配置 |
| VirtualWriter | 虚拟作家 |
| CoverDesign | 封面设计 |
| MarketTrend | 市场趋势 |
| MarketBook | 市场上榜书籍 |

---

## 34. API 响应格式

### 34.1 成功响应

```json
{
  "success": true,
  "data": { ... }
}
```

### 34.2 错误响应

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误信息"
  }
}
```

---

## 35. SSE 事件类型

| 事件类型 | 说明 | 数据内容 |
|----------|------|----------|
| `start` | 开始生成 | 项目/章节信息 |
| `token` | Token 输出 | 文本片段 |
| `agent_switch` | Agent 切换 | 切换的 Agent 类型 |
| `validation` | 校验结果 | 校验报告 |
| `done` | 生成完成 | 最终结果 |
| `error` | 错误发生 | 错误信息 |
| `wordCount` | 字数更新 | 当前字数 |
| `research` | 研究完成 | 研究结果 |
| `hook_warning` | 钩子警告 | 警告信息 |
| `phase_timing` | 阶段计时 | 耗时统计 |

---

## 总结

Novel AI 是一个功能完整的 AI 网络小说创作平台，涵盖了从创意生成到完稿的全流程。主要功能包括：

1. **多智能体协作**：7+ 种专业 Agent 协作完成创作
2. **多 AI 提供商**：支持 8 家主流 AI 服务商
3. **完整创作流程**：创意 → 大纲 → 章节 → 润色 → 导出
4. **深度分析能力**：角色关系、伏笔追踪、风格分析
5. **长篇小说支持**：分层摘要系统解决上下文限制
6. **去 AI 味技术**：专业提示词消除机器感
7. **市场分析**：趋势追踪、竞品分析
8. **导出多样**：支持 TXT、MD、JSON、EPUB 格式
9. **成本控制**：Token 统计、配额管理
10. **虚拟作家**：可训练的个性化写作风格

---

---

## 36. 章节提交与重播

### 36.1 章节提交 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/projects/[projectId]/chapter-commits` | GET/POST | 章节提交列表/创建 |
| `/api/novel/projects/[projectId]/chapter-commits/[commitId]/replay` | POST | 章节重播生成 |

### 36.2 章节重播功能

| 功能 | 说明 |
|------|------|
| 保存章节状态 | 保存章节生成时的完整状态 |
| 重播生成 | 从历史提交点重新生成章节 |
| 状态恢复 | 恢复章节状态回滚到历史版本 |

---

## 37. 分析任务管理

### 37.1 分析任务 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/projects/[projectId]/analysis-task` | GET/POST | 分析任务列表/创建 |
| `/api/novel/analysis-task/[taskId]/cancel` | POST | 取消分析任务 |

### 37.2 分析任务状态

| 状态 | 枚举值 | 说明 |
|------|--------|------|
| 等待中 | `PENDING` | 任务等待执行 |
| 运行中 | `RUNNING` | 任务执行中 |
| 已完成 | `COMPLETED` | 任务执行完成 |
| 已取消 | `CANCELLED` | 任务已被用户取消 |
| 失败 | `FAILED` | 任务执行失败 |

---

## 38. 灵感市场

### 38.1 灵感 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/inspiration` | GET/POST | 灵感列表/创建 |

### 38.2 灵感类型

| 类型 | 枚举值 | 说明 |
|------|--------|------|
| 网络热榜 | `HOT_RANKING` | 网络热门内容 |
| 创意灵感 | `CREATIVE_IDEA` | AI生成的创意 |
| 风格参考 | `STYLE_REFERENCE` | 写作风格参考 |

---

## 39. 章节图谱

### 39.1 章节图谱 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/projects/[projectId]/chapter-graph` | GET | 获取章节图谱 |

### 39.2 章节图谱功能

| 功能 | 说明 |
|------|------|
| 角色出场追踪 | 追踪角色在各章节的出场情况 |
| 情节发展可视化 | 可视化情节发展时间线 |
| 伏笔埋设回收 | 可视化伏笔的埋设与回收位置 |
| 情绪曲线追踪 | 追踪各章节的情绪变化 |

---

## 40. 书籍分析仪表板

### 40.1 分析模块组件

```
src/components/ai/
├── BookAnalysisDashboard.tsx  # 书籍分析仪表板
├── AnalysisWorkbench.tsx  # 分析工作台
├── AnalysisTaskPanel.tsx   # 分析任务面板
└── DraggableTimeline.tsx # 可拖拽时间线
```

---

## 41. 章节摘要增强

### 41.1 摘要 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/projects/[projectId]/chapters/[chapterId]/enhance-summary` | POST | 增强章节摘要 |
| `/api/novel/projects/[projectId]/chapters/normalize` | POST | 规范化章节内容 |

### 41.2 摘要增强功能

| 功能 | 说明 |
|------|------|
| 关键事件提取 | 提取章节关键事件 |
| 情绪概括 | 自动概括章节情绪基调 |
| 伏笔追踪 | 追踪伏笔的埋设与回收 |
| 角色发展记录 | 记录角色发展变化 |

---

## 42. 项目引导流程

### 42.1 引导 API

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/novel/projects/[projectId]/bootstrap` | POST | 项目引导初始化 |

### 42.2 引导步骤

| 步骤 | 说明 |
|------|------|
| 1 | 初始化项目设置 |
| 2 | 生成全书蓝图 |
| 3 | 规划故事弧线 |
| 4 | 生成章节目录 |
| 5 | 创建角色设定 |
| 6 | RAG 向量构建 |

---

## 总结

Novel AI 是一个功能完整的 AI 网络小说创作平台，涵盖了从创意生成到完稿的全流程。主要功能包括：

1. **多智能体协作**：9+ 种专业 Agent 协作完成创作
2. **多 AI 提供商**：支持 8 家主流 AI 服务商（新增智谱 AI、秘塔 AI）
3. **完整创作流程**：创意 → 大纲 → 章节 → 润色 → 导出
4. **深度分析能力**：角色关系、伏笔追踪、风格分析、书籍分析仪表板
5. **长篇小说支持**：分层摘要系统解决上下文限制
6. **去 AI 味与反检测**：专业提示词消除机器感、反检测重写
7. **RAG 向量检索**：基于 pgvector 的智能检索增强
8. **市场分析**：灵感市场、趋势追踪、竞品分析
9. **导出多样**：支持 EPUB 格式导出
10. **成本控制**：Token 统计、配额管理
11. **虚拟作家**：可训练的个性化写作风格
12. **流水线与任务管理**：章节提交与重播、分析任务管理
13. **项目健康度**：自动维护任务、健康度检查
14. **故事导向**：可调节的创作参数

---

*文档更新时间: 2026-05-25*

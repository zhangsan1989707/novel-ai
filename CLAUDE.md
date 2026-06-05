# Novel AI 项目配置

> 最后更新：2026-06-05

## 项目概述

Novel AI 是一个基于多智能体协作的 AI 网络小说工业化生产系统，支持从创意到完稿的全流程创作辅助。

- **版本**: 0.1.0
- **端口**: 3200
- **技术栈**: Next.js 16.2 + React 19.2 + PostgreSQL + Prisma 6.19
- **代码规模**: 219 个 TS 库文件 + 100 个 TSX 组件 + 135 个 API 路由

## 启动命令

```bash
npm run dev          # 开发服务器 (端口 3200)
npm run build        # 生产构建
npm start            # 启动生产服务器
npm test             # 运行测试 (280 tests, 35 files)
npm run test:e2e     # 端到端测试
```

## 环境变量

### 数据库
```env
DATABASE_URL="postgresql://user:password@localhost:5432/novel_ai"
```

### AI 配置
```env
# 默认配置
DEFAULT_AI_VENDOR="DEEPSEEK"           # 默认 AI 提供商
DEFAULT_AI_MODEL_ID="deepseek-chat"     # 默认模型 ID
DEFAULT_AI_API_KEY="your-api-key"       # 默认 API Key

# 各厂商配置 (支持 8 家)
DEEPSEEK_API_KEY="your-key"
OPENAI_API_KEY="your-key"
ANTHROPIC_API_KEY="your-key"
ALIBABA_API_KEY="your-key"
MINIMAX_API_KEY="your-key"
VOLCENGINE_API_KEY="your-key"
ZHIPU_API_KEY="your-key"
MIMO_API_KEY="your-key"
```

### 网络配置
```env
NODE_TLS_REJECT_UNAUTHORIZED=0  # 公司网络 SSL 代理
```

## 数据库操作

```bash
npx prisma migrate dev      # 创建迁移
npx prisma migrate deploy   # 应用迁移
npx prisma migrate reset    # 重置数据库
npx prisma studio           # 查看数据库
npx prisma generate         # 生成 Prisma Client
```

## 项目结构

```
novel-ai/
├── prisma/                          # 数据库模型 (1 schema, 迁移文件)
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (main)/                  # 主应用页面
│   │   │   ├── projects/            # 项目管理
│   │   │   │   ├── [projectId]/     # 项目详情
│   │   │   │   │   └── chapters/    # 章节管理 + 生成
│   │   │   │   └── new/             # 新建项目
│   │   │   ├── settings/            # 系统设置
│   │   │   ├── cost/                # 成本统计
│   │   │   └── market/              # 市场分析
│   │   └── api/                     # API 路由 (135个)
│   │       ├── novel/               # 小说相关 API
│   │       │   ├── ai/              # AI 能力 (20个)
│   │       │   ├── engine/          # 引擎 (8个)
│   │       │   ├── projects/        # 项目管理 (15个)
│   │       │   ├── deslop/          # 去AI味 (2个)
│   │       │   └── ...
│   │       ├── short-story/         # 短篇 (8个)
│   │       ├── market/              # 市场 (3个)
│   │       └── notifications/       # 通知
│   ├── components/                  # React 组件 (100个)
│   │   ├── ai/                      # AI 功能组件 (30个)
│   │   ├── chapter/                 # 章节组件
│   │   ├── project/                 # 项目组件
│   │   ├── ui/                      # 通用 UI
│   │   └── writer/                  # 虚拟作家
│   ├── lib/                         # 核心业务逻辑 (219个)
│   │   ├── engine/                  # 小说引擎 (60个文件)
│   │   ├── agents/                  # Agent 智能体 (18个)
│   │   ├── ai/                      # AI 服务封装 (27个)
│   │   ├── memory/                  # 记忆系统 (7个)
│   │   ├── prompts/                 # 提示词库 (30+个)
│   │   ├── knowledge/               # 写作知识库 (7个)
│   │   ├── export/                  # 导出服务
│   │   ├── cost-tracker/            # 成本追踪
│   │   └── hooks/                   # 工作流钩子
│   └── types/                       # TypeScript 类型
├── docs/                            # 项目文档 (20+个)
├── scripts/                         # 部署脚本
├── package.json
├── CLAUDE.md                        # 本文件
├── AGENTS.md                        # Agent 开发指南
├── CHANGELOG.md                     # 变更日志
├── CODE_WIKI.md                     # 代码架构
├── README.md                        # 项目介绍
├── TODO_ISSUES.md                   # TODO 跟踪
├── docker-compose.yml
└── Dockerfile
```

## 核心架构

### 小说引擎 (60个文件)

```
src/lib/engine/
├── orchestrator.ts              # 主编排器
├── production-pipeline.ts       # 生产级流水线
├── project-runtime.ts           # 统一运行态
├── project-pipeline-snapshot.ts # 快照构建
├── chapter-continuity.ts        # 章节连续性
├── chapter-repair.ts            # 章节修复
├── chapter-commit.ts            # 章节提交
├── quality-gate.ts              # 质量门禁
├── context-budget.ts            # 上下文预算
├── context-compression.ts       # 上下文压缩
├── long-novel-controller.ts     # 长篇控制器
├── story-state.ts               # 故事状态
├── world-expansion.ts           # 世界扩张
├── villain-lifecycle.ts         # 反派生命周期
├── truncation-detector.ts       # 截断检测
├── rag-vector.ts                # RAG 向量检索
└── ...
```

### Agent 系统 (18个 Agent)

```
src/lib/agents/
├── planner.ts              # 策划 Agent
├── writer.ts               # 写作 Agent
├── polisher.ts             # 润色 Agent
├── validator.ts            # 校验 Agent
├── summarizer.ts           # 摘要 Agent
├── researcher.ts           # 研究 Agent
├── reviewer.ts             # 评审 Agent
├── reader.ts               # 读者 Agent
├── deslopper.ts            # 去AI味 Agent
├── narrative-director.ts   # 叙事导演 Agent
├── quality-analyzer.ts     # 质量分析 Agent
├── feedback-loop.ts        # 反馈循环
├── model-strategy.ts       # 模型策略
├── correction-builder.ts   # 修正构建器
├── adapters.ts             # 适配器
├── base.ts                 # 基础接口
├── prompts.ts              # 提示词模板
└── registry.ts             # 注册表
```

### AI 提供商 (8家)

```
src/lib/ai/providers/
├── openai.ts              # OpenAI
├── anthropic.ts           # Anthropic
├── alibaba.ts             # 阿里云
├── deepseek.ts            # DeepSeek
├── minimax.ts             # MiniMax
├── volcengine.ts          # 火山引擎
├── zhipu.ts               # 智谱 AI
├── mimo.ts                # 秘塔 AI
└── openai-compatible.ts   # OpenAI 兼容格式
```

## 开发规范

### API 响应格式
```typescript
{ "success": true, "data": {...} }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "错误信息" } }
```

### 代码提交规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

### 代码检查
```bash
npm run lint                # ESLint 检查
npm run lint -- --fix       # 自动修复
```

## 重要开发决策

1. **不改 Prisma Schema**：现有 JSON 字段 + runtime 层已足够表达运行态，先不改 enum
2. **统一运行态**：`ProjectRuntimeSummary` 是唯一状态来源，UI 不自行拼状态
3. **COMPLETED ≠ 全书完成**：job completed 只是当前批次完成
4. **maxTokens = targetWordCount × 2.5**：修复了中文分词膨胀导致的截断问题
5. **连续性锚点**：每章必须从上一章结尾继续，否则 quality gate 阻止
6. **上下文预算**：Blueprint(10%) + ArcPlan(15%) + Summaries(25%) + Plotlines(15%) + Characters(15%) + StyleGuide(10%) + Outline(10%)

## 文档索引

| 文档 | 路径 | 内容 |
|------|------|------|
| Agent 开发指南 | AGENTS.md | 开发规则和架构约束 |
| 代码架构 | CODE_WIKI.md | 详细架构文档 |
| 项目分析 | docs/PROJECT_ANALYSIS.md | 全面分析报告 |
| 功能清单 | docs/FEATURE_CHECKLIST.md | 完整功能清单 (42节) |
| 开发进度 | docs/DEV_PROGRESS.md | 开发进度和问题 |
| 开发决策 | docs/DEV_DECISIONS.md | 关键架构决策 |
| TODO 跟踪 | docs/DEV_TODO.md | P0/P1/P2/P3 优先级 |
| TODO Issues | TODO_ISSUES.md | 代码 TODO 记录 |
| 质量审计 | docs/quality-audit-2026-06-01.md | 全流程质量审计 |
| 连续性设计 | docs/superpowers/specs/2026-06-02-chapter-continuity-p0-design.md | 章节连续性 |
| 串行流程 | docs/superpowers/specs/2026-06-03-serial-chapter-flow-design.md | 串行章节流程 |
| 质量优化 | docs/superpowers/plans/2026-05-31-quality-optimization.md | 质量优化计划 |
| 改造清单 | docs/改造清单v1.md | 工业化改造清单 |
| 优化建议 | docs/优化建议.md | 全面优化建议 |
| 部署文档 | docs/DEPLOYMENT.md | 部署指南 |

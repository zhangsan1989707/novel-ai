# Novel AI - AI 网络小说工业化生产系统

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748)](https://prisma.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> 基于多智能体协作的 AI 网络小说工业化生产系统。  
> 核心壁垒：**长篇稳定工业化控制** — 无限续写、防崩坏、防提前结局、世界扩张。

## ✨ 核心特性

### 🤖 多智能体协作系统 (11 种 Agent)
- **Planner** — 策划章节大纲
- **Writer** — 生成章节正文
- **Polisher** — 文笔润色优化
- **Validator** — 质量校验验证
- **Summarizer** — 章节摘要生成
- **Researcher** — 资料研究
- **Reviewer** — 多人评审
- **Reader** — 读者视角审核
- **Deslopper** — 去 AI 味处理
- **NarrativeDirector** — 叙事导演
- **QualityAnalyzer** — 质量分析

### 📚 创作模式
- **创作模式**: 从零开始，AI 辅助全流程
- **拆解模式**: 导入已有小说，结构分析
- 智能章节目录生成 (网文/传统/诗词三种标题风格)
- 章节连续性锚点 (上一章结尾 → 下一章开篇)
- 自动伏笔追踪和管理
- 角色关系图可视化 (React Flow)
- 情绪曲线分析
- 章节节奏热力图

### 🏭 长篇工业化控制
- Book Blueprint 蓝图系统
- Arc Plan 弧线规划
- 动态章节批次系统
- 防提前结局验证
- 世界扩张引擎
- 反派生命周期管理
- 上下文预算管理 (Blueprint 10% + ArcPlan 15% + Summaries 25% + Plotlines 15% + Characters 15% + StyleGuide 10% + Outline 10%)
- Pipeline Checkpoint 断点续传
- 故事导向系统 (可调节 pace/darkness/humor/romance/conflict)

### 💡 去 AI 味技术
- 60+ 分层禁用词库 (L1/L2/L3)
- 10 种禁止模式检测
- 多维评分系统 (词汇/模式/结构/节奏/沉浸度)
- 章节质量分析面板
- 批量去 AI 味优化
- 三档优化强度 (轻/中/重)

### 💰 成本控制
- 分层摘要系统 (章节→卷→全书)
- AI 调用成本追踪
- 用户配额管理
- 支持 8 家 AI 提供商

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Next.js 16.2.4 + React 19.2.4 |
| 数据库 | PostgreSQL + Prisma 6.19.3 |
| AI 提供商 | OpenAI / Anthropic / 阿里云 / DeepSeek / MiniMax / 火山引擎 / 智谱 AI / 秘塔 AI |
| 样式方案 | Tailwind CSS 4 |
| 状态管理 | React Hook Form + Zod |
| 可视化 | D3.js + React Flow |
| 拖拽排序 | @dnd-kit |
| 测试 | Vitest (280 tests) + Playwright |
| 日志 | Pino |
| 认证 | NextAuth.js 5 |

## 📦 安装与运行

### 环境要求
- Node.js 20+
- PostgreSQL 14+

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
```env
DATABASE_URL="postgresql://user:password@localhost:5432/novel_ai"
DEEPSEEK_API_KEY="your-deepseek-api-key"
DEFAULT_AI_VENDOR="DEEPSEEK"
DEFAULT_AI_MODEL_ID="deepseek-chat"
```

### 3. 数据库初始化
```bash
npx prisma migrate dev
npx prisma generate
```

### 4. 启动
```bash
npm run dev
# 访问 http://localhost:3200
```

## 📁 项目结构

```
novel-ai/
├── prisma/                          # 数据库模型 (30+ 模型)
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (main)/                  # 主应用页面
│   │   │   ├── projects/            # 项目管理
│   │   │   ├── settings/            # 系统设置
│   │   │   ├── cost/                # 成本统计
│   │   │   └── market/              # 市场分析
│   │   └── api/                     # API 路由 (135个)
│   │       ├── novel/               # 小说相关 API
│   │       ├── short-story/         # 短篇 API
│   │       ├── market/              # 市场 API
│   │       └── notifications/       # 通知 API
│   ├── components/                  # React 组件 (100个)
│   │   ├── ai/                      # AI 功能组件 (30个)
│   │   ├── chapter/                 # 章节组件
│   │   ├── project/                 # 项目组件
│   │   └── ui/                      # 通用 UI
│   ├── lib/                         # 核心业务逻辑 (219个)
│   │   ├── engine/                  # 小说引擎 (60个)
│   │   ├── agents/                  # Agent 智能体 (18个)
│   │   ├── ai/                      # AI 服务封装 (27个)
│   │   ├── memory/                  # 记忆系统 (7个)
│   │   ├── prompts/                 # 提示词库
│   │   ├── knowledge/               # 写作知识库
│   │   └── export/                  # 导出服务
│   └── types/                       # TypeScript 类型
├── docs/                            # 项目文档 (20+个)
├── scripts/                         # 部署脚本
├── CLAUDE.md                        # 项目配置
├── AGENTS.md                        # Agent 开发指南
├── CHANGELOG.md                     # 变更日志
└── CODE_WIKI.md                     # 代码架构
```

## 📖 文档指南

| 文档 | 内容 |
|------|------|
| [AGENTS.md](./AGENTS.md) | Agent 开发指南、架构约束 |
| [CLAUDE.md](./CLAUDE.md) | 项目配置、环境变量、开发规范 |
| [CODE_WIKI.md](./CODE_WIKI.md) | 详细代码架构文档 |
| [CHANGELOG.md](./CHANGELOG.md) | 变更日志 |
| [PROJECT_ANALYSIS.md](./docs/PROJECT_ANALYSIS.md) | 全面项目分析 |
| [FEATURE_CHECKLIST.md](./docs/FEATURE_CHECKLIST.md) | 完整功能清单 (42节) |
| [DEV_PROGRESS.md](./docs/DEV_PROGRESS.md) | 开发进度和状态 |
| [DEV_DECISIONS.md](./docs/DEV_DECISIONS.md) | 关键架构决策 |
| [DEV_TODO.md](./docs/DEV_TODO.md) | P0/P1/P2/P3 优先级 |
| [改造清单v1.md](./docs/改造清单v1.md) | 工业化改造清单 |
| [优化建议.md](./docs/优化建议.md) | 全面优化建议 |

## 🧪 测试

```bash
npm test                 # 单元测试 (280 tests, 35 files)
npm run test:e2e         # 端到端测试
npm run test:watch       # 监听模式
```

## 🔧 构建

```bash
npm run build            # 生产构建
npm start                # 启动生产服务器
```

## 📄 许可证

MIT License

---

**Made with ❤️ for novel writers**

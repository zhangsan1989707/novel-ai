# Novel AI - AI 网络小说创作平台

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748)](https://prisma.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> 基于多智能体协作的 AI 网络小说创作平台，支持从创意到完稿的全流程创作辅助。

## ✨ 核心特性

### 🤖 多智能体协作系统
采用五阶段 Agent 流水线架构：
- **Planner Agent** - 策划章节大纲
- **Writer Agent** - 生成章节正文
- **Polisher Agent** - 文笔润色优化
- **Validator Agent** - 质量校验验证
- **Summarizer Agent** - 章节摘要生成

### 📚 创作模式
- 智能生成章节目录（支持网文/传统/诗词三种标题风格）
- 自动伏笔追踪和管理
- 角色关系图可视化
- 情绪曲线分析
- 章节节奏热力图

### 🔬 拆解模式
- 导入已有小说进行结构分析
- 自动提取世界观和力量体系
- 人物关系和剧情线梳理
- 伏笔埋设与回收分析

### 💡 去 AI 味技术
内置专业网文写作规范，有效消除 AI 生成文本的"机器感"：
- 禁止排比句堆砌和过度比喻
- 口语化表达和意识流
- 情绪通过行为细节体现
- 段落长短参差不齐

### 💰 成本控制
- 分层摘要系统（章节→卷→全书）
- AI 调用成本追踪
- 用户配额管理
- 支持 6 家 AI 提供商

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Next.js 16.2.4 + React 19.2.4 |
| 数据库 | PostgreSQL + Prisma 6.19.3 |
| AI 提供商 | OpenAI / Anthropic / 阿里云 / DeepSeek / MiniMax / 火山引擎 |
| 样式方案 | Tailwind CSS 4 |
| 状态管理 | React Hook Form + Zod |
| 可视化 | D3.js + React Flow |
| 测试 | Vitest + Playwright |

## 📦 安装与运行

### 环境要求
- Node.js 20+
- PostgreSQL 14+
- npm / yarn / pnpm / bun

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/novel_ai"

# AI 配置（至少配置一个）
DEEPSEEK_API_KEY="your-deepseek-api-key"
DEFAULT_AI_VENDOR="DEEPSEEK"
DEFAULT_AI_MODEL_ID="deepseek-chat"

# 开发环境 SSL（公司网络需要）
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### 3. 数据库初始化

```bash
# 运行数据库迁移
npx prisma migrate dev

# 生成 Prisma Client
npx prisma generate
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3200](http://localhost:3200)

## 📁 项目结构

```
novel-ai/
├── prisma/                      # 数据库模型定义
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (main)/             # 主应用页面
│   │   │   ├── projects/       # 项目管理
│   │   │   └── settings/       # 系统设置
│   │   └── api/               # API 路由
│   │       ├── novel/          # 小说相关 API
│   │       ├── projects/       # 项目管理 API
│   │       └── engine/         # 引擎 API
│   ├── components/             # React 组件
│   │   ├── ai/                # AI 功能组件
│   │   ├── chapter/           # 章节组件
│   │   ├── project/           # 项目组件
│   │   ├── ui/               # 通用 UI
│   │   └── writer/            # 虚拟作家
│   ├── lib/                   # 核心业务逻辑
│   │   ├── agents/           # Agent 智能体
│   │   ├── ai/               # AI 提供商封装
│   │   ├── engine/           # 小说引擎
│   │   ├── memory/           # 记忆系统
│   │   └── export/           # 导出服务
│   └── types/                # TypeScript 类型
├── CLAUDE.md                  # 项目配置文档
├── CODE_WIKI.md               # 代码架构文档
└── package.json
```

## 📖 文档指南

| 文档 | 内容 |
|------|------|
| [CODE_WIKI.md](./CODE_WIKI.md) | 详细的代码架构、API 设计、数据模型文档 |
| [CLAUDE.md](./CLAUDE.md) | 项目配置、环境变量、开发指南 |
| [去ai味提示词.md](./去ai味提示词.md) | AI 写作去"机器味"的提示词策略 |

## 🧪 测试

```bash
# 运行单元测试
npm test

# 运行端到端测试
npm run test:e2e

# 监听模式
npm run test:watch
```

## 🔧 构建生产版本

```bash
# 构建应用
npm run build

# 启动生产服务器
npm start
```

## 📄 许可证

本项目基于 MIT 许可证开源。

---

**Made with ❤️ for novel writers**

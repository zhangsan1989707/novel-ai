# Novel AI - AI 网络小说创作平台

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748)](https://prisma.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> 基于多智能体协作的 AI 网络小说创作平台，支持从创意到完稿的全流程创作辅助。

## ✨ 核心特性

### 🤖 多智能体协作系统
采用多阶段 Agent 流水线架构：
- **Planner Agent** - 策划章节大纲
- **Writer Agent** - 生成章节正文
- **Polisher Agent** - 文笔润色优化
- **Validator Agent** - 质量校验验证
- **Summarizer Agent** - 章节摘要生成
- **Narrative Director** - 叙事导演
- **Deslopper Agent** - 去 AI 味处理
- **Researcher Agent** - 资料收集研究
- **Reviewer Agent** - 多维度评审

### 📚 智能创作模式
- **AI 智能生成书名、大纲、章节目录（支持网文/传统/诗词三种标题风格）
- 自动伏笔追踪和管理
- 角色关系图可视化
- 情绪曲线分析
- 章节节奏热力图
- **故事导向** - 可调节冲突强度、黑暗程度、幽默程度等参数
- **角色卡片** - 详细的角色档案管理
- **时间线拖拽** - 可视化剧情时间轴管理
- **角色声音指纹** - 每个角色个性化的说话风格、词汇选择、句式模式
- **风格配置系统** - 从已有作品提取写作风格，支持风格强度调节和安全控制

### 🔬 拆解分析模式
- 导入已有小说进行结构分析
- 自动提取世界观和力量体系
- 人物关系和剧情线梳理
- 伏笔埋设与回收分析
- **章节图谱可视化
- **分析任务管理** - 异步分析任务队列
- **书籍分析仪表板** - 全方位分析数据展示
- **章节质量分析** - AI 质量评分与优化建议

### 🧠 RAG 向量检索系统
- 基于 pgvector 的向量化存储
- 智能上下文检索增强生成
- 文档管理与重建
- 记忆编排系统

### 💡 去 AI 味与反检测
内置专业网文写作规范
- 去 AI 味处理，有效消除机器感
- **AI 内容检测与重写
- 禁止排比句堆砌和过度比喻
- 口语化表达和意识流
- 情绪通过行为细节体现
- 段落长短参差不齐
- **批量去 AI 味** - 支持一键对多个章节进行去 AI 味优化
- **自动提示** - 快速验收完成后自动提示去 AI 味

### 📦 导出系统
- 支持 EPUB 电子书格式导出
- 多种导出适配器架构
- 自定义导出配置

### 💰 成本控制
- 分层摘要系统（章节→卷→全书）
- AI 调用成本追踪
- 用户配额管理
- 支持 8 家 AI 提供商（OpenAI/Anthropic/阿里云/DeepSeek/MiniMax/火山引擎/智谱AI/秘塔AI）
- 智能路由，自动选择合适模型
- 模型降级策略

### 🛠️ 项目健康度检查
- 伏笔回收率监控
- 章节完成度检查
- 自动维护任务
- 项目健康评估

### 📊 灵感市场
- 实时网络热榜灵感
- 市场趋势分析
- 创作灵感推荐

## 🎬 生产流水线
- 批量生成
- 章节提交与重播
- 章节预测与规划
- 流水线运行时管理
- 项目引导流程
- 批量规划器
- **连续生成模式** - 自动推进流水线批量生成，支持一键批量生成多个章节
- **优化状态显示** - 流水线状态显示实际章节数据，统一使用人类可读数字格式

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Next.js 16.2.4 + React 19.2.4 |
| 数据库 | PostgreSQL + Prisma 6.19.3 + pgvector |
| AI 提供商 | OpenAI / Anthropic / 阿里云 / DeepSeek / MiniMax / 火山引擎 / 智谱AI / 秘塔AI |
| 样式方案 | Tailwind CSS 4 |
| 状态管理 | React Hook Form + Zod |
| 可视化 | D3.js + React Flow |
| 测试 | Vitest + Playwright |
| 向量检索 | pgvector |

## 📦 安装与运行

### 环境要求
- Node.js 20+
- PostgreSQL 14+（需支持 pgvector 扩展
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
# 启动数据库（使用 Docker Compose
docker compose -f docker-compose.db.yml up -d

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
├── docker/                      # Docker 配置
├── scripts/                     # 部署脚本
├── docs/                        # 文档
│   ├── DEPLOYMENT.md          # 部署指南
│   ├── FEATURE_CHECKLIST.md   # 功能清单
│   └── PROJECT_ANALYSIS.md     # 项目分析
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (main)/             # 主应用页面
│   │   │   ├── projects/       # 项目管理
│   │   │   ├── settings/       # 系统设置
│   │   │   ├── cost/           # 成本统计
│   │   │   └── market/         # 市场分析
│   │   ├── api/               # API 路由（90+ 个 API）
│   │   │   ├── novel/          # 小说相关 API
│   │   │   ├── projects/       # 项目管理 API
│   │   │   ├── engine/         # 引擎 API
│   │   │   ├── market/         # 市场 API
│   │   │   └── ...
│   │   └── login/               # 登录页面
│   ├── components/             # React 组件
│   │   ├── ai/                # AI 功能组件
│   │   ├── chapter/           # 章节组件
│   │   ├── project/           # 项目组件
│   │   ├── ui/               # 通用 UI
│   │   ├── writer/            # 虚拟作家
│   │   ├── inspiration/      # 灵感组件
│   │   ├── layout/         # 布局组件
│   │   └── common/         # 通用组件
│   ├── lib/                   # 核心业务逻辑
│   │   ├── agents/           # Agent 智能体
│   │   ├── ai/               # AI 提供商封装
│   │   ├── engine/           # 小说引擎
│   │   ├── memory/           # 记忆系统
│   │   ├── export/           # 导出服务
│   │   ├── analysis/         # 分析模块
│   │   ├── anti-detect/      # 反检测模块
│   │   ├── inspiration/     # 灵感模块
│   │   ├── knowledge/      # 知识模块
│   │   ├── cost-tracker/  # 成本追踪
│   │   └── notifications/  # 通知
│   └── types/                # TypeScript 类型
├── CLAUDE.md                  # 项目配置文档
└── package.json
```

## 📖 文档指南

| 文档 | 内容 |
|------|------|
| [FEATURE_CHECKLIST.md](docs/FEATURE_CHECKLIST.md) | 完整功能清单，用于 AI 分析研究 |
| [PROJECT_ANALYSIS.md](docs/PROJECT_ANALYSIS.md) | 项目全面分析报告 |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | 部署指南 |
| [CLAUDE.md](CLAUDE.md) | 项目配置、环境变量、开发指南 |
| [去ai味提示词.md](去ai味提示词.md) | AI 写作去"机器味"的提示词策略 |

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

## 🚀 部署

详细部署指南请参考 [DEPLOYMENT.md](docs/DEPLOYMENT.md)

## 📄 许可证

本项目基于 MIT 许可证开源。

---

**Made with ❤️ for novel writers**

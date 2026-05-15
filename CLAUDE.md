# Novel AI 项目配置

## 项目端口
- 开发服务器端口: **3200**
- 配置位置: `package.json` scripts.dev

## 启动命令
```bash
npm run dev  # 端口 3200
npm run build  # 生产构建
npm start  # 启动生产服务器
npm test  # 运行测试
npm run test:e2e  # 端到端测试
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

# 各厂商配置（至少配置一个）
DEEPSEEK_API_KEY="your-deepseek-api-key"
OPENAI_API_KEY="your-openai-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"
ALIBABA_API_KEY="your-alibaba-api-key"
MINIMAX_API_KEY="your-minimax-api-key"
VOLCENGINE_API_KEY="your-volcengine-api-key"
```

### 网络配置
```env
NODE_TLS_REJECT_UNAUTHORIZED=0  # 开发环境 SSL 代理（公司网络需要）
```

## 数据库操作

```bash
# 创建迁移
npx prisma migrate dev

# 应用现有迁移
npx prisma migrate deploy

# 重置数据库
npx prisma migrate reset

# 查看数据库
npx prisma studio

# 生成 Prisma Client
npx prisma generate
```

## 项目结构说明

```
src/
├── app/                      # Next.js App Router
│   ├── (main)/              # 主应用路由组
│   │   ├── projects/        # 项目管理页面
│   │   └── settings/        # 设置页面
│   └── api/                 # API 路由
│       ├── novel/           # 小说 AI API
│       ├── projects/        # 项目管理 API
│       └── engine/          # 小说引擎 API
├── components/              # React 组件
│   ├── ui/                 # 通用 UI 组件
│   ├── project/            # 项目组件
│   ├── chapter/            # 章节组件
│   ├── ai/                 # AI 功能组件
│   └── writer/             # 虚拟作家组件
├── lib/                     # 核心业务逻辑
│   ├── agents/             # Agent 智能体
│   ├── ai/                 # AI 提供商封装
│   ├── engine/             # 小说引擎
│   ├── memory/             # 记忆系统
│   ├── export/             # 导出服务
│   ├── cost-tracker/       # 成本追踪
│   └── prisma.ts           # Prisma Client
└── types/                   # TypeScript 类型定义
```

## 开发规范

### API 响应格式
```typescript
// 成功响应
{ "success": true, "data": {...} }

// 错误响应
{ "success": false, "error": { "code": "ERROR_CODE", "message": "错误信息" } }
```

### 代码提交规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试相关
chore: 构建/工具更新
```

## 常用开发命令

```bash
# 代码检查
npm run lint

# 修复自动可修复的问题
npm run lint -- --fix

# 运行测试（监听模式）
npm run test:watch

# 生成 Prisma 类型
npx prisma generate
```

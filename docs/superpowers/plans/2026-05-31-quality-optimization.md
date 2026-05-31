# Novel AI 质量优化实施计划

> **目标：** 解决核心模块复杂度、测试覆盖、技术债务、文档体系、错误处理5个关键问题

**架构概述：** 
- 任务1采用目录重构策略，将engine目录按职责拆分为orchestration/pipeline/context三个子目录
- 任务2采用TDD策略，先写测试再重构，确保质量
- 任务4-8采用渐进式优化，不破坏现有功能

**技术栈：** TypeScript, Vitest, Prisma, Next.js API Routes

---

## 任务1：重构核心模块复杂度

### 分析现有文件结构

```
src/lib/engine/
├── orchestration/          # 新增：编排逻辑
│   ├── orchestrator.ts      # 主编排器（需精简至300行内）
│   ├── coordinator.ts      # 新增：协调器接口
│   └── types.ts            # 新增：编排类型定义
├── pipeline/               # 新增：流水线执行
│   ├── pipeline.ts         # 流水线定义
│   ├── runtime.ts          # 运行时（原pipeline-runtime.ts）
│   ├── worker.ts           # Worker（原pipeline-worker.ts）
│   ├── checkpoint.ts       # 检查点
│   └── types.ts            # 流水线类型
├── context/                # 新增：上下文管理
│   ├── assembler.ts        # 上下文组装（原context-assembler.ts）
│   ├── budget.ts           # 预算计算（原context-budget.ts）
│   ├── compression.ts      # 压缩（原context-compression.ts）
│   ├── strategy.ts         # 策略（原context-strategy.ts）
│   └── manager.ts          # 新增：上下文管理器
├── validation/             # 保留：验证模块
│   ├── validator.ts
│   └── types.ts
├── story-state.ts          # 故事状态（保留原位置）
├── story-steering.ts       # 故事导向（保留原位置）
├── generation-job.ts       # 生成任务（保留原位置）
├── task-queue.ts           # 任务队列（保留原位置）
├── queue.ts                # 队列（保留原位置）
├── project-health.ts       # 健康检查（保留原位置）
├── auto-maintenance.ts    # 自动维护（保留原位置）
├── rag-vector.ts          # RAG向量（保留原位置）
└── index.ts               # 统一导出
```

### 实施任务

- [ ] **Step 1: 分析现有 orchestrator.ts 代码，识别职责边界**

  检查文件：`src/lib/engine/orchestrator.ts`

  任务：统计代码行数、识别主要函数、分析依赖关系

- [ ] **Step 2: 创建 orchestration/ 子目录**

  创建目录：`src/lib/engine/orchestration/`

  创建文件：`src/lib/engine/orchestration/index.ts`

- [ ] **Step 3: 创建 pipeline/ 子目录结构**

  创建目录：`src/lib/engine/pipeline/`

  创建文件：
  - `src/lib/engine/pipeline/index.ts`
  - `src/lib/engine/pipeline/runtime.ts` （从 pipeline-runtime.ts 复制）
  - `src/lib/engine/pipeline/worker.ts` （从 pipeline-worker.ts 复制）
  - `src/lib/engine/pipeline/checkpoint.ts` （从 pipeline-checkpoint.ts 复制）

- [ ] **Step 4: 创建 context/ 子目录结构**

  创建目录：`src/lib/engine/context/`

  创建文件：
  - `src/lib/engine/context/index.ts`
  - `src/lib/engine/context/assembler.ts` （从 context-assembler.ts 复制）
  - `src/lib/engine/context/budget.ts` （从 context-budget.ts 复制）
  - `src/lib/engine/context/compression.ts` （从 context-compression.ts 复制）
  - `src/lib/engine/context/strategy.ts` （从 context-strategy.ts 复制）

- [ ] **Step 5: 更新 orchestration/orchestrator.ts**

  修改文件：`src/lib/engine/orchestrator.ts`

  目标：删除内联的 pipeline/context 逻辑，改为导入新模块

- [ ] **Step 6: 更新 engine/index.ts 统一导出**

  修改文件：`src/lib/engine/index.ts`

  添加：导出新模块

- [ ] **Step 7: 运行测试验证重构正确性**

  运行：`npm test`

  预期：所有测试通过

- [ ] **Step 8: Git 提交**

  ```bash
  git add -A
  git commit -m "refactor(engine): 拆分engine目录为orchestration/pipeline/context三个子模块"
  ```

---

## 任务2：补充测试覆盖

### 分析现有测试情况

```
src/__tests__/
├── unit/                    # 现有单元测试（146个）
│   ├── api-response.test.ts
│   ├── ai-factory.test.ts
│   ├── export.test.ts
│   ├── helpers.test.ts
│   ├── prompts.test.ts
│   ├── schema.test.ts
│   ├── types.test.ts
│   └── utils.test.ts
├── e2e/                     # 现有E2E测试（48个）
│   ├── analyze.spec.ts
│   ├── project-flow.spec.ts
│   └── setup.ts
└── api/
    └── title-factory.test.ts
```

### 新增测试任务

- [ ] **Step 1: 为 agents/ 模块添加单元测试**

  创建文件：`src/__tests__/unit/agents/planner.test.ts`

  ```typescript
  import { describe, it, expect, vi } from 'vitest';
  import { plannerAgent } from '@/lib/agents/planner';
  
  describe('plannerAgent', () => {
    it('should generate chapter outline with valid input', async () => {
      const input = {
        projectId: 1,
        chapterNo: 1,
        characterProfiles: [],
        openPlotlines: [],
        emotionalArc: [],
        targetWordCount: 3000
      };
      
      // Mock AI provider
      const mockProvider = {
        generate: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            chapterTitle: '第一章 起点',
            chapterGoal: '建立主角背景',
            mainConflict: '主角遭遇危机',
            keyScenes: [{ scene: '危机发生', description: '主角遇到挑战' }],
            ending: '危机暂时解除',
            foreshadows: [],
            resolvedPlotlines: []
          })
        })
      };
      
      const result = await plannerAgent(input, undefined, mockProvider as any);
      
      expect(result.outline).toBeDefined();
      expect(result.outline.chapterTitle).toBe('第一章 起点');
    });
  });
  ```

  创建文件：`src/__tests__/unit/agents/writer.test.ts`

  创建文件：`src/__tests__/unit/agents/validator.test.ts`

- [ ] **Step 2: 为 engine/orchestration 添加单元测试**

  创建文件：`src/__tests__/unit/engine/orchestrator.test.ts`

  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { Orchestrator } from '@/lib/engine/orchestration/orchestrator';
  
  describe('Orchestrator', () => {
    let orchestrator: Orchestrator;
    
    beforeEach(() => {
      orchestrator = new Orchestrator();
    });
    
    it('should initialize with empty state', () => {
      expect(orchestrator.getState()).toEqual({
        currentStep: 'idle',
        progress: 0,
        errors: []
      });
    });
    
    it('should execute chapter generation pipeline', async () => {
      const mockEmitter = vi.fn();
      
      const result = await orchestrator.runChapterPipeline(
        { projectId: 1, chapterNo: 1 },
        mockEmitter
      );
      
      expect(result.status).toBe('success');
    });
  });
  ```

- [ ] **Step 3: 为 engine/pipeline 添加单元测试**

  创建文件：`src/__tests__/unit/engine/pipeline.test.ts`

  ```typescript
  import { describe, it, expect } from 'vitest';
  import { Pipeline } from '@/lib/engine/pipeline/pipeline';
  
  describe('Pipeline', () => {
    it('should define correct pipeline steps', () => {
      const pipeline = new Pipeline();
      
      expect(pipeline.steps).toContain('PLANNER');
      expect(pipeline.steps).toContain('WRITER');
      expect(pipeline.steps).toContain('VALIDATOR');
    });
    
    it('should execute steps in order', async () => {
      const pipeline = new Pipeline();
      const executionOrder: string[] = [];
      
      pipeline.onStepComplete((step) => {
        executionOrder.push(step);
      });
      
      await pipeline.execute({ chapterNo: 1 });
      
      const expectedOrder = ['PLANNER', 'WRITER', 'VALIDATOR', 'SUMMARIZER'];
      expectedOrder.forEach((step, index) => {
        expect(executionOrder[index]).toBe(step);
      });
    });
  });
  ```

- [ ] **Step 4: 为 engine/context 添加单元测试**

  创建文件：`src/__tests__/unit/engine/context.test.ts`

  ```typescript
  import { describe, it, expect, vi } from 'vitest';
  import { ContextAssembler } from '@/lib/engine/context/assembler';
  import { ContextBudget } from '@/lib/engine/context/budget';
  
  describe('ContextAssembler', () => {
    it('should assemble context within budget', async () => {
      const assembler = new ContextAssembler();
      const budget = new ContextBudget({ maxTokens: 100000 });
      
      const context = await assembler.assemble({
        projectId: 1,
        chapterNo: 5,
        budget
      });
      
      expect(context.tokenCount).toBeLessThanOrEqual(100000);
    });
  });
  
  describe('ContextBudget', () => {
    it('should calculate correct budget allocation', () => {
      const budget = new ContextBudget({
        maxTokens: 100000,
        priorities: { characters: 0.4, plotlines: 0.3, summary: 0.3 }
      });
      
      expect(budget.getAllocation('characters')).toBe(40000);
      expect(budget.getAllocation('plotlines')).toBe(30000);
      expect(budget.getAllocation('summary')).toBe(30000);
    });
  });
  ```

- [ ] **Step 5: 为 API 路由添加集成测试**

  创建文件：`src/__tests__/unit/api/projects.test.ts`

  ```typescript
  import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
  import { setupServer } from 'msw/node';
  import { http, HttpResponse } from 'msw';
  
  const server = setupServer();
  
  beforeAll(() => server.listen());
  afterAll(() => server.close());
  
  describe('GET /api/novel/projects', () => {
    it('should return project list', async () => {
      server.use(
        http.get('/api/novel/projects', () => {
          return HttpResponse.json({
            success: true,
            data: [{ id: 1, title: 'Test Project' }]
          });
        })
      );
      
      const response = await fetch('/api/novel/projects');
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });
  ```

- [ ] **Step 6: 设置测试覆盖率门禁**

  修改文件：`vitest.config.ts`

  ```typescript
  export default defineConfig({
    test: {
      coverage: {
        provider: 'v8',
        thresholds: {
          lines: 60,
          functions: 60,
          branches: 50,
          statements: 60
        },
        reporter: ['text', 'json', 'html'],
        perFile: true,
        exclude: ['node_modules/**', 'dist/**', '**/*.d.ts']
      }
    }
  });
  ```

- [ ] **Step 7: 运行测试并验证覆盖率**

  运行：`npm test -- --coverage`

  预期：新增强制覆盖率检查

- [ ] **Step 8: Git 提交**

  ```bash
  git add -A
  git commit -m "test: 补充agents和engine模块的单元测试，建立覆盖率门禁"
  ```

---

## 任务4：清理技术债务

### 实施任务

- [ ] **Step 1: 删除备份文件**

  运行：
  ```bash
  # 删除 engine 目录下的备份文件
  rm -f src/lib/engine/orchestrator.ts.backup
  
  # 查找并删除所有 .backup 文件
  find . -name "*.backup" -type f
  
  # 删除 migrations-backup 目录
  rm -rf prisma/migrations-backup
  ```

- [ ] **Step 2: 搜索并收集代码中的 TODO 注释**

  运行：
  ```bash
  grep -rn "TODO" src/ --include="*.ts" --include="*.tsx" | head -50
  ```

  创建文件：`TODO_ISSUES.md` 记录所有 TODO

  ```markdown
  # TODO Issues 转换记录
  
  ## High Priority
  - [ ] TODO-001: [src/lib/engine/orchestrator.ts:123] 简化上下文组装逻辑
  - [ ] TODO-002: [src/lib/agents/writer.ts:456] 优化流式输出处理
  
  ## Medium Priority
  - [ ] TODO-003: [src/lib/ai/service.ts:78] 添加模型降级重试逻辑
  - [ ] TODO-004: [src/components/ai/StreamViewer.tsx:90] 优化大文本渲染性能
  
  ## Low Priority
  - [ ] TODO-005: [src/lib/export/service.ts:34] 支持更多导出格式
  ```

- [ ] **Step 3: 在 GitHub/GitLab 创建 Issue（如果使用远程仓库）**

  或创建本地 Issue 文件：`docs/issues/TODO-001.md` 等

  示例：`docs/issues/TODO-001.md`
  ```markdown
  ---
  title: "简化上下文组装逻辑"
  priority: high
  type: refactor
  ---
  
  ## 问题描述
  src/lib/engine/orchestrator.ts:123 处的上下文组装逻辑过于复杂，需要简化。
  
  ## 期望行为
  将上下文组装逻辑抽取为独立函数，控制在 50 行以内。
  
  ## 验收标准
  - [ ] 上下文组装逻辑抽取为独立模块
  - [ ] 添加单元测试覆盖
  - [ ] 代码行数减少 50%
  ```

- [ ] **Step 4: 删除代码中的 TODO 注释**

  替换策略：将 TODO 注释替换为指向 Issue 的引用

  示例：
  ```typescript
  // TODO: 简化上下文组装逻辑 - 见 docs/issues/TODO-001.md
  // @todo(TODO-001): 简化上下文组装逻辑
  ```

- [ ] **Step 5: 清理未使用的导入和变量**

  运行：
  ```bash
  # 运行 ESLint 检查
  npm run lint
  
  # 自动修复可修复的问题
  npm run lint -- --fix
  ```

- [ ] **Step 6: 检查并清理空目录**

  运行：
  ```bash
  find src -type d -empty
  ```

  删除空目录或添加 `.gitkeep` 文件

- [ ] **Step 7: Git 提交**

  ```bash
  git add -A
  git commit -m "chore: 清理技术债务 - 删除备份文件，TODO转Issue"
  ```

---

## 任务7：完善文档体系

### 文档结构规划

```
docs/
├── superpowers/
│   └── plans/              # 实施计划
├── modules/                # 新增：模块文档
│   ├── engine/
│   │   ├── README.md       # 引擎总览
│   │   ├── orchestration.md
│   │   ├── pipeline.md
│   │   ├── context.md
│   │   └── validation.md
│   ├── agents/
│   │   └── README.md       # Agent系统文档
│   ├── ai/
│   │   └── README.md       # AI服务文档
│   └── memory/
│       └── README.md       # 记忆系统文档
└── api/                    # 新增：API文档
    ├── projects.md
    ├── chapters.md
    └── ai.md
```

### 实施任务

- [ ] **Step 1: 创建模块文档目录结构**

  创建目录：
  ```bash
  mkdir -p docs/modules/{engine,agents,ai,memory}
  mkdir -p docs/api
  ```

- [ ] **Step 2: 编写 engine/README.md**

  创建文件：`docs/modules/engine/README.md`

  ```markdown
  # 小说引擎模块
  
  ## 概述
  
  小说引擎是 Novel AI 的核心模块，负责协调多个 Agent 完成章节创作流程。
  
  ## 目录结构
  
  ```
  src/lib/engine/
  ├── orchestration/   # 编排层 - 协调各模块执行
  ├── pipeline/        # 流水线层 - 管理执行步骤
  ├── context/         # 上下文层 - 管理创作上下文
  └── validation/      # 验证层 - 质量检查
  ```
  
  ## 核心流程
  
  1. **初始化**：创建编排器实例，加载项目配置
  2. **上下文组装**：收集角色、伏笔、摘要等上下文信息
  3. **流水线执行**：按顺序执行 PLANNER → WRITER → VALIDATOR → SUMMARIZER
  4. **结果输出**：保存章节，更新记忆系统
  
  ## 主要接口
  
  ### Orchestrator
  
  ```typescript
  class Orchestrator {
    async runChapterPipeline(
      params: ChapterParams,
      emitter: SSEEmitter
    ): Promise<GenerationResult>
  }
  ```
  
  ## 测试覆盖
  
  - 单元测试：`src/__tests__/unit/engine/`
  - 覆盖率目标：80%
  ```

- [ ] **Step 3: 编写 agents/README.md**

  创建文件：`docs/modules/agents/README.md`

  ```markdown
  # Agent 智能体系统
  
  ## Agent 类型
  
  | Agent | 职责 | 输入 | 输出 |
  |-------|------|------|------|
  | PLANNER | 策划大纲 | 项目设定、角色档案 | 章节大纲 |
  | WRITER | 正文写作 | 章节大纲、世界观 | 章节正文 |
  | POLISHER | 文笔润色 | 原始正文、写作风格 | 润色后正文 |
  | VALIDATOR | 质量校验 | 正文内容、世界设定 | 校验报告 |
  | SUMMARIZER | 章节摘要 | 章节标题与正文 | 摘要数据 |
  | RESEARCHER | 资料研究 | 研究主题 | 研究资料 |
  | REVIEWER | 多角度评审 | 章节内容 | 评审报告 |
  | DESLOPPER | 去AI味 | 原始正文 | 改写后正文 |
  
  ## 调用示例
  
  ```typescript
  import { plannerAgent } from '@/lib/agents/planner';
  
  const outline = await plannerAgent({
    projectId: 1,
    chapterNo: 1,
    characterProfiles: [],
    openPlotlines: [],
    emotionalArc: [],
    targetWordCount: 3000
  });
  ```
  ```

- [ ] **Step 4: 编写 ai/README.md**

  创建文件：`docs/modules/ai/README.md`

  ```markdown
  # AI 服务模块
  
  ## 支持的 AI 提供商
  
  | 厂商 | 枚举值 | 默认模型 |
  |------|--------|----------|
  | OpenAI | `OPENAI` | gpt-4o |
  | Anthropic | `ANTHROPIC` | claude-3-5-sonnet |
  | DeepSeek | `DEEPSEEK` | deepseek-chat |
  | 阿里云 | `ALIBABA` | qwen-max |
  | 智谱AI | `ZHIPU` | glm-4 |
  
  ## 使用方法
  
  ```typescript
  import { AIService } from '@/lib/ai/service';
  
  const aiService = new AIService();
  const result = await aiService.generate({
    prompt: '写一段小说开篇',
    vendor: 'DEEPSEEK',
    modelId: 'deepseek-chat'
  });
  ```
  ```

- [ ] **Step 5: 编写 memory/README.md**

  创建文件：`docs/modules/memory/README.md`

  ```markdown
  # 记忆系统
  
  ## 分层摘要架构
  
  ```
  L1: 章节摘要 (200-300字)
  L2: 卷摘要 (500-800字)
  L3: 全书摘要 (1000-1500字)
  ```
  
  ## 使用接口
  
  ```typescript
  import { MemoryOrchestrator } from '@/lib/memory';
  
  const memory = new MemoryOrchestrator(projectId);
  
  // 获取上下文
  const context = await memory.getContext(chapterNo);
  
  // 更新记忆
  await memory.updateChapterMemory(chapterNo, summary);
  ```
  ```

- [ ] **Step 6: 编写 API 文档示例**

  创建文件：`docs/api/projects.md`

  ```markdown
  # 项目管理 API
  
  ## GET /api/novel/projects
  
  获取当前用户的项目列表。
  
  **响应示例：**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "title": "我的小说",
        "genre": "玄幻",
        "status": "WRITING",
        "currentWordCount": 50000
      }
    ]
  }
  ```
  
  ## POST /api/novel/projects
  
  创建新项目。
  
  **请求参数：**
  - `title` (string, required): 项目标题
  - `genre` (string, optional): 小说类型
  - `platform` (string, optional): 发布平台
  
  **响应：** 返回创建的项目对象
  ```

- [ ] **Step 7: 更新根目录 README.md**

  修改文件：`README.md`

  添加模块文档链接：

  ```markdown
  ## 模块文档
  
  - [引擎模块](docs/modules/engine/README.md)
  - [Agent系统](docs/modules/agents/README.md)
  - [AI服务](docs/modules/ai/README.md)
  - [记忆系统](docs/modules/memory/README.md)
  
  ## API文档
  
  - [项目管理API](docs/api/projects.md)
  ```

- [ ] **Step 8: Git 提交**

  ```bash
  git add -A
  git commit -m "docs: 补充核心模块文档和API文档"
  ```

---

## 任务8：优化错误提示

### 错误处理架构

```
src/lib/
├── errors/                    # 新增：统一错误处理
│   ├── index.ts              # 导出入口
│   ├── codes.ts              # 错误码定义
│   ├── messages.ts           # 错误消息映射
│   ├── handler.ts            # 错误处理器
│   └── types.ts              # 错误类型定义
└── api-handler.ts            # 统一API错误处理
```

### 实施任务

- [ ] **Step 1: 创建错误类型定义**

  创建目录：`src/lib/errors/`

  创建文件：`src/lib/errors/types.ts`

  ```typescript
  // 错误分类
  export enum ErrorCategory {
    VALIDATION = 'VALIDATION',      // 参数验证错误
    AUTHENTICATION = 'AUTH',         // 认证错误
    AUTHORIZATION = 'AUTHORIZATION',  // 授权错误
    NOT_FOUND = 'NOT_FOUND',         // 资源不存在
    DATABASE = 'DATABASE',           // 数据库错误
    AI_PROVIDER = 'AI_PROVIDER',     // AI服务商错误
    PIPELINE = 'PIPELINE',           // 流水线执行错误
    INTERNAL = 'INTERNAL'            // 内部错误
  }
  
  // 错误码格式：类别_编号 (如 VALIDATION_001)
  export type ErrorCode = 
    | `${ErrorCategory}_${string}`
    | string;
  
  // 错误响应结构
  export interface AppError {
    code: ErrorCode;
    category: ErrorCategory;
    message: string;          // 用户友好的消息
    details?: Record<string, unknown>; // 详细错误信息
    suggestions?: string[];    // 建议操作
  }
  
  // 原始错误接口
  export interface RawError {
    code?: string;
    message: string;
    stack?: string;
    [key: string]: unknown;
  }
  ```

- [ ] **Step 2: 定义错误码常量**

  创建文件：`src/lib/errors/codes.ts`

  ```typescript
  import { ErrorCategory } from './types';
  
  // 项目相关错误
  export const ProjectErrors = {
    NOT_FOUND: { code: 'PROJECT_001', category: ErrorCategory.NOT_FOUND },
    CREATE_FAILED: { code: 'PROJECT_002', category: ErrorCategory.DATABASE },
    UPDATE_FAILED: { code: 'PROJECT_003', category: ErrorCategory.DATABASE },
    DELETE_FAILED: { code: 'PROJECT_004', category: ErrorCategory.DATABASE },
  } as const;
  
  // 章节相关错误
  export const ChapterErrors = {
    NOT_FOUND: { code: 'CHAPTER_001', category: ErrorCategory.NOT_FOUND },
    GENERATION_FAILED: { code: 'CHAPTER_002', category: ErrorCategory.PIPELINE },
    VALIDATION_FAILED: { code: 'CHAPTER_003', category: ErrorCategory.VALIDATION },
    WORD_COUNT_EXCEEDED: { code: 'CHAPTER_004', category: ErrorCategory.VALIDATION },
  } as const;
  
  // AI相关错误
  export const AIErrors = {
    PROVIDER_UNAVAILABLE: { code: 'AI_001', category: ErrorCategory.AI_PROVIDER },
    API_KEY_INVALID: { code: 'AI_002', category: ErrorCategory.AI_PROVIDER },
    RATE_LIMIT_EXCEEDED: { code: 'AI_003', category: ErrorCategory.AI_PROVIDER },
    QUOTA_EXCEEDED: { code: 'AI_004', category: ErrorCategory.AI_PROVIDER },
    GENERATION_TIMEOUT: { code: 'AI_005', category: ErrorCategory.AI_PROVIDER },
  } as const;
  
  // 数据库相关错误
  export const DatabaseErrors = {
    CONNECTION_FAILED: { code: 'DB_001', category: ErrorCategory.DATABASE },
    QUERY_FAILED: { code: 'DB_002', category: ErrorCategory.DATABASE },
    TRANSACTION_FAILED: { code: 'DB_003', category: ErrorCategory.DATABASE },
  } as const;
  
  // 验证相关错误
  export const ValidationErrors = {
    INVALID_INPUT: { code: 'VALIDATION_001', category: ErrorCategory.VALIDATION },
    MISSING_REQUIRED: { code: 'VALIDATION_002', category: ErrorCategory.VALIDATION },
    INVALID_FORMAT: { code: 'VALIDATION_003', category: ErrorCategory.VALIDATION },
  } as const;
  
  export const AllErrors = {
    ...ProjectErrors,
    ...ChapterErrors,
    ...AIErrors,
    ...DatabaseErrors,
    ...ValidationErrors,
  } as const;
  ```

- [ ] **Step 3: 定义错误消息映射**

  创建文件：`src/lib/errors/messages.ts`

  ```typescript
  import { ErrorCategory } from './types';
  
  // 用户友好的错误消息
  export const ErrorMessages: Record<string, {
    message: string;
    suggestions?: string[];
  }> = {
    // 项目错误
    'PROJECT_001': {
      message: '项目不存在或已被删除',
      suggestions: [
        '检查项目ID是否正确',
        '刷新页面后重试',
        '联系技术支持获取帮助'
      ]
    },
    'PROJECT_002': {
      message: '创建项目失败，请稍后重试',
      suggestions: [
        '检查网络连接',
        '稍后重试',
        '如果问题持续存在，请联系支持'
      ]
    },
    
    // 章节错误
    'CHAPTER_001': {
      message: '章节不存在',
      suggestions: [
        '检查章节ID是否正确',
        '确认章节未被删除'
      ]
    },
    'CHAPTER_002': {
      message: '章节生成失败',
      suggestions: [
        '检查AI配置是否正确',
        '查看配额是否充足',
        '尝试重新生成'
      ]
    },
    'CHAPTER_003': {
      message: '章节内容验证失败',
      suggestions: [
        '检查章节内容是否完整',
        '确保字数在要求范围内'
      ]
    },
    
    // AI错误
    'AI_001': {
      message: 'AI服务暂时不可用',
      suggestions: [
        '稍后重试',
        '检查AI服务商状态',
        '切换到其他AI模型'
      ]
    },
    'AI_002': {
      message: 'AI配置无效',
      suggestions: [
        '检查API Key是否正确',
        '确认API Key有足够配额'
      ]
    },
    'AI_003': {
      message: 'AI调用频率超限',
      suggestions: [
        '等待一段时间后重试',
        '降低请求频率'
      ]
    },
    'AI_004': {
      message: 'AI配额已用完',
      suggestions: [
        '升级您的订阅计划',
        '等待配额重置',
        '联系客服申请临时提升'
      ]
    },
    'AI_005': {
      message: 'AI生成超时',
      suggestions: [
        '尝试简化请求内容',
        '检查网络连接',
        '稍后重试'
      ]
    },
    
    // 数据库错误
    'DB_001': {
      message: '数据库连接失败',
      suggestions: [
        '稍后重试',
        '如果问题持续，请联系支持'
      ]
    },
    'DB_002': {
      message: '数据操作失败',
      suggestions: [
        '检查输入数据是否正确',
        '稍后重试'
      ]
    },
    
    // 验证错误
    'VALIDATION_001': {
      message: '输入数据无效',
      suggestions: [
        '检查必填字段是否填写',
        '确保数据格式正确'
      ]
    },
    'VALIDATION_002': {
      message: '缺少必要的参数',
      suggestions: [
        '检查请求参数是否完整',
        '查看API文档确认必填字段'
      ]
    },
    'VALIDATION_003': {
      message: '数据格式不正确',
      suggestions: [
        '检查数据格式',
        '参考API文档中的格式要求'
      ]
    },
    
    // 通用错误
    [ErrorCategory.INTERNAL]: {
      message: '服务器内部错误',
      suggestions: [
        '稍后重试',
        '如果问题持续，请联系支持'
      ]
    }
  };
  ```

- [ ] **Step 4: 创建错误处理器**

  创建文件：`src/lib/errors/handler.ts`

  ```typescript
  import { AppError, ErrorCategory, RawError } from './types';
  import { ErrorMessages } from './messages';
  import { AllErrors } from './codes';
  
  export class ErrorHandler {
    /**
     * 将原始错误转换为用户友好的错误对象
     */
    static normalize(error: RawError): AppError {
      // 如果已经是 AppError，直接返回
      if ('code' in error && 'category' in error) {
        return error as AppError;
      }
  
      // 根据错误类型进行分类
      const category = this.categorize(error);
      const { code, message, suggestions } = this.getErrorInfo(error, category);
  
      return {
        code,
        category,
        message,
        details: this.extractDetails(error),
        suggestions
      };
    }
  
    /**
     * 根据错误特征判断错误类别
     */
    private static categorize(error: RawError): ErrorCategory {
      const message = error.message?.toLowerCase() || '';
      const code = error.code?.toString() || '';
  
      // Prisma 错误码
      if (code.includes('P2001')) return ErrorCategory.NOT_FOUND;
      if (code.includes('P2002')) return ErrorCategory.VALIDATION;
      if (code.includes('P2025')) return ErrorCategory.NOT_FOUND;
  
      // 数据库连接错误
      if (message.includes('database') && message.includes('connection')) {
        return ErrorCategory.DATABASE;
      }
  
      // AI 相关错误
      if (message.includes('api key') || message.includes('auth')) {
        return ErrorCategory.AI_PROVIDER;
      }
      if (message.includes('rate limit') || message.includes('429')) {
        return ErrorCategory.AI_PROVIDER;
      }
      if (message.includes('quota') || message.includes('limit')) {
        return ErrorCategory.AI_PROVIDER;
      }
  
      // 验证错误
      if (message.includes('validation') || message.includes('invalid')) {
        return ErrorCategory.VALIDATION;
      }
  
      // 认证错误
      if (message.includes('unauthorized') || message.includes('401')) {
        return ErrorCategory.AUTHENTICATION;
      }
  
      return ErrorCategory.INTERNAL;
    }
  
    /**
     * 获取错误码和消息
     */
    private static getErrorInfo(
      error: RawError,
      category: ErrorCategory
    ): { code: string; message: string; suggestions?: string[] } {
      const errorCode = error.code?.toString() || '';
  
      // 尝试从预定义错误中匹配
      const matchedCode = Object.keys(AllErrors).find(
        key => errorCode.includes(key) || error.message?.includes(key)
      );
  
      if (matchedCode && ErrorMessages[matchedCode]) {
        const info = ErrorMessages[matchedCode];
        return {
          code: (AllErrors as any)[matchedCode]?.code || matchedCode,
          message: info.message,
          suggestions: info.suggestions
        };
      }
  
      // 使用通用错误消息
      const genericInfo = ErrorMessages[category] || ErrorMessages[ErrorCategory.INTERNAL];
      return {
        code: `${category}_UNKNOWN`,
        message: genericInfo.message,
        suggestions: genericInfo.suggestions
      };
    }
  
    /**
     * 提取详细信息
     */
    private static extractDetails(error: RawError): Record<string, unknown> {
      const details: Record<string, unknown> = {};
  
      if (error.stack) {
        // 只在开发环境包含堆栈信息
        if (process.env.NODE_ENV === 'development') {
          details.stack = error.stack;
        }
      }
  
      // 添加原始错误码（脱敏处理）
      if (error.code) {
        details.originalCode = error.code;
      }
  
      return details;
    }
  
    /**
     * 创建 API 响应格式的错误对象
     */
    static toResponse(error: RawError): {
      success: false;
      error: AppError;
    } {
      const normalizedError = this.normalize(error);
      return {
        success: false,
        error: normalizedError
      };
    }
  
    /**
     * 创建 AppError 实例
     */
    static create(
      code: string,
      overrides?: Partial<AppError>
    ): AppError {
      const baseError = ErrorMessages[code] || ErrorMessages[ErrorCategory.INTERNAL];
      const allErrors = AllErrors as any;
      const errorDef = Object.values(allErrors).find(
        (e: any) => e.code === code
      );
  
      return {
        code,
        category: errorDef?.category || ErrorCategory.INTERNAL,
        message: overrides?.message || baseError.message,
        suggestions: overrides?.suggestions || baseError.suggestions,
        details: overrides?.details,
        ...overrides
      };
    }
  }
  ```

- [ ] **Step 5: 创建统一导出入口**

  创建文件：`src/lib/errors/index.ts`

  ```typescript
  export * from './types';
  export * from './codes';
  export * from './messages';
  export * from './handler';
  
  // 便捷函数
  import { ErrorHandler } from './handler';
  import { AppError, RawError } from './types';
  
  /**
   * 快速创建错误
   */
  export function createError(
    code: string,
    message?: string,
    suggestions?: string[]
  ): AppError {
    return ErrorHandler.create(code, { message, suggestions });
  }
  
  /**
   * 转换错误为 API 响应格式
   */
  export function toErrorResponse(error: RawError) {
    return ErrorHandler.toResponse(error);
  }
  ```

- [ ] **Step 6: 更新 API 错误处理**

  修改文件：`src/lib/api-handler.ts`

  ```typescript
  import { ErrorHandler, AppError, ErrorCategory } from './errors';
  
  export async function handleAPIError(
    error: unknown,
    res: Response
  ): Promise<void> {
    const rawError = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : { message: String(error) };
    
    const appError = ErrorHandler.normalize(rawError);
    
    // 根据错误类别设置 HTTP 状态码
    const statusCode = getStatusCode(appError.category);
    
    res.status(statusCode).json({
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
        suggestions: appError.suggestions,
        ...(process.env.NODE_ENV === 'development' && { 
          details: appError.details 
        })
      }
    });
  }
  
  function getStatusCode(category: ErrorCategory): number {
    switch (category) {
      case ErrorCategory.VALIDATION:
      case ErrorCategory.VALIDATION:
        return 400;
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.AUTHORIZATION:
        return 401;
      case ErrorCategory.NOT_FOUND:
        return 404;
      case ErrorCategory.AI_PROVIDER:
      case ErrorCategory.DATABASE:
      case ErrorCategory.PIPELINE:
      case ErrorCategory.INTERNAL:
      default:
        return 500;
    }
  }
  ```

- [ ] **Step 7: 为常见场景添加错误处理测试**

  创建文件：`src/__tests__/unit/errors.test.ts`

  ```typescript
  import { describe, it, expect } from 'vitest';
  import { ErrorHandler } from '@/lib/errors/handler';
  import { createError, toErrorResponse } from '@/lib/errors';
  
  describe('ErrorHandler', () => {
    describe('normalize', () => {
      it('should handle database errors', () => {
        const error = { 
          code: 'P2025', 
          message: 'Record to delete does not exist' 
        };
        
        const result = ErrorHandler.normalize(error);
        
        expect(result.category).toBe('NOT_FOUND');
        expect(result.message).toContain('不存在');
      });
      
      it('should handle AI quota errors', () => {
        const error = { 
          message: 'You have exceeded your monthly quota' 
        };
        
        const result = ErrorHandler.normalize(error);
        
        expect(result.category).toBe('AI_PROVIDER');
        expect(result.code).toBe('AI_004');
        expect(result.suggestions).toBeDefined();
      });
    });
    
    describe('toResponse', () => {
      it('should format error as API response', () => {
        const error = { message: 'Something went wrong' };
        const response = toErrorResponse(error);
        
        expect(response.success).toBe(false);
        expect(response.error).toBeDefined();
        expect(response.error.message).toBeDefined();
      });
    });
  });
  ```

- [ ] **Step 8: Git 提交**

  ```bash
  git add -A
  git commit -m "feat: 建立统一错误处理体系"
  ```

---

## 总结

本计划包含5个优化任务，预计总工时：**6-8周**

| 任务 | 预计工时 | 关键产出 |
|-----|---------|---------|
| 1. 重构核心模块 | 2-3周 | engine目录拆分为3个子模块 |
| 2. 补充测试 | 2周 | 150+新增测试，覆盖率60%+ |
| 4. 清理技术债务 | 0.5周 | 删除备份，TODO转Issue |
| 7. 完善文档 | 1周 | 8+模块文档 |
| 8. 优化错误提示 | 0.5-1周 | 统一错误处理体系 |

建议按顺序执行：任务1和2可并行，完成后任务4、7、8可并行执行。

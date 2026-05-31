# 小说引擎模块

## 概述

小说引擎是 Novel AI 的核心模块，负责协调多个 Agent 完成章节创作流程。引擎通过流水线模式管理创作过程，确保生成内容的质量、连贯性和一致性。

## 目录结构

```
src/lib/engine/
├── orchestrator.ts        # 主编排器 - 协调各模块执行
├── pipeline.ts            # 流水线定义 - 管理执行步骤
├── pipeline-runtime.ts    # 运行时 - 执行流水线步骤
├── pipeline-worker.ts     # Worker - 执行具体任务
├── pipeline-checkpoint.ts  # 检查点 - 保存执行状态
├── context-assembler.ts   # 上下文组装 - 收集创作上下文
├── context-budget.ts      # 预算计算 - 管理token预算
├── context-compression.ts # 上下文压缩 - 压缩过长上下文
├── context-strategy.ts    # 上下文策略 - 选择压缩策略
├── story-state.ts         # 故事状态 - 管理故事进度
├── story-steering.ts     # 故事导向 - 调整创作方向
├── generation-job.ts       # 生成任务 - 管理生成任务
├── task-queue.ts         # 任务队列 - 管理任务排队
├── project-health.ts      # 健康检查 - 检查项目状态
├── auto-maintenance.ts   # 自动维护 - 自动修复问题
├── rag-vector.ts         # RAG向量 - 向量检索增强
├── validation/           # 验证模块
│   ├── validator.ts       # 验证器
│   └── types.ts          # 验证类型
└── index.ts             # 统一导出
```

## 核心流程

```
┌─────────────────────────────────────────────────────────────┐
│                    章节生成流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 初始化故事状态                                           │
│         ↓                                                    │
│  2. 组装上下文（角色、伏笔、摘要、设定）                          │
│         ↓                                                    │
│  3. 执行流水线                                               │
│         ↓                                                    │
│  ┌──────────────────────────────────────────┐                │
│  │ PLANNER → WRITER → VALIDATOR → POLISHER │                │
│  │    ↓         ↓         ↓           ↓     │                │
│  │  章节大纲    正文     质量验证     润色    │                │
│  └──────────────────────────────────────────┘                │
│         ↓                                                    │
│  4. 生成摘要                                                 │
│         ↓                                                    │
│  5. 更新记忆系统                                             │
│         ↓                                                    │
│  6. 返回结果                                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 主要接口

### Orchestrator

主编排器，负责协调整个生成流程。

```typescript
class Orchestrator {
  async runChapterPipeline(
    params: {
      projectId: number;
      chapterNo: number;
    },
    emitter: SSEEmitter
  ): Promise<GenerationResult>

  async runBatchPipeline(
    params: {
      projectId: number;
      startChapter: number;
      endChapter: number;
    },
    emitter: SSEEmitter
  ): Promise<BatchResult>
}
```

### Pipeline

流水线管理器，定义和管理执行步骤。

```typescript
class Pipeline {
  readonly steps: PipelineStep[]

  async execute(
    params: ChapterParams,
    context: PipelineContext
  ): Promise<PipelineResult>

  onStepComplete(callback: (step: PipelineStep) => void): void
  onError(callback: (error: Error, step: PipelineStep) => void): void
}
```

### ContextManager

上下文管理器，负责组装和管理创作上下文。

```typescript
class ContextManager {
  async assemble(params: {
    projectId: number;
    chapterNo: number;
    budget: ContextBudget;
  }): Promise<AssembledContext>

  async compress(context: AssembledContext): Promise<CompressedContext>
}
```

## 配置参数

### 生成参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `temperature` | number | 0.7 | 生成温度 |
| `maxTokens` | number | 4000 | 最大token数 |
| `targetWordCount` | number | 3000 | 目标字数 |
| `styleStrength` | number | 0.5 | 风格强度 |

### 上下文预算

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxTokens` | number | 100000 | 最大token数 |
| `characterRatio` | number | 0.3 | 角色信息占比 |
| `plotlineRatio` | number | 0.2 | 伏笔信息占比 |
| `summaryRatio` | number | 0.5 | 摘要信息占比 |

## 测试覆盖

- 单元测试：`src/__tests__/unit/engine/`
- 覆盖率目标：80%
- 关键场景：
  - 单章节生成
  - 批量章节生成
  - 错误恢复
  - 上下文预算控制

## 常见问题

### Q: 如何调整生成内容的风格？

A: 通过 `styleStrength` 参数调整，值范围 0-1，值越高越接近设定风格。

### Q: 上下文超限怎么办？

A: 系统会自动压缩上下文，优先保留关键信息（角色、伏笔）。

### Q: 生成失败如何处理？

A: 系统会自动重试最多3次，若仍失败会返回详细错误信息。

## 相关文档

- [Agent系统](../agents/README.md)
- [AI服务](../ai/README.md)
- [记忆系统](../memory/README.md)

# 流水线层模块

> 状态：规划中

## 职责

流水线层负责管理和执行具体的创作步骤，如策划、写作、校验、润色等。

## 目标文件

```
pipeline/
├── pipeline.ts              # 流水线定义（从根目录移动）
├── pipeline-runtime.ts      # 运行时（从根目录移动）
├── pipeline-worker.ts       # Worker（从根目录移动）
├── pipeline-checkpoint.ts   # 检查点（从根目录移动）
├── pipeline-types.ts       # 流水线类型（从根目录移动）
├── factory.ts              # 流水线工厂
├── executor.ts             # 流水线执行器
├── step.ts                 # 步骤定义
└── index.ts               # 模块导出
```

## 流水线步骤

```typescript
enum PipelineStep {
  PLANNER = 'PLANNER',      // 策划
  WRITER = 'WRITER',        // 写作
  VALIDATOR = 'VALIDATOR',  // 校验
  POLISHER = 'POLISHER',    // 润色
  SUMMARIZER = 'SUMMARIZER', // 摘要
  DESLOPPER = 'DESLOPPER',  // 去AI味
}
```

## 重构目标

### Pipeline（流水线）
- 当前：与编排逻辑混合
- 目标：独立的流水线执行器

### PipelineRuntime（运行时）
- 管理步骤执行
- 处理步骤间数据传递
- 错误处理和重试

### PipelineWorker（Worker）
- 执行单个步骤
- 调用对应的 Agent
- 处理流式输出

## 重构步骤

### 阶段1：步骤抽象
```typescript
interface PipelineStepHandler {
  step: PipelineStep;
  execute(context: StepContext): Promise<StepResult>;
}
```

### 阶段2：流水线执行器
```typescript
class PipelineExecutor {
  constructor(
    private steps: Map<PipelineStep, PipelineStepHandler>,
    private hooks: PipelineHooks
  ) {}

  async execute(context: PipelineContext): Promise<PipelineResult> {
    for (const [step, handler] of this.steps) {
      const result = await handler.execute(context);
      this.hooks.onStepComplete(step, result);
    }
  }
}
```

### 阶段3：检查点机制
```typescript
class CheckpointManager {
  async save(pipelineId: string, context: PipelineContext): Promise<void>;
  async restore(pipelineId: string): Promise<PipelineContext>;
}
```

## 验收标准

- [ ] 流水线执行逻辑独立
- [ ] 支持步骤级错误恢复
- [ ] 支持检查点保存/恢复
- [ ] 编写单元测试覆盖
- [ ] 与编排层通过接口通信

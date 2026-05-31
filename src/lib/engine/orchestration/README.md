# 编排层模块

> 状态：规划中

## 职责

编排层负责协调整个生成流程，决定何时执行什么任务。

## 目标文件

```
orchestration/
├── orchestrator.ts          # 主编排器（从根目录移动）
├── story-steering.ts        # 故事导向（从根目录移动）
├── story-state.ts          # 故事状态（从根目录移动）
├── types.ts                # 编排类型定义
└── index.ts                # 模块导出
```

## 重构目标

### Orchestrator（主编排器）
- 当前行数：800+
- 目标行数：< 300
- 策略：提取子方法，委托给子模块

### StorySteering（故事导向）
- 管理故事发展方向
- 处理读者反馈
- 调整创作策略

### StoryState（故事状态）
- 管理故事进度
- 追踪已生成内容
- 提供状态查询

## 重构步骤

### 阶段1：提取子方法
```typescript
// 当前 orchestrator.ts
async runChapterPipeline(params, emitter) {
  // 1. 初始化
  // 2. 上下文组装
  // 3. 执行流水线
  // 4. 保存结果
  // ...
}

// 重构后
async runChapterPipeline(params, emitter) {
  const context = await this.contextManager.assemble(params);
  const pipeline = await this.pipelineFactory.create(params);
  return await pipeline.execute(context, emitter);
}
```

### 阶段2：依赖注入
```typescript
class Orchestrator {
  constructor(
    private contextManager: ContextManager,
    private pipelineFactory: PipelineFactory,
    private memory: MemoryOrchestrator
  ) {}
}
```

### 阶段3：接口定义
```typescript
interface IOrchestrator {
  runChapterPipeline(params: ChapterParams, emitter: SSEEmitter): Promise<GenerationResult>;
  runBatchPipeline(params: BatchParams, emitter: SSEEmitter): Promise<BatchResult>;
}
```

## 验收标准

- [ ] orchestrator.ts 行数 < 300
- [ ] 所有子方法提取为独立模块
- [ ] 依赖通过构造函数注入
- [ ] 编写单元测试覆盖核心逻辑
- [ ] 所有测试通过

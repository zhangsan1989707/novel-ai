# 上下文层模块

> 状态：规划中

## 职责

上下文层负责组装和管理创作所需的上下文信息，包括角色档案、伏笔、摘要、世界观等。

## 目标文件

```
context/
├── context-assembler.ts     # 上下文组装（从根目录移动）
├── context-budget.ts        # 预算计算（从根目录移动）
├── context-compression.ts   # 上下文压缩（从根目录移动）
├── context-strategy.ts      # 上下文策略（从根目录移动）
├── manager.ts              # 上下文管理器
├── types.ts                # 上下文类型定义
└── index.ts                # 模块导出
```

## 核心概念

### 上下文预算
```typescript
interface ContextBudget {
  maxTokens: number;
  characterRatio: number;     // 角色信息占比
  plotlineRatio: number;     // 伏笔占比
  summaryRatio: number;      // 摘要占比
  worldSettingRatio: number; // 世界观占比
}
```

### 上下文组装
```typescript
interface AssembledContext {
  characters: CharacterProfile[];
  plotlines: PlotlineData[];
  summaries: ChapterSummary[];
  worldSetting: WorldSetting;
  recentChapters: Chapter[];
  tokenCount: number;
}
```

## 压缩策略

### 策略类型
1. **LRU**：保留最近使用的信息
2. **重要性**：保留重要性高的信息
3. **摘要替换**：将长文本替换为摘要
4. **混合策略**：组合多种策略

## 重构目标

### ContextAssembler（组装器）
- 当前：与编排逻辑混合
- 目标：独立的上下文组装服务

### ContextBudget（预算计算）
- 计算各部分token分配
- 确保不超过最大限制

### ContextCompression（压缩）
- 压缩过长上下文
- 优先保留关键信息

### ContextStrategy（策略）
- 选择合适的压缩策略
- 配置预算分配

## 重构步骤

### 阶段1：接口定义
```typescript
interface IContextManager {
  assemble(params: AssembleParams): Promise<AssembledContext>;
  compress(context: AssembledContext, budget: ContextBudget): Promise<CompressedContext>;
  expand(context: CompressedContext): Promise<AssembledContext>;
}
```

### 阶段2：预算计算
```typescript
class ContextBudgetCalculator {
  calculate(context: AssembledContext): ContextBudget;
  adjust(budget: ContextBudget, actualTokens: number): ContextBudget;
}
```

### 阶段3：压缩实现
```typescript
class ContextCompressor {
  constructor(
    private strategies: CompressionStrategy[]
  ) {}

  compress(context: AssembledContext, budget: ContextBudget): CompressedContext {
    for (const strategy of this.strategies) {
      context = strategy.compress(context, budget);
    }
    return context;
  }
}
```

## 与其他模块的交互

```
编排层
  ↓ 调用
上下文层 ←→ 记忆层
  ↓
流水线层
```

## 验收标准

- [ ] 上下文组装逻辑独立
- [ ] 支持多种压缩策略
- [ ] token预算精确控制
- [ ] 编写单元测试覆盖
- [ ] 与编排层通过接口通信

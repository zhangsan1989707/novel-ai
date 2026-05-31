# Engine 模块重构路线图

> 创建时间：2026-05-31

## 背景

`src/lib/engine` 目录当前包含 47 个文件，单个文件（如 orchestrator.ts）超过 800 行，职责边界模糊，维护成本高。

## 重构目标

1. **降低复杂度**：核心文件控制在 300 行以内
2. **清晰职责**：每个子模块职责单一明确
3. **易于测试**：每个模块可独立测试
4. **可扩展**：便于添加新功能

## 目标架构

```
src/lib/engine/
├── orchestration/     # 编排层：协调各模块执行
├── pipeline/         # 流水线层：管理执行步骤
├── context/         # 上下文层：管理创作上下文
├── validation/      # 验证层：质量检查（已存在）
├── index.ts         # 统一导出
└── *.ts             # 保留：其他辅助模块
```

## 子模块职责

### 1. Orchestration（编排层）

**职责**：
- 协调整个生成流程
- 决定执行顺序和策略
- 管理流程状态

**核心文件**：
- `orchestrator.ts` → 精简为 300 行以内
- `story-steering.ts`
- `story-state.ts`

### 2. Pipeline（流水线层）

**职责**：
- 定义执行步骤
- 管理步骤执行
- 处理步骤间数据流

**核心文件**：
- `pipeline.ts`
- `pipeline-runtime.ts`
- `pipeline-worker.ts`
- `pipeline-checkpoint.ts`

### 3. Context（上下文层）

**职责**：
- 组装创作上下文
- 管理token预算
- 压缩过长上下文

**核心文件**：
- `context-assembler.ts`
- `context-budget.ts`
- `context-compression.ts`
- `context-strategy.ts`

## 分阶段实施计划

### 阶段1：基础设施（1周）

**目标**：建立子模块结构，不破坏现有代码

**任务**：
- [ ] 创建 orchestration/ 目录和 README
- [ ] 创建 pipeline/ 目录和 README
- [ ] 创建 context/ 目录和 README
- [ ] 创建重构路线图文档（本文档）
- [ ] 运行全量测试确保基线

**验收**：
- 所有测试通过
- 目录结构就绪

---

### 阶段2：提取上下文层（2-3周）

**目标**：将上下文相关逻辑抽取到 context/ 子模块

**任务**：
1. 定义 IContextManager 接口
2. 移动 context-assembler.ts → context/assembler.ts
3. 移动 context-budget.ts → context/budget.ts
4. 移动 context-compression.ts → context/compression.ts
5. 移动 context-strategy.ts → context/strategy.ts
6. 创建 context/manager.ts 整合各组件
7. 更新所有导入路径
8. 运行测试确保功能正常

**验收**：
- context/ 模块可独立测试
- orchestrator.ts 减少约 200 行
- 所有测试通过

---

### 阶段3：提取流水线层（2-3周）

**目标**：将流水线相关逻辑抽取到 pipeline/ 子模块

**任务**：
1. 定义 IPipeline 接口
2. 移动 pipeline.ts → pipeline/pipeline.ts
3. 移动 pipeline-runtime.ts → pipeline/runtime.ts
4. 移动 pipeline-worker.ts → pipeline/worker.ts
5. 移动 pipeline-checkpoint.ts → pipeline/checkpoint.ts
6. 移动 pipeline-types.ts → pipeline/types.ts
7. 创建 pipeline/factory.ts 工厂类
8. 更新所有导入路径
9. 运行测试确保功能正常

**验收**：
- pipeline/ 模块可独立测试
- orchestrator.ts 再减少约 200 行
- 所有测试通过

---

### 阶段4：精简编排层（2周）

**目标**：大幅精简 orchestrator.ts

**任务**：
1. 提取子方法到独立文件
2. 实现依赖注入
3. 定义 Orchestrator 接口
4. 精简核心逻辑到 300 行以内
5. 添加详细注释和文档
6. 补充单元测试

**验收**：
- orchestrator.ts < 300 行
- 核心逻辑可独立测试
- 所有测试通过

---

### 阶段5：清理和优化（1周）

**目标**：清理遗留代码，优化整体结构

**任务**：
1. 检查并清理未使用的导入
2. 优化模块间依赖关系
3. 更新 README 文档
4. 运行 lint 检查
5. 最终测试验证

**验收**：
- lint 检查无警告
- 所有测试通过
- 文档完整

## 风险控制

### 风险1：重构破坏现有功能

**缓解措施**：
- 每个阶段完成后运行全量测试
- 使用 Git 分支管理重构
- 频繁提交，每次小改动

### 风险2：导入路径变更影响范围大

**缓解措施**：
- 使用 IDE 全局替换功能
- 创建别名导出减少直接依赖
- 分阶段逐步更新导入

### 风险3：重构周期过长

**缓解措施**：
- 明确每个阶段的验收标准
- 定期同步进展
- 必要时调整范围

## 当前状态

| 阶段 | 状态 | 完成度 |
|------|------|--------|
| 阶段1：基础设施 | ✅ 已完成 | 100% |
| 阶段2：提取上下文层 | ⏳ 规划中 | 0% |
| 阶段3：提取流水线层 | ⏳ 规划中 | 0% |
| 阶段4：精简编排层 | ⏳ 规划中 | 0% |
| 阶段5：清理和优化 | ⏳ 规划中 | 0% |

## 相关文档

- [Orchestration 模块规划](./orchestration/README.md)
- [Pipeline 模块规划](./pipeline/README.md)
- [Context 模块规划](./context/README.md)
- [Engine 模块文档](../../../docs/modules/engine/README.md)

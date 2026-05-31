# Agent 智能体系统

## 概述

Agent 系统是 Novel AI 的核心创作引擎，包含多个专业 Agent 协作完成小说创作。每个 Agent 专注于特定任务，通过流水线模式串联工作。

## Agent 类型

| Agent | 枚举值 | 职责 | 输入 | 输出 |
|-------|--------|------|------|------|
| **Planner** | `PLANNER` | 策划章节大纲 | 项目设定、角色档案、伏笔状态 | 章节大纲 |
| **Writer** | `WRITER` | 正文写作 | 章节大纲、世界观、角色档案 | 章节正文 |
| **Polisher** | `POLISHER` | 文笔润色 | 原始正文、写作风格 | 润色后正文 |
| **Validator** | `VALIDATOR` | 质量校验 | 正文内容、世界设定、伏笔追踪 | 校验报告 |
| **Summarizer** | `SUMMARIZER` | 章节摘要 | 章节标题与正文 | 摘要数据 |
| **Researcher** | `RESEARCHER` | 资料研究 | 研究主题 | 研究资料 |
| **Reviewer** | `REVIEWER` | 多角度评审 | 章节内容 | 评审报告 |
| **Deslopper** | `DESLOPPER` | 去AI味 | 原始正文 | 改写后正文 |

## 文件结构

```
src/lib/agents/
├── planner.ts              # 策划Agent
├── writer.ts               # 写作Agent
├── polisher.ts             # 润色Agent
├── validator.ts            # 校验Agent
├── summarizer.ts           # 摘要Agent
├── researcher.ts           # 研究Agent
├── reviewer.ts             # 评审Agent
├── deslopper.ts            # 去AI味Agent
├── adapters.ts             # Agent适配器
├── base.ts                 # 基础接口
├── prompts.ts              # 提示词模板
└── registry.ts            # Agent注册表
```

## 使用示例

### Planner Agent

```typescript
import { plannerAgent } from '@/lib/agents/planner';

const outline = await plannerAgent({
  projectId: 1,
  chapterNo: 1,
  characterProfiles: [
    { name: '张三', role: 'PROTAGONIST', personality: '坚毅果敢' }
  ],
  openPlotlines: [
    { id: '1', description: '主角的神秘身世' }
  ],
  emotionalArc: [30, 45, 60],
  targetWordCount: 3000
});

// 输出
console.log(outline.chapterTitle);   // "第一章 起点"
// console.log(outline.mainConflict);  // 主要冲突描述
// console.log(outline.keyScenes);     // 关键场景列表
```

### Writer Agent

```typescript
import { writerAgent } from '@/lib/agents/writer';

const content = await writerAgent({
  projectId: 1,
  chapterNo: 1,
  outline: {
    chapterTitle: '第一章 起点',
    mainConflict: '主角遭遇危机',
    keyScenes: [{ scene: '危机发生' }]
  },
  context: {
    worldSetting: '修仙世界',
    characterProfiles: [],
    previousSummary: '...'
  }
}, (chunk) => {
  // 流式输出回调
  console.log(chunk);
});
```

### Validator Agent

```typescript
import { validatorAgent } from '@/lib/agents/validator';

const report = await validatorAgent({
  projectId: 1,
  chapterNo: 1,
  content: '章节正文内容...',
  worldSetting: '修仙世界',
  characterProfiles: [],
  openPlotlines: []
});

// 校验结果
console.log(report.result);    // 'pass' | 'retry'
console.log(report.score);     // 0-100 评分
console.log(report.issues);     // 问题列表
```

## 流水线集成

Agent 通常通过 Pipeline 串联使用：

```typescript
import { Pipeline } from '@/lib/engine/pipeline';

const pipeline = new Pipeline({
  steps: ['PLANNER', 'WRITER', 'VALIDATOR', 'POLISHER']
});

const result = await pipeline.execute({
  projectId: 1,
  chapterNo: 1
}, emitter);
```

## 提示词管理

Agent 使用结构化的提示词模板：

```typescript
import { buildPlannerPrompt } from '@/lib/agents/prompts';

const prompt = buildPlannerPrompt({
  genre: '玄幻',
  worldSetting: '修仙世界',
  characterProfiles: [],
  openPlotlines: [],
  targetWordCount: 3000
});
```

提示词模板位置：`src/lib/prompts/agents/`

## 自定义 Agent

创建新的 Agent 需要：

1. 定义 Agent 输入输出类型
2. 实现 Agent 执行逻辑
3. 注册到 AgentRegistry
4. 添加单元测试

```typescript
// 1. 定义类型
interface MyAgentInput {
  projectId: number;
  content: string;
}

interface MyAgentOutput {
  result: string;
  score: number;
}

// 2. 实现 Agent
export async function myAgent(
  input: MyAgentInput,
  onChunk?: (chunk: string) => void
): Promise<MyAgentOutput> {
  // 实现逻辑
  return { result: '', score: 0 };
}

// 3. 注册
AgentRegistry.register('MY_AGENT', myAgent);
```

## 测试指南

```typescript
import { describe, it, expect, vi } from 'vitest';
import { plannerAgent } from '@/lib/agents/planner';

describe('plannerAgent', () => {
  it('should generate valid chapter outline', async () => {
    const mockProvider = {
      generate: vi.fn().mockResolvedValue({
        content: JSON.stringify({ chapterTitle: '测试', ... })
      })
    };

    const result = await plannerAgent(input, undefined, mockProvider as any);

    expect(result.outline).toBeDefined();
    expect(result.outline.chapterTitle).toBeTruthy();
  });
});
```

## 相关文档

- [引擎模块](./engine/README.md)
- [AI服务](./ai/README.md)

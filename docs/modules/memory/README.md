# 记忆系统

## 概述

记忆系统是 Novel AI 的核心模块之一，负责管理小说的长期记忆和上下文信息。通过分层摘要和向量检索技术，解决长篇小说创作的上下文管理问题。

## 核心挑战

1. **Token 限制**：AI 模型有上下文长度限制（4K-128K tokens）
2. **信息衰减**：早期章节的关键信息在上下文中权重降低
3. **一致性维护**：确保角色设定、世界观、伏笔在全书中保持一致
4. **检索效率**：快速定位特定时间点或场景的上下文

## 解决方案：分层摘要架构

```
┌────────────────────────────────────────────┐
│           L3: 全书摘要 (1000-1500字)         │
│  • 核心主线剧情                              │
│  • 主要角色命运                              │
│  • 世界观关键变化                            │
├────────────────────────────────────────────┤
│           L2: 卷摘要 (500-800字)             │
│  • 本卷主要事件                              │
│  • 角色关系变化                              │
│  • 伏笔埋设情况                              │
├────────────────────────────────────────────┤
│           L1: 章节摘要 (200-300字)            │
│  • 本章核心事件                              │
│  • 角色动态                                 │
│  • 伏笔相关                                 │
└────────────────────────────────────────────┘
```

## 文件结构

```
src/lib/memory/
├── index.ts                # 统一导出
├── orchestrator.ts         # 记忆编排器
├── summarizer.ts           # 摘要生成器
├── chapter-memory.ts       # 章节记忆
├── volume-memory.ts        # 卷记忆
├── book-memory.ts         # 全书记忆
├── types.ts               # 类型定义
└── prompts.ts             # 提示词模板
```

## 核心类型

```typescript
// 章节记忆
interface ChapterMemory {
  chapterNo: number;
  title: string;
  summary: string;           // 200-300字摘要
  keyEvents: string[];       // 关键事件
  characterUpdates: {        // 角色动态
    name: string;
    update: string;
  }[];
  plotlineUpdates: {         // 伏笔更新
    plotlineId: string;
    update: string;
  }[];
  foreshadows: {            // 新埋伏笔
    id: string;
    description: string;
    hint: string;
  }[];
  createdAt: Date;
}

// 卷记忆
interface VolumeMemory {
  volumeNo: number;
  title: string;
  summary: string;           // 500-800字摘要
  chapterCount: number;
  keyEvents: string[];
  plotlines: string[];       // 本卷涉及的主要伏笔
  createdAt: Date;
  updatedAt: Date;
}

// 全书记忆
interface BookMemory {
  bookId: number;
  summary: string;           // 1000-1500字摘要
  volumes: VolumeMemory[];
  characterArcs: {          // 角色弧线
    name: string;
    arc: string;
  }[];
  mainPlotlines: string[];   // 主线伏笔
  worldChanges: string[];     // 世界观变化
  createdAt: Date;
  updatedAt: Date;
}
```

## 使用接口

### MemoryOrchestrator

主编排器，管理整个记忆系统。

```typescript
import { MemoryOrchestrator } from '@/lib/memory';

const memory = new MemoryOrchestrator(projectId);

// 获取当前上下文
const context = await memory.getContext(chapterNo, {
  maxTokens: 80000,
  includeCharacterProfiles: true,
  includeOpenPlotlines: true,
  includeRecentChapters: 3
});

console.log(context.characters);    // 角色信息
console.log(context.plotlines);     // 伏笔信息
console.log(context.summaries);     // 摘要信息
console.log(context.totalTokens);   // token数

// 更新章节记忆
await memory.updateChapterMemory(chapterNo, {
  title: '第一章 起点',
  summary: '主角张三遇到神秘老者...',
  keyEvents: ['主角遇到神秘老者', '老者传授功法'],
  characterUpdates: [{ name: '张三', update: '获得修炼功法' }],
  plotlineUpdates: [],
  foreshadows: [{ id: 'pl-001', description: '老者的身份', hint: '似乎与主角有关' }]
});

// 更新卷记忆
await memory.updateVolumeMemory(volumeNo, {
  volumeNo: 1,
  title: '第一卷 修行之路',
  summary: '...'
});

// 获取全书摘要
const bookSummary = await memory.getBookSummary();
```

### 动态上下文组装

根据当前章节需求动态组装上下文：

```typescript
const context = await memory.assembleContext({
  chapterNo: 50,
  purpose: 'generate',  // 'generate' | 'analysis'
  constraints: {
    maxTokens: 100000,
    priorities: {
      characters: 0.4,      // 40% 给角色信息
      plotlines: 0.3,      // 30% 给伏笔
      summaries: 0.3       // 30% 给摘要
    }
  }
});
```

## 摘要生成

### 自动摘要策略

```typescript
import { Summarizer } from '@/lib/memory/summarizer';

const summarizer = new Summarizer();

// 章节摘要
const chapterSummary = await summarizer.summarizeChapter({
  title: '第一章 起点',
  content: '章节正文内容...',
  options: {
    maxLength: 300,  // 最大字数
    preserveKeyEvents: true,
    preserveForeshadows: true
  }
});

// 卷摘要
const volumeSummary = await summarizer.summarizeVolume({
  chapterSummaries: [...],
  options: {
    maxLength: 800,
    focusOnPlotlines: ['主线', '感情线']
  }
});

// 全书摘要
const bookSummary = await summarizer.summarizeBook({
  volumeSummaries: [...],
  options: {
    maxLength: 1500,
    focusOnArcs: true
  }
});
```

## 向量检索增强

使用 pgvector 实现语义检索：

```typescript
import { VectorMemory } from '@/lib/memory/vector';

const vectorMemory = new VectorMemory(projectId);

// 存储记忆向量
await vectorMemory.store({
  type: 'character',
  content: '张三，主角，性格坚毅，身世成谜',
  metadata: { chapterNo: 1, name: '张三' }
});

// 检索相似记忆
const memories = await vectorMemory.search({
  query: '主角的身世',
  type: 'character',
  limit: 5,
  threshold: 0.8
});

console.log(memories[0].content);  // 相关角色信息
```

## 上下文一致性检查

```typescript
import { ConsistencyChecker } from '@/lib/memory/consistency';

const checker = new ConsistencyChecker(projectId);

// 检查角色一致性
const characterCheck = await checker.checkCharacter('张三', {
  currentState: '已经成为筑基期修士',
  previousMentions: ['曾经是凡人', '偶遇老者']
});

if (!characterCheck.isConsistent) {
  console.log('警告：角色状态存在不一致');
  console.log('冲突点:', characterCheck.conflicts);
}

// 检查伏笔一致性
const plotlineCheck = await checker.checkPlotline('pl-001', {
  currentHint: '老者可能是主角的父亲',
  previousHints: ['老者对主角异常照顾', '老者功法与主角相似']
});
```

## 与 RAG 系统集成

记忆系统与 RAG 系统协同工作：

```typescript
const context = await memory.getContext(chapterNo, {
  maxTokens: 60000
});

// 使用 RAG 补充相关资料
const rag = new RAGVector(projectId);
const relevantDocs = await rag.search({
  query: `第${chapterNo}章相关设定`,
  limit: 10,
  threshold: 0.7
});

// 合并上下文
const finalContext = {
  ...context,
  relevantDocs: relevantDocs.map(d => d.content)
};
```

## 性能优化

1. **增量更新**：只更新变更的记忆，不重新生成全文摘要
2. **缓存策略**：热门章节摘要缓存，减少重复计算
3. **批量处理**：多章节批量生成摘要，提升效率
4. **向量索引**：使用 HNSW 索引加速向量检索

## 测试指南

```typescript
import { describe, it, expect } from 'vitest';
import { MemoryOrchestrator } from '@/lib/memory';

describe('MemoryOrchestrator', () => {
  it('should assemble context within token budget', async () => {
    const memory = new MemoryOrchestrator(projectId);

    const context = await memory.getContext(10, {
      maxTokens: 80000
    });

    expect(context.totalTokens).toBeLessThanOrEqual(80000);
  });

  it('should prioritize recent chapters', async () => {
    const memory = new MemoryOrchestrator(projectId);

    const context = await memory.getContext(50, {
      includeRecentChapters: 5
    });

    expect(context.recentChapters.length).toBeLessThanOrEqual(5);
  });
});
```

## 相关文档

- [引擎模块](./engine/README.md)
- [Agent系统](./agents/README.md)
- [RAG系统](./rag/README.md)

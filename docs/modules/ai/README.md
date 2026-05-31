# AI 服务模块

## 概述

AI 服务模块提供统一的 AI 调用接口，支持多个 AI 服务商（OpenAI、Anthropic、DeepSeek 等）。模块负责 AI 请求的发送、响应解析、错误处理和成本追踪。

## 支持的 AI 提供商

| 厂商 | 枚举值 | 默认模型 | 状态 | API Key 环境变量 |
|------|--------|----------|------|------------------|
| OpenAI | `OPENAI` | gpt-4o | ✅ 已支持 | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC` | claude-3-5-sonnet | ✅ 已支持 | `ANTHROPIC_API_KEY` |
| DeepSeek | `DEEPSEEK` | deepseek-chat | ✅ 已支持 | `DEEPSEEK_API_KEY` |
| 阿里云 | `ALIBABA` | qwen-max | ✅ 已支持 | `ALIBABA_API_KEY` |
| 智谱AI | `ZHIPU` | glm-4 | ✅ 已支持 | `ZHIPU_API_KEY` |
| MiniMax | `MINIMAX` | abab6-chat | ✅ 已支持 | `MINIMAX_API_KEY` |
| 火山引擎 | `VOLCENGINE` | doubao-pro | ✅ 已支持 | `VOLCENGINE_API_KEY` |

## 文件结构

```
src/lib/ai/
├── service.ts              # AI服务主类
├── factory.ts              # 厂商工厂
├── adapters/              # 厂商适配器
│   ├── openai.ts         # OpenAI适配器
│   ├── anthropic.ts      # Anthropic适配器
│   ├── deepseek.ts       # DeepSeek适配器
│   └── ...
├── types.ts              # AI类型定义
├── config.ts             # 配置管理
└── index.ts             # 统一导出
```

## 核心类型

```typescript
// AI厂商枚举
enum AIVendor {
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  DEEPSEEK = 'DEEPSEEK',
  ALIBABA = 'ALIBABA',
  // ...
}

// 生成请求
interface GenerateRequest {
  prompt: string;
  vendor?: AIVendor;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

// 生成响应
interface GenerateResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'content_filter';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  raw: Record<string, unknown>;
}
```

## 基本使用

### 默认配置

```typescript
import { AIService } from '@/lib/ai/service';

const aiService = new AIService();

// 使用默认配置（DEEPSEEK + deepseek-chat）
const result = await aiService.generate({
  prompt: '写一段小说开篇'
});

console.log(result.content);
console.log(`消耗token: ${result.usage.totalTokens}`);
```

### 指定厂商和模型

```typescript
const result = await aiService.generate({
  prompt: '写一段小说开篇',
  vendor: 'OPENAI',
  modelId: 'gpt-4o',
  temperature: 0.8,
  maxTokens: 2000
});
```

### 流式输出

```typescript
const stream = await aiService.generateStream({
  prompt: '继续写下去',
  vendor: 'DEEPSEEK',
  modelId: 'deepseek-chat'
});

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

### 成本追踪

```typescript
import { useCostTracker } from '@/lib/cost-tracker';

const tracker = useCostTracker();

const result = await aiService.generate({ prompt: '...' });

// 记录成本
tracker.record({
  vendor: 'DEEPSEEK',
  modelId: 'deepseek-chat',
  tokens: result.usage.totalTokens,
  timestamp: new Date()
});

// 查询统计
const stats = tracker.getStats({ period: 'month' });
console.log(`本月消耗: ¥${stats.totalCost}`);
```

## 厂商适配器

每个厂商都有独立的适配器实现：

```typescript
import { OpenAIAdapter } from '@/lib/ai/adapters/openai';
import { AnthropicAdapter } from '@/lib/ai/adapters/anthropic';
import { DeepSeekAdapter } from '@/lib/ai/adapters/deepseek';

// 直接使用适配器
const adapter = new DeepSeekAdapter({
  apiKey: process.env.DEEPSEEK_API_KEY
});

const result = await adapter.generate({
  prompt: '...',
  modelId: 'deepseek-chat'
});
```

## 错误处理

AI 服务会自动处理常见错误：

```typescript
import { AIErrors } from '@/lib/errors';

try {
  const result = await aiService.generate({ prompt: '...' });
} catch (error) {
  if (error instanceof AIErrors.QuotaExceeded) {
    // 处理配额超限
    console.log('配额已用完，请升级套餐');
  } else if (error instanceof AIErrors.RateLimitExceeded) {
    // 处理频率限制
    console.log('请求过于频繁，请稍后重试');
  }
}
```

## 配置管理

### 环境变量

```bash
# 默认配置
DEFAULT_AI_VENDOR=DEEPSEEK
DEFAULT_AI_MODEL_ID=deepseek-chat

# 厂商API Key
DEEPSEEK_API_KEY=your-deepseek-api-key
OPENAI_API_KEY=your-openai-api-key
```

### 动态配置

```typescript
const aiService = new AIService({
  defaultVendor: 'OPENAI',
  defaultModel: 'gpt-4o',
  timeout: 60000,  // 60秒超时
  retries: 3       // 失败重试3次
});
```

## 测试指南

```typescript
import { describe, it, expect, vi } from 'vitest';
import { AIService } from '@/lib/ai/service';

describe('AIService', () => {
  it('should generate content with default config', async () => {
    const service = new AIService();

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '测试内容' } }]
      })
    });

    const result = await service.generate({ prompt: '测试' });

    expect(result.content).toBe('测试内容');
  });
});
```

## 性能优化

1. **批量请求**：对于多个独立请求，使用批量处理减少网络开销
2. **缓存**：对相同请求的响应进行缓存（需要外部缓存服务）
3. **模型选择**：根据任务复杂度选择合适模型，简单任务使用轻量模型
4. **Token优化**：精简提示词，减少 token 消耗

## 相关文档

- [Agent系统](./agents/README.md)
- [成本追踪](../cost-tracker/README.md)

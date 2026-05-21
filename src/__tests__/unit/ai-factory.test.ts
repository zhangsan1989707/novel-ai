import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIVendor } from '@/types'

// Mock the providers
vi.mock('@/lib/ai/providers', () => ({
  OpenAIProvider: vi.fn().mockImplementation(() => ({
    name: 'OpenAI',
    vendor: AIVendor.OPENAI,
    setConfig: vi.fn(),
    validateConfig: vi.fn().mockReturnValue(true),
  })),
  AnthropicProvider: vi.fn().mockImplementation(() => ({
    name: 'Anthropic',
    vendor: AIVendor.ANTHROPIC,
    setConfig: vi.fn(),
    validateConfig: vi.fn().mockReturnValue(true),
  })),
  AlibabaProvider: vi.fn().mockImplementation(() => ({
    name: 'Alibaba',
    vendor: AIVendor.ALIBABA,
    setConfig: vi.fn(),
    validateConfig: vi.fn().mockReturnValue(true),
  })),
  DeepSeekProvider: vi.fn().mockImplementation(() => ({
    name: 'DeepSeek',
    vendor: AIVendor.DEEPSEEK,
    setConfig: vi.fn(),
    validateConfig: vi.fn().mockReturnValue(true),
  })),
  MiniMaxProvider: vi.fn().mockImplementation(() => ({
    name: 'MiniMax',
    vendor: AIVendor.MINIMAX,
    setConfig: vi.fn(),
    validateConfig: vi.fn().mockReturnValue(true),
  })),
  MiMoProvider: vi.fn().mockImplementation(() => ({
    name: 'Xiaomi MiMo',
    vendor: AIVendor.MIMO,
    setConfig: vi.fn(),
    validateConfig: vi.fn().mockReturnValue(true),
  })),
  VolcEngineProvider: vi.fn().mockImplementation(() => ({
    name: 'VolcEngine',
    vendor: AIVendor.VOLCENGINE,
    setConfig: vi.fn(),
    validateConfig: vi.fn().mockReturnValue(true),
  })),
  ZhipuProvider: vi.fn().mockImplementation(() => ({
    name: 'Zhipu AI',
    vendor: AIVendor.ZHIPU,
    setConfig: vi.fn(),
    validateConfig: vi.fn().mockReturnValue(true),
  })),
}))

describe('AI Provider Factory', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('AIProviderFactory', () => {
    it('should create DeepSeek provider', async () => {
      const { AIProviderFactory } = await import('@/lib/ai/factory')
      const provider = AIProviderFactory.create(AIVendor.DEEPSEEK)
      expect(provider).toBeDefined()
      expect(provider.vendor).toBe(AIVendor.DEEPSEEK)
    })

    it('should create OpenAI provider', async () => {
      const { AIProviderFactory } = await import('@/lib/ai/factory')
      const provider = AIProviderFactory.create(AIVendor.OPENAI)
      expect(provider).toBeDefined()
      expect(provider.vendor).toBe(AIVendor.OPENAI)
    })

    it('should throw error for unsupported vendor', async () => {
      const { AIProviderFactory } = await import('@/lib/ai/factory')
      expect(() => {
        // @ts-expect-error - testing invalid vendor
        AIProviderFactory.create('UNSUPPORTED')
      }).toThrow('Unsupported AI vendor')
    })

    it('should return all supported vendors', async () => {
      const { AIProviderFactory } = await import('@/lib/ai/factory')
      const vendors = AIProviderFactory.getSupportedVendors()
      expect(vendors).toContain(AIVendor.DEEPSEEK)
      expect(vendors).toContain(AIVendor.OPENAI)
      expect(vendors).toContain(AIVendor.ANTHROPIC)
      expect(vendors).toContain(AIVendor.ALIBABA)
      expect(vendors).toContain(AIVendor.MINIMAX)
      expect(vendors).toContain(AIVendor.MIMO)
      expect(vendors).toContain(AIVendor.VOLCENGINE)
      expect(vendors).toContain(AIVendor.ZHIPU)
    })
  })

  describe('getAIProvider', () => {
    it('should create provider with config', async () => {
      const { getAIProvider } = await import('@/lib/ai/factory')
      const config = {
        vendor: AIVendor.DEEPSEEK,
        modelId: 'deepseek-chat',
        apiKey: 'test-key',
      }
      const provider = getAIProvider(AIVendor.DEEPSEEK, config)
      expect(provider).toBeDefined()
      expect(provider.vendor).toBe(AIVendor.DEEPSEEK)
    })

    it('should cache provider instances', async () => {
      const { getAIProvider } = await import('@/lib/ai/factory')
      const config = {
        vendor: AIVendor.DEEPSEEK,
        modelId: 'deepseek-chat',
        apiKey: 'test-key',
      }
      const provider1 = getAIProvider(AIVendor.DEEPSEEK, config)
      const provider2 = getAIProvider(AIVendor.DEEPSEEK, config)
      expect(provider1).toBe(provider2)
    })
  })

  describe('getSupportedAIProviders', () => {
    it('should return list of supported providers', async () => {
      const { getSupportedAIProviders } = await import('@/lib/ai/factory')
      const providers = getSupportedAIProviders()
      expect(providers.length).toBe(8)
      expect(providers.find(p => p.vendor === AIVendor.DEEPSEEK)?.name).toBe('DeepSeek')
    })
  })
})

describe('BaseAIProvider', () => {
  it('should estimate target tokens correctly', async () => {
    const { BaseAIProvider } = await import('@/lib/ai/base')

    class TestProvider extends BaseAIProvider {
      readonly name = 'Test'
      readonly vendor = AIVendor.DEEPSEEK
      async generate() { return { content: '' } }
      async *generateStream() { yield '' }
    }

    const provider = new TestProvider()
    // 3000 字 * 1.5 = 4500 tokens
    expect(provider.estimateTargetTokens(3000)).toBe(4500)
  })

  it('should validate config correctly', async () => {
    const { BaseAIProvider } = await import('@/lib/ai/base')

    class TestProvider extends BaseAIProvider {
      readonly name = 'Test'
      readonly vendor = AIVendor.DEEPSEEK
      async generate() { return { content: '' } }
      async *generateStream() { yield '' }
    }

    const provider = new TestProvider()

    expect(provider.validateConfig({
      vendor: AIVendor.DEEPSEEK,
      modelId: 'deepseek-chat',
      apiKey: 'test-key',
    })).toBe(true)

    expect(provider.validateConfig({
      vendor: AIVendor.DEEPSEEK,
      modelId: '',
      apiKey: 'test-key',
    })).toBe(false)

    expect(provider.validateConfig({
      vendor: AIVendor.DEEPSEEK,
      modelId: 'deepseek-chat',
      apiKey: '',
    })).toBe(false)
  })

  it('should check content sufficiency', async () => {
    const { BaseAIProvider } = await import('@/lib/ai/base')

    class TestProvider extends BaseAIProvider {
      readonly name = 'Test'
      readonly vendor = AIVendor.DEEPSEEK
      async generate() { return { content: '' } }
      async *generateStream() { yield '' }
    }

    const provider = new TestProvider()

    // 3000 * 0.9 = 2700, 所以 2800 应该足够，2000 不够
    expect(provider.isContentSufficient(2800, 3000)).toBe(true)
    expect(provider.isContentSufficient(2000, 3000)).toBe(false)
    expect(provider.isContentSufficient(2700, 3000)).toBe(true)
  })
})

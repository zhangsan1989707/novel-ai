import type { AIProvider, AIConfig, GenerationParams, GenerationResult } from './types'
import type { AIVendor } from '@/types'

/**
 * AI Provider 抽象基类
 */
export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string
  abstract readonly vendor: AIVendor

  protected config: AIConfig | null = null

  abstract generate(prompt: string, params?: GenerationParams): Promise<GenerationResult>
  abstract generateStream(prompt: string, params?: GenerationParams): AsyncGenerator<string>

  setConfig(config: AIConfig): void {
    this.config = config
  }

  getConfig(): AIConfig | null {
    return this.config
  }

  validateConfig(config: AIConfig): boolean {
    if (!config.apiKey) return false
    if (!config.modelId) return false
    return true
  }

  /**
   * 计算目标 token 数（根据目标字数估算）
   * 中文约 2 字符 = 1 token
   */
  protected estimateTargetTokens(targetWordCount: number): number {
    return Math.floor(targetWordCount * 1.5)
  }

  /**
   * 估算生内容量是否足够
   */
  protected isContentSufficient(wordCount: number, targetWordCount: number): boolean {
    return wordCount >= targetWordCount * 0.9
  }
}

/**
 * Provider 工厂
 */
export class AIProviderFactory {
  private static providers: Map<AIVendor, new () => BaseAIProvider> = new Map()

  static register(vendor: AIVendor, providerClass: new () => BaseAIProvider): void {
    AIProviderFactory.providers.set(vendor, providerClass)
  }

  static create(vendor: AIVendor): AIProvider {
    const ProviderClass = AIProviderFactory.providers.get(vendor)
    if (!ProviderClass) {
      throw new Error(`Unsupported AI vendor: ${vendor}`)
    }
    return new ProviderClass()
  }

  static getSupportedVendors(): AIVendor[] {
    return Array.from(AIProviderFactory.providers.keys())
  }
}

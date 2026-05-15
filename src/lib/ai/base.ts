import type { AIProvider, AIConfig, GenerationParams, GenerationResult } from './types'
import type { AIVendor } from '@/types'
import { getModelPricing, estimateCost } from '@/lib/cost-tracker'

// 简单的 token 估算函数（当 API 不返回 token 统计时使用）
export function estimateTokens(text: string): number {
  // 中文字符约 1.5 个字符 = 1 token
  // 英文字符约 4 个字符 = 1 token
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}

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

  /**
   * 获取当前模型的定价信息
   */
  async getPricing() {
    if (!this.config) {
      throw new Error('Provider not configured')
    }
    return getModelPricing(this.vendor, this.config.modelId)
  }

  /**
   * 估算一次调用的成本
   */
  async estimateCallCost(prompt: string, estimatedCompletionTokens: number) {
    if (!this.config) {
      throw new Error('Provider not configured')
    }
    const pricing = await this.getPricing()
    if (!pricing) {
      // 如果没有定价信息，使用默认值
      return estimateCost(
        estimateTokens(prompt),
        estimatedCompletionTokens,
        1.0,
        2.0
      )
    }
    const promptTokens = estimateTokens(prompt)
    return estimateCost(
      promptTokens,
      estimatedCompletionTokens,
      pricing.inputPrice.toNumber(),
      pricing.outputPrice.toNumber()
    )
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

import { BaseAIProvider, estimateTokens } from '@/lib/ai/base'
import { recordUsage, canProceedWithGeneration } from '@/lib/cost-tracker'
import { logger } from '@/lib/logger'
import type {
  AIProvider,
  AIConfig,
  EmbeddingParams,
  GenerationParams,
  GenerationResult,
  ImageGenerationParams,
  ImageGenerationResult,
} from '@/lib/ai/types'

// 临时用户 ID（在完整用户系统之前）
const DEFAULT_USER_ID = 1

/**
 * 可追踪成本的 AI Provider Wrapper
 */
export class TraceableAIProvider implements AIProvider {
  private provider: BaseAIProvider
  private config: AIConfig
  private userId: number
  private projectId?: number | null
  private usageType: string

  constructor(
    provider: BaseAIProvider,
    config: AIConfig,
    options: {
      userId?: number
      projectId?: number | null
      usageType?: string
    } = {}
  ) {
    this.provider = provider
    this.config = config
    this.userId = options.userId || DEFAULT_USER_ID
    this.projectId = options.projectId
    this.usageType = options.usageType || 'GENERATE'
    this.provider.setConfig(config)
  }

  get name() {
    return this.provider.name
  }

  get vendor() {
    return this.provider.vendor
  }

  /**
   * 生成并记录成本
   */
  async generate(
    prompt: string,
    params?: GenerationParams
  ): Promise<GenerationResult> {
    // 1. 先检查配额
    const quotaCheck = await canProceedWithGeneration(this.userId)
    if (!quotaCheck.allowed) {
      throw new Error(quotaCheck.reason || 'Quota exceeded')
    }

    const startTime = Date.now()
    try {
      const result = await this.provider.generate(prompt, params)

      // 记录使用
      await this.recordUsage(prompt, result)

      logger.info(
        {
          vendor: this.vendor,
          modelId: this.config.modelId,
          duration: Date.now() - startTime,
          tokens: result.totalTokens,
          cost: result.cost,
        },
        'AI generation completed with cost tracking'
      )

      return result
    } catch (error) {
      logger.error(
        {
          vendor: this.vendor,
          modelId: this.config.modelId,
          error,
        },
        'AI generation failed'
      )
      throw error
    }
  }

  /**
   * 流式生成并记录成本
   * 注意：流式生成需要特殊处理
   */
  async *generateStream(
    prompt: string,
    params?: GenerationParams
  ): AsyncGenerator<string> {
    // 1. 先检查配额
    const quotaCheck = await canProceedWithGeneration(this.userId)
    if (!quotaCheck.allowed) {
      throw new Error(quotaCheck.reason || 'Quota exceeded')
    }

    const startTime = Date.now()
    const tokens: string[] = []

    try {
      // 执行流式生成
      for await (const token of this.provider.generateStream(prompt, params)) {
        tokens.push(token)
        yield token
      }

      const completion = tokens.join('')

      // 记录成本记录使用
      await this.recordUsageFromContent(prompt, completion)

      logger.info(
        {
          vendor: this.vendor,
          modelId: this.config.modelId,
          duration: Date.now() - startTime,
          tokens: estimateTokens(prompt) + estimateTokens(completion),
        },
        'AI stream generation completed'
      )

    } catch (error) {
      logger.error(
        {
          vendor: this.vendor,
          modelId: this.config.modelId,
          error,
        },
        'AI stream generation failed'
      )
      throw error
    }
  }

  /**
   * 图片生成并记录成本
   */
  async generateImage(
    prompt: string,
    params?: ImageGenerationParams
  ): Promise<ImageGenerationResult> {
    // 1. 先检查配额
    const quotaCheck = await canProceedWithGeneration(this.userId)
    if (!quotaCheck.allowed) {
      throw new Error(quotaCheck.reason || 'Quota exceeded')
    }

    const startTime = Date.now()
    try {
      // 检查 provider 是否支持图片生成
      if (!('generateImage' in this.provider) || typeof this.provider.generateImage !== 'function') {
        throw new Error(`Provider ${this.provider.name} does not support image generation`)
      }

      const result = await (this.provider as any).generateImage(prompt, params)

      // 记录图片生成的使用量（估算）
      await this.recordImageUsage(prompt, params)

      logger.info(
        {
          vendor: this.vendor,
          modelId: this.config.modelId,
          duration: Date.now() - startTime,
        },
        'AI image generation completed with cost tracking'
      )

      return result
    } catch (error) {
      logger.error(
        {
          vendor: this.vendor,
          modelId: this.config.modelId,
          error,
        },
        'AI image generation failed'
      )
      throw error
    }
  }

  async embedText(text: string, params?: EmbeddingParams): Promise<number[]> {
    if (!this.provider.embedText) {
      throw new Error(`Provider ${this.provider.name} does not support embeddings`)
    }

    const startTime = Date.now()
    try {
      const embedding = await this.provider.embedText(text, params)

      await recordUsage({
        userId: this.userId,
        projectId: this.projectId,
        vendor: this.config.vendor,
        modelId: params?.modelId || this.config.embeddingModelId || this.config.modelId,
        usageType: this.usageType,
        promptTokens: estimateTokens(text),
        completionTokens: 0,
      })

      logger.info(
        {
          vendor: this.vendor,
          modelId: params?.modelId || this.config.embeddingModelId || this.config.modelId,
          duration: Date.now() - startTime,
        },
        'AI embedding completed with cost tracking'
      )

      return embedding
    } catch (error) {
      logger.error(
        {
          vendor: this.vendor,
          modelId: params?.modelId || this.config.embeddingModelId || this.config.modelId,
          error,
        },
        'AI embedding failed'
      )
      throw error
    }
  }

  private async recordUsage(
    prompt: string,
    result: GenerationResult
  ): Promise<void> {
    try {
      await recordUsage({
        userId: this.userId,
        projectId: this.projectId,
        vendor: this.config.vendor,
        modelId: this.config.modelId,
        usageType: this.usageType,
        promptTokens: result.promptTokens || estimateTokens(prompt),
        completionTokens: result.completionTokens || estimateTokens(result.content),
      })
    } catch (error) {
      logger.warn(
        { error },
        'Failed to record AI usage'
      )
    }
  }

  private async recordUsageFromContent(
    prompt: string,
    completion: string
  ): Promise<void> {
    try {
      await recordUsage({
        userId: this.userId,
        projectId: this.projectId,
        vendor: this.config.vendor,
        modelId: this.config.modelId,
        usageType: this.usageType,
        promptTokens: estimateTokens(prompt),
        completionTokens: estimateTokens(completion),
      })
    } catch (error) {
      logger.warn(
        { error },
        'Failed to record AI usage from content'
      )
    }
  }

  private async recordImageUsage(
    prompt: string,
    params?: ImageGenerationParams
  ): Promise<void> {
    try {
      // 估算图片生成的 token 消耗（DALL-E 3 图片约为 200 tokens）
      const estimatedTokens = 200 * (params?.numImages || 1)

      await recordUsage({
        userId: this.userId,
        projectId: this.projectId,
        vendor: this.config.vendor,
        modelId: 'dall-e-3',
        usageType: 'IMAGE_GENERATION',
        promptTokens: estimateTokens(prompt),
        completionTokens: estimatedTokens,
      })
    } catch (error) {
      logger.warn(
        { error },
        'Failed to record AI image usage'
      )
    }
  }

  setConfig(config: AIConfig): void {
    this.config = config
    this.provider.setConfig(config)
  }

  getConfig(): AIConfig | null {
    return this.config
  }

  validateConfig(config: AIConfig): boolean {
    return this.provider.validateConfig(config)
  }
}

/**
 * 创建可追踪成本的 Provider
 */
export function createTraceableProvider(
  provider: BaseAIProvider,
  config: AIConfig,
  options?: {
    userId?: number
    projectId?: number | null
    usageType?: string
  }
): AIProvider {
  return new TraceableAIProvider(provider, config, options)
}

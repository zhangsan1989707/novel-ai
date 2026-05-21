import { AIVendor } from '@/types'
import { logger } from '../logger'
import { getAIProvider } from '../ai/factory'

// ================================
// 重试与降级配置
// ================================

export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitter: boolean
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeoutMs: number
}

export interface FallbackConfig {
  fallbackVendors: AIVendor[]
  useDefaultFallback: boolean
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 300000 // 5 分钟
}

export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  fallbackVendors: [
    AIVendor.ALIBABA,
    AIVendor.OPENAI,
    AIVendor.ANTHROPIC,
    AIVendor.MINIMAX,
    AIVendor.MIMO,
    AIVendor.VOLCENGINE
  ],
  useDefaultFallback: true
}

// ================================
// 熔断器状态
// ================================

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitStatus {
  state: CircuitState
  failureCount: number
  lastFailureTime: number | null
}

// 全局熔断器状态
const circuitBreakers = new Map<AIVendor, CircuitStatus>()

// ================================
// 重试与降级管理器
// ================================

export class AIInvocationManager {
  private retryConfig: RetryConfig
  private circuitConfig: CircuitBreakerConfig
  private fallbackConfig: FallbackConfig

  constructor(
    options: {
      retry?: Partial<RetryConfig>
      circuitBreaker?: Partial<CircuitBreakerConfig>
      fallback?: Partial<FallbackConfig>
    } = {}
  ) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retry }
    this.circuitConfig = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...options.circuitBreaker }
    this.fallbackConfig = { ...DEFAULT_FALLBACK_CONFIG, ...options.fallback }
  }

  // ================================
  // 熔断器管理
  // ================================

  private getCircuitStatus(vendor: AIVendor): CircuitStatus {
    if (!circuitBreakers.has(vendor)) {
      circuitBreakers.set(vendor, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null
      })
    }
    return circuitBreakers.get(vendor)!
  }

  private recordSuccess(vendor: AIVendor): void {
    const status = this.getCircuitStatus(vendor)
    status.state = 'CLOSED'
    status.failureCount = 0
    status.lastFailureTime = null
  }

  private recordFailure(vendor: AIVendor): void {
    const status = this.getCircuitStatus(vendor)
    status.failureCount++
    status.lastFailureTime = Date.now()

    if (status.failureCount >= this.circuitConfig.failureThreshold) {
      status.state = 'OPEN'
      logger.warn(
        { vendor, failureCount: status.failureCount },
        'Circuit breaker OPENED'
      )
    }
  }

  private isCircuitOpen(vendor: AIVendor): boolean {
    const status = this.getCircuitStatus(vendor)
    
    if (status.state === 'OPEN') {
      // 检查是否过了重置时间
      if (status.lastFailureTime &&
          Date.now() - status.lastFailureTime >= this.circuitConfig.resetTimeoutMs) {
        status.state = 'HALF_OPEN'
        logger.info({ vendor }, 'Circuit breaker HALF_OPEN')
        return false
      }
      return true
    }
    
    return false
  }

  // ================================
  // 重试策略 - 指数退避
  // ================================

  private calculateRetryDelay(attempt: number): number {
    const delay = this.retryConfig.initialDelayMs * 
      Math.pow(this.retryConfig.backoffMultiplier, attempt)
    
    // 加上抖动
    let jitteredDelay = delay
    if (this.retryConfig.jitter) {
      jitteredDelay = delay * (0.5 + Math.random())
    }
    
    return Math.min(jitteredDelay, this.retryConfig.maxDelayMs)
  }

  // ================================
  // 带重试的 AI 调用
  // ================================

  async invokeWithRetry<T>(
    vendor: AIVendor,
    modelId: string,
    invoke: () => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // 检查熔断器
        if (this.isCircuitOpen(vendor)) {
          throw new Error(`Circuit breaker OPEN for ${vendor}`)
        }

        const result = await invoke()
        this.recordSuccess(vendor)
        
        logger.info(
          { vendor, modelId, attempt },
          'AI invocation SUCCESS'
        )
        
        return result
      } catch (error) {
        lastError = error as Error
        this.recordFailure(vendor)

        logger.warn(
          { vendor, modelId, attempt, error },
          'AI invocation FAILED'
        )

        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.calculateRetryDelay(attempt)
          logger.info({ delay, attempt }, 'Waiting before retry')
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError
  }

  // ================================
  // 带降级的 AI 调用
  // ================================

  async invokeWithFallback<T>(
    primaryVendor: AIVendor,
    modelId: string,
    invoke: (vendor: AIVendor, modelId: string) => Promise<T>,
    customFallbackVendors?: AIVendor[]
  ): Promise<{ vendor: AIVendor; result: T }> {
    const vendorsToTry = [
      primaryVendor,
      ...(customFallbackVendors || this.fallbackConfig.fallbackVendors)
    ]

    for (const vendor of vendorsToTry) {
      // 跳过熔断器打开的供应商
      if (this.isCircuitOpen(vendor)) {
        logger.info({ vendor }, 'Skipping vendor - circuit breaker OPEN')
        continue
      }

      try {
        logger.info({ vendor, modelId }, 'Trying AI provider')
        const result = await this.invokeWithRetry(vendor, modelId, () => 
          invoke(vendor, modelId)
        )
        return { vendor, result }
      } catch (error) {
        logger.warn(
          { vendor, modelId, error },
          'AI provider FAILED, trying next fallback'
        )
      }
    }

    throw new Error('All AI providers failed')
  }

  // ================================
  // 便捷方法：文本生成
  // ================================

  async generateTextWithResilience(
    prompt: string,
    vendor: AIVendor,
    modelId: string,
    options?: {
      customFallbackVendors?: AIVendor[]
    }
  ): Promise<{ vendor: AIVendor; text: string }> {
    const { vendor: usedVendor, result: text } = await this.invokeWithFallback(
      vendor,
      modelId,
      async (selectedVendor, selectedModelId) => {
        const provider = getAIProvider(selectedVendor, {
          vendor: selectedVendor,
          modelId: selectedModelId,
          apiKey: ''
        })
        const result = await provider.generate(prompt)
        return result.content
      },
      options?.customFallbackVendors
    )

    return { vendor: usedVendor, text }
  }

  // ================================
  // 状态查询
  // ================================

  getCircuitBreakerStatus(vendor: AIVendor): CircuitStatus {
    return this.getCircuitStatus(vendor)
  }

  getAllCircuitBreakerStatus(): Map<AIVendor, CircuitStatus> {
    return new Map(circuitBreakers)
  }

  resetCircuitBreaker(vendor: AIVendor): void {
    circuitBreakers.delete(vendor)
    logger.info({ vendor }, 'Circuit breaker RESET')
  }

  resetAllCircuitBreakers(): void {
    circuitBreakers.clear()
    logger.info('All circuit breakers RESET')
  }
}

// ================================
// 导出单例实例
// ================================

export const aiInvocationManager = new AIInvocationManager()

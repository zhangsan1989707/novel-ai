/**
 * AI 模型对比功能
 * 支持多模型并行生成并对比结果
 */

import { AIVendor } from '@/types'
import { getAIProvider } from './factory'
import { logger } from '@/lib/logger'

// ============================================
// 类型定义
// ============================================

/**
 * 模型对比配置
 */
export interface ModelCompareConfig {
  vendors: AIVendor[] // 要对比的模型列表
  prompt: string // 生成 prompt
  options?: {
    temperature?: number
    maxTokens?: number
    timeout?: number // 单个模型超时(ms)
  }
}

/**
 * 单个模型的生成结果
 */
export interface ModelResult {
  vendor: AIVendor
  modelId: string
  success: boolean
  content?: string
  duration: number // 耗时(ms)
  tokens?: number
  error?: string
  score?: {
    overall: number
    dimensions: Record<string, number>
  }
}

/**
 * 对比结果
 */
export interface CompareResult {
  results: ModelResult[]
  bestModel: AIVendor
  bestScore: number
  summary: {
    totalModels: number
    successCount: number
    averageDuration: number
    averageScore: number
  }
  timestamp: string
}

/**
 * 对比选项
 */
export interface CompareOptions {
  parallel: boolean // 是否并行生成
  timeout: number // 单个模型超时(ms)
  autoScore: boolean // 是否自动评分
  maxRetries: number // 最大重试次数
}

// ============================================
// 模型对比器
// ============================================

/**
 * AI 模型对比器
 */
export class ModelComparator {
  private defaultOptions: CompareOptions = {
    parallel: true,
    timeout: 120000, // 2 分钟
    autoScore: true,
    maxRetries: 2,
  }

  constructor(options?: Partial<CompareOptions>) {
    this.defaultOptions = { ...this.defaultOptions, ...options }
  }

  /**
   * 对比多个模型的生成结果
   */
  async compare(
    config: ModelCompareConfig
  ): Promise<CompareResult> {
    const options = this.defaultOptions
    const results: ModelResult[] = []
    const startTime = Date.now()

    logger.info({ vendors: config.vendors }, 'Starting model comparison')

    // 并行或串行生成
    if (options.parallel) {
      const promises = config.vendors.map(vendor =>
        this.generateWithModel(vendor, config.prompt, config.options)
      )
      const settled = await Promise.allSettled(promises)
      
      for (let i = 0; i < settled.length; i++) {
        const result = settled[i]
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push({
            vendor: config.vendors[i],
            modelId: '',
            success: false,
            error: result.reason?.message || 'Unknown error',
            duration: 0,
          })
        }
      }
    } else {
      // 串行执行
      for (const vendor of config.vendors) {
        const result = await this.generateWithModel(vendor, config.prompt, config.options)
        results.push(result)
      }
    }

    // 找出最佳模型
    const successfulResults = results.filter(r => r.success && r.score)
    const bestResult = successfulResults.sort((a, b) => 
      (b.score?.overall || 0) - (a.score?.overall || 0)
    )[0]

    // 计算统计
    const successCount = results.filter(r => r.success).length
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length
    const avgScore = successfulResults.length > 0
      ? successfulResults.reduce((sum, r) => sum + (r.score?.overall || 0), 0) / successfulResults.length
      : 0

    const compareResult: CompareResult = {
      results,
      bestModel: bestResult?.vendor || config.vendors[0],
      bestScore: bestResult?.score?.overall || 0,
      summary: {
        totalModels: config.vendors.length,
        successCount,
        averageDuration: Math.round(avgDuration),
        averageScore: Math.round(avgScore),
      },
      timestamp: new Date().toISOString(),
    }

    logger.info({
      bestModel: compareResult.bestModel,
      successCount,
      totalDuration: Date.now() - startTime,
    }, 'Model comparison completed')

    return compareResult
  }

  /**
   * 使用单个模型生成
   */
  private async generateWithModel(
    vendor: AIVendor,
    prompt: string,
    options?: {
      temperature?: number
      maxTokens?: number
    }
  ): Promise<ModelResult> {
    const startTime = Date.now()
    let lastError: Error | undefined

    for (let retry = 0; retry < this.defaultOptions.maxRetries; retry++) {
      try {
        const config = {
          vendor,
          modelId: '',
          apiKey: ''
        }
        const provider = getAIProvider(vendor, config)
        const tokens: string[] = []

        // 带超时的生成
        const timeoutPromise = new Promise<'timeout'>((resolve) => {
          setTimeout(() => resolve('timeout'), this.defaultOptions.timeout)
        })

        const generatePromise = (async () => {
          for await (const token of provider.generateStream(prompt, {
            temperature: options?.temperature ?? 0.7,
          })) {
            tokens.push(token)
          }
          return tokens.join('')
        })()

        const content = await Promise.race([generatePromise, timeoutPromise])

        if (content === 'timeout') {
          throw new Error(`Generation timeout after ${this.defaultOptions.timeout}ms`)
        }

        const duration = Date.now() - startTime

        return {
          vendor,
          modelId: '',
          success: true,
          content,
          duration,
          tokens: tokens.length,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        logger.warn({ vendor, retry, error: lastError.message }, 'Model generation failed')
        
        if (retry < this.defaultOptions.maxRetries - 1) {
          await this.delay(1000 * (retry + 1)) // 指数退避
        }
      }
    }

    return {
      vendor,
      modelId: '',
      success: false,
      error: lastError?.message || 'Max retries exceeded',
      duration: Date.now() - startTime,
    }
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ============================================
// 便捷函数
// ============================================

/**
 * 快速对比函数
 */
export async function quickCompare(
  prompt: string,
  vendors?: AIVendor[]
): Promise<CompareResult> {
  const defaultVendors = vendors || [
    AIVendor.DEEPSEEK,
    AIVendor.OPENAI,
    AIVendor.ANTHROPIC,
  ]

  const comparator = new ModelComparator()
  return comparator.compare({
    vendors: defaultVendors,
    prompt,
    options: {
      temperature: 0.7,
      maxTokens: 4000,
      timeout: 120000,
    },
  })
}

/**
 * 获取模型显示名称
 */
export function getVendorDisplayName(vendor: AIVendor): string {
  const names: Record<AIVendor, string> = {
    [AIVendor.OPENAI]: 'OpenAI GPT',
    [AIVendor.ANTHROPIC]: 'Anthropic Claude',
    [AIVendor.ALIBABA]: '阿里云通义千问',
    [AIVendor.DEEPSEEK]: 'DeepSeek',
    [AIVendor.MINIMAX]: 'MiniMax',
    [AIVendor.VOLCENGINE]: '火山引擎',
  }
  return names[vendor] || vendor
}

/**
 * 格式化对比结果
 */
export function formatCompareResult(result: CompareResult): string {
  const lines: string[] = []

  lines.push('===== AI 模型对比报告 =====')
  lines.push(`时间: ${result.timestamp}`)
  lines.push('')
  lines.push('--- 统计摘要 ---')
  lines.push(`测试模型数: ${result.summary.totalModels}`)
  lines.push(`成功数: ${result.summary.successCount}`)
  lines.push(`平均耗时: ${Math.round(result.summary.averageDuration / 1000)}s`)
  lines.push(`平均评分: ${result.summary.averageScore}`)
  lines.push('')
  lines.push(`最佳模型: ${getVendorDisplayName(result.bestModel)} (${result.bestScore}分)`)
  lines.push('')
  lines.push('--- 各模型结果 ---')

  for (const modelResult of result.results) {
    const status = modelResult.success ? '✅' : '❌'
    lines.push(`${status} ${getVendorDisplayName(modelResult.vendor)}`)
    lines.push(`   耗时: ${Math.round(modelResult.duration / 1000)}s`)
    if (modelResult.tokens) {
      lines.push(`   Token: ${modelResult.tokens}`)
    }
    if (modelResult.score) {
      lines.push(`   评分: ${modelResult.score.overall}`)
    }
    if (modelResult.error) {
      lines.push(`   错误: ${modelResult.error}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * 选择最佳模型
 */
export function selectBestModel(result: CompareResult): ModelResult {
  const successful = result.results.filter(r => r.success)
  
  if (successful.length === 0) {
    throw new Error('No model generated successfully')
  }

  // 按评分排序，评分相同则按速度排序
  return successful.sort((a, b) => {
    const scoreDiff = (b.score?.overall || 0) - (a.score?.overall || 0)
    if (scoreDiff !== 0) return scoreDiff
    return a.duration - b.duration
  })[0]
}

// ============================================
// 单例导出
// ============================================

export const modelComparator = new ModelComparator()

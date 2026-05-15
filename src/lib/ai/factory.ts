import { AIProviderFactory, BaseAIProvider } from './base'
import type { AIProvider, AIConfig } from './types'
import { AIVendor } from '@/types'

// 导入所有 Provider
import {
  OpenAIProvider,
  AnthropicProvider,
  AlibabaProvider,
  DeepSeekProvider,
  MiniMaxProvider,
  VolcEngineProvider,
} from './providers'

// 注册所有 Provider
AIProviderFactory.register(AIVendor.OPENAI, OpenAIProvider)
AIProviderFactory.register(AIVendor.ANTHROPIC, AnthropicProvider)
AIProviderFactory.register(AIVendor.ALIBABA, AlibabaProvider)
AIProviderFactory.register(AIVendor.DEEPSEEK, DeepSeekProvider)
AIProviderFactory.register(AIVendor.MINIMAX, MiniMaxProvider)
AIProviderFactory.register(AIVendor.VOLCENGINE, VolcEngineProvider)

// 导出工厂和 Provider
export { AIProviderFactory } from './base'
export type { AIProvider, AIConfig } from './types'

// 默认 Provider 实例缓存
const providerCache: Map<string, AIProvider> = new Map()

/**
 * 获取 AI Provider 实例
 */
export function getAIProvider(vendor: AIVendor, config?: AIConfig): AIProvider {
  const cacheKey = `${vendor}-${config?.apiKey || 'default'}`

  if (!providerCache.has(cacheKey)) {
    const provider = AIProviderFactory.create(vendor)
    if (config) {
      (provider as unknown as BaseAIProvider).setConfig(config)
    }
    providerCache.set(cacheKey, provider)
  }

  return providerCache.get(cacheKey)!
}

/**
 * 从环境变量创建 Provider（使用指定 vendor）
 */
export function createProviderFromEnv(vendor: AIVendor): AIProvider {
  const config = createConfigFromEnv(vendor)
  return getAIProvider(vendor, config)
}

/**
 * 从数据库获取默认 AI Provider
 * 优先从数据库中查找 isDefault=true 的配置，如果没有则回退到环境变量
 */
export async function createProviderFromDefaultConfig(): Promise<AIProvider> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const defaultConfig = await prisma.aIModelConfig.findFirst({
      where: { isDefault: true },
    })

    if (defaultConfig) {
      return getAIProvider(defaultConfig.vendor as AIVendor, {
        vendor: defaultConfig.vendor as AIVendor,
        modelId: defaultConfig.modelId,
        apiKey: defaultConfig.apiKey || '',
        apiEndpoint: defaultConfig.apiEndpoint || undefined,
      })
    }
  } catch (error) {
    console.warn('Failed to get default config from database, falling back to env:', error)
  }

  // 回退到环境变量
  const config = getDefaultAIConfig()
  return getAIProvider(config.vendor, config)
}

/**
 * 从数据库获取指定 ID 的 AI Provider
 */
export async function createProviderFromConfigId(configId: number): Promise<AIProvider | null> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const config = await prisma.aIModelConfig.findUnique({
      where: { id: configId },
    })

    if (config) {
      return getAIProvider(config.vendor as AIVendor, {
        vendor: config.vendor as AIVendor,
        modelId: config.modelId,
        apiKey: config.apiKey || '',
        apiEndpoint: config.apiEndpoint || undefined,
      })
    }
  } catch (error) {
    console.warn('Failed to get config from database:', error)
  }

  return null
}

/**
 * 从环境变量创建配置
 */
function createConfigFromEnv(vendor: AIVendor): AIConfig {
  switch (vendor) {
    case AIVendor.OPENAI:
      return {
        vendor: AIVendor.OPENAI,
        modelId: process.env.OPENAI_MODEL_ID || 'gpt-4o',
        apiKey: process.env.OPENAI_API_KEY || '',
      }
    case AIVendor.ANTHROPIC:
      return {
        vendor: AIVendor.ANTHROPIC,
        modelId: process.env.ANTHROPIC_MODEL_ID || 'claude-3-5-sonnet-20241022',
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      }
    case AIVendor.ALIBABA:
      return {
        vendor: AIVendor.ALIBABA,
        modelId: process.env.DASHSCOPE_MODEL_ID || 'qwen-max',
        apiKey: process.env.DASHSCOPE_API_KEY || '',
      }
    case AIVendor.DEEPSEEK:
      return {
        vendor: AIVendor.DEEPSEEK,
        modelId: process.env.DEEPSEEK_MODEL_ID || 'deepseek-chat',
        apiKey: process.env.DEEPSEEK_API_KEY || '',
      }
    case AIVendor.MINIMAX:
      return {
        vendor: AIVendor.MINIMAX,
        modelId: process.env.MINIMAX_MODEL_ID || 'MiniMax-Text-01',
        apiKey: process.env.MINIMAX_API_KEY || '',
      }
    case AIVendor.VOLCENGINE:
      return {
        vendor: AIVendor.VOLCENGINE,
        modelId: process.env.VOLCENGINE_MODEL_ID || 'doubao-pro-32k',
        apiKey: process.env.VOLCENGINE_API_KEY || '',
      }
    default:
      throw new Error(`Unsupported vendor: ${vendor}`)
  }
}

/**
 * 获取默认 AI Vendor
 * 通过 DEFAULT_AI_VENDOR 环境变量配置，默认为 DEEPSEEK
 */
export function getDefaultVendor(): AIVendor {
  const envVendor = process.env.DEFAULT_AI_VENDOR?.toUpperCase()
  if (envVendor && Object.values(AIVendor).includes(envVendor as AIVendor)) {
    return envVendor as AIVendor
  }
  return AIVendor.DEEPSEEK // 默认为 DeepSeek
}

/**
 * 获取默认 AI 配置（模型ID和API Key）
 * 通过环境变量配置：
 * - DEFAULT_AI_MODEL_ID: 模型ID（如 glm-5.1）
 * - DEFAULT_AI_API_KEY: API Key（可选，不提供则使用 vendor 对应的默认 key）
 * - DEFAULT_AI_VENDOR: AI供应商（可选，不提供则根据已配置的 key 自动推断）
 */
export function getDefaultAIConfig(): { vendor: AIVendor; modelId: string; apiKey: string } {
  const modelId = process.env.DEFAULT_AI_MODEL_ID
  const apiKey = process.env.DEFAULT_AI_API_KEY

  if (modelId) {
    // 如果指定了模型ID，尝试推断 vendor
    // 优先使用 apiKey（如果提供），否则根据 DEFAULT_AI_VENDOR 或默认 vendor
    const vendor = getDefaultVendor()

    // 如果提供了独立的 API key，直接返回
    if (apiKey) {
      return { vendor, modelId, apiKey }
    }

    // 否则使用对应 vendor 的默认 API key
    const config = createConfigFromEnv(vendor)
    return { vendor, modelId, apiKey: config.apiKey }
  }

  // 没有指定模型ID，使用 vendor 默认配置
  const vendor = getDefaultVendor()
  const config = createConfigFromEnv(vendor)
  return { vendor, modelId: config.modelId, apiKey: config.apiKey }
}

/**
 * 获取支持的 AI 提供商列表
 */
export function getSupportedAIProviders(): { vendor: AIVendor; name: string }[] {
  return [
    { vendor: AIVendor.OPENAI, name: 'OpenAI (GPT系列)' },
    { vendor: AIVendor.ANTHROPIC, name: 'Anthropic (Claude系列)' },
    { vendor: AIVendor.ALIBABA, name: '阿里云 (通义千问)' },
    { vendor: AIVendor.DEEPSEEK, name: 'DeepSeek' },
    { vendor: AIVendor.MINIMAX, name: 'MiniMax' },
    { vendor: AIVendor.VOLCENGINE, name: '火山引擎 (字节跳动)' },
  ]
}

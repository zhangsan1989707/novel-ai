import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getTraceableAIProvider, getDefaultVendor } from './factory'
import type { AIProvider, AIConfig } from './types'
import { AIVendor } from '@/types'
import { auth } from '@/lib/auth'

// 获取当前用户（开发模式返回默认用户）
async function getCurrentUserId() {
  const session = await auth()
  if (session?.user?.id) {
    return parseInt(session.user.id)
  }
  // 开发模式：尝试获取或创建默认用户
  try {
    let user = await prisma.user.findFirst()
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'dev@localhost',
          name: '开发用户',
          password: 'dev-password',
        },
      })
    }
    return user.id
  } catch {
    // 如果数据库也失败，返回一个默认 ID
    return 1
  }
}

export interface GenerateOptions {
  userId?: number
  projectId?: number | null
  usageType?: string
}

/**
 * AI 生成服务
 */
export class AIService {
  private static attachEmbeddingConfig(config: AIConfig): AIConfig {
    const embeddingVendor = this.resolveEmbeddingVendor(config.vendor, config.embeddingVendor)
    const defaultEmbeddingConfig = this.getDefaultConfig(embeddingVendor)
    const embeddingDimensions = Number(
      config.embeddingDimensions
      || defaultEmbeddingConfig.embeddingDimensions
      || process.env.AI_EMBEDDING_DIMENSIONS
      || 256
    )
    const embeddingModelId = config.embeddingModelId
      || defaultEmbeddingConfig.embeddingModelId
      || this.resolveEmbeddingModelId(embeddingVendor, config.modelId)
    const embeddingApiKey = config.embeddingApiKey
      || defaultEmbeddingConfig.embeddingApiKey
      || config.apiKey
    const embeddingApiEndpoint = config.embeddingApiEndpoint
      || defaultEmbeddingConfig.embeddingApiEndpoint
      || defaultEmbeddingConfig.apiEndpoint

    return {
      ...config,
      embeddingVendor,
      embeddingApiKey,
      embeddingApiEndpoint,
      embeddingModelId,
      embeddingDimensions: Number.isFinite(embeddingDimensions) && embeddingDimensions > 0
        ? embeddingDimensions
        : 256,
    }
  }

  private static resolveEmbeddingModelId(vendor: AIVendor, modelId: string): string | undefined {
    const genericEmbeddingModel = process.env.EMBEDDING_MODEL_ID
    if (genericEmbeddingModel) return genericEmbeddingModel

    const vendorKey = `${vendor.toUpperCase()}_EMBEDDING_MODEL_ID`
    const vendorEmbeddingModel = process.env[vendorKey]
    if (vendorEmbeddingModel) return vendorEmbeddingModel

    if (vendor === AIVendor.OPENAI) {
      return process.env.OPENAI_EMBEDDING_MODEL_ID || 'text-embedding-3-small'
    }

    if (modelId.toLowerCase().includes('embedding')) {
      return modelId
    }

    return undefined
  }

  /**
   * 创建可追踪成本的 Provider
   */
  static async createProvider(
    options?: {
      projectId?: number | null
      configId?: number
      vendor?: AIVendor
    } & GenerateOptions
  ): Promise<AIProvider> {
    const { projectId, configId, vendor: preferredVendor } = options || {}
    const userId = options?.userId || (await getCurrentUserId())

    let config: AIConfig | null = null

    // 1. 尝试从项目配置获取
    if (projectId) {
      const project = await prisma.novelProject.findUnique({
        where: { id: projectId },
        include: { aiModelConfig: true },
      })

      if (project && project.aiModelConfig) {
        config = {
          vendor: project.aiModelConfig.vendor as AIVendor,
          modelId: project.aiModelConfig.modelId,
          apiKey: project.aiModelConfig.apiKey || '',
          apiEndpoint: project.aiModelConfig.apiEndpoint || undefined,
          embeddingVendor: project.aiModelConfig.embeddingVendor as AIVendor | undefined,
          embeddingApiKey: project.aiModelConfig.embeddingApiKey || undefined,
          embeddingApiEndpoint: project.aiModelConfig.embeddingApiEndpoint || undefined,
          embeddingModelId: project.aiModelConfig.embeddingModelId || undefined,
          embeddingDimensions: project.aiModelConfig.embeddingDimensions || undefined,
        }
      }
    }

    // 2. 如果指定 configId，使用该配置
    if (!config && configId) {
      const dbConfig = await prisma.aIModelConfig.findUnique({
        where: { id: configId },
      })

      if (dbConfig) {
        config = {
          vendor: dbConfig.vendor as AIVendor,
          modelId: dbConfig.modelId,
          apiKey: dbConfig.apiKey || '',
          apiEndpoint: dbConfig.apiEndpoint || undefined,
          embeddingVendor: dbConfig.embeddingVendor as AIVendor | undefined,
          embeddingApiKey: dbConfig.embeddingApiKey || undefined,
          embeddingApiEndpoint: dbConfig.embeddingApiEndpoint || undefined,
          embeddingModelId: dbConfig.embeddingModelId || undefined,
          embeddingDimensions: dbConfig.embeddingDimensions || undefined,
        }
      }
    }

    // 3. 如果有指定 vendor，尝试使用默认配置
    if (!config && preferredVendor) {
      try {
        config = this.getDefaultConfig(preferredVendor)
      } catch {
        // 忽略
      }
    }

    // 4. 使用全局默认配置
    if (!config) {
      const defaultConfig = await prisma.aIModelConfig.findFirst({
        where: { isDefault: true },
      })

      if (defaultConfig) {
        config = {
          vendor: defaultConfig.vendor as AIVendor,
          modelId: defaultConfig.modelId,
          apiKey: defaultConfig.apiKey || '',
          apiEndpoint: defaultConfig.apiEndpoint || undefined,
          embeddingVendor: defaultConfig.embeddingVendor as AIVendor | undefined,
          embeddingApiKey: defaultConfig.embeddingApiKey || undefined,
          embeddingApiEndpoint: defaultConfig.embeddingApiEndpoint || undefined,
          embeddingModelId: defaultConfig.embeddingModelId || undefined,
          embeddingDimensions: defaultConfig.embeddingDimensions || undefined,
        }
      }
    }

    // 5. 回退到环境变量配置
    if (!config) {
      config = this.getDefaultConfig(AIVendor.DEEPSEEK)
    }

    config = this.attachEmbeddingConfig(config)

    logger.info(
      { vendor: config.vendor, modelId: config.modelId, projectId },
      'Created AI provider'
    )

    return getTraceableAIProvider(config.vendor, config, {
      userId,
      projectId,
      usageType: options?.usageType,
    })
  }

  /**
   * 创建向量化 Provider
   * 默认优先使用 EMBEDDING_VENDOR/EMBEDDING_MODEL_ID，其次复用项目或默认配置的 vendor
   */
  static async createEmbeddingProvider(
    options?: {
      projectId?: number | null
      configId?: number
      vendor?: AIVendor
    } & GenerateOptions
  ): Promise<AIProvider> {
    const { projectId, configId, vendor: preferredVendor } = options || {}
    const userId = options?.userId || (await getCurrentUserId())

    let config: AIConfig | null = null
    let vendor = this.resolveEmbeddingVendor(preferredVendor)
    const hasExplicitEmbeddingVendor = Boolean(process.env.EMBEDDING_VENDOR)

    if (hasExplicitEmbeddingVendor) {
      config = this.getDefaultConfig(vendor)
    }

    if (!config && projectId) {
      const project = await prisma.novelProject.findUnique({
        where: { id: projectId },
        include: { aiModelConfig: true },
      })

      if (project?.aiModelConfig) {
        const projectVendor = project.aiModelConfig.vendor as AIVendor
        vendor = this.resolveEmbeddingVendor(projectVendor, project.aiModelConfig.embeddingVendor as AIVendor | undefined)
        config = {
          vendor: projectVendor,
          modelId: project.aiModelConfig.modelId,
          apiKey: project.aiModelConfig.apiKey || '',
          apiEndpoint: project.aiModelConfig.apiEndpoint || undefined,
          embeddingVendor: project.aiModelConfig.embeddingVendor as AIVendor | undefined,
          embeddingApiKey: project.aiModelConfig.embeddingApiKey || undefined,
          embeddingApiEndpoint: project.aiModelConfig.embeddingApiEndpoint || undefined,
          embeddingModelId: project.aiModelConfig.embeddingModelId || undefined,
          embeddingDimensions: project.aiModelConfig.embeddingDimensions || undefined,
        }
      }
    }

    if (!config && configId) {
      const dbConfig = await prisma.aIModelConfig.findUnique({
        where: { id: configId },
      })

      if (dbConfig) {
        const dbVendor = dbConfig.vendor as AIVendor
        vendor = this.resolveEmbeddingVendor(dbVendor, dbConfig.embeddingVendor as AIVendor | undefined)
        config = {
          vendor: dbVendor,
          modelId: dbConfig.modelId,
          apiKey: dbConfig.apiKey || '',
          apiEndpoint: dbConfig.apiEndpoint || undefined,
          embeddingVendor: dbConfig.embeddingVendor as AIVendor | undefined,
          embeddingApiKey: dbConfig.embeddingApiKey || undefined,
          embeddingApiEndpoint: dbConfig.embeddingApiEndpoint || undefined,
          embeddingModelId: dbConfig.embeddingModelId || undefined,
          embeddingDimensions: dbConfig.embeddingDimensions || undefined,
        }
      }
    }

    if (!config && preferredVendor) {
      vendor = this.resolveEmbeddingVendor(preferredVendor)
      try {
        config = this.getDefaultConfig(vendor)
      } catch {
        // ignore
      }
    }

    if (!config) {
      const defaultConfig = await prisma.aIModelConfig.findFirst({
        where: { isDefault: true },
      })

      if (defaultConfig) {
        const defaultVendor = defaultConfig.vendor as AIVendor
        vendor = this.resolveEmbeddingVendor(defaultVendor, defaultConfig.embeddingVendor as AIVendor | undefined)
        config = {
          vendor: defaultVendor,
          modelId: defaultConfig.modelId,
          apiKey: defaultConfig.apiKey || '',
          apiEndpoint: defaultConfig.apiEndpoint || undefined,
          embeddingVendor: defaultConfig.embeddingVendor as AIVendor | undefined,
          embeddingApiKey: defaultConfig.embeddingApiKey || undefined,
          embeddingApiEndpoint: defaultConfig.embeddingApiEndpoint || undefined,
          embeddingModelId: defaultConfig.embeddingModelId || undefined,
          embeddingDimensions: defaultConfig.embeddingDimensions || undefined,
        }
      }
    }

    if (!config) {
      vendor = this.resolveEmbeddingVendor(getDefaultVendor())
      config = this.getDefaultConfig(vendor)
    }

    config = this.attachEmbeddingConfig(config)
    const embeddingConfig = this.resolveEmbeddingProviderConfig(config)

    if (!embeddingConfig.embeddingModelId) {
      throw new Error(
        `Embedding model is not configured for vendor ${embeddingConfig.vendor}. Set EMBEDDING_MODEL_ID or ${embeddingConfig.vendor.toUpperCase()}_EMBEDDING_MODEL_ID.`
      )
    }

    logger.info(
      { vendor: embeddingConfig.vendor, modelId: embeddingConfig.embeddingModelId, projectId },
      'Created embedding AI provider'
    )

    return getTraceableAIProvider(embeddingConfig.vendor, embeddingConfig, {
      userId,
      projectId,
      usageType: options?.usageType || 'RAG_EMBEDDING',
    })
  }

  private static resolveEmbeddingProviderConfig(config: AIConfig): AIConfig {
    const embeddingVendor = this.resolveEmbeddingVendor(config.vendor, config.embeddingVendor)
    const defaultEmbeddingConfig = this.getDefaultConfig(embeddingVendor)
    const embeddingModelId = config.embeddingModelId
      || defaultEmbeddingConfig.embeddingModelId
      || this.resolveEmbeddingModelId(embeddingVendor, config.modelId)
    const embeddingApiKey = config.embeddingApiKey
      || defaultEmbeddingConfig.embeddingApiKey
      || config.apiKey
    const embeddingApiEndpoint = config.embeddingApiEndpoint
      || defaultEmbeddingConfig.embeddingApiEndpoint
      || defaultEmbeddingConfig.apiEndpoint
    const embeddingDimensions = Number(
      config.embeddingDimensions
      || defaultEmbeddingConfig.embeddingDimensions
      || process.env.AI_EMBEDDING_DIMENSIONS
      || 256
    )

    return {
      vendor: embeddingVendor,
      modelId: embeddingModelId || defaultEmbeddingConfig.modelId,
      apiKey: embeddingApiKey || '',
      apiEndpoint: embeddingApiEndpoint,
      embeddingVendor,
      embeddingApiKey: embeddingApiKey || '',
      embeddingApiEndpoint,
      embeddingModelId: embeddingModelId || undefined,
      embeddingDimensions: Number.isFinite(embeddingDimensions) && embeddingDimensions > 0
        ? embeddingDimensions
        : 256,
    }
  }

  private static resolveEmbeddingVendor(vendor?: AIVendor, embeddingVendor?: AIVendor): AIVendor {
    const envVendor = process.env.EMBEDDING_VENDOR?.toUpperCase()
    if (envVendor && Object.values(AIVendor).includes(envVendor as AIVendor)) {
      return envVendor as AIVendor
    }

    if (embeddingVendor) {
      return embeddingVendor
    }

    if (vendor && vendor !== AIVendor.ANTHROPIC && vendor !== AIVendor.MIMO) {
      return vendor
    }

    return AIVendor.OPENAI
  }

  /**
   * 从环境变量获取默认配置
   */
  private static getDefaultConfig(vendor: AIVendor): AIConfig {
    switch (vendor) {
      case AIVendor.OPENAI:
        return {
          vendor: AIVendor.OPENAI,
          modelId: process.env.OPENAI_MODEL_ID || 'gpt-4o',
          apiKey: process.env.OPENAI_API_KEY || '',
          embeddingVendor: AIVendor.OPENAI,
          embeddingApiKey: process.env.OPENAI_EMBEDDING_API_KEY || process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || '',
          embeddingApiEndpoint: process.env.OPENAI_API_ENDPOINT || undefined,
          embeddingModelId: process.env.OPENAI_EMBEDDING_MODEL_ID || process.env.EMBEDDING_MODEL_ID || 'text-embedding-3-small',
          embeddingDimensions: Number(process.env.AI_EMBEDDING_DIMENSIONS || 256),
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
          embeddingVendor: AIVendor.ALIBABA,
          embeddingApiKey: process.env.ALIBABA_EMBEDDING_API_KEY || process.env.DASHSCOPE_EMBEDDING_API_KEY || process.env.EMBEDDING_API_KEY || process.env.DASHSCOPE_API_KEY || '',
          embeddingApiEndpoint: process.env.ALIBABA_EMBEDDING_API_ENDPOINT || process.env.DASHSCOPE_EMBEDDING_API_ENDPOINT || undefined,
          embeddingModelId: process.env.ALIBABA_EMBEDDING_MODEL_ID || process.env.EMBEDDING_MODEL_ID,
          embeddingDimensions: Number(process.env.AI_EMBEDDING_DIMENSIONS || 256),
        }
      case AIVendor.MIMO:
        return {
          vendor: AIVendor.MIMO,
          modelId: process.env.MIMO_MODEL_ID || 'mimo-v2.5-pro',
          apiKey: process.env.MIMO_API_KEY || '',
          apiEndpoint: process.env.MIMO_API_ENDPOINT || 'https://token-plan-cn.xiaomimimo.com/v1',
          embeddingVendor: AIVendor.OPENAI,
          embeddingApiKey: process.env.OPENAI_EMBEDDING_API_KEY || process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || '',
        }
      case AIVendor.VOLCENGINE:
        return {
          vendor: AIVendor.VOLCENGINE,
          modelId: process.env.VOLCENGINE_MODEL_ID || 'ark-code-latest',
          apiKey: process.env.VOLCENGINE_API_KEY || '',
          apiEndpoint: process.env.VOLCENGINE_API_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/coding/v3',
          embeddingVendor: AIVendor.VOLCENGINE,
          embeddingApiKey: process.env.VOLCENGINE_EMBEDDING_API_KEY || process.env.EMBEDDING_API_KEY || process.env.VOLCENGINE_API_KEY || '',
          embeddingApiEndpoint: process.env.VOLCENGINE_EMBEDDING_API_ENDPOINT || undefined,
          embeddingModelId: process.env.VOLCENGINE_EMBEDDING_MODEL_ID || process.env.EMBEDDING_MODEL_ID,
          embeddingDimensions: Number(process.env.AI_EMBEDDING_DIMENSIONS || 256),
        }
      case AIVendor.ZHIPU:
        return {
          vendor: AIVendor.ZHIPU,
          modelId: process.env.ZHIPU_MODEL_ID || 'glm-4-0520',
          apiKey: process.env.ZHIPU_API_KEY || '',
          apiEndpoint: process.env.ZHIPU_API_ENDPOINT || 'https://open.bigmodel.cn/api/paas/v4',
          embeddingVendor: AIVendor.ZHIPU,
          embeddingApiKey: process.env.ZHIPU_EMBEDDING_API_KEY || process.env.EMBEDDING_API_KEY || process.env.ZHIPU_API_KEY || '',
          embeddingApiEndpoint: process.env.ZHIPU_EMBEDDING_API_ENDPOINT || undefined,
          embeddingModelId: process.env.ZHIPU_EMBEDDING_MODEL_ID || process.env.EMBEDDING_MODEL_ID,
          embeddingDimensions: Number(process.env.AI_EMBEDDING_DIMENSIONS || 256),
        }
      case AIVendor.DEEPSEEK:
      default:
        return {
          vendor: AIVendor.DEEPSEEK,
          modelId: process.env.DEEPSEEK_MODEL_ID || 'deepseek-chat',
          apiKey: process.env.DEEPSEEK_API_KEY || '',
          embeddingVendor: AIVendor.DEEPSEEK,
          embeddingApiKey: process.env.DEEPSEEK_EMBEDDING_API_KEY || process.env.EMBEDDING_API_KEY || process.env.DEEPSEEK_API_KEY || '',
          embeddingApiEndpoint: process.env.DEEPSEEK_EMBEDDING_API_ENDPOINT || undefined,
          embeddingModelId: process.env.DEEPSEEK_EMBEDDING_MODEL_ID || process.env.EMBEDDING_MODEL_ID,
          embeddingDimensions: Number(process.env.AI_EMBEDDING_DIMENSIONS || 256),
        }
    }
  }
}

export { AIService as default }

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
    const embeddingDimensions = Number(
      config.embeddingDimensions || process.env.AI_EMBEDDING_DIMENSIONS || 256
    )
    const embeddingModelId = this.resolveEmbeddingModelId(config.vendor, config.modelId)

    return {
      ...config,
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
        vendor = this.resolveEmbeddingVendor(projectVendor)
          config = vendor === projectVendor
          ? {
              vendor,
              modelId: project.aiModelConfig.modelId,
              apiKey: project.aiModelConfig.apiKey || '',
              apiEndpoint: project.aiModelConfig.apiEndpoint || undefined,
              embeddingModelId: project.aiModelConfig.embeddingModelId || undefined,
              embeddingDimensions: project.aiModelConfig.embeddingDimensions || undefined,
            }
          : this.getDefaultConfig(vendor)
      }
    }

    if (!config && configId) {
      const dbConfig = await prisma.aIModelConfig.findUnique({
        where: { id: configId },
      })

      if (dbConfig) {
        const dbVendor = dbConfig.vendor as AIVendor
        vendor = this.resolveEmbeddingVendor(dbVendor)
        config = vendor === dbVendor
          ? {
              vendor,
              modelId: dbConfig.modelId,
              apiKey: dbConfig.apiKey || '',
              apiEndpoint: dbConfig.apiEndpoint || undefined,
              embeddingModelId: dbConfig.embeddingModelId || undefined,
              embeddingDimensions: dbConfig.embeddingDimensions || undefined,
            }
          : this.getDefaultConfig(vendor)
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
        vendor = this.resolveEmbeddingVendor(defaultVendor)
        config = vendor === defaultVendor
          ? {
              vendor,
              modelId: defaultConfig.modelId,
              apiKey: defaultConfig.apiKey || '',
              apiEndpoint: defaultConfig.apiEndpoint || undefined,
              embeddingModelId: defaultConfig.embeddingModelId || undefined,
              embeddingDimensions: defaultConfig.embeddingDimensions || undefined,
            }
          : this.getDefaultConfig(vendor)
      }
    }

    if (!config) {
      vendor = this.resolveEmbeddingVendor(getDefaultVendor())
      config = this.getDefaultConfig(vendor)
    }

    config = this.attachEmbeddingConfig(config)

    if (!config.embeddingModelId) {
      throw new Error(
        `Embedding model is not configured for vendor ${config.vendor}. Set EMBEDDING_MODEL_ID or ${config.vendor.toUpperCase()}_EMBEDDING_MODEL_ID.`
      )
    }

    logger.info(
      { vendor: config.vendor, modelId: config.embeddingModelId, projectId },
      'Created embedding AI provider'
    )

    return getTraceableAIProvider(config.vendor, config, {
      userId,
      projectId,
      usageType: options?.usageType || 'RAG_EMBEDDING',
    })
  }

  private static resolveEmbeddingVendor(vendor?: AIVendor): AIVendor {
    const envVendor = process.env.EMBEDDING_VENDOR?.toUpperCase()
    if (envVendor && Object.values(AIVendor).includes(envVendor as AIVendor)) {
      return envVendor as AIVendor
    }

    if (vendor && vendor !== AIVendor.ANTHROPIC) {
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
          embeddingModelId: process.env.ALIBABA_EMBEDDING_MODEL_ID || process.env.EMBEDDING_MODEL_ID,
          embeddingDimensions: Number(process.env.AI_EMBEDDING_DIMENSIONS || 256),
        }
      case AIVendor.VOLCENGINE:
        return {
          vendor: AIVendor.VOLCENGINE,
          modelId: process.env.VOLCENGINE_MODEL_ID || 'ark-code-latest',
          apiKey: process.env.VOLCENGINE_API_KEY || '',
          apiEndpoint: process.env.VOLCENGINE_API_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/coding/v3',
          embeddingModelId: process.env.VOLCENGINE_EMBEDDING_MODEL_ID || process.env.EMBEDDING_MODEL_ID,
          embeddingDimensions: Number(process.env.AI_EMBEDDING_DIMENSIONS || 256),
        }
      case AIVendor.ZHIPU:
        return {
          vendor: AIVendor.ZHIPU,
          modelId: process.env.ZHIPU_MODEL_ID || 'glm-4-0520',
          apiKey: process.env.ZHIPU_API_KEY || '',
          apiEndpoint: process.env.ZHIPU_API_ENDPOINT || 'https://open.bigmodel.cn/api/paas/v4',
          embeddingModelId: process.env.ZHIPU_EMBEDDING_MODEL_ID || process.env.EMBEDDING_MODEL_ID,
          embeddingDimensions: Number(process.env.AI_EMBEDDING_DIMENSIONS || 256),
        }
      case AIVendor.DEEPSEEK:
      default:
        return {
          vendor: AIVendor.DEEPSEEK,
          modelId: process.env.DEEPSEEK_MODEL_ID || 'deepseek-chat',
          apiKey: process.env.DEEPSEEK_API_KEY || '',
          embeddingModelId: process.env.DEEPSEEK_EMBEDDING_MODEL_ID || process.env.EMBEDDING_MODEL_ID,
          embeddingDimensions: Number(process.env.AI_EMBEDDING_DIMENSIONS || 256),
        }
    }
  }
}

export { AIService as default }

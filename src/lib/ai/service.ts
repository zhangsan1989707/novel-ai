import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getTraceableAIProvider } from './factory'
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
        }
      }
    }

    // 5. 回退到环境变量配置
    if (!config) {
      config = this.getDefaultConfig(AIVendor.DEEPSEEK)
    }

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
   * 从环境变量获取默认配置
   */
  private static getDefaultConfig(vendor: AIVendor): AIConfig {
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
      case AIVendor.VOLCENGINE:
        return {
          vendor: AIVendor.VOLCENGINE,
          modelId: process.env.VOLCENGINE_MODEL_ID || 'ark-code-latest',
          apiKey: process.env.VOLCENGINE_API_KEY || '',
          apiEndpoint: process.env.VOLCENGINE_API_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/coding/v3',
        }
      case AIVendor.DEEPSEEK:
      default:
        return {
          vendor: AIVendor.DEEPSEEK,
          modelId: process.env.DEEPSEEK_MODEL_ID || 'deepseek-chat',
          apiKey: process.env.DEEPSEEK_API_KEY || '',
        }
    }
  }
}

export { AIService as default }

import type { AIModelConfig } from '@prisma/client'
import { getCurrentUserId, auth } from '@/lib/auth'

export type SafeAIModelConfig = Omit<AIModelConfig, 'apiKey' | 'embeddingApiKey'> & {
  hasApiKey: boolean
  apiKeyPreview: string | null
  hasEmbeddingApiKey: boolean
  embeddingApiKeyPreview: string | null
}

function previewSecret(value: string | null | undefined): string | null {
  const secret = value?.trim()
  if (!secret) {
    return null
  }

  if (secret.length <= 8) {
    return `${secret.slice(0, 2)}...${secret.slice(-2)}`
  }

  return `${secret.slice(0, 4)}...${secret.slice(-4)}`
}

export function redactAIConfig(config: AIModelConfig): SafeAIModelConfig {
  const { apiKey, embeddingApiKey, ...safeConfig } = config

  return {
    ...safeConfig,
    hasApiKey: Boolean(apiKey?.trim()),
    apiKeyPreview: previewSecret(apiKey),
    hasEmbeddingApiKey: Boolean(embeddingApiKey?.trim()),
    embeddingApiKeyPreview: previewSecret(embeddingApiKey),
  }
}

export async function getAuthorizedAIConfigUserId(): Promise<number | null> {
  try {
    return await getCurrentUserId()
  } catch {
    return null
  }
}

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export async function requireAdmin(): Promise<boolean> {
  if (ADMIN_EMAILS.length === 0) {
    return true
  }

  const session = await auth()
  const email = session?.user?.email?.toLowerCase()
  return !!email && ADMIN_EMAILS.includes(email)
}

export function getSafeAIProviderErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''

  if (message.includes('401')) {
    return 'API Key 无效或已过期'
  }
  if (message.includes('403')) {
    return 'API Key 权限不足'
  }
  if (message.includes('429')) {
    return '请求过于频繁，请稍后重试'
  }
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return 'AI 服务端错误，请稍后重试'
  }
  if (message.includes('fetch') || message.includes('network')) {
    return '网络连接失败，请检查网络或 API 端点'
  }

  return 'API 调用失败'
}

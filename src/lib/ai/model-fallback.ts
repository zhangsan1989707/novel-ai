import type { AIProvider } from './types'

type AgentCategory = 'planner' | 'writer' | 'validator' | 'summarizer' | 'deslopper' | 'polisher'

interface FallbackResult<T> {
  success: boolean
  result?: T
  error?: string
  attempts: number
  finalModel?: string
  degraded: boolean
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000
const TIMEOUT_MS = 120000

function getTimeoutForAgent(agentType: AgentCategory): number {
  switch (agentType) {
    case 'planner': return 180000
    case 'writer': return 300000
    case 'validator': return 60000
    case 'summarizer': return 60000
    case 'deslopper': return 120000
    case 'polisher': return 120000
    default: return TIMEOUT_MS
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function executeWithFallback<T>(
  agentType: AgentCategory,
  primaryProvider: AIProvider,
  fallbackProvider: AIProvider | null,
  fn: (provider: AIProvider) => Promise<T>
): Promise<FallbackResult<T>> {
  const timeoutMs = getTimeoutForAgent(agentType)
  let lastError: string | undefined
  let degraded = false

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`操作超时 (${timeoutMs}ms)`)), timeoutMs)
      )

      const result = await Promise.race([fn(primaryProvider), timeoutPromise])
      return { success: true, result, attempts: attempt, finalModel: 'primary', degraded }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      console.error(`[Fallback] ${agentType} attempt ${attempt}/${MAX_RETRIES} failed:`, lastError)

      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * attempt)
      }
    }
  }

  if (fallbackProvider) {
    console.warn(`[Fallback] ${agentType} 降级到备用模型`)
    degraded = true

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const timeoutMsFallback = getTimeoutForAgent(agentType)
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`备用模型超时 (${timeoutMsFallback}ms)`)), timeoutMsFallback)
        )

        const result = await Promise.race([fn(fallbackProvider), timeoutPromise])
        return { success: true, result, attempts: MAX_RETRIES + attempt, finalModel: 'fallback', degraded }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        console.error(`[Fallback] ${agentType} fallback attempt ${attempt}/2 failed:`, lastError)

        if (attempt < 2) {
          await delay(RETRY_DELAY_MS * 2)
        }
      }
    }
  }

  return { success: false, error: lastError, attempts: MAX_RETRIES + (fallbackProvider ? 2 : 0), degraded }
}

export function getAgentModelPriority(agentType: AgentCategory): string {
  switch (agentType) {
    case 'planner': return 'high_quality'
    case 'writer': return 'chinese_long_text'
    case 'validator': return 'cheap_logic'
    case 'summarizer': return 'fast_cheap'
    case 'deslopper': return 'medium'
    case 'polisher': return 'medium'
    default: return 'default'
  }
}
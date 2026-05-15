import { NextRequest, NextResponse } from 'next/server'
import { LRUCache } from 'lru-cache'
import logger from '../logger'

interface RateLimitConfig {
  max: number
  windowMs: number
  message?: string
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

const defaultConfig: RateLimitConfig = {
  max: 100,
  windowMs: 60 * 1000,
  message: '请求过于频繁，请稍后再试',
}

const rateLimitStore = new LRUCache<string, RateLimitEntry>({
  max: 10000,
  ttl: 1000 * 60 * 60,
})

function getIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  return `${ip}:${userAgent.slice(0, 50)}`
}

export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const { max, windowMs, message } = { ...defaultConfig, ...config }

  return (request: NextRequest) => {
    const identifier = getIdentifier(request)
    const now = Date.now()

    let entry = rateLimitStore.get(identifier)

    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
      }
      rateLimitStore.set(identifier, entry)
      return null
    }

    entry.count++
    rateLimitStore.set(identifier, entry)

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
      logger.warn(
        { identifier, count: entry.count, max, retryAfter },
        'Rate limit exceeded'
      )

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message,
            retryAfter,
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(max),
            'X-RateLimit-Remaining': String(Math.max(0, max - entry.count)),
            'X-RateLimit-Reset': String(entry.resetTime),
          },
        }
      )
    }

    return null
  }
}

export const aiGenerationLimiter = createRateLimiter({
  max: 10,
  windowMs: 60 * 1000,
  message: 'AI 生成请求过于频繁，请稍后再试',
})

export const apiLimiter = createRateLimiter({
  max: 100,
  windowMs: 60 * 1000,
  message: 'API 请求过于频繁，请稍后再试',
})

export const exportLimiter = createRateLimiter({
  max: 5,
  windowMs: 60 * 1000,
  message: '导出请求过于频繁，请稍后再试',
})

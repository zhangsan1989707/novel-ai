/**
 * 滑动窗口限流器
 * 控制 API 调用频率，避免触发厂商限流
 */

import type { RateLimitMetrics } from './types'

interface WindowEntry {
  timestamp: number
}

export class RateLimiter {
  private windows: Map<string, WindowEntry[]> = new Map()
  private limit: number
  private windowMs: number

  constructor(limit: number, windowMs: number = 60_000) {
    this.limit = limit
    this.windowMs = windowMs
  }

  /**
   * 尝试获取调用令牌
   * @param vendor 厂商标识（可选，按厂商分别限流）
   * @returns true 表示获取成功
   */
  acquire(vendor: string = 'default'): boolean {
    const now = Date.now()
    const cutoff = now - this.windowMs

    if (!this.windows.has(vendor)) {
      this.windows.set(vendor, [])
    }

    const entries = this.windows.get(vendor)!
    // 清理过期条目
    const valid = entries.filter(e => e.timestamp > cutoff)
    this.windows.set(vendor, valid)

    if (valid.length >= this.limit) {
      return false
    }

    valid.push({ timestamp: now })
    return true
  }

  /**
   * 获取限流状态
   */
  getMetrics(vendor: string = 'default'): RateLimitMetrics {
    const now = Date.now()
    const cutoff = now - this.windowMs
    const entries = this.windows.get(vendor) || []
    const valid = entries.filter(e => e.timestamp > cutoff)

    return {
      used: valid.length,
      remaining: Math.max(0, this.limit - valid.length),
      limit: this.limit,
      resetAt: new Date(now + this.windowMs),
    }
  }

  /**
   * 等待直到有可用令牌
   */
  async waitForToken(vendor: string = 'default', timeoutMs: number = 10_000): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (this.acquire(vendor)) return true
      await new Promise(r => setTimeout(r, 500))
    }
    return false
  }
}

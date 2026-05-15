/**
 * LRU 缓存工具
 * 支持 TTL 和最大容量限制
 */

interface CacheEntry<T> {
  value: T
  expiry: number | null // null 表示永不过期
  createdAt: number
  accessCount: number
  lastAccessed: number
}

interface CacheOptions {
  max?: number // 最大条目数，默认 100
  ttl?: number // 默认 TTL (ms)，0 表示永不过期
  onEvict?: <T>(key: string, value: T) => void // 驱逐回调
}

/**
 * LRU 缓存类
 */
export class LRUCache<K, V> {
  private cache: Map<string, CacheEntry<V>> = new Map()
  private maxSize: number
  private defaultTTL: number
  private onEvict?: (key: string, value: V) => void

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.max ?? 100
    this.defaultTTL = options.ttl ?? 0
    this.onEvict = options.onEvict
  }

  /**
   * 设置缓存
   */
  set(key: string, value: V, ttl?: number): void {
    const now = Date.now()
    const expiry = ttl ? now + ttl : (this.defaultTTL ? now + this.defaultTTL : null)

    // 如果 key 已存在，先删除
    if (this.cache.has(key)) {
      this.delete(key)
    }

    // 如果缓存已满，删除最久未使用的
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, {
      value,
      expiry,
      createdAt: now,
      accessCount: 0,
      lastAccessed: now,
    })
  }

  /**
   * 获取缓存
   */
  get(key: string): V | undefined {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return undefined
    }

    // 检查是否过期
    if (entry.expiry && Date.now() > entry.expiry) {
      this.delete(key)
      return undefined
    }

    // 更新访问信息
    entry.accessCount++
    entry.lastAccessed = Date.now()

    return entry.value
  }

  /**
   * 检查是否存在（未过期）
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    
    if (entry.expiry && Date.now() > entry.expiry) {
      this.delete(key)
      return false
    }
    
    return true
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key)
    if (entry) {
      this.onEvict?.(key, entry.value)
      return this.cache.delete(key)
    }
    return false
  }

  /**
   * 清空缓存
   */
  clear(): void {
    if (this.onEvict) {
      for (const [key, entry] of this.cache) {
        this.onEvict(key, entry.value)
      }
    }
    this.cache.clear()
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    // 清理过期条目
    this.cleanup()
    return this.cache.size
  }

  /**
   * 获取缓存统计
   */
  stats(): CacheStats {
    let totalAccess = 0
    let expired = 0
    const now = Date.now()

    for (const entry of this.cache.values()) {
      totalAccess += entry.accessCount
      if (entry.expiry && now > entry.expiry) {
        expired++
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalAccess,
      expired,
      hitRate: 0, // 需要与计数器配合计算
    }
  }

  /**
   * 批量设置
   */
  setMany(entries: Array<[string, V]>, ttl?: number): void {
    for (const [key, value] of entries) {
      this.set(key, value, ttl)
    }
  }

  /**
   * 获取或设置（缓存不存在时调用 factory）
   */
  async getOrSet(
    key: string,
    factory: () => V | Promise<V>,
    ttl?: number
  ): Promise<V> {
    const cached = this.get(key)
    if (cached !== undefined) {
      return cached
    }

    const value = await factory()
    this.set(key, value, ttl)
    return value
  }

  /**
   * 驱逐最久未使用的条目
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.delete(oldestKey)
    }
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache) {
      if (entry.expiry && now > entry.expiry) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.delete(key)
    }
  }
}

export interface CacheStats {
  size: number
  maxSize: number
  totalAccess: number
  expired: number
  hitRate: number
}

// ============================================
// 预配置的缓存实例
// ============================================

/**
 * AI 模型配置缓存 (TTL: 5 分钟)
 */
export const aiModelConfigCache = new LRUCache<string, unknown>({
  max: 50,
  ttl: 5 * 60 * 1000, // 5 分钟
})

/**
 * 项目摘要缓存 (TTL: 10 分钟)
 */
export const projectSummaryCache = new LRUCache<string, unknown>({
  max: 100,
  ttl: 10 * 60 * 1000, // 10 分钟
})

/**
 * 用户配额缓存 (TTL: 1 分钟)
 */
export const userQuotaCache = new LRUCache<string, unknown>({
  max: 100,
  ttl: 1 * 60 * 1000, // 1 分钟
})

/**
 * AI Provider 实例缓存 (永不过期，但有大小限制)
 */
export const aiProviderCache = new LRUCache<string, unknown>({
  max: 10,
  ttl: 0, // 永不过期
})

// ============================================
// 缓存辅助函数
// ============================================

/**
 * 生成缓存键
 */
export function cacheKey(...parts: (string | number)[]): string {
  return parts.join(':')
}

/**
 * 带缓存的函数包装器
 */
export function withCache<T extends (...args: any[]) => any>(
  cache: LRUCache<string, unknown>,
  keyGenerator: (...args: Parameters<T>) => string,
  ttl?: number
) {
  return (fn: T): T => {
    return ((...args: Parameters<T>) => {
      const key = keyGenerator(...args)
      const cached = cache.get(key)
      if (cached !== undefined) {
        return cached as ReturnType<T>
      }
      const result = fn(...args)
      if (result instanceof Promise) {
        return result.then((value) => {
          cache.set(key, value, ttl)
          return value
        })
      }
      cache.set(key, result, ttl)
      return result
    }) as T
  }
}

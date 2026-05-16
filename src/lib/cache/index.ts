import { LRUCache } from 'lru-cache'

interface CacheOptions {
  ttl?: number
  maxSize?: number
}

const defaultOptions: Required<CacheOptions> = {
  ttl: 5 * 60 * 1000,
  maxSize: 1000,
}

class MemoryCache<T extends {} = object> {
  private cache: any

  constructor(options: CacheOptions = {}) {
    const opts = { ...defaultOptions, ...options }
    this.cache = new LRUCache<string, T>({
      max: opts.maxSize,
      ttl: opts.ttl,
    })
  }

  get(key: string): T | undefined {
    return this.cache.get(key)
  }

  set(key: string, value: T): void {
    this.cache.set(key, value)
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}

const projectCache = new MemoryCache<any>({ ttl: 60 * 1000, maxSize: 100 })
const characterCache = new MemoryCache<any>({ ttl: 5 * 60 * 1000, maxSize: 500 })
const chapterCache = new MemoryCache<any>({ ttl: 2 * 60 * 1000, maxSize: 200 })

export function getProjectCache() {
  return projectCache
}

export function getCharacterCache() {
  return characterCache
}

export function getChapterCache() {
  return chapterCache
}

export function createCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`
}

export const cacheKeys = {
  project: (id: number) => createCacheKey('project', id),
  projectConfig: (id: number) => createCacheKey('project-config', id),
  chapter: (id: number) => createCacheKey('chapter', id),
  chapterList: (projectId: number) => createCacheKey('chapter-list', projectId),
  character: (id: string) => createCacheKey('character', id),
  characterList: (projectId: number) => createCacheKey('character-list', projectId),
  plotlineList: (projectId: number) => createCacheKey('plotline-list', projectId),
  aiConfig: (id: number) => createCacheKey('ai-config', id),
  defaultAIConfig: () => createCacheKey('ai-config', 'default'),
}

export default MemoryCache

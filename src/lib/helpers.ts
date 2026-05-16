/**
 * 通用工具函数
 */

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * 清理文件名，移除非法字符
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[<>:"/\\|?*\s]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number, ellipsis = '...'): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - ellipsis.length) + ellipsis
}

/**
 * 延迟函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => { inThrottle = false }, limit)
    }
  }
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    delay?: number
    onError?: (error: Error, attempt: number) => void
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 0, onError } = options

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxAttempts) throw error
      if (onError && error instanceof Error) {
        onError(error, attempt)
      }
      if (delay > 0) {
        await sleep(delay)
      }
    }
  }
  throw new Error('Retry failed')
}

/**
 * 将数组分块
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * 按键分组
 */
export function groupBy<T, K extends keyof T>(array: T[], key: K): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key])
    if (!groups[groupKey]) {
      groups[groupKey] = []
    }
    groups[groupKey].push(item)
    return groups
  }, {} as Record<string, T[]>)
}

/**
 * 排序函数
 */
export function sortBy<T>(
  array: T[],
  key?: keyof T,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  const sorted = [...array]
  if (key) {
    sorted.sort((a, b) => {
      const aVal = a[key]
      const bVal = b[key]
      if (aVal < bVal) return order === 'asc' ? -1 : 1
      if (aVal > bVal) return order === 'asc' ? 1 : -1
      return 0
    })
  } else {
    sorted.sort((a, b) => {
      if (a < b) return order === 'asc' ? -1 : 1
      if (a > b) return order === 'asc' ? 1 : -1
      return 0
    })
  }
  return sorted
}

/**
 * 数组去重
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)]
}

/**
 * 限制数值在范围内
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 深拷贝
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(deepClone) as unknown as T
  const cloned = {} as T
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  return cloned
}

/**
 * 判断是否为对象
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 合并对象
 */
export function merge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  return sources.reduce((acc, source) => {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key]
        const targetValue = acc[key]
        
        if (isObject(sourceValue) && isObject(targetValue)) {
          acc[key] = merge(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>) as T[keyof T]
        } else {
          acc[key] = sourceValue as T[keyof T]
        }
      }
    }
    return acc
  }, { ...target })
}

/**
 * 格式化日期
 */
export function formatDate(date: Date | string, format: string = 'YYYY-MM-DD'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

/**
 * 计算百分比
 */
export function percentage(value: number, total: number, decimals = 2): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100 * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

/**
 * 首字母大写
 */
export function capitalize(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * 将下划线转为驼峰
 */
export function camelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * 将驼峰转为下划线
 */
export function snakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

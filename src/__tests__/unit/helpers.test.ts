import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateId,
  sanitizeFileName,
  truncateText,
  sleep,
  debounce,
  throttle,
  retry,
  chunk,
  groupBy,
  sortBy,
  unique,
  clamp,
} from '@/lib/helpers'

describe('Helper Functions', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
    })

    it('should generate string IDs', () => {
      const id = generateId()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })
  })

  describe('sanitizeFileName', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeFileName('file<>:"/\\|?*name')).toBe('file_name')
    })

    it('should handle normal file names', () => {
      expect(sanitizeFileName('my_novel.txt')).toBe('my_novel.txt')
    })

    it('should handle Chinese characters', () => {
      expect(sanitizeFileName('我的小说.txt')).toBe('我的小说.txt')
    })

    it('should replace spaces with underscores', () => {
      expect(sanitizeFileName('my novel file')).toBe('my_novel_file')
    })
  })

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const text = '这是一个很长的文本内容'
      const result = truncateText(text, 10)
      expect(result.length).toBeLessThanOrEqual(13) // 10 + '...'
    })

    it('should not truncate short text', () => {
      const text = '短文本'
      const result = truncateText(text, 10)
      expect(result).toBe('短文本')
    })

    it('should use default ellipsis', () => {
      const text = '这是一个很长的文本内容'
      const result = truncateText(text, 5)
      expect(result.endsWith('...')).toBe(true)
    })

    it('should use custom ellipsis', () => {
      const text = '这是一个很长的文本内容'
      const result = truncateText(text, 5, '>>>')
      expect(result.endsWith('>>>')).toBe(true)
    })
  })

  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now()
      await sleep(50)
      const duration = Date.now() - start
      expect(duration).toBeGreaterThanOrEqual(40)
    })

    it('should handle zero delay', async () => {
      const start = Date.now()
      await sleep(0)
      const duration = Date.now() - start
      expect(duration).toBeLessThan(50)
    })
  })

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should debounce function calls', () => {
      let callCount = 0
      const fn = vi.fn(() => { callCount++ })
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      expect(callCount).toBe(0)

      vi.advanceTimersByTime(100)

      expect(callCount).toBe(1)
    })
  })

  describe('throttle', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should throttle function calls', () => {
      let callCount = 0
      const fn = vi.fn(() => { callCount++ })
      const throttledFn = throttle(fn, 100)

      throttledFn()
      throttledFn()
      throttledFn()

      expect(callCount).toBe(1)

      vi.advanceTimersByTime(100)

      throttledFn()
      expect(callCount).toBe(2)
    })
  })

  describe('retry', () => {
    it('should retry failed operations with real timers', async () => {
      vi.useRealTimers()
      
      let attempts = 0
      const fn = vi.fn(async () => {
        attempts++
        if (attempts < 3) throw new Error('Failed')
        return 'success'
      })

      const result = await retry(fn, { maxAttempts: 3, delay: 10 })
      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('should throw after max attempts', async () => {
      vi.useRealTimers()
      
      const fn = vi.fn(async () => {
        throw new Error('Always fails')
      })

      await expect(retry(fn, { maxAttempts: 2, delay: 10 })).rejects.toThrow('Always fails')
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('chunk', () => {
    it('should split array into chunks', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7]
      const chunks = chunk(arr, 3)
      expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]])
    })

    it('should handle empty array', () => {
      expect(chunk([], 3)).toEqual([])
    })

    it('should handle chunk size larger than array', () => {
      expect(chunk([1, 2], 5)).toEqual([[1, 2]])
    })

    it('should handle chunk size of 1', () => {
      expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]])
    })
  })

  describe('groupBy', () => {
    it('should group array by key', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ]
      const grouped = groupBy(items, 'type')
      
      expect(grouped.a).toEqual([{ type: 'a', value: 1 }, { type: 'a', value: 3 }])
      expect(grouped.b).toEqual([{ type: 'b', value: 2 }])
    })

    it('should handle empty array', () => {
      expect(groupBy([], 'type')).toEqual({})
    })
  })

  describe('sortBy', () => {
    it('should sort array by key', () => {
      const items = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
      ]
      const sorted = sortBy(items, 'age')
      
      expect(sorted[0].name).toBe('Alice')
      expect(sorted[1].name).toBe('Charlie')
      expect(sorted[2].name).toBe('Bob')
    })

    it('should handle descending order', () => {
      const items = [3, 1, 2]
      const sorted = sortBy(items, undefined, 'desc')
      expect(sorted).toEqual([3, 2, 1])
    })
  })

  describe('unique', () => {
    it('should remove duplicates', () => {
      expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3])
    })

    it('should handle empty array', () => {
      expect(unique([])).toEqual([])
    })

    it('should preserve order', () => {
      expect(unique([3, 1, 2, 1, 3])).toEqual([3, 1, 2])
    })
  })

  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
      expect(clamp(-5, 0, 10)).toBe(0)
      expect(clamp(15, 0, 10)).toBe(10)
    })

    it('should handle edge cases', () => {
      expect(clamp(0, 0, 10)).toBe(0)
      expect(clamp(10, 0, 10)).toBe(10)
    })
  })
})

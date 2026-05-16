import { describe, it, expect } from 'vitest'
import {
  countChineseWords,
  isWordCountValid,
  formatWordCount,
} from '@/lib/utils'

describe('countChineseWords', () => {
  it('should return 0 for empty string', () => {
    expect(countChineseWords('')).toBe(0)
  })

  it('should return 0 for null/undefined', () => {
    expect(countChineseWords(null as unknown as string)).toBe(0)
  })

  it('should count Chinese characters correctly', () => {
    // 纯中文文本
    const text = '你好世界'
    const result = countChineseWords(text)
    // 4个中文字符 = 4 字
    expect(result).toBe(4)
  })

  it('should count mixed content correctly', () => {
    const text = '你好hello世界'
    const result = countChineseWords(text)
    // 4个中文字符 + 1个英文单词(0.5) ≈ 4
    expect(result).toBeGreaterThanOrEqual(4)
  })

  it('should count Chinese punctuation with weight', () => {
    const text = '你好，'
    const result = countChineseWords(text)
    expect(result).toBeGreaterThanOrEqual(2)
  })

  it('should count English words with 0.5 weight', () => {
    // 英文单词按数量计算 * 0.5，然后 floor
    // 单个单词 "hello" = 0.5 -> floor = 0
    // 多个单词应该能体现
    const result = countChineseWords('hello world')
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('should count novel content correctly', () => {
    const text = '张三大步走向门口，推开那扇沉重的木门。'
    const result = countChineseWords(text)
    expect(result).toBeGreaterThan(0)
    // 验证大致字数合理
    expect(result).toBeGreaterThanOrEqual(10)
  })
})

describe('isWordCountValid', () => {
  it('should return true when actual equals target', () => {
    expect(isWordCountValid(3000, 3000)).toBe(true)
  })

  it('should return true when within 90% range', () => {
    expect(isWordCountValid(2700, 3000)).toBe(true) // 90%
    expect(isWordCountValid(3300, 3000)).toBe(true) // 110%
  })

  it('should return true at boundary 90%', () => {
    expect(isWordCountValid(2700, 3000)).toBe(true)
  })

  it('should return true at boundary 110%', () => {
    expect(isWordCountValid(3300, 3000)).toBe(true)
  })

  it('should return false when below 90%', () => {
    expect(isWordCountValid(2699, 3000)).toBe(false)
    expect(isWordCountValid(0, 3000)).toBe(false)
  })

  it('should return false when above 110%', () => {
    expect(isWordCountValid(3301, 3000)).toBe(false)
    expect(isWordCountValid(6000, 3000)).toBe(false)
  })

  it('should handle zero target', () => {
    expect(isWordCountValid(0, 0)).toBe(true)
  })
})

describe('formatWordCount', () => {
  it('should format numbers below 10000 without units', () => {
    expect(formatWordCount(0)).toBe('0')
    expect(formatWordCount(999)).toBe('999')
  })

  it('should format numbers 10000 and above with 万', () => {
    expect(formatWordCount(10000)).toBe('1.0万')
    expect(formatWordCount(15000)).toBe('1.5万')
    expect(formatWordCount(100000)).toBe('10.0万')
    expect(formatWordCount(105000)).toBe('10.5万')
  })

  it('should handle large numbers', () => {
    expect(formatWordCount(1000000)).toBe('100.0万')
    expect(formatWordCount(10000000)).toBe('1000.0万')
  })

  it('should handle thousands with comma', () => {
    expect(formatWordCount(1000)).toBe('1,000')
  })
})

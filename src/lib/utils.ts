import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 精确字数统计（中文字符为主）
 * - 中文字符 × 1.0
 * - 中文标点 × 0.5
 * - 英文单词 × 0.5
 * - 其他字符 × 0.25
 */
export function countChineseWords(text: string): number {
  if (!text) return 0

  // 中文字符（包括汉字和中文标点范围）
  const chineseChars = (text.match(/[一-鿿]/g) || []).length
  const chinesePunct = (text.match(/[　-〿＀-￯]/g) || []).length * 0.5
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length * 0.5
  const otherChars = (text.length - chineseChars - (text.match(/[　-〿＀-￯a-zA-Z]/g) || []).length) * 0.25

  return Math.floor(chineseChars + chinesePunct + englishWords + otherChars)
}

/**
 * 检查字数是否在目标范围内（90% - 110%）
 */
export function isWordCountValid(actual: number, target: number): boolean {
  return actual >= target * 0.9 && actual <= target * 1.1
}

/**
 * 格式化字数显示
 */
export function formatWordCount(count: number): string {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`
  }
  return count.toLocaleString()
}

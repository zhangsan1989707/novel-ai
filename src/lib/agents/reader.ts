/**
 * Reader Agent - 读者视角模拟器
 * 从目标读者视角评估章节阅读体验
 */
import { AIService } from '@/lib/ai/service'
import type { AIProvider } from '@/lib/ai/types'
import { buildReaderSystemPrompt, buildReaderUserPrompt } from '../prompts/reader'

interface ReaderInput {
  projectId: number
  chapterNo: number
  chapterContent: string
  chapterTitle?: string
  genre?: string | null
  targetAudience?: string | null
  recentSummaries: { chapterNo: number; summary: string }[]
  provider?: AIProvider
}

interface ReaderReport {
  /** 悬念吸引力 (0-100) */
  engagementScore: number
  /** 节奏舒适度 (0-100) */
  pacingScore: number
  /** 情感共鸣度 (0-100) */
  emotionalScore: number
  /** 可读性 (0-100) */
  readabilityScore: number
  /** 开头钩子强度 (0-100) */
  hookStrength: number
  /** 结尾悬念强度 (0-100) */
  cliffhangerStrength: number
  /** 亮点 */
  highlights: string[]
  /** 阅读疲劳点 */
  painPoints: string[]
  /** 改进建议 */
  suggestions: string[]
  /** 读完后的情绪状态 */
  readerMood: string
  /** 是否想继续读下一章 */
  wouldContinueReading: boolean
  /** 预估阅读时间（分钟） */
  estimatedReadingTime: number
}

export type { ReaderInput, ReaderReport }

/**
 * Reader Agent - 模拟读者阅读体验
 */
export async function readerAgent(input: ReaderInput): Promise<ReaderReport> {
  const provider = input.provider || await AIService.createProvider({
    projectId: input.projectId,
    usageType: 'READER',
  })

  const systemPrompt = buildReaderSystemPrompt()
  const userPrompt = buildReaderUserPrompt({
    chapterNo: input.chapterNo,
    chapterTitle: input.chapterTitle,
    genre: input.genre,
    targetAudience: input.targetAudience,
    chapterContent: input.chapterContent,
    recentSummaries: input.recentSummaries
      .map(s => `第${s.chapterNo}章：${s.summary}`)
      .join('\n'),
  })

  const result = await provider.generate(
    `${systemPrompt}\n\n${userPrompt}`,
    { temperature: 0.5, maxTokens: 2000 }
  )

  // 解析 JSON 输出
  const jsonMatch = result.content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const report = JSON.parse(jsonMatch[0]) as ReaderReport
      // 校验并修正数值范围
      return {
        engagementScore: clamp(report.engagementScore, 0, 100),
        pacingScore: clamp(report.pacingScore, 0, 100),
        emotionalScore: clamp(report.emotionalScore, 0, 100),
        readabilityScore: clamp(report.readabilityScore, 0, 100),
        hookStrength: clamp(report.hookStrength, 0, 100),
        cliffhangerStrength: clamp(report.cliffhangerStrength, 0, 100),
        highlights: Array.isArray(report.highlights) ? report.highlights.slice(0, 5) : [],
        painPoints: Array.isArray(report.painPoints) ? report.painPoints.slice(0, 4) : [],
        suggestions: Array.isArray(report.suggestions) ? report.suggestions.slice(0, 4) : [],
        readerMood: typeof report.readerMood === 'string' ? report.readerMood : '未知',
        wouldContinueReading: !!report.wouldContinueReading,
        estimatedReadingTime: typeof report.estimatedReadingTime === 'number' ? report.estimatedReadingTime : 0,
      }
    } catch {
      // JSON 解析失败，返回默认值
    }
  }

  // 无法解析时返回保守评估
  return {
    engagementScore: 50,
    pacingScore: 50,
    emotionalScore: 50,
    readabilityScore: 50,
    hookStrength: 50,
    cliffhangerStrength: 50,
    highlights: ['无法解析评估结果'],
    painPoints: ['评估结果格式异常'],
    suggestions: ['建议重新评估'],
    readerMood: '评估失败',
    wouldContinueReading: false,
    estimatedReadingTime: 0,
  }
}

function clamp(value: unknown, min: number, max: number): number {
  const num = typeof value === 'number' ? value : min
  return Math.max(min, Math.min(max, Math.round(num)))
}

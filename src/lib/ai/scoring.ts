/**
 * 章节评分系统
 * 多维度评估 AI 生成章节的质量
 */

import { AIVendor } from '@/types'

// ============================================
// 类型定义
// ============================================

/**
 * 评分维度
 */
export enum ScoringDimension {
  PACING = 'pacing',           // 节奏
  CONFLICT = 'conflict',        // 冲突
  CONSISTENCY = 'consistency',  // 一致性
  WRITING = 'writing',          // 文笔
  HOOK = 'hook',               // 钩子
}

/**
 * 单项评分
 */
export interface DimensionScore {
  dimension: ScoringDimension
  score: number // 0-100
  weight: number // 权重
  details: string // 评分理由
}

/**
 * 章节评分结果
 */
export interface ChapterScore {
  overall: number // 综合评分 0-100
  dimensions: DimensionScore[]
  grade: string // 等级 (S/A/B/C/D)
  suggestions: string[] // 改进建议
  strengths: string[] // 优点
  metadata: {
    chapterNo: number
    wordCount: number
    estimatedReadTime: number // 预估阅读时间(秒)
    generatedAt: string
  }
}

/**
 * 评分配置
 */
export interface ScoringConfig {
  dimensions: Array<{
    dimension: ScoringDimension
    weight: number
  }>
  passThreshold: number // 及格分数
  gradeThresholds: {
    S: number // 90+
    A: number // 80+
    B: number // 70+
    C: number // 60+
    D: number // 0+
  }
}

// 默认评分配置
const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  dimensions: [
    { dimension: ScoringDimension.PACING, weight: 0.25 },
    { dimension: ScoringDimension.CONFLICT, weight: 0.20 },
    { dimension: ScoringDimension.CONSISTENCY, weight: 0.20 },
    { dimension: ScoringDimension.WRITING, weight: 0.20 },
    { dimension: ScoringDimension.HOOK, weight: 0.15 },
  ],
  passThreshold: 60,
  gradeThresholds: {
    S: 90,
    A: 80,
    B: 70,
    C: 60,
    D: 0,
  },
}

// 维度权重映射
const DIMENSION_WEIGHTS: Record<ScoringDimension, number> = {
  [ScoringDimension.PACING]: 0.25,
  [ScoringDimension.CONFLICT]: 0.20,
  [ScoringDimension.CONSISTENCY]: 0.20,
  [ScoringDimension.WRITING]: 0.20,
  [ScoringDimension.HOOK]: 0.15,
}

// ============================================
// 评分 Prompt 构建
// ============================================

/**
 * 构建评分 Prompt
 */
export function buildScoringPrompt(
  chapterNo: number,
  chapterTitle: string,
  content: string,
  context?: {
    worldSetting?: string
    protagonistProfile?: string
    characterProfiles?: string
  }
): string {
  const parts: string[] = []

  parts.push(`你是一位专业的小说编辑，负责评估章节质量。`)
  parts.push(`请对以下章节进行多维度评分。`)

  parts.push(`\n【章节信息】`)
  parts.push(`第${chapterNo}章 "${chapterTitle}"`)
  parts.push(`字数：约${content.length}字`)

  if (context?.worldSetting) {
    parts.push(`\n【世界观设定】`)
    parts.push(context.worldSetting)
  }

  if (context?.protagonistProfile) {
    parts.push(`\n【主角人设】`)
    parts.push(context.protagonistProfile)
  }

  if (context?.characterProfiles) {
    parts.push(`\n【角色档案】`)
    parts.push(context.characterProfiles)
  }

  parts.push(`\n【待评分内容】`)
  parts.push(content.slice(0, 8000)) // 限制内容长度

  parts.push(`\n【评分维度】`)
  parts.push(`1. 节奏(PACING): 章节节奏是否张弛有度，铺垫与发展是否合理`)
  parts.push(`2. 冲突(CONFLICT): 是否有足够的矛盾冲突推动剧情发展`)
  parts.push(`3. 一致性(CONSISTENCY): 角色性格、情节逻辑是否前后一致`)
  parts.push(`4. 文笔(WRITING): 语言表达是否流畅、生动、有感染力`)
  parts.push(`5. 钩子(HOOK): 章节开头和结尾是否有吸引力，能抓住读者`)

  parts.push(`\n【输出格式】`)
  parts.push(`请以严格 JSON 格式输出评分结果：`)
  parts.push(`{
  "dimensions": [
    {
      "dimension": "PACING|CONFLICT|CONSISTENCY|WRITING|HOOK",
      "score": 0-100之间的整数,
      "details": "评分理由（50-100字）"
    }
  ],
  "overall": 0-100之间的整数,
  "suggestions": ["改进建议1", "改进建议2"],
  "strengths": ["优点1", "优点2"]
}`)

  return parts.join('\n')
}

// ============================================
// 评分计算
// ============================================

/**
 * 计算综合评分
 */
export function calculateOverallScore(
  dimensionScores: Array<{ score: number; weight: number }>
): number {
  const totalWeight = dimensionScores.reduce((sum, d) => sum + d.weight, 0)
  const weightedSum = dimensionScores.reduce(
    (sum, d) => sum + d.score * d.weight,
    0
  )
  return Math.round(weightedSum / totalWeight)
}

/**
 * 转换为等级
 */
export function scoreToGrade(
  score: number,
  thresholds: ScoringConfig['gradeThresholds']
): string {
  if (score >= thresholds.S) return 'S'
  if (score >= thresholds.A) return 'A'
  if (score >= thresholds.B) return 'B'
  if (score >= thresholds.C) return 'C'
  return 'D'
}

/**
 * 解析评分结果
 */
export function parseScoringResult(
  result: string,
  chapterNo: number,
  wordCount: number
): ChapterScore {
  try {
    // 提取 JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('无法解析评分结果')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // 构建维度评分
    const dimensions: DimensionScore[] = (parsed.dimensions || []).map(
      (d: { dimension: string; score: number; details: string }) => ({
        dimension: d.dimension as ScoringDimension,
        score: d.score,
        weight: DIMENSION_WEIGHTS[d.dimension as ScoringDimension] || 0.2,
        details: d.details || '',
      })
    )

    // 确保所有维度都有评分
    for (const dim of Object.values(ScoringDimension)) {
      if (!dimensions.find(d => d.dimension === dim)) {
        dimensions.push({
          dimension: dim,
          score: 70, // 默认分数
          weight: DIMENSION_WEIGHTS[dim],
          details: '未明确评估',
        })
      }
    }

    // 计算综合评分
    const overall =
      parsed.overall ||
      calculateOverallScore(
        dimensions.map(d => ({ score: d.score, weight: d.weight }))
      )

    // 确定等级
    const grade = scoreToGrade(overall, DEFAULT_SCORING_CONFIG.gradeThresholds)

    // 预估阅读时间（中文阅读速度约 400 字/分钟）
    const estimatedReadTime = Math.round((wordCount / 400) * 60)

    return {
      overall,
      dimensions,
      grade,
      suggestions: parsed.suggestions || [],
      strengths: parsed.strengths || [],
      metadata: {
        chapterNo,
        wordCount,
        estimatedReadTime,
        generatedAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    // 解析失败，返回默认评分
    return createDefaultScore(chapterNo, wordCount, '评分解析失败')
  }
}

/**
 * 创建默认评分
 */
export function createDefaultScore(
  chapterNo: number,
  wordCount: number,
  reason: string
): ChapterScore {
  return {
    overall: 70,
    grade: 'B',
    dimensions: Object.values(ScoringDimension).map(dim => ({
      dimension: dim,
      score: 70,
      weight: DIMENSION_WEIGHTS[dim],
      details: '默认评分',
    })),
    suggestions: [`评分异常: ${reason}`],
    strengths: ['内容已生成'],
    metadata: {
      chapterNo,
      wordCount,
      estimatedReadTime: Math.round((wordCount / 400) * 60),
      generatedAt: new Date().toISOString(),
    },
  }
}

// ============================================
// 评分历史
// ============================================

/**
 * 章节评分历史记录
 */
export interface ScoreHistory {
  chapterScores: Array<{
    chapterNo: number
    score: ChapterScore
  }>
  averageScore: number
  trend: 'improving' | 'stable' | 'declining'
  recentTrend: number[] // 最近 N 章的分数
}

/**
 * 计算评分趋势
 */
export function calculateScoreTrend(scores: number[]): 'improving' | 'stable' | 'declining' {
  if (scores.length < 3) return 'stable'

  const recent = scores.slice(-5)
  const firstHalf = recent.slice(0, Math.floor(recent.length / 2))
  const secondHalf = recent.slice(Math.floor(recent.length / 2))

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

  const diff = avgSecond - avgFirst

  if (diff > 3) return 'improving'
  if (diff < -3) return 'declining'
  return 'stable'
}

// ============================================
// 评分展示
// ============================================

/**
 * 评分等级颜色
 */
export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    S: '#FFD700', // 金色
    A: '#4CAF50', // 绿色
    B: '#2196F3', // 蓝色
    C: '#FF9800', // 橙色
    D: '#F44336', // 红色
  }
  return colors[grade] || '#9E9E9E'
}

/**
 * 评分等级描述
 */
export function getGradeDescription(grade: string): string {
  const descriptions: Record<string, string> = {
    S: '卓越 - 极佳的章节质量',
    A: '优秀 - 高质量的章节',
    B: '良好 - 合格的章节',
    C: '及格 - 需要改进',
    D: '不合格 - 需要重写',
  }
  return descriptions[grade] || '未知'
}

/**
 * 格式化评分输出
 */
export function formatScoreReport(score: ChapterScore): string {
  const lines: string[] = []

  lines.push(`===== 章节评分报告 =====`)
  lines.push(`章节: 第${score.metadata.chapterNo}章`)
  lines.push(`字数: ${score.metadata.wordCount}`)
  lines.push(`阅读时间: 约${Math.floor(score.metadata.estimatedReadTime / 60)}分${score.metadata.estimatedReadTime % 60}秒`)
  lines.push('')
  lines.push(`综合评分: ${score.overall} 分 [${score.grade}]`)
  lines.push('')
  lines.push('--- 各维度评分 ---')

  for (const dim of score.dimensions) {
    const dimName = {
      [ScoringDimension.PACING]: '节奏',
      [ScoringDimension.CONFLICT]: '冲突',
      [ScoringDimension.CONSISTENCY]: '一致性',
      [ScoringDimension.WRITING]: '文笔',
      [ScoringDimension.HOOK]: '钩子',
    }[dim.dimension]
    lines.push(`${dimName}: ${dim.score}/100 (权重: ${dim.weight * 100}%)`)
    lines.push(`  ${dim.details}`)
  }

  if (score.strengths.length > 0) {
    lines.push('')
    lines.push('--- 优点 ---')
    for (const s of score.strengths) {
      lines.push(`• ${s}`)
    }
  }

  if (score.suggestions.length > 0) {
    lines.push('')
    lines.push('--- 改进建议 ---')
    for (const s of score.suggestions) {
      lines.push(`• ${s}`)
    }
  }

  return lines.join('\n')
}

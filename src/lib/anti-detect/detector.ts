/**
 * 多层AI检测流水线
 *
 * Layer 1: 规则层（词库 + 模式检测）- 基于已知的AI高频特征词和写作模式
 * Layer 2: 统计层（困惑度 + 突发度）- 基于统计特征的AI文本识别
 * Layer 3: 综合评分 - 融合两层结果给出最终判定
 *
 * 综合公式：规则分 × 0.4 + 统计分 × 0.6
 */

import {
  scanForbiddenWords,
  scanForbiddenPatterns,
  scanWordsByLevel,
} from '@/lib/knowledge/anti-ai'
import type { ForbiddenWord, ForbiddenPattern } from '@/lib/knowledge/anti-ai'
import { calculatePerplexity } from './perplexity'
import type { PerplexityResult } from './perplexity'

// ============================================
// 类型定义
// ============================================

export interface SuspiciousWord {
  word: string
  count: number
  level: string
}

export interface SuspiciousPattern {
  pattern: string
  matches: string[]
}

export interface UniformSegment {
  text: string
  score: number
}

export interface RuleLayerResult {
  score: number
  verdict: string
  suspiciousWords: SuspiciousWord[]
  suspiciousPatterns: SuspiciousPattern[]
  totalForbiddenCount: number
  criticalCount: number
  warningCount: number
}

export interface StatisticalLayerResult {
  score: number
  perplexity: PerplexityResult
}

export interface DetectionResult {
  overallScore: number
  verdict: 'human' | 'likely_human' | 'uncertain' | 'likely_ai' | 'ai'
  layers: {
    rule: RuleLayerResult
    statistical: StatisticalLayerResult
  }
  details: {
    suspiciousWords: SuspiciousWord[]
    suspiciousPatterns: SuspiciousPattern[]
    uniformSegments: UniformSegment[]
  }
  suggestions: string[]
}

export interface QuickDetectionResult {
  score: number
  verdict: string
}

// ============================================
// 规则层检测
// ============================================

function detectRuleLayer(text: string): RuleLayerResult {
  const forbiddenWordsResult = scanForbiddenWords(text)
  const forbiddenPatternsResult = scanForbiddenPatterns(text)
  const wordsByLevel = scanWordsByLevel(text)

  const suspiciousWords: SuspiciousWord[] = forbiddenWordsResult.map(r => ({
    word: r.word.word,
    count: r.count,
    level: r.word.level,
  }))

  const suspiciousPatterns: SuspiciousPattern[] = forbiddenPatternsResult.map(r => ({
    pattern: r.pattern.pattern,
    matches: r.matches,
  }))

  const totalForbiddenCount = suspiciousWords.reduce((sum, w) => sum + w.count, 0)
  const criticalCount = wordsByLevel.critical.reduce((sum, w) => sum + w.count, 0)
  const warningCount = wordsByLevel.warning.reduce((sum, w) => sum + w.count, 0)

  let wordScore = 0
  const textLength = text.replace(/\s/g, '').length
  if (textLength > 0) {
    const density = (criticalCount * 3 + warningCount * 1.5) / (textLength / 100)
    if (density > 2.5) wordScore = 90
    else if (density > 1.8) wordScore = 75
    else if (density > 1.2) wordScore = 55
    else if (density > 0.7) wordScore = 35
    else if (density > 0.3) wordScore = 20
    else wordScore = 5
  }

  let patternScore = 0
  const criticalPatterns = forbiddenPatternsResult.filter(p => p.pattern.level === 'critical').length
  const warningPatterns = forbiddenPatternsResult.filter(p => p.pattern.level === 'warning').length
  patternScore = criticalPatterns * 25 + warningPatterns * 12
  patternScore = Math.min(100, patternScore)

  const score = Math.round(wordScore * 0.55 + patternScore * 0.45)

  let verdict = 'human'
  if (score >= 75) verdict = 'ai'
  else if (score >= 55) verdict = 'likely_ai'
  else if (score >= 35) verdict = 'uncertain'
  else if (score >= 15) verdict = 'likely_human'
  else verdict = 'human'

  return {
    score,
    verdict,
    suspiciousWords,
    suspiciousPatterns,
    totalForbiddenCount,
    criticalCount,
    warningCount,
  }
}

// ============================================
// 统计层检测
// ============================================

function detectStatisticalLayer(text: string): StatisticalLayerResult {
  const perplexity = calculatePerplexity(text)
  return {
    score: perplexity.score,
    perplexity,
  }
}

// ============================================
// 综合评分
// ============================================

function calculateOverallVerdict(score: number): DetectionResult['verdict'] {
  if (score >= 75) return 'ai'
  if (score >= 55) return 'likely_ai'
  if (score >= 35) return 'uncertain'
  if (score >= 15) return 'likely_human'
  return 'human'
}

function generateSuggestions(
  ruleLayer: RuleLayerResult,
  statLayer: StatisticalLayerResult,
  overallScore: number
): string[] {
  const suggestions: string[] = []

  if (ruleLayer.criticalCount > 0) {
    const criticalWords = ruleLayer.suspiciousWords
      .filter(w => w.level === 'critical')
      .map(w => `"${w.word}"`)
    if (criticalWords.length > 0) {
      suggestions.push(`建议替换L1禁用词：${criticalWords.slice(0, 5).join('、')}`)
    }
  }

  if (ruleLayer.suspiciousPatterns.length > 0) {
    const patternNames = ruleLayer.suspiciousPatterns
      .slice(0, 3)
      .map(p => p.pattern)
    if (patternNames.length > 0) {
      suggestions.push(`检测到疑似模式：${patternNames.join('、')}`)
    }
  }

  const { details } = statLayer.perplexity

  if (details.uniformScore > 0.6) {
    suggestions.push('句长过于均匀，建议有意识地变化句子长度')
  }

  if (details.diversityScore > 0.6) {
    suggestions.push('词汇多样性偏低，建议丰富用词')
  }

  if (details.patternScore > 0.6) {
    suggestions.push('检测到词汇重复模式，建议减少重复短语的使用')
  }

  if (details.structureScore > 0.6) {
    suggestions.push('段落结构过于工整，建议打破规整的段落模式')
  }

  if (statLayer.perplexity.burstiness < 0.3) {
    suggestions.push('突发度过低，建议增加句长变化幅度')
  }

  if (overallScore >= 50) {
    suggestions.push('整体AI特征明显，建议运行改写引擎（rewriteText）降低检测分')
  }

  if (suggestions.length === 0) {
    suggestions.push('文本质量良好，未检测到明显的AI特征')
  }

  return suggestions
}

// ============================================
// 导出函数
// ============================================

/**
 * 多层AI检测 - 完整版
 *
 * 执行规则层 + 统计层双重检测，输出详细报告。
 *
 * @param text - 待检测的中文文本
 * @returns 包含各层评分、可疑词汇、优化建议的完整检测报告
 */
export function detectAI(text: string): DetectionResult {
  const ruleLayer = detectRuleLayer(text)
  const statLayer = detectStatisticalLayer(text)

  const overallScore = Math.round(ruleLayer.score * 0.4 + statLayer.score * 0.6)
  const verdict = calculateOverallVerdict(overallScore)

  const uniformSegments: UniformSegment[] = []

  const suggestions = generateSuggestions(ruleLayer, statLayer, overallScore)

  return {
    overallScore,
    verdict,
    layers: {
      rule: ruleLayer,
      statistical: statLayer,
    },
    details: {
      suspiciousWords: ruleLayer.suspiciousWords,
      suspiciousPatterns: ruleLayer.suspiciousPatterns,
      uniformSegments,
    },
    suggestions,
  }
}

/**
 * 快速AI检测
 *
 * 执行简化版检测，返回分数和判定，适合在UI中快速展示。
 *
 * @param text - 待检测的中文文本
 * @returns 简化的检测结果（分数 + 判定）
 */
export function quickDetect(text: string): QuickDetectionResult {
  const result = detectAI(text)
  return {
    score: result.overallScore,
    verdict: result.verdict,
  }
}
/**
 * 章节AI质量分析服务
 * 提供多维度的AI味道检测和评分
 */

import { scanForbiddenWords, scanForbiddenPatterns, scanWordsByLevel } from './anti-ai'

// ============================================
// 类型定义
// ============================================

export interface DimensionScore {
  name: string
  score: number        // 0-100
  weight: number       // 权重
  issues: Issue[]
  suggestions: string[]
}

export interface Issue {
  type: 'word' | 'pattern' | 'structure' | 'rhythm' | 'dialogue' | 'immersive'
  severity: 'critical' | 'warning' | 'info'
  description: string
  location?: string
  suggestion?: string
}

export interface ChapterQualityReport {
  // 总体评分
  overallScore: number           // 0-100
  
  // 多维度评分
  dimensions: DimensionScore[]
  
  // AI味检测
  aiIndicators: {
    wordScore: number            // 词汇AI味
    patternScore: number         // 模式AI味
    structureScore: number       // 结构AI味
    rhythmScore: number          // 节奏AI味
    immersiveScore: number       // 沉浸度
  }
  
  // 问题列表
  issues: Issue[]
  
  // 改进建议
  suggestions: string[]
  
  // 统计数据
  statistics: {
    totalWords: number
    totalParagraphs: number
    totalSentences: number
    avgParagraphLength: number
    avgSentenceLength: number
    dialogueRatio: number         // 对话占比
    descriptionRatio: number      // 描写占比
    adverbDensity: number         // 副词密度
  }
}

// ============================================
// 评分计算
// ============================================

/**
 * 计算章节AI质量评分
 */
export function analyzeChapterQuality(content: string): ChapterQualityReport {
  if (!content || content.trim().length === 0) {
    return createEmptyReport()
  }

  const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 0)
  const sentences = content.split(/[。！？]/).filter(s => s.trim().length > 0)
  
  // 统计数据
  const statistics = calculateStatistics(content, paragraphs, sentences)
  
  // AI指标检测
  const aiIndicators = calculateAiIndicators(content, paragraphs, sentences)
  
  // 多维度评分
  const dimensions = calculateDimensions(content, paragraphs, sentences, aiIndicators)
  
  // 计算总体评分
  const overallScore = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0)
  
  // 收集所有问题和建议
  const issues = dimensions.flatMap(d => d.issues)
  const suggestions = [...new Set(dimensions.flatMap(d => d.suggestions))]

  return {
    overallScore: Math.round(overallScore),
    dimensions,
    aiIndicators,
    issues,
    suggestions,
    statistics,
  }
}

/**
 * 创建空报告
 */
function createEmptyReport(): ChapterQualityReport {
  return {
    overallScore: 100,
    dimensions: [],
    aiIndicators: {
      wordScore: 100,
      patternScore: 100,
      structureScore: 100,
      rhythmScore: 100,
      immersiveScore: 100,
    },
    issues: [],
    suggestions: [],
    statistics: {
      totalWords: 0,
      totalParagraphs: 0,
      totalSentences: 0,
      avgParagraphLength: 0,
      avgSentenceLength: 0,
      dialogueRatio: 0,
      descriptionRatio: 0,
      adverbDensity: 0,
    },
  }
}

/**
 * 计算统计数据
 */
function calculateStatistics(
  content: string,
  paragraphs: string[],
  sentences: string[]
): ChapterQualityReport['statistics'] {
  const totalWords = content.replace(/\s/g, '').length
  const totalParagraphs = paragraphs.length
  const totalSentences = sentences.length
  
  // 平均段落长度
  const paragraphLengths = paragraphs.map(p => p.replace(/\s/g, '').length)
  const avgParagraphLength = totalParagraphs > 0 
    ? paragraphLengths.reduce((a, b) => a + b, 0) / totalParagraphs 
    : 0
  
  // 平均句子长度
  const sentenceLengths = sentences.map(s => s.replace(/\s/g, '').length)
  const avgSentenceLength = totalSentences > 0
    ? sentenceLengths.reduce((a, b) => a + b, 0) / totalSentences
    : 0
  
  // 对话占比（估算）
  const dialogueMatches = content.match(/["""''][^""'']*["""'']/g) || []
  const dialogueLength = dialogueMatches.reduce((sum, d) => sum + d.length, 0)
  const dialogueRatio = totalWords > 0 ? dialogueLength / totalWords : 0
  
  // 描写占比（动作、心理、环境描写的词数占比）
  const descriptionKeywords = ['看着', '望着', '想着', '感觉到', '听到', '闻到', '伸手', '转头', '皱起', '露出', '嘴角', '眉头']
  const descriptionMatches = descriptionKeywords.reduce((count, keyword) => {
    const matches = content.match(new RegExp(keyword, 'g')) || []
    return count + matches.length
  }, 0)
  const descriptionRatio = totalWords > 0 ? (descriptionMatches * 2) / totalWords : 0
  
  // 副词密度
  const adverbPattern = /[\u4e00-\u9fa5]+地/g
  const adverbMatches = content.match(adverbPattern) || []
  const adverbDensity = totalSentences > 0 ? adverbMatches.length / totalSentences : 0

  return {
    totalWords,
    totalParagraphs,
    totalSentences,
    avgParagraphLength: Math.round(avgParagraphLength),
    avgSentenceLength: Math.round(avgSentenceLength),
    dialogueRatio: Math.round(dialogueRatio * 100),
    descriptionRatio: Math.min(100, Math.round(descriptionRatio * 100)),
    adverbDensity: Math.round(adverbDensity * 100) / 100,
  }
}

/**
 * 计算AI指标
 */
function calculateAiIndicators(
  content: string,
  paragraphs: string[],
  sentences: string[]
): ChapterQualityReport['aiIndicators'] {
  // 1. 词汇AI味
  const wordScan = scanWordsByLevel(content)
  const criticalCount = wordScan.critical.reduce((sum, w) => sum + w.count, 0)
  const warningCount = wordScan.warning.reduce((sum, w) => sum + w.count, 0)
  const optionalCount = wordScan.optional.reduce((sum, w) => sum + w.count, 0)
  const wordScore = Math.max(0, 100 - criticalCount * 5 - warningCount * 2 - optionalCount)

  // 2. 模式AI味
  const patternScan = scanForbiddenPatterns(content)
  const patternScore = Math.max(0, 100 - patternScan.reduce((sum, p) => sum + p.severity * 8, 0))

  // 3. 结构AI味
  let structureScore = 100
  // 检查段落长度方差
  if (paragraphs.length >= 3) {
    const lengths = paragraphs.map(p => p.length)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLen, 2), 0) / lengths.length
    const cv = Math.sqrt(variance) / (avgLen || 1)
    if (cv < 0.15) structureScore -= 20
    else if (cv < 0.25) structureScore -= 10
    if (cv > 0.5) structureScore += 10 // 方差大是好事
  }
  structureScore = Math.max(0, Math.min(100, structureScore))

  // 4. 节奏AI味
  let rhythmScore = 100
  // 检查句子长度变化
  if (sentences.length >= 5) {
    const lengths = sentences.map(s => s.replace(/\s/g, '').length)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLen, 2), 0) / lengths.length
    const cv = Math.sqrt(variance) / (avgLen || 1)
    if (cv < 0.2) rhythmScore -= 15
    else if (cv > 0.4) rhythmScore += 5
  }
  // 检查是否有重复的句式开头
  const sentenceStarts = sentences.slice(0, 10).map(s => {
    const trimmed = s.trim()
    if (/^["""'']/.test(trimmed)) return 'dialogue'
    if (/^[他她它]/.test(trimmed)) return 'pronoun'
    if (/^[的]/.test(trimmed)) return 'modifier'
    return 'other'
  })
  const startCounts = new Map<string, number>()
  sentenceStarts.forEach(s => startCounts.set(s, (startCounts.get(s) || 0) + 1))
  const maxStartCount = Math.max(...startCounts.values())
  if (maxStartCount > 4) rhythmScore -= 10
  else if (maxStartCount > 3) rhythmScore -= 5
  rhythmScore = Math.max(0, Math.min(100, rhythmScore))

  // 5. 沉浸度（越高越好）
  let immersiveScore = 100
  // 检查是否有足够的感官描写
  const sensoryWords = ['看着', '望着', '听着', '闻着', '感觉到', '感受到', '伸手', '抬手', '迈步', '心跳', '呼吸']
  const sensoryCount = sensoryWords.reduce((count, word) => {
    const matches = content.match(new RegExp(word, 'g')) || []
    return count + matches.length
  }, 0)
  immersiveScore += Math.min(10, sensoryCount * 2)
  // 检查是否有足够的对话（但不是太多）
  const dialogueCount = (content.match(/["""'']/g) || []).length / 2
  const dialogueRatio = content.length > 0 ? dialogueCount / (content.length / 100) : 0
  if (dialogueRatio > 0.3) immersiveScore -= 10  // 对话太多
  if (dialogueRatio < 0.1) immersiveScore -= 5   // 对话太少
  // 检查是否有留白
  if (content.includes('……') || content.includes('...') || content.includes('......')) {
    immersiveScore += 5
  }
  immersiveScore = Math.max(0, Math.min(100, immersiveScore))

  return {
    wordScore,
    patternScore,
    structureScore,
    rhythmScore,
    immersiveScore,
  }
}

/**
 * 计算多维度评分
 */
function calculateDimensions(
  content: string,
  paragraphs: string[],
  sentences: string[],
  aiIndicators: ChapterQualityReport['aiIndicators']
): DimensionScore[] {
  const issues: Issue[] = []
  const suggestions: string[] = []

  // 1. 词汇维度
  const wordScan = scanWordsByLevel(content)
  const wordIssues: Issue[] = []
  if (wordScan.critical.length > 0) {
    const words = wordScan.critical.map(w => `"${w.word}"`).join('、')
    wordIssues.push({
      type: 'word',
      severity: 'critical',
      description: `发现 ${wordScan.critical.reduce((s, w) => s + w.count, 0)} 处L1级禁用词`,
      location: words,
      suggestion: '立即替换这些明显的AI特征词',
    })
    suggestions.push('替换所有L1级禁用词：' + wordScan.critical.map(w => w.word).join('、'))
  }
  if (wordScan.warning.length > 0) {
    wordIssues.push({
      type: 'word',
      severity: 'warning',
      description: `发现 ${wordScan.warning.reduce((s, w) => s + w.count, 0)} 处L2级AI特征词`,
      location: wordScan.warning.slice(0, 5).map(w => `"${w.word}"`).join('、'),
      suggestion: '考虑替换这些词以提升自然度',
    })
  }

  // 2. 模式维度
  const patternScan = scanForbiddenPatterns(content)
  const patternIssues: Issue[] = patternScan.map(p => ({
    type: 'pattern' as const,
    severity: p.severity >= 2 ? 'critical' as const : 'warning' as const,
    description: p.pattern,
    location: p.matches.slice(0, 2).join('；'),
    suggestion: p.pattern.examples?.good || '改变这种模式化写法',
  }))
  suggestions.push(...patternScan.map(p => `修正模式问题：${p.pattern}`))

  // 3. 结构维度
  const structureIssues: Issue[] = []
  if (paragraphs.length >= 3) {
    const lengths = paragraphs.map(p => p.length)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLen, 2), 0) / lengths.length
    const cv = Math.sqrt(variance) / (avgLen || 1)
    if (cv < 0.15) {
      structureIssues.push({
        type: 'structure',
        severity: 'warning',
        description: '段落长度过于均匀',
        suggestion: '让段落长短不一，增加节奏变化',
      })
      suggestions.push('打破均匀的段落结构，让长短段落交替')
    }
  }

  // 4. 节奏维度
  const rhythmIssues: Issue[] = []
  const adverbPattern = /[\u4e00-\u9fa5]+地/g
  const adverbMatches = content.match(adverbPattern) || []
  if (adverbMatches.length > sentences.length * 0.5) {
    rhythmIssues.push({
      type: 'rhythm',
      severity: 'warning',
      description: `副词密度过高（${adverbMatches.length}个/ ${sentences.length}句）`,
      suggestion: '减少副词使用，用具体动作替代',
    })
    suggestions.push('降低副词密度，用动词和名词替代')
  }

  // 5. 沉浸度维度
  const immersiveIssues: Issue[] = []
  const sensoryWords = ['看着', '望着', '听着', '感觉到', '感受到', '心跳', '呼吸']
  const sensoryCount = sensoryWords.reduce((count, word) => {
    const matches = content.match(new RegExp(word, 'g')) || []
    return count + matches.length
  }, 0)
  if (sensoryCount < 3 && content.length > 1000) {
    immersiveIssues.push({
      type: 'immersive',
      severity: 'info',
      description: '感官描写偏少',
      suggestion: '增加更多视觉、听觉、触觉等感官描写',
    })
    suggestions.push('增加感官细节描写，提升沉浸感')
  }

  return [
    {
      name: '词汇自然度',
      score: aiIndicators.wordScore,
      weight: 0.25,
      issues: wordIssues,
      suggestions: wordIssues.filter(i => i.suggestion).map(i => i.suggestion!),
    },
    {
      name: '模式多样性',
      score: aiIndicators.patternScore,
      weight: 0.20,
      issues: patternIssues,
      suggestions: patternIssues.filter(i => i.suggestion).map(i => i.suggestion!),
    },
    {
      name: '结构变化',
      score: aiIndicators.structureScore,
      weight: 0.20,
      issues: structureIssues,
      suggestions: structureIssues.filter(i => i.suggestion).map(i => i.suggestion!),
    },
    {
      name: '节奏韵律',
      score: aiIndicators.rhythmScore,
      weight: 0.15,
      issues: rhythmIssues,
      suggestions: rhythmIssues.filter(i => i.suggestion).map(i => i.suggestion!),
    },
    {
      name: '沉浸体验',
      score: aiIndicators.immersiveScore,
      weight: 0.20,
      issues: immersiveIssues,
      suggestions: immersiveIssues.filter(i => i.suggestion).map(i => i.suggestion!),
    },
  ]
}

/**
 * 快速检测章节AI味道（用于列表展示）
 */
export function quickDetectAiScore(content: string): number {
  if (!content) return 100
  
  const wordScan = scanForbiddenWords(content)
  const patternScan = scanForbiddenPatterns(content)
  
  let score = 100
  for (const w of wordScan) {
    score -= w.word.level === 'critical' ? 5 : w.word.level === 'warning' ? 2 : 0.5
  }
  for (const p of patternScan) {
    score -= p.severity * 8
  }
  
  return Math.max(0, Math.min(100, Math.round(score)))
}

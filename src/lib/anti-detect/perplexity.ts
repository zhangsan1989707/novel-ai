/**
 * 基于统计特征的AI文本检测
 * 模拟 GPTZero / Originality.ai 的核心算法思路
 *
 * 核心原理：
 * - AI文本的句长分布高度均匀（人类写作忽长忽短）
 * - AI文本的词汇多样性偏低（重复用词较多）
 * - AI文本的N-gram重复率偏高
 * - AI文本的段落结构过于工整
 */

export interface PerplexityResult {
  score: number
  burstiness: number
  avgSentenceLength: number
  sentenceLengthStdDev: number
  vocabularyRichness: number
  repeatedPhrases: string[]
  details: {
    uniformScore: number
    diversityScore: number
    patternScore: number
    structureScore: number
  }
}

const CJK_CHAR_REGEX = /[\u4e00-\u9fa5\u3400-\u4dbf\uf900-\ufaff]/

function isCJK(c: string): boolean {
  return CJK_CHAR_REGEX.test(c)
}

function getSentences(text: string): string[] {
  const raw = text.split(/[。！？；\n]+/).filter(s => s.trim().length > 0)
  return raw
}

function getChineseChars(text: string): string {
  return text.replace(/\s/g, '')
}

function getWords(text: string): string[] {
  const cleaned = text.replace(/[\s，。！？、；：""''（）《》…—\-,\\.!\?;:'"()\n\r]/g, '')
  const words: string[] = []
  for (const char of cleaned) {
    if (isCJK(char)) {
      words.push(char)
    }
  }
  return words
}

function getBigrams(words: string[]): string[] {
  const bigrams: string[] = []
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(words[i] + words[i + 1])
  }
  return bigrams
}

function getTrigrams(words: string[]): string[] {
  const trigrams: string[] = []
  for (let i = 0; i < words.length - 2; i++) {
    trigrams.push(words[i] + words[i + 1] + words[i + 2])
  }
  return trigrams
}

/**
 * 计算文本的困惑度近似值和突发度
 *
 * @param text - 待检测的中文文本
 * @returns 困惑度分析结果
 */
export function calculatePerplexity(text: string): PerplexityResult {
  const sentences = getSentences(text)
  if (sentences.length < 3) {
    return {
      score: 0,
      burstiness: 1,
      avgSentenceLength: 0,
      sentenceLengthStdDev: 0,
      vocabularyRichness: 1,
      repeatedPhrases: [],
      details: {
        uniformScore: 0,
        diversityScore: 0,
        patternScore: 0,
        structureScore: 0,
      },
    }
  }

  const sentenceLengths = sentences.map(s => getChineseChars(s).length).filter(l => l > 0)
  const avgLen = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length

  const variance =
    sentenceLengths.reduce((sum, len) => sum + (len - avgLen) ** 2, 0) / sentenceLengths.length
  const stdDev = Math.sqrt(variance)

  const uniformScore = calculateUniformScore(sentences, sentenceLengths, avgLen, stdDev)
  const { diversityScore, ttr } = calculateDiversityScore(text)
  const { patternScore, repeatedPhrases } = calculatePatternScore(text)
  const structureScore = calculateStructureScore(sentences)

  const burstiness = calculateBurstiness(sentenceLengths)

  const score = Math.min(100, Math.round(
    uniformScore * 28 +
    diversityScore * 25 +
    patternScore * 22 +
    structureScore * 25
  ))

  return {
    score,
    burstiness: Math.round(burstiness * 100) / 100,
    avgSentenceLength: Math.round(avgLen * 100) / 100,
    sentenceLengthStdDev: Math.round(stdDev * 100) / 100,
    vocabularyRichness: Math.round(ttr * 1000) / 1000,
    repeatedPhrases,
    details: {
      uniformScore: Math.round(uniformScore * 100) / 100,
      diversityScore: Math.round(diversityScore * 100) / 100,
      patternScore: Math.round(patternScore * 100) / 100,
      structureScore: Math.round(structureScore * 100) / 100,
    },
  }
}

/**
 * 句长均匀度评分
 *
 * CV（变异系数）= stdDev / avgLen 越小越均匀，越像AI
 * 人类写作 CV 通常在 0.5-1.2 范围内
 * AI文本 CV 通常在 0.2-0.5 范围内
 */
function calculateUniformScore(
  _sentences: string[],
  _sentenceLengths: number[],
  avgLen: number,
  stdDev: number
): number {
  if (avgLen === 0) return 0
  const cv = stdDev / avgLen

  if (cv < 0.2) return 0.95
  if (cv < 0.35) return 0.85
  if (cv < 0.45) return 0.7
  if (cv < 0.55) return 0.5
  if (cv < 0.65) return 0.3
  if (cv < 0.8) return 0.15
  return 0.05
}

/**
 * 词汇多样性评分
 *
 * TTR (Type-Token Ratio) = 不同词数 / 总词数
 * AI文本 TTR 偏低（< 0.4 高度可疑）
 * 人类写作 TTR 通常在 0.45-0.7
 */
function calculateDiversityScore(text: string): { diversityScore: number; ttr: number } {
  const words = getWords(text)
  if (words.length < 10) return { diversityScore: 0, ttr: 1 }

  const uniqueWords = new Set(words)
  const ttr = uniqueWords.size / words.length

  if (ttr < 0.3) return { diversityScore: 0.95, ttr }
  if (ttr < 0.38) return { diversityScore: 0.8, ttr }
  if (ttr < 0.45) return { diversityScore: 0.6, ttr }
  if (ttr < 0.52) return { diversityScore: 0.35, ttr }
  if (ttr < 0.6) return { diversityScore: 0.15, ttr }
  return { diversityScore: 0.05, ttr }
}

/**
 * N-gram 重复率评分
 *
 * 检测2-gram和3-gram的重复模式
 * AI文本倾向于重复使用相同的短语组合
 */
function calculatePatternScore(text: string): { patternScore: number; repeatedPhrases: string[] } {
  const words = getWords(text)
  if (words.length < 20) return { patternScore: 0, repeatedPhrases: [] }

  const bigrams = getBigrams(words)
  const trigrams = getTrigrams(words)

  const bigramFreq = new Map<string, number>()
  for (const bg of bigrams) {
    bigramFreq.set(bg, (bigramFreq.get(bg) || 0) + 1)
  }

  const trigramFreq = new Map<string, number>()
  for (const tg of trigrams) {
    trigramFreq.set(tg, (trigramFreq.get(tg) || 0) + 1)
  }

  const repeatedBigrams = [...bigramFreq.entries()].filter(([, c]) => c >= 3).length
  const repeatedTrigrams = [...trigramFreq.entries()].filter(([, c]) => c >= 2).length

  const repeatedPhrases = [
    ...[...bigramFreq.entries()].filter(([, c]) => c >= 3).map(([w]) => w),
    ...[...trigramFreq.entries()].filter(([, c]) => c >= 2).map(([w]) => w),
  ].slice(0, 10)

  const bigramRepeatRatio = bigrams.length > 0 ? repeatedBigrams / bigrams.length : 0
  const trigramRepeatRatio = trigrams.length > 0 ? repeatedTrigrams / trigrams.length : 0

  const combinedRatio = bigramRepeatRatio * 0.6 + trigramRepeatRatio * 0.4

  if (combinedRatio > 0.08) return { patternScore: 0.9, repeatedPhrases }
  if (combinedRatio > 0.05) return { patternScore: 0.7, repeatedPhrases }
  if (combinedRatio > 0.03) return { patternScore: 0.5, repeatedPhrases }
  if (combinedRatio > 0.02) return { patternScore: 0.3, repeatedPhrases }
  if (combinedRatio > 0.01) return { patternScore: 0.15, repeatedPhrases }
  return { patternScore: 0.05, repeatedPhrases }
}

/**
 * 结构工整度评分
 *
 * 检查段落长度分布、开头句式多样性
 * AI文本的段落结构往往过于工整
 */
function calculateStructureScore(sentences: string[]): number {
  if (sentences.length < 5) return 0

  const paragraphLengths: number[] = []
  let currentLen = 0
  for (const s of sentences) {
    currentLen += getChineseChars(s).length
    if (s.endsWith('\n') || s === sentences[sentences.length - 1]) {
      if (currentLen > 0) {
        paragraphLengths.push(currentLen)
        currentLen = 0
      }
    }
  }

  if (paragraphLengths.length === 0) {
    for (const s of sentences) {
      paragraphLengths.push(getChineseChars(s).length)
    }
  }

  if (paragraphLengths.length < 2) return 0.3

  const avgLen = paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length
  const variance =
    paragraphLengths.reduce((sum, len) => sum + (len - avgLen) ** 2, 0) / paragraphLengths.length
  const stdDev = Math.sqrt(variance)
  const cv = avgLen > 0 ? stdDev / avgLen : 0

  const starts: string[] = sentences.slice(0, 20).map(s => {
    const cleaned = s.trim()
    return cleaned.length >= 2 ? cleaned.substring(0, 2) : cleaned
  })
  const uniqueStarts = new Set(starts)
  const startDiversity = starts.length > 0 ? uniqueStarts.size / starts.length : 1

  let startScore = 0
  if (startDiversity < 0.3) startScore = 0.85
  else if (startDiversity < 0.45) startScore = 0.65
  else if (startDiversity < 0.55) startScore = 0.4
  else if (startDiversity < 0.7) startScore = 0.2
  else startScore = 0.05

  let cvScore = 0
  if (cv < 0.3) cvScore = 0.85
  else if (cv < 0.5) cvScore = 0.6
  else if (cv < 0.7) cvScore = 0.35
  else if (cv < 0.9) cvScore = 0.15
  else cvScore = 0.05

  return cvScore * 0.6 + startScore * 0.4
}

/**
 * 计算突发度（burstiness）
 *
 * 突发度 = max(句子长度) / avg(句子长度)
 * 该比值越大，说明句长变化越剧烈，越像人类写作
 * AI文本句长均匀，该比值接近1
 *
 * @param sentenceLengths - 各句子长度数组
 * @returns 突发度 0-1，越低越像AI
 */
function calculateBurstiness(sentenceLengths: number[]): number {
  if (sentenceLengths.length < 3) return 1

  const maxLen = Math.max(...sentenceLengths)
  const minLen = Math.min(...sentenceLengths.filter(l => l > 0))
  if (minLen === 0) return 1

  const range = maxLen - minLen
  const avg = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
  if (avg === 0) return 1

  const ratio = range / avg

  if (ratio > 3) return 0.95
  if (ratio > 2.5) return 0.85
  if (ratio > 2) return 0.7
  if (ratio > 1.5) return 0.5
  if (ratio > 1) return 0.3
  if (ratio > 0.6) return 0.15
  return 0.05
}
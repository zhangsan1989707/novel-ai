import { StyleValidationResult, StyleProfileData, StyleRiskLevel } from '@/types/style'
import { countChineseWords } from '@/lib/utils'

export function scoreStyleConsistency(
  generatedContent: string,
  styleProfile: StyleProfileData
): StyleValidationResult {
  const proseMatch = scoreProseMatch(generatedContent, styleProfile)
  const sentenceMatch = scoreSentenceMatch(generatedContent, styleProfile)
  const vocabularyMatch = scoreVocabularyMatch(generatedContent, styleProfile)
  const narrativeMatch = scoreNarrativeMatch(generatedContent, styleProfile)
  const plotMatch = scorePlotMatch(generatedContent, styleProfile)

  const weights = { prose: 0.25, sentence: 0.20, vocabulary: 0.15, narrative: 0.20, plot: 0.20 }
  const styleConsistencyScore = Math.round(
    proseMatch * weights.prose +
    sentenceMatch * weights.sentence +
    vocabularyMatch * weights.vocabulary +
    narrativeMatch * weights.narrative +
    plotMatch * weights.plot
  )

  const similarityAlerts: string[] = []
  const forbiddenPhrases = styleProfile.generationGuide.avoid || []
  for (const phrase of forbiddenPhrases) {
    if (generatedContent.includes(phrase)) {
      similarityAlerts.push(`检测到风格禁忌词"${phrase}"`)
    }
  }

  const riskLevel = determineOutputRiskLevel(styleConsistencyScore, similarityAlerts, styleProfile.riskLevel)

  return {
    styleConsistencyScore,
    riskLevel,
    riskNotes: buildRiskNotes(riskLevel, similarityAlerts, styleProfile),
    proseMatch,
    sentenceMatch,
    vocabularyMatch,
    narrativeMatch,
    plotMatch,
    similarityAlerts,
  }
}

function scoreProseMatch(content: string, profile: StyleProfileData): number {
  let score = 50

  const dialogueRatio = estimateDialogueRatio(content)
  if (profile.prose.dialogueDensity > 0) {
    const expectedRatio = profile.prose.dialogueDensity / 100
    const diff = Math.abs(dialogueRatio - expectedRatio)
    if (diff < 0.1) score += 20
    else if (diff < 0.2) score += 10
    else score -= 10
  }

  const avgSentenceLen = estimateAvgSentenceLength(content)
  switch (profile.prose.sentenceLength) {
    case 'short':
      if (avgSentenceLen < 15) score += 15
      else if (avgSentenceLen < 25) score += 5
      else score -= 10
      break
    case 'long':
      if (avgSentenceLen > 30) score += 15
      else if (avgSentenceLen > 20) score += 5
      else score -= 10
      break
    case 'medium':
      if (avgSentenceLen >= 15 && avgSentenceLen <= 30) score += 15
      else score -= 5
      break
    case 'mixed':
      score += 10
      break
  }

  return Math.min(100, Math.max(0, score))
}

function scoreSentenceMatch(content: string, profile: StyleProfileData): number {
  let score = 50

  const patterns = profile.sentence.commonPatterns || []
  if (patterns.length > 0) {
    let matched = 0
    for (const pattern of patterns) {
      if (content.includes(pattern)) matched++
    }
    score += Math.round((matched / patterns.length) * 30)
  }

  const paragraphPattern = profile.sentence.paragraphPattern
  if (paragraphPattern && paragraphPattern.length > 0) {
    score += 10
  }

  return Math.min(100, Math.max(0, score))
}

function scoreVocabularyMatch(content: string, profile: StyleProfileData): number {
  let score = 50

  const commonWords = profile.vocabulary.commonWords || []
  if (commonWords.length > 0) {
    let matched = 0
    for (const word of commonWords) {
      if (content.includes(word)) matched++
    }
    score += Math.round((matched / commonWords.length) * 30)
  }

  const forbiddenWords = profile.vocabulary.forbiddenWords || []
  for (const word of forbiddenWords) {
    if (content.includes(word)) score -= 10
  }

  return Math.min(100, Math.max(0, score))
}

function scoreNarrativeMatch(content: string, profile: StyleProfileData): number {
  let score = 50

  switch (profile.narrative.pov) {
    case 'first':
      if (countFirstPersonPronouns(content) > 5) score += 20
      else score -= 10
      break
    case 'third_limited':
      if (countThirdPersonPronouns(content) > 5 && countFirstPersonPronouns(content) < 5) score += 20
      break
    case 'third_omniscient':
      score += 15
      break
    case 'mixed':
      score += 10
      break
  }

  if (profile.narrative.suspenseMethod) score += 10

  return Math.min(100, Math.max(0, score))
}

function scorePlotMatch(content: string, profile: StyleProfileData): number {
  let score = 50

  const wordCount = countChineseWords(content)
  const reversalScore = profile.plot.reversalFrequency || 0
  if (reversalScore > 50 && wordCount > 1000) {
    score += 10
  }

  if (profile.plot.cliffhangerStyle && profile.plot.cliffhangerStyle.length > 0) {
    score += 10
  }

  return Math.min(100, Math.max(0, score))
}

function determineOutputRiskLevel(
  styleScore: number,
  alerts: string[],
  profileRisk: StyleRiskLevel
): StyleRiskLevel {
  if (alerts.length > 2) return 'HIGH'
  if (alerts.length > 0 || (profileRisk === 'HIGH' && styleScore > 80)) return 'MEDIUM'
  if (profileRisk === 'MEDIUM' && styleScore > 70) return 'MEDIUM'
  return 'LOW'
}

function buildRiskNotes(
  riskLevel: StyleRiskLevel,
  alerts: string[],
  profile: StyleProfileData
): string[] {
  const notes: string[] = [...alerts]
  if (riskLevel === 'HIGH') {
    notes.push('输出高度接近源风格，建议降低风格强度或人工审核')
  }
  if (riskLevel === 'MEDIUM') {
    notes.push('输出与源风格相似度中等，建议关注')
  }
  if (profile.riskLevel !== 'LOW') {
    notes.push(`源风格风险等级: ${profile.riskLevel}`)
  }
  return notes
}

function estimateDialogueRatio(text: string): number {
  const quoteMatches = (text.match(/["""'']/g) || []).length
  const totalChars = text.replace(/\s/g, '').length
  if (totalChars === 0) return 0
  return Math.min(1, quoteMatches * 20 / totalChars)
}

function estimateAvgSentenceLength(text: string): number {
  const sentences = text.split(/[。！？.!?]/).filter(s => s.trim().length > 0)
  if (sentences.length === 0) return 0
  const totalChars = sentences.reduce((sum, s) => sum + s.length, 0)
  return Math.round(totalChars / sentences.length)
}

function countFirstPersonPronouns(text: string): number {
  return (text.match(/我/g) || []).length
}

function countThirdPersonPronouns(text: string): number {
  return (text.match(/他|她/g) || []).length
}

export function checkSimilarityRisk(
  generatedContent: string,
  sourceExcerpt: string,
  threshold: number = 20
): string[] {
  const alerts: string[] = []

  const forbiddenNames = extractProperNouns(sourceExcerpt)
  for (const name of forbiddenNames) {
    if (generatedContent.includes(name) && name.length >= 2) {
      alerts.push(`检测到与源文相同的专有名词："${name}"`)
    }
  }

  const shortPhrases = extractDistinctivePhrases(sourceExcerpt, threshold)
  for (const phrase of shortPhrases) {
    if (generatedContent.includes(phrase) && phrase.length >= 8) {
      alerts.push(`检测到与源文连续的近似表达（${phrase.length}字）`)
    }
  }

  return alerts
}

function extractProperNouns(text: string): string[] {
  const names: string[] = []
  const sourceExcerpt = text.slice(0, 10000)
  const lines = sourceExcerpt.split(/[。！？.!?\n]+/)

  for (const line of lines) {
    const matches = line.match(/[\u4e00-\u9fa5]{2,4}/g)
    if (matches) {
      for (const m of matches) {
        if (!names.includes(m) && !isCommonWord(m)) {
          names.push(m)
        }
        if (names.length >= 20) break
      }
    }
  }

  return names.slice(0, 15)
}

function extractDistinctivePhrases(text: string, minLength: number): string[] {
  const phrases: string[] = []
  const sourceExcerpt = text.slice(0, 30000)
  const sentences = sourceExcerpt.split(/[。！？.!?]+/)

  for (const sentence of sentences) {
    const trimmed = sentence.trim().replace(/\s/g, '')
    if (trimmed.length >= minLength && trimmed.length <= 50) {
      phrases.push(trimmed)
    }
  }

  return phrases.slice(0, 20)
}

function isCommonWord(word: string): boolean {
  const commonWords = [
    '不过', '所以', '因为', '但是', '而且', '虽然', '然而',
    '开始', '已经', '这个', '那个', '什么', '怎么', '为什么',
    '可以', '应该', '直接', '完全', '非常', '一定', '可能',
    '其中', '此时', '突然', '终于', '立刻', '马上', '一直',
  ]
  return commonWords.includes(word)
}
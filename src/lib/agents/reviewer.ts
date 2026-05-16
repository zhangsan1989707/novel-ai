import { AIService } from '@/lib/ai/service'
import {
  buildMaleReaderReviewPrompt,
  buildFemaleReaderReviewPrompt,
  buildToxicityReviewPrompt,
  buildStructureReviewPrompt,
  type ReviewResult,
} from '../prompts/review'

interface ReviewInput {
  projectId: number
  content: string
  genre?: string | null
  targetAudience?: string | null
  chapterNo?: number
  worldSetting?: string | null
}

interface MultiReviewResult {
  reviews: ReviewResult[]
  overallScore: number
  consensus: string
  criticalIssues: string[]
  improvementPriority: string[]
}

async function runSingleReview(
  projectId: number,
  prompt: string,
  defaultReviewer: string
): Promise<ReviewResult> {
  const provider = await AIService.createProvider({
    projectId,
    usageType: 'REVIEWER',
  })

  const result = await provider.generate(prompt, {
    temperature: 0.3,
    maxTokens: 3000,
  })

  const jsonMatch = result.content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        reviewer: parsed.reviewer || defaultReviewer,
        scores: Array.isArray(parsed.scores)
          ? parsed.scores.map((s: { dimension?: string; score?: number; comment?: string }) => ({
              dimension: s.dimension || '',
              score: typeof s.score === 'number' ? Math.min(100, Math.max(0, s.score)) : 50,
              comment: s.comment || '',
            }))
          : [],
        overallScore: typeof parsed.overallScore === 'number' ? Math.min(100, Math.max(0, parsed.overallScore)) : 50,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      }
    } catch {
      return buildFallbackResult(defaultReviewer)
    }
  }

  return buildFallbackResult(defaultReviewer)
}

function buildFallbackResult(reviewer: string): ReviewResult {
  return {
    reviewer,
    scores: [],
    overallScore: 0,
    strengths: [],
    weaknesses: ['审稿分析失败，请重试'],
    suggestions: ['请重新执行审稿'],
  }
}

function computeOverallScore(reviews: ReviewResult[]): number {
  if (reviews.length === 0) return 0

  const weights: Record<string, number> = {
    '男频审稿人': 0.25,
    '女频审稿人': 0.25,
    '毒点检测器': 0.3,
    '结构分析师': 0.2,
  }

  let totalWeight = 0
  let weightedSum = 0

  for (const review of reviews) {
    const weight = weights[review.reviewer] || 0.25
    weightedSum += review.overallScore * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0
}

function generateConsensus(reviews: ReviewResult[]): string {
  const parts: string[] = []

  const allStrengths = reviews.flatMap(r => r.strengths)
  const allWeaknesses = reviews.flatMap(r => r.weaknesses)

  if (allStrengths.length > 0) {
    const topStrengths = allStrengths.slice(0, 3)
    parts.push(`作品亮点：${topStrengths.join('；')}。`)
  }

  if (allWeaknesses.length > 0) {
    const topWeaknesses = allWeaknesses.slice(0, 3)
    parts.push(`主要不足：${topWeaknesses.join('；')}。`)
  }

  const avgScore = computeOverallScore(reviews)
  if (avgScore >= 80) {
    parts.push('整体质量优秀，具备较强的读者吸引力。')
  } else if (avgScore >= 60) {
    parts.push('整体质量尚可，但仍有较大提升空间。')
  } else if (avgScore >= 40) {
    parts.push('整体质量偏弱，需要重点修改。')
  } else {
    parts.push('整体质量较差，建议大幅修改或重写。')
  }

  return parts.join('')
}

function extractCriticalIssues(reviews: ReviewResult[]): string[] {
  const issues: string[] = []

  for (const review of reviews) {
    if (review.reviewer === '毒点检测器') {
      for (const score of review.scores) {
        if (score.score < 60) {
          issues.push(`[${review.reviewer}] ${score.dimension}：${score.comment}`)
        }
      }
    }

    for (const weakness of review.weaknesses) {
      if (weakness.includes('严重') || weakness.includes('违规') || weakness.includes('红线') || weakness.includes('弃书')) {
        issues.push(`[${review.reviewer}] ${weakness}`)
      }
    }
  }

  return [...new Set(issues)]
}

function computeImprovementPriority(reviews: ReviewResult[]): string[] {
  const allSuggestions = reviews.flatMap(r =>
    r.suggestions.map(s => ({ reviewer: r.reviewer, suggestion: s }))
  )

  const priorityOrder = ['毒点检测器', '结构分析师', '男频审稿人', '女频审稿人']
  allSuggestions.sort((a, b) => {
    const aIdx = priorityOrder.indexOf(a.reviewer)
    const bIdx = priorityOrder.indexOf(b.reviewer)
    return aIdx - bIdx
  })

  return allSuggestions.map(s => `[${s.reviewer}] ${s.suggestion}`)
}

export async function reviewerAgent(input: ReviewInput): Promise<MultiReviewResult> {
  const { projectId, content, genre, targetAudience, chapterNo, worldSetting } = input

  const promptInput = {
    content,
    genre,
    targetAudience,
    chapterNo,
    worldSetting,
  }

  const [maleReview, femaleReview, toxicityReview, structureReview] = await Promise.all([
    runSingleReview(
      projectId,
      buildMaleReaderReviewPrompt(promptInput),
      '男频审稿人'
    ),
    runSingleReview(
      projectId,
      buildFemaleReaderReviewPrompt(promptInput),
      '女频审稿人'
    ),
    runSingleReview(
      projectId,
      buildToxicityReviewPrompt(promptInput),
      '毒点检测器'
    ),
    runSingleReview(
      projectId,
      buildStructureReviewPrompt(promptInput),
      '结构分析师'
    ),
  ])

  const reviews = [maleReview, femaleReview, toxicityReview, structureReview]

  return {
    reviews,
    overallScore: computeOverallScore(reviews),
    consensus: generateConsensus(reviews),
    criticalIssues: extractCriticalIssues(reviews),
    improvementPriority: computeImprovementPriority(reviews),
  }
}

export type { ReviewInput, MultiReviewResult }

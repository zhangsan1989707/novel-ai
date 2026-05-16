import { AIService } from '@/lib/ai/service'
import { prisma } from '@/lib/prisma'
import { buildMarketAnalysisPrompt, buildGenreRecommendationPrompt } from '../prompts/market'
import { logger } from '@/lib/logger'

interface MarketAnalysisResult {
  genre: string
  platform: string
  trendDirection: string
  hotTags: string[]
  readerPreferences: string[]
  competitorAnalysis: string
  recommendations: { genre: string; reason: string; difficulty: string }[]
}

interface GenreRecommendation {
  genre: string
  subGenre: string
  reason: string
  targetAudience: string
  difficulty: 'easy' | 'medium' | 'hard'
  marketSaturation: 'low' | 'medium' | 'high'
}

export async function analyzeMarketTrend(params: {
  projectId?: number
  genre: string
  platform: string
  targetAudience?: string
}): Promise<MarketAnalysisResult> {
  const { projectId, genre, platform, targetAudience } = params

  let existingTrends: string | undefined
  if (projectId) {
    const recentTrends = await prisma.marketTrend.findMany({
      where: { platform, genre },
      orderBy: { rankDate: 'desc' },
      take: 3,
    })
    if (recentTrends.length > 0) {
      existingTrends = recentTrends
        .map((t: { rankDate: Date; trendDirection: string | null; hotTags: string[] }) => `日期: ${t.rankDate.toISOString().split('T')[0]}, 趋势: ${t.trendDirection || '未知'}, 热门标签: ${t.hotTags.join(', ')}`)
        .join('\n')
    }
  }

  const provider = await AIService.createProvider({
    projectId: projectId || null,
    usageType: 'MARKET_ANALYSIS',
  })

  const prompt = buildMarketAnalysisPrompt({
    genre,
    platform,
    targetAudience,
    existingTrends,
  })

  const result = await provider.generate(prompt, {
    temperature: 0.7,
    maxTokens: 4000,
  })

  let parsed: MarketAnalysisResult
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AI 返回内容无法解析为 JSON')
    }
    const raw = JSON.parse(jsonMatch[0])
    parsed = {
      genre,
      platform,
      trendDirection: raw.trendDirection || 'stable',
      hotTags: raw.hotTags || [],
      readerPreferences: raw.readerPreferences || [],
      competitorAnalysis: raw.competitorAnalysis || '',
      recommendations: (raw.recommendations || []).map((r: Record<string, string>) => ({
        genre: r.genre || '',
        reason: r.reason || '',
        difficulty: r.difficulty || 'medium',
      })),
    }
  } catch (e) {
    logger.error({ error: e, content: result.content }, 'Failed to parse market analysis result')
    parsed = {
      genre,
      platform,
      trendDirection: 'stable',
      hotTags: [],
      readerPreferences: [],
      competitorAnalysis: result.content,
      recommendations: [],
    }
  }

  await prisma.marketTrend.create({
    data: {
      platform,
      genre,
      rankDate: new Date(),
      trendDirection: parsed.trendDirection,
      hotTags: parsed.hotTags,
      analysisData: {
        readerPreferences: parsed.readerPreferences,
        competitorAnalysis: parsed.competitorAnalysis,
        recommendations: parsed.recommendations,
        targetAudience: targetAudience || null,
      },
    },
  })

  return parsed
}

export async function getGenreRecommendation(params: {
  userStrengths: string[]
  targetPlatform: string
  preferredGenres: string[]
}): Promise<GenreRecommendation[]> {
  const { userStrengths, targetPlatform, preferredGenres } = params

  const provider = await AIService.createProvider({
    usageType: 'GENRE_RECOMMENDATION',
  })

  const prompt = buildGenreRecommendationPrompt({
    userStrengths,
    targetPlatform,
    preferredGenres,
  })

  const result = await provider.generate(prompt, {
    temperature: 0.8,
    maxTokens: 4000,
  })

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AI 返回内容无法解析为 JSON')
    }
    const raw = JSON.parse(jsonMatch[0])
    return (raw.recommendations || []).map((r: Record<string, string>) => ({
      genre: r.genre || '',
      subGenre: r.subGenre || '',
      reason: r.reason || '',
      targetAudience: r.targetAudience || '',
      difficulty: r.difficulty as GenreRecommendation['difficulty'] || 'medium',
      marketSaturation: r.marketSaturation as GenreRecommendation['marketSaturation'] || 'medium',
    }))
  } catch (e) {
    logger.error({ error: e, content: result.content }, 'Failed to parse genre recommendation result')
    return []
  }
}

export async function getMarketTrends(params: {
  platform?: string
  genre?: string
  limit?: number
}) {
  const { platform, genre, limit = 20 } = params

  const where: Record<string, unknown> = {}
  if (platform) where.platform = platform
  if (genre) where.genre = genre

  return prisma.marketTrend.findMany({
    where,
    orderBy: { rankDate: 'desc' },
    take: limit,
  })
}

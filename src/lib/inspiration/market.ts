import { prisma } from '@/lib/prisma'
import { enhanceInspirations, type HotInspiration, type InspirationCategory } from './data'

type MarketTrendRow = {
  platform: string
  genre: string
  rankDate: Date
  avgWordCount: number
  updateFreq: string | null
  hotTags: string[]
  trendDirection: string | null
  analysisData: unknown
}

type MarketTrendInsight = {
  platform: string
  genre: string
  category: InspirationCategory
  trendDirection: string
  hotTags: string[]
  readerPreferences: string[]
  competitorAnalysis: string
  recommendationGenres: string[]
  rankDate: Date
  count: number
  avgWordCount: number
}

const platformLabels: Record<string, string> = {
  qidian: '起点',
  fanqie: '番茄',
  tomato: '番茄',
  jinjiang: '晋江',
  qimao: '七猫',
  ciweimao: '刺猬猫',
  feilu: '飞卢',
}

const categoryByGenre: Record<string, InspirationCategory> = {
  言情: 'female',
  古言: 'female',
  女强: 'female',
  都市: 'unisex',
  悬疑: 'unisex',
  玄幻: 'male',
  仙侠: 'male',
  科幻: 'male',
  历史: 'male',
  军事: 'male',
  游戏: 'male',
  轻小说: 'unisex',
}

const categoryByPlatform: Record<string, InspirationCategory> = {
  jinjiang: 'female',
  qidian: 'male',
  tomato: 'male',
  qimao: 'male',
  ciweimao: 'unisex',
  feilu: 'male',
}

function platformLabel(platform: string) {
  return platformLabels[platform] || platform.toUpperCase()
}

function uniqueStrings(values: Array<string | null | undefined>, limit?: number) {
  const result: string[] = []
  for (const value of values) {
    const text = value?.trim()
    if (!text || result.includes(text)) continue
    result.push(text)
    if (limit && result.length >= limit) break
  }
  return result
}

function inferCategory(genre: string, platform: string, hotTags: string[], readerPreferences: string[]): InspirationCategory {
  const text = `${genre} ${hotTags.join(' ')} ${readerPreferences.join(' ')}`
  if (/(女强|大女主|无CP|古言|言情|宅斗|宫斗|晋江|情感)/.test(text)) {
    return 'female'
  }
  if (/(玄幻|仙侠|科幻|历史|军事|悬疑|规则|智斗|系统|穿越|修仙)/.test(text)) {
    return categoryByPlatform[platform] || 'male'
  }
  return categoryByGenre[genre] || categoryByPlatform[platform] || 'unisex'
}

function scoreTrend(row: MarketTrendRow, count: number) {
  const recencyDays = Math.max(0, (Date.now() - new Date(row.rankDate).getTime()) / (1000 * 60 * 60 * 24))
  const recencyScore = Math.max(0, 30 - recencyDays)
  const directionScore = row.trendDirection === 'rising' ? 8 : row.trendDirection === 'stable' ? 5 : 2
  return count * 12 + recencyScore + directionScore
}

function buildInsight(rows: MarketTrendRow[]): MarketTrendInsight {
  const latest = rows[0]
  const trendDirection = rows.find(row => row.trendDirection)?.trendDirection || 'stable'
  const hotTags = uniqueStrings(rows.flatMap(row => row.hotTags || []), 8)
  const readerPreferences = uniqueStrings(
    rows.flatMap(row => {
      const analysis = row.analysisData as Record<string, unknown> | null
      return Array.isArray(analysis?.readerPreferences)
        ? (analysis?.readerPreferences as string[])
        : []
    }),
    5
  )
  const competitorAnalysis = rows.find(row => {
    const analysis = row.analysisData as Record<string, unknown> | null
    return typeof analysis?.competitorAnalysis === 'string' && analysis.competitorAnalysis.trim().length > 0
  })
  const recommendationGenres = uniqueStrings(
    rows.flatMap(row => {
      const analysis = row.analysisData as Record<string, unknown> | null
      const recommendations = Array.isArray(analysis?.recommendations) ? (analysis?.recommendations as Array<Record<string, unknown>>) : []
      return recommendations.map(r => (typeof r.genre === 'string' ? r.genre : '')).filter(Boolean)
    }),
    4
  )

  return {
    platform: latest.platform,
    genre: latest.genre,
    category: inferCategory(latest.genre, latest.platform, hotTags, readerPreferences),
    trendDirection,
    hotTags,
    readerPreferences,
    competitorAnalysis: (competitorAnalysis?.analysisData as Record<string, unknown> | null)?.competitorAnalysis as string || '',
    recommendationGenres,
    rankDate: latest.rankDate,
    count: rows.length,
    avgWordCount: Math.round(rows.reduce((sum, row) => sum + (row.avgWordCount || 0), 0) / Math.max(rows.length, 1)),
  }
}

function buildInspiration(insight: MarketTrendInsight): HotInspiration {
  const platformText = platformLabel(insight.platform)
  const trendLabel = insight.trendDirection === 'rising' ? '上升热势' : insight.trendDirection === 'declining' ? '降温回调' : '稳定热区'
  const coreElements = uniqueStrings([
    ...insight.hotTags.slice(0, 4),
    ...insight.readerPreferences.slice(0, 2),
    ...insight.recommendationGenres.slice(0, 2),
  ], 5)

  const summaryPieces = [
    `${platformText}最近 ${insight.count} 条趋势记录`,
    insight.hotTags.length > 0 ? `关键词：${insight.hotTags.slice(0, 4).join('、')}` : '',
    insight.readerPreferences.length > 0 ? `读者偏好：${insight.readerPreferences.slice(0, 3).join('、')}` : '',
  ].filter(Boolean)

  const targetAudience = insight.readerPreferences.length > 0
    ? insight.readerPreferences.slice(0, 2).join('；')
    : `${platformText}${insight.genre}读者`

  const hotScore = Math.min(10, Math.max(6, Math.round((insight.count * 1.4) + (insight.trendDirection === 'rising' ? 2 : 0) + (insight.hotTags.length > 0 ? 1 : 0))))

  return {
    id: `trend-${insight.platform}-${insight.genre}-${insight.rankDate.toISOString().slice(0, 10)}`,
    category: insight.category,
    title: `${platformText} ${insight.genre} · 爆点开写`,
    description: summaryPieces.join('，') || `${platformText} ${insight.genre} 当前处于${trendLabel}，更适合从冲突与反差切入，而不是复述榜单。`,
    exampleWorks: insight.recommendationGenres.length > 0
      ? insight.recommendationGenres.slice(0, 3)
      : insight.hotTags.slice(0, 3),
    coreElements: coreElements.length > 0 ? coreElements : [platformText, insight.genre, trendLabel],
    targetAudience,
    hotScore,
    sampleTitle: `${platformText}${insight.genre}：${insight.hotTags[0] || '爆点选题'}`,
    sampleSummary: `${platformText} ${insight.genre} 现在更值得写的是「${insight.hotTags.slice(0, 3).join('、') || '市场热词'}」的组合，而不是单纯复述热榜。${insight.competitorAnalysis ? ` 近期竞品要点：${insight.competitorAnalysis.slice(0, 80)}。` : ''}`,
    sampleGenre: insight.genre,
    sampleWritingStyle: insight.trendDirection === 'rising' ? '快节奏爽文' : '市场向选题',
    tags: uniqueStrings([insight.platform, insight.genre, insight.trendDirection, ...insight.hotTags], 6),
  }
}

export async function getMarketTrendInspirations(category?: InspirationCategory, limit: number = 6, random = false): Promise<HotInspiration[]> {
  const trends = await prisma.marketTrend.findMany({
    orderBy: [
      { rankDate: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 200,
  })

  if (trends.length === 0) {
    return []
  }

  const grouped = new Map<string, MarketTrendRow[]>()
  for (const trend of trends as MarketTrendRow[]) {
    const key = `${trend.platform}::${trend.genre}`
    const group = grouped.get(key) || []
    group.push(trend)
    grouped.set(key, group)
  }

  let insights = Array.from(grouped.values())
    .map(rows => ({ rows, score: scoreTrend(rows[0], rows.length) }))
    .sort((a, b) => b.score - a.score)
    .map(({ rows }) => buildInspiration(buildInsight(rows)))

  if (category) {
    insights = insights.filter(item => item.category === category)
  }

  if (random) {
    const shuffled = [...insights]
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    insights = shuffled
  }

  return enhanceInspirations(insights.slice(0, limit))
}

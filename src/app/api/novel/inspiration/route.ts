import { NextRequest, NextResponse } from 'next/server'
import { getInspirationsByCategory, getRandomInspirations, type InspirationCategory } from '@/lib/inspiration/data'
import { getMarketTrendInspirations } from '@/lib/inspiration/market'
import { getLiveInternetInspirations } from '@/lib/inspiration/live'
import { generateAIInspirations } from '@/lib/inspiration/ai-generator'

function shuffle<T>(items: T[]): T[] {
  const cloned = [...items]
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cloned[i], cloned[j]] = [cloned[j], cloned[i]]
  }
  return cloned
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as InspirationCategory | null
    const limit = parseInt(searchParams.get('limit') || '6')
    const random = searchParams.get('random') === 'true'
    const aiGenerate = searchParams.get('aiGenerate') !== 'false' // 默认启用

    // 实时抓取 + 市场趋势（并行）
    const [liveInspirations, aiInspirations] = await Promise.all([
      getLiveInternetInspirations(category || undefined, limit, random),
      aiGenerate ? generateAIInspirations(3) : Promise.resolve([]),
    ])

    // 获取市场趋势（实时数据为空时的降级）
    const marketInspirations = liveInspirations.length === 0
      ? await getMarketTrendInspirations(category || undefined, limit, random)
      : []

    // 混合数据源
    let inspirations: typeof liveInspirations

    if (liveInspirations.length > 0 && aiInspirations.length > 0) {
      // 实时数据 + AI 生成混合
      const aiCount = Math.min(aiInspirations.length, Math.ceil(limit / 3))
      const liveCount = limit - aiCount
      inspirations = [
        ...shuffle(liveInspirations).slice(0, liveCount),
        ...shuffle(aiInspirations).slice(0, aiCount),
      ]
    } else if (liveInspirations.length > 0) {
      inspirations = random ? shuffle(liveInspirations).slice(0, limit) : liveInspirations.slice(0, limit)
    } else if (aiInspirations.length > 0) {
      // 实时数据失败，用 AI 生成替代
      inspirations = shuffle(aiInspirations).slice(0, limit)
    } else if (marketInspirations.length > 0) {
      inspirations = random ? shuffle(marketInspirations).slice(0, limit) : marketInspirations.slice(0, limit)
    } else {
      // 最终兜底：静态数据
      inspirations = random
        ? getRandomInspirations(category || undefined, limit)
        : getInspirationsByCategory(category || undefined, limit)
    }

    // 打乱顺序
    if (random) {
      inspirations = shuffle(inspirations)
    }

    return NextResponse.json({
      success: true,
      data: inspirations,
    })
  } catch (error) {
    console.error('获取创作灵感失败:', error)
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取创作灵感失败' } },
      { status: 500 }
    )
  }
}

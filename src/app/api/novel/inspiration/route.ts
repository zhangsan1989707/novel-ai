import { NextRequest, NextResponse } from 'next/server'
import { getInspirationsByCategory, getRandomInspirations, type InspirationCategory, type HotInspiration } from '@/lib/inspiration/data'
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

// AI 灵感卡缓存（进程级，10 分钟 TTL）
let aiInspirationCache: { expiresAt: number; data: HotInspiration[] } | null = null
const AI_CACHE_TTL_MS = 10 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as InspirationCategory | null
    const limit = parseInt(searchParams.get('limit') || '6')
    const random = searchParams.get('random') === 'true'
    const mode = searchParams.get('mode') || 'fast'

    // ── 快速模式：静态数据秒回 ──────────────────────────
    if (mode === 'fast') {
      const staticData = random
        ? getRandomInspirations(category || undefined, limit)
        : getInspirationsByCategory(category || undefined, limit)
      return NextResponse.json({ success: true, data: staticData, mode: 'fast' })
    }

    // ── 完整模式：实时抓取 + AI 生成（带缓存） ──────────
    const aiGenerate = searchParams.get('aiGenerate') !== 'false'

    // AI 灵感卡有独立缓存，命中则跳过 LLM 调用
    let aiInspirations: HotInspiration[] = []
    if (aiGenerate) {
      const now = Date.now()
      if (aiInspirationCache && aiInspirationCache.expiresAt > now) {
        aiInspirations = aiInspirationCache.data
      } else {
        aiInspirations = await generateAIInspirations(3)
        if (aiInspirations.length > 0) {
          aiInspirationCache = { expiresAt: now + AI_CACHE_TTL_MS, data: aiInspirations }
        }
      }
    }

    const [liveInspirations] = await Promise.all([
      getLiveInternetInspirations(category || undefined, limit, random),
    ])

    // 获取市场趋势（实时数据为空时的降级）
    const marketInspirations = liveInspirations.length === 0
      ? await getMarketTrendInspirations(category || undefined, limit, random)
      : []

    // 混合数据源
    let inspirations: typeof liveInspirations

    if (liveInspirations.length > 0 && aiInspirations.length > 0) {
      const aiCount = Math.min(aiInspirations.length, Math.ceil(limit / 3))
      const liveCount = limit - aiCount
      inspirations = [
        ...shuffle(liveInspirations).slice(0, liveCount),
        ...shuffle(aiInspirations).slice(0, aiCount),
      ]
    } else if (liveInspirations.length > 0) {
      inspirations = random ? shuffle(liveInspirations).slice(0, limit) : liveInspirations.slice(0, limit)
    } else if (aiInspirations.length > 0) {
      inspirations = shuffle(aiInspirations).slice(0, limit)
    } else if (marketInspirations.length > 0) {
      inspirations = random ? shuffle(marketInspirations).slice(0, limit) : marketInspirations.slice(0, limit)
    } else {
      inspirations = random
        ? getRandomInspirations(category || undefined, limit)
        : getInspirationsByCategory(category || undefined, limit)
    }

    if (random) {
      inspirations = shuffle(inspirations)
    }

    return NextResponse.json({ success: true, data: inspirations, mode: 'full' })
  } catch (error) {
    console.error('获取创作灵感失败:', error)
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取创作灵感失败' } },
      { status: 500 }
    )
  }
}

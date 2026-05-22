import { NextRequest, NextResponse } from 'next/server'
import { getInspirationsByCategory, getRandomInspirations, type InspirationCategory } from '@/lib/inspiration/data'
import { getMarketTrendInspirations } from '@/lib/inspiration/market'
import { getLiveInternetInspirations } from '@/lib/inspiration/live'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as InspirationCategory | null
    const limit = parseInt(searchParams.get('limit') || '6')
    const random = searchParams.get('random') === 'true'

    const liveInspirations = await getLiveInternetInspirations(category || undefined, limit, random)
    const marketInspirations = liveInspirations.length === 0
      ? await getMarketTrendInspirations(category || undefined, limit, random)
      : []
    const inspirations = liveInspirations.length > 0
      ? liveInspirations
      : marketInspirations.length > 0
        ? marketInspirations
        : random
          ? getRandomInspirations(category || undefined, limit)
          : getInspirationsByCategory(category || undefined, limit)

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

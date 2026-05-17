import { NextRequest } from 'next/server'
import { tryCatch } from '@/lib/api-response'
import { getMarketTrends } from '@/lib/market/service'

export async function GET(request: NextRequest) {
  return tryCatch(async () => {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') || undefined
    const genre = searchParams.get('genre') || undefined
    const rawLimit = parseInt(searchParams.get('limit') || '20')
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 20 : rawLimit, 1), 100)

    const result = await getMarketTrends({
      platform,
      genre,
      limit,
    })

    return result
  })
}

import { NextRequest } from 'next/server'
import { tryCatch } from '@/lib/api-response'
import { analyzeMarketTrend } from '@/lib/market/service'

export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const body = await request.json()
    const { projectId, genre, platform, targetAudience } = body

    if (!genre || !platform) {
      throw new Error('题材和平台不能为空')
    }

    const result = await analyzeMarketTrend({
      projectId: projectId || undefined,
      genre,
      platform,
      targetAudience: targetAudience || undefined,
    })

    return result
  })
}

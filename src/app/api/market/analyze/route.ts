import { NextRequest } from 'next/server'
import { tryCatch, error } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'
import { analyzeMarketTrend } from '@/lib/market/service'
import { requireProjectOwner } from '@/lib/server/project-access'

export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const body = await request.json()
    const { projectId, genre, platform, targetAudience } = body

    if (!genre || !platform) {
      throw new ValidationError('题材和平台不能为空')
    }

    if (projectId) {
      const project = await requireProjectOwner(projectId)
      if (!project) {
        return error('NOT_FOUND', '项目不存在')
      }
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

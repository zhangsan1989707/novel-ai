import { NextRequest } from 'next/server'
import { tryCatch } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'
import { getGenreRecommendation } from '@/lib/market/service'

export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const body = await request.json()
    const { userStrengths, targetPlatform, preferredGenres } = body

    if (!userStrengths || !Array.isArray(userStrengths) || userStrengths.length === 0) {
      throw new ValidationError('请至少输入一个作者优势')
    }

    if (!targetPlatform) {
      throw new ValidationError('请选择目标平台')
    }

    if (!preferredGenres || !Array.isArray(preferredGenres) || preferredGenres.length === 0) {
      throw new ValidationError('请至少选择一个偏好题材')
    }

    const result = await getGenreRecommendation({
      userStrengths,
      targetPlatform,
      preferredGenres,
    })

    return result
  })
}

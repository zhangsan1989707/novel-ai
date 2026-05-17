import { NextRequest } from 'next/server'
import { tryCatch, error } from '@/lib/api-response'
import { getCoverCapability } from '@/lib/cover/service'

export async function GET(request: NextRequest) {
  return tryCatch(async () => {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return error('VALIDATION_ERROR', '缺少 projectId 参数')
    }

    const parsedId = parseInt(projectId, 10)
    if (Number.isNaN(parsedId)) {
      return error('VALIDATION_ERROR', 'projectId 格式无效')
    }

    return getCoverCapability(parsedId)
  })
}

import { NextRequest } from 'next/server'
import { tryCatch, error } from '@/lib/api-response'
import { getCoverCapability } from '@/lib/cover/service'
import { requireProjectOwner } from '@/lib/server/project-access'

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

    const project = await requireProjectOwner(parsedId)
    if (!project) {
      return error('NOT_FOUND', '项目不存在')
    }

    return getCoverCapability(parsedId)
  })
}

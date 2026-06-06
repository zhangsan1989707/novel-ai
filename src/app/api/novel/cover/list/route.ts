import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tryCatch, error } from '@/lib/api-response'
import { requireProjectOwner } from '@/lib/server/project-access'

export async function GET(request: NextRequest) {
  return tryCatch(async () => {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return error('VALIDATION_ERROR', '缺少 projectId 参数')
    }

    const parsedId = parseInt(projectId, 10)
    if (isNaN(parsedId)) {
      return error('VALIDATION_ERROR', 'projectId 格式无效')
    }

    if (!await requireProjectOwner(parsedId)) {
      return error('NOT_FOUND', '项目不存在')
    }

    const designs = await prisma.coverDesign.findMany({
      where: { projectId: parsedId },
      orderBy: { createdAt: 'desc' },
    })

    return designs
  })
}

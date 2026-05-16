import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tryCatch, error } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  return tryCatch(async () => {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return error('VALIDATION_ERROR', '缺少 projectId 参数')
    }

    const designs = await prisma.coverDesign.findMany({
      where: { projectId: parseInt(projectId, 10) },
      orderBy: { createdAt: 'desc' },
    })

    return designs
  })
}

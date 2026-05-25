import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { listChapterCommits } from '@/lib/engine/chapter-commit'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId: projectIdStr } = await params
  const projectId = Number.parseInt(projectIdStr, 10)

  if (Number.isNaN(projectId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
      { status: 400 }
    )
  }

  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    select: { id: true },
  })
  if (!project) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
      { status: 404 }
    )
  }

  const url = new URL(request.url)
  const take = Number.parseInt(url.searchParams.get('take') || '20', 10)
  const commits = await listChapterCommits(projectId, Number.isNaN(take) ? 20 : Math.max(1, Math.min(50, take)))

  return NextResponse.json({
    success: true,
    data: commits,
  })
}

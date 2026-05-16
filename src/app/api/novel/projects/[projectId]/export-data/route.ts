import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * GET /api/novel/projects/{projectId}/export-data
 * 获取项目导出数据（包含章节内容）
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  let projectIdNum: number | null = null
  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const project = await prisma.novelProject.findUnique({
      where: { id: projectIdNum },
      include: {
        chapters: {
          orderBy: { chapterNumber: 'asc' },
          select: {
            chapterNumber: true,
            title: true,
            content: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: project.id,
        title: project.title,
        outline: project.outline,
        chapters: project.chapters,
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_export_data', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'EXPORT_DATA_ERROR', message: '获取导出数据失败' } },
      { status: 500 }
    )
  }
}
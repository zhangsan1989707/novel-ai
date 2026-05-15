import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ============================================
// API Handler
// ============================================

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * GET /api/novel/projects/{projectId}/chapters/next-number
 * 获取下一个可用章节编号
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params
    const projectIdNum = parseInt(projectId)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    // 获取当前最大的章节编号
    const lastChapter = await prisma.novelChapter.findFirst({
      where: { projectId: projectIdNum },
      orderBy: { chapterNumber: 'desc' },
      select: { chapterNumber: true },
    })

    const nextNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1

    return NextResponse.json({ success: true, data: { nextNumber } })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_next_chapter_number', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取下一章节号失败' } },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logError } from '@/lib/logger'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

// ============================================
// Schema 验证
// ============================================

const reorderSchema = z.object({
  chapterIds: z.array(z.number().int().positive()),
})

// ============================================
// API Handler
// ============================================

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * POST /api/novel/projects/{projectId}/chapters/reorder
 * 批量更新章节排序
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    if (!await requireProjectOwner(projectIdNum)) {
      return projectNotFoundResponse()
    }
    const projectIdValue = projectIdNum

    const body = await request.json()
    const { chapterIds } = reorderSchema.parse(body)

    const existingChapters = await prisma.novelChapter.count({
      where: {
        id: { in: chapterIds },
        projectId: projectIdValue,
      },
    })

    if (existingChapters !== chapterIds.length) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '章节不存在' } },
        { status: 404 }
      )
    }

    // 批量更新排序
    await prisma.$transaction(
      chapterIds.map((id, index) =>
        prisma.novelChapter.updateMany({
          where: { id, projectId: projectIdValue },
          data: { sortOrder: index },
        })
      )
    )

    return NextResponse.json({ success: true, data: { updated: chapterIds.length } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'reorder_chapters', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'REORDER_ERROR', message: '更新章节排序失败' } },
      { status: 500 }
    )
  }
}

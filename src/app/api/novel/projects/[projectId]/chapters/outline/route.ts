import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * GET /api/novel/projects/[projectId]/chapters/outline
 * 获取项目所有章节大纲
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId: projectIdStr } = await params
    const projectId = parseInt(projectIdStr)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const chapters = await prisma.novelChapter.findMany({
      where: { projectId, status: 'DRAFT' },
      orderBy: { chapterNumber: 'asc' },
      select: {
        id: true,
        chapterNumber: true,
        title: true,
        summary: true,
        chapterOutline: true,
      },
    })

    return NextResponse.json({ success: true, data: chapters })
  } catch (error) {
    console.error('Get outlines error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '获取大纲失败' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/novel/projects/[projectId]/chapters/outline
 * 批量更新章节大纲
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId: projectIdStr } = await params
    const projectId = parseInt(projectIdStr)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { outlines } = body as {
      outlines: Array<{ chapterNumber: number; title?: string; summary?: string }>
    }

    if (!Array.isArray(outlines) || outlines.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '缺少大纲数据' } },
        { status: 400 }
      )
    }

    let updated = 0
    for (const outline of outlines) {
      const data: Record<string, unknown> = {}
      if (outline.title !== undefined) data.title = outline.title
      if (outline.summary !== undefined) data.summary = outline.summary
      if (Object.keys(data).length === 0) continue

      const result = await prisma.novelChapter.updateMany({
        where: { projectId, chapterNumber: outline.chapterNumber, status: 'DRAFT' },
        data,
      })
      updated += result.count
    }

    return NextResponse.json({ success: true, data: { updated } })
  } catch (error) {
    console.error('Update outlines error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '更新大纲失败' } },
      { status: 500 }
    )
  }
}

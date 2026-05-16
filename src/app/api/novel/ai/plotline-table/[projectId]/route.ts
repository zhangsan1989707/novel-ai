import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { PlotlineData } from '@/lib/engine/types'
import { logError } from '@/lib/logger'

/**
 * GET /api/novel/ai/plotline-table/[projectId]
 * 获取伏笔对照表数据
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  let projectIdNum: number | null = null
  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId, 10)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    // 获取所有伏笔
    const plotlines = await prisma.plotline.findMany({
      where: { projectId: projectIdNum },
      orderBy: [{ plantedAt: 'asc' }, { createdAt: 'asc' }],
    })

    // 获取章节信息用于展示标题
    const chapters = await prisma.novelChapter.findMany({
      where: { projectId: projectIdNum },
      select: { chapterNumber: true, title: true },
    })

    const chapterMap = new Map(chapters.map(c => [c.chapterNumber, c.title]))

    // 构建伏笔对照表数据
    const tableData = plotlines.map((p): PlotlineData & {
      plantedChapterTitle: string
      resolvedChapterTitle: string | null
      age: number | null
    } => ({
      id: p.id,
      type: p.type,
      description: p.description,
      plantedAt: p.plantedAt,
      resolvedAt: p.resolvedAt,
      plannedAt: p.plannedAt,
      status: p.status,
      plantedChapterTitle: chapterMap.get(p.plantedAt) || `第${p.plantedAt}章`,
      resolvedChapterTitle: p.resolvedAt ? (chapterMap.get(p.resolvedAt) || `第${p.resolvedAt}章`) : null,
      age: p.resolvedAt ? null : p.plantedAt > 0 ? Math.abs(p.plantedAt) : null,
    }))

    // 分类统计
    const stats = {
      total: plotlines.length,
      open: plotlines.filter(p => p.status === 'OPEN').length,
      resolved: plotlines.filter(p => p.status === 'RESOLVED').length,
      abandoned: plotlines.filter(p => p.status === 'ABANDONED').length,
    }

    return NextResponse.json({
      success: true,
      data: {
        plotlines: tableData,
        stats,
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_plotline_table', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取伏笔对照表失败' } },
      { status: 500 }
    )
  }
}
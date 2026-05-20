import { NextRequest, NextResponse } from 'next/server'
import { autoPipelineScheduler } from '@/lib/pipeline/scheduler'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const pid = parseInt(projectId)

    if (isNaN(pid)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const progress = autoPipelineScheduler.getProgress(pid)
    const isRunning = autoPipelineScheduler.isRunning(pid)

    const latestChapter = await prisma.novelChapter.findFirst({
      where: {
        projectId: pid,
        status: 'COMPLETED',
        content: { not: null },
      },
      orderBy: { chapterNumber: 'desc' },
      select: { chapterNumber: true, wordCount: true, title: true },
    })

    const project = await prisma.novelProject.findUnique({
      where: { id: pid },
      select: { currentWordCount: true, chapterWordCount: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        isRunning,
        progress: progress || null,
        latestChapter: latestChapter || null,
        totalWordCount: project?.currentWordCount || 0,
      },
    })
  } catch (error) {
    console.error('Auto pipeline status error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '查询自动流水线状态失败' } },
      { status: 500 }
    )
  }
}
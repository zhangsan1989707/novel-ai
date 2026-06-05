import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getVolumeChapterRange } from '@/lib/memory/volume-summary'
import { logError } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
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
      select: {
        totalVolumes: true,
        targetWordCount: true,
        chapters: {
          select: {
            chapterNumber: true,
            status: true,
            wordCount: true,
          },
          orderBy: { chapterNumber: 'asc' },
        },
        volumeSummaries: {
          select: {
            volumeNumber: true,
            summary: true,
            keyEvents: true,
          },
          orderBy: { volumeNumber: 'asc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    const totalVolumes = project.totalVolumes || 4
    const totalChapters = project.chapters.length || Math.ceil((project.targetWordCount || 300000) / 3000)

    const summaryMap = new Map(
      project.volumeSummaries.map(s => [s.volumeNumber, s])
    )

    const volumes = Array.from({ length: totalVolumes }, (_, i) => {
      const volumeNumber = i + 1
      const range = getVolumeChapterRange(volumeNumber, totalVolumes, totalChapters)
      const chaptersInRange = project.chapters.filter(
        c => c.chapterNumber >= range.start && c.chapterNumber <= range.end
      )
      const completedInRange = chaptersInRange.filter(c => c.status === 'COMPLETED')
      const summary = summaryMap.get(volumeNumber)

      return {
        volumeNumber,
        start: range.start,
        end: range.end,
        totalCount: range.end - range.start + 1,
        completedCount: completedInRange.length,
        totalWordCount: chaptersInRange.reduce((sum, c) => sum + (c.wordCount || 0), 0),
        summary: summary?.summary || null,
        keyEvents: summary?.keyEvents || [],
      }
    })

    return NextResponse.json({
      success: true,
      data: { totalVolumes, volumes },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      type: 'volumes_list',
      projectId: projectIdNum,
    })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取卷数据失败' } },
      { status: 500 }
    )
  }
}

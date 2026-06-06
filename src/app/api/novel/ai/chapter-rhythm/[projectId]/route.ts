import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'
import { buildChapterMemoryPack, buildMemorySnapshotPack } from '@/lib/memory'
import { requireProjectOwner, projectNotFoundResponse } from '@/lib/server/project-access'

/**
 * GET /api/novel/ai/chapter-rhythm/[projectId]
 * 获取章节节奏热力图数据
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

    const project = await requireProjectOwner(projectIdNum)
    if (!project) {
      return projectNotFoundResponse()
    }

    // 获取所有章节和摘要
    const [chapters, summaries] = await Promise.all([
      prisma.novelChapter.findMany({
        where: { projectId: projectIdNum },
        select: { chapterNumber: true, title: true, wordCount: true },
        orderBy: { chapterNumber: 'asc' },
      }),
      prisma.chapterSummary.findMany({
        where: { projectId: projectIdNum },
        select: { chapterNo: true, emotionalTone: true, keyEvents: true },
      }),
    ])

    // 构建热力图数据
    const summaryMap = new Map(summaries.map(s => [s.chapterNo, s]))

    const rhythmData = chapters.map(chapter => {
      const summary = summaryMap.get(chapter.chapterNumber)
      // 情绪强度映射：紧张=80, 温馨=40, 悲伤=70, 平稳=50
      let emotionalIntensity = 50
      if (summary?.emotionalTone === '紧张') emotionalIntensity = 80
      else if (summary?.emotionalTone === '温馨') emotionalIntensity = 40
      else if (summary?.emotionalTone === '悲伤') emotionalIntensity = 70
      else if (summary?.emotionalTone === '高潮') emotionalIntensity = 90
      else if (summary?.emotionalTone === '平缓') emotionalIntensity = 30

      return {
        chapterNo: chapter.chapterNumber,
        title: chapter.title,
        wordCount: chapter.wordCount,
        emotionalIntensity,
        keyEventCount: summary?.keyEvents?.length || 0,
      }
    })

    // 计算统计
    const totalWordCount = rhythmData.reduce((sum, d) => sum + d.wordCount, 0)
    const avgWordCount = rhythmData.length > 0 ? Math.round(totalWordCount / rhythmData.length) : 0
    const avgEmotionalIntensity = rhythmData.length > 0
      ? Math.round(rhythmData.reduce((sum, d) => sum + d.emotionalIntensity, 0) / rhythmData.length)
      : 50
    const memoryPack = await buildChapterMemoryPack(projectIdNum, rhythmData[rhythmData.length - 1]?.chapterNo || 1, {
      recentChapterCount: 5,
      recentVolumeCount: 2,
      characterLimit: 8,
      plotlineLimit: 8,
      researchLimit: 3,
    })

    return NextResponse.json({
      success: true,
      data: {
        chapters: rhythmData,
        stats: {
          totalChapters: rhythmData.length,
          totalWordCount,
          avgWordCount,
          avgEmotionalIntensity,
        },
        memoryPack: buildMemorySnapshotPack(memoryPack),
        contexts: {
          planner: memoryPack.plannerContext,
          writer: memoryPack.writerContext,
          validator: memoryPack.validatorContext,
          summarizer: memoryPack.summarizerContext,
        },
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_chapter_rhythm', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取章节节奏失败' } },
      { status: 500 }
    )
  }
}

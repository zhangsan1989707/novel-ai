import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeChapterQuality } from '@/lib/knowledge/chapter-quality'
import { logError } from '@/lib/logger'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

interface RouteParams {
  params: Promise<{ projectId: string; chapterId: string }>
}

/**
 * GET /api/novel/projects/{projectId}/chapters/{chapterId}/review
 * 获取章节审核汇总数据（validationReport + quality analysis）
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  let chapterIdNum: number | null = null
  try {
    const { projectId, chapterId } = await params
    chapterIdNum = parseInt(chapterId)
    const projectIdNum = parseInt(projectId)

    if (isNaN(chapterIdNum) || isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的ID' } },
        { status: 400 }
      )
    }

    if (!await requireProjectOwner(projectIdNum)) {
      return projectNotFoundResponse()
    }

    const [chapter, project, completionReport, arcEvents, cheatState] = await Promise.all([
      prisma.novelChapter.findFirst({
        where: { id: chapterIdNum, projectId: projectIdNum },
        select: {
          id: true,
          chapterNumber: true,
          content: true,
          validationReport: true,
          completionReport: true,
          wordCount: true,
          status: true,
        },
      }),
      prisma.novelProject.findUnique({
        where: { id: projectIdNum },
        select: { chapterWordCount: true },
      }),
      prisma.chapterCompletionReport.findFirst({
        where: { projectId: projectIdNum },
        orderBy: { chapterNo: 'desc' },
      }),
      prisma.arcEventLedger.findMany({
        where: { projectId: projectIdNum, status: { in: ['pending', 'started', 'delayed'] } },
        orderBy: [{ arcNumber: 'asc' }, { plannedChapterNo: 'asc' }, { createdAt: 'asc' }],
        select: { eventKey: true, eventDescription: true, status: true, plannedChapterNo: true, actualChapterNo: true },
        take: 10,
      }),
      prisma.cheatAbilityState.findUnique({
        where: { projectId: projectIdNum },
        select: { cheatName: true, oneLineRule: true, unlockedAbilities: true, currentMarkValue: true, currentBacklashValue: true, cooldownActiveUntilChapter: true },
      }),
    ])

    if (!chapter) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '章节不存在' } },
        { status: 404 }
      )
    }

    const targetWordCount = project?.chapterWordCount || 3000
    const currentWordCount = chapter.wordCount || 0
    let wordCountStatus: 'ok' | 'short' | 'long' = 'ok'
    if (currentWordCount < targetWordCount * 0.8) {
      wordCountStatus = 'short'
    } else if (currentWordCount > targetWordCount * 1.5) {
      wordCountStatus = 'long'
    }

    // 运行 AI 质量分析
    const qualityReport = chapter.content
      ? analyzeChapterQuality(chapter.content)
      : null

    return NextResponse.json({
      success: true,
      data: {
        validationReport: chapter.validationReport || null,
        qualityReport,
        targetWordCount,
        currentWordCount,
        wordCountStatus,
        completionReport: chapter.completionReport || completionReport || null,
        arcEvents,
        cheatState: cheatState || null,
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      type: 'chapter_review',
      chapterId: chapterIdNum,
    })
    return NextResponse.json(
      { success: false, error: { code: 'REVIEW_ERROR', message: '获取审核数据失败' } },
      { status: 500 }
    )
  }
}

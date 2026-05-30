import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeChapterQuality } from '@/lib/knowledge/chapter-quality'
import { logError } from '@/lib/logger'

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

    const [chapter, project] = await Promise.all([
      prisma.novelChapter.findUnique({
        where: { id: chapterIdNum },
        select: {
          id: true,
          content: true,
          validationReport: true,
          wordCount: true,
          status: true,
        },
      }),
      prisma.novelProject.findUnique({
        where: { id: projectIdNum },
        select: { chapterWordCount: true },
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

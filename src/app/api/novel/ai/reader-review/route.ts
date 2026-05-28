import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, handleApiError } from '@/lib/api-response'
import { AppError, ErrorCodes } from '@/lib/errors'
import { readerAgent } from '@/lib/agents/reader'
import { getRecentChapterSummaries } from '@/lib/memory/chapter-summary'

/**
 * POST /api/novel/ai/reader-review
 * 以读者视角评估章节阅读体验
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, chapterNo } = body

    if (!projectId || !chapterNo) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, '缺少 projectId 或 chapterNo', 400)
    }

    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      select: { id: true, genre: true, targetAudience: true },
    })

    if (!project) {
      throw new AppError(ErrorCodes.NOT_FOUND, '项目不存在', 404)
    }

    const chapter = await prisma.novelChapter.findUnique({
      where: {
        projectId_chapterNumber: { projectId, chapterNumber: chapterNo },
      },
      select: { id: true, title: true, content: true },
    })

    if (!chapter || !chapter.content) {
      throw new AppError(ErrorCodes.NOT_FOUND, '章节不存在或内容为空', 404)
    }

    const recentSummaries = await getRecentChapterSummaries(projectId, 3)

    const report = await readerAgent({
      projectId,
      chapterNo,
      chapterContent: chapter.content,
      chapterTitle: chapter.title,
      genre: project.genre,
      recentSummaries: recentSummaries.map(s => ({
        chapterNo: s.chapterNo,
        summary: s.summary,
      })),
    })

    return NextResponse.json(success(report))
  } catch (err) {
    return handleApiError(err)
  }
}

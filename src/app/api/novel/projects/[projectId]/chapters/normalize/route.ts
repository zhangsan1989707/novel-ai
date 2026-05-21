import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'
import { countContentWords } from '@/lib/analysis/chapter-utils'

const normalizeSchema = z.object({
  chapters: z.array(z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
  })).min(1, '至少保留一个章节'),
})

interface RouteParams {
  params: Promise<{ projectId: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  let projectIdNum: number | null = null
  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId, 10)

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { chapters } = normalizeSchema.parse(body)
    const totalWordCount = chapters.reduce((sum, chapter) => sum + countContentWords(chapter.content), 0)

    await prisma.$transaction(async (tx) => {
      await tx.novelChapter.deleteMany({ where: { projectId: projectIdNum! } })

      await tx.novelChapter.createMany({
        data: chapters.map((chapter, index) => ({
          projectId: projectIdNum!,
          chapterNumber: index + 1,
          sortOrder: index,
          title: chapter.title.trim(),
          content: chapter.content.trim(),
          wordCount: countContentWords(chapter.content),
          status: 'REVIEWING',
        })),
      })

      await tx.novelProject.update({
        where: { id: projectIdNum! },
        data: { currentWordCount: totalWordCount },
      })

      await Promise.all([
        tx.bookAnalysis.deleteMany({ where: { projectId: projectIdNum! } }),
        tx.analysisTask.deleteMany({ where: { projectId: projectIdNum! } }),
        tx.chapterSummary.deleteMany({ where: { projectId: projectIdNum! } }),
        tx.volumeSummary.deleteMany({ where: { projectId: projectIdNum! } }),
        tx.bookSummary.deleteMany({ where: { projectId: projectIdNum! } }),
        tx.character.deleteMany({ where: { projectId: projectIdNum! } }),
      ])
    })

    return NextResponse.json({
      success: true,
      data: {
        chapterCount: chapters.length,
        totalWordCount,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }

    logError(error instanceof Error ? error : new Error(String(error)), { type: 'normalize_analyze_chapters', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'NORMALIZE_ERROR', message: '保存章节校正失败' } },
      { status: 500 }
    )
  }
}

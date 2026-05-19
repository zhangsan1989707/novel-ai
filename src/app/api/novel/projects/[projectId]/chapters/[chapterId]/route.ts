import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logError } from '@/lib/logger'
import { countChineseWords } from '@/lib/utils'

// ============================================
// Schema 验证
// ============================================

const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().optional(),
  content: z.string().optional(),
  status: z.enum(['DRAFT', 'GENERATING', 'COMPLETED', 'REVIEWING']).optional(),
  virtualWriterId: z.number().int().positive().nullable().optional(),
})

// ============================================
// API Handlers
// ============================================

interface RouteParams {
  params: Promise<{ projectId: string; chapterId: string }>
}

/**
 * GET /api/novel/projects/{projectId}/chapters/{chapterId}
 * 获取章节详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  let chapterIdNum: number | null = null
  try {
    const { projectId, chapterId } = await params
    chapterIdNum = parseInt(chapterId)

    if (isNaN(chapterIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的章节ID' } },
        { status: 400 }
      )
    }

    const chapter = await prisma.novelChapter.findUnique({
      where: { id: chapterIdNum },
      include: {
        virtualWriter: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 10,
        },
      },
    })

    if (!chapter) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '章节不存在' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: chapter })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_chapter', chapterId: chapterIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取章节详情失败' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/novel/projects/{projectId}/chapters/{chapterId}
 * 更新章节
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  let chapterIdNum: number | null = null
  try {
    const { projectId, chapterId } = await params
    chapterIdNum = parseInt(chapterId)

    if (isNaN(chapterIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的章节ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = updateChapterSchema.parse(body)

    // 获取原章节内容
    const oldChapter = await prisma.novelChapter.findUnique({
      where: { id: chapterIdNum },
      include: { project: true },
    })

    if (!oldChapter) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '章节不存在' } },
        { status: 404 }
      )
    }

    // 计算字数变化
    const oldWordCount = oldChapter.content ? countChineseWords(oldChapter.content) : 0
    const newContent = validatedData.content !== undefined ? validatedData.content : oldChapter.content
    const newWordCount = newContent ? countChineseWords(newContent) : 0
    const wordCountDiff = newWordCount - oldWordCount

    // 保存版本记录（如果内容有变化）
    if (validatedData.content && validatedData.content !== oldChapter.content) {
      const versionCount = await prisma.chapterVersion.count({
        where: { chapterId: chapterIdNum },
      })

      await prisma.chapterVersion.create({
        data: {
          chapterId: chapterIdNum,
          content: oldChapter.content || '',
          wordCount: oldWordCount,
          prompt: oldChapter.generationPrompt,
          versionNumber: versionCount + 1,
        },
      })
    }

    const chapter = await prisma.novelChapter.update({
      where: { id: chapterIdNum },
      data: {
        ...validatedData,
        wordCount: newWordCount,
      },
    })

    // 更新项目总字数
    if (wordCountDiff !== 0) {
      await prisma.novelProject.update({
        where: { id: oldChapter.projectId },
        data: {
          currentWordCount: { increment: wordCountDiff },
        },
      })
    }

    return NextResponse.json({ success: true, data: chapter })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'update_chapter', chapterId: chapterIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_ERROR', message: '更新章节失败' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/novel/projects/{projectId}/chapters/{chapterId}
 * 删除章节
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  let chapterIdNum: number | null = null
  try {
    const { projectId, chapterId } = await params
    chapterIdNum = parseInt(chapterId)

    if (isNaN(chapterIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的章节ID' } },
        { status: 400 }
      )
    }

    const chapter = await prisma.novelChapter.findUnique({
      where: { id: chapterIdNum },
    })

    if (!chapter) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '章节不存在' } },
        { status: 404 }
      )
    }

    // 删除章节
    await prisma.novelChapter.delete({
      where: { id: chapterIdNum },
    })

    // 更新项目总字数
    if (chapter.wordCount > 0) {
      await prisma.novelProject.update({
        where: { id: chapter.projectId },
        data: {
          currentWordCount: { decrement: chapter.wordCount },
        },
      })
    }

    return NextResponse.json({ success: true, data: { id: chapterIdNum } })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'delete_chapter', chapterId: chapterIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_ERROR', message: '删除章节失败' } },
      { status: 500 }
    )
  }
}

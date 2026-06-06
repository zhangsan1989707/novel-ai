import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logError } from '@/lib/logger'
import { countChapterWords, syncProjectChapterWordCount } from '@/lib/novel/chapter-word-count'
import { sanitizePipelineRuntime } from '@/lib/engine/pipeline-runtime'
import { normalizeChapterContentForUser } from '@/lib/chapter-content-normalizer'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

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
 * 从运行时状态获取章节的实时内容
 */
async function getLiveContentFromRuntime(projectId: number, chapterNumber: number): Promise<string | null> {
  try {
    // 查找当前运行中的生成任务
    const job = await prisma.generationJob.findFirst({
      where: {
        projectId,
        status: { in: ['RUNNING', 'PENDING'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    })

    if (!job?.payload) return null

    const payload = job.payload as Record<string, unknown>
    const runtime = sanitizePipelineRuntime(payload.runtime)

    // 检查当前章节是否正在生成
    if (runtime.currentChapter?.chapterNumber === chapterNumber) {
      return runtime.currentChapter.liveContent || null
    }

    // 检查最近完成的章节
    const recentChapter = runtime.recentChapters.find(
      ch => ch.chapterNumber === chapterNumber
    )
    if (recentChapter) {
      return recentChapter.liveContent || null
    }

    return null
  } catch (error) {
    console.error('获取运行时内容失败:', error)
    return null
  }
}

/**
 * GET /api/novel/projects/{projectId}/chapters/{chapterId}
 * 获取章节详情（包含实时内容）
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  let chapterIdNum: number | null = null
  let projectIdNum: number | null = null
  try {
    const { projectId, chapterId } = await params
    chapterIdNum = parseInt(chapterId)
    projectIdNum = parseInt(projectId)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    if (isNaN(chapterIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的章节ID' } },
        { status: 400 }
      )
    }

    if (!await requireProjectOwner(projectIdNum)) {
      return projectNotFoundResponse()
    }

    const chapter = await prisma.novelChapter.findFirst({
      where: { id: chapterIdNum, projectId: projectIdNum },
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

    // 如果章节正在生成中，尝试获取实时内容
    let liveContent: string | null = null
    if (chapter.status === 'GENERATING' && !isNaN(projectIdNum)) {
      liveContent = await getLiveContentFromRuntime(projectIdNum, chapter.chapterNumber)
    }

    // 返回章节数据，包含实时内容
    const responseData = {
      ...chapter,
      content: normalizeChapterContentForUser(chapter.content),
      liveContent: normalizeChapterContentForUser(liveContent),
      draftContent: null, // 预留字段，当前数据库无此字段
    }

    return NextResponse.json({ success: true, data: responseData })
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
  let projectIdNum: number | null = null
  try {
    const { projectId, chapterId } = await params
    projectIdNum = parseInt(projectId)
    chapterIdNum = parseInt(chapterId)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    if (isNaN(chapterIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的章节ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = updateChapterSchema.parse(body)

    if (!await requireProjectOwner(projectIdNum)) {
      return projectNotFoundResponse()
    }

    // 获取原章节内容
    const oldChapter = await prisma.novelChapter.findFirst({
      where: { id: chapterIdNum, projectId: projectIdNum },
    })

    if (!oldChapter) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '章节不存在' } },
        { status: 404 }
      )
    }

    // 计算字数变化
    const oldWordCount = countChapterWords(oldChapter.content)
    const newContent = validatedData.content !== undefined
      ? normalizeChapterContentForUser(validatedData.content)
      : oldChapter.content
    const newWordCount = countChapterWords(newContent)

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

    const updated = await prisma.novelChapter.updateMany({
      where: { id: chapterIdNum, projectId: projectIdNum },
      data: {
        ...validatedData,
        ...(validatedData.content !== undefined ? { content: newContent } : {}),
        wordCount: newWordCount,
      },
    })

    if (updated.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '章节不存在' } },
        { status: 404 }
      )
    }

    const chapter = await prisma.novelChapter.findFirst({
      where: { id: chapterIdNum, projectId: projectIdNum },
    })

    // 更新项目总字数
    await syncProjectChapterWordCount(prisma, oldChapter.projectId)

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
  let projectIdNum: number | null = null
  try {
    const { projectId, chapterId } = await params
    projectIdNum = parseInt(projectId)
    chapterIdNum = parseInt(chapterId)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    if (isNaN(chapterIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的章节ID' } },
        { status: 400 }
      )
    }

    if (!await requireProjectOwner(projectIdNum)) {
      return projectNotFoundResponse()
    }

    const chapter = await prisma.novelChapter.findFirst({
      where: { id: chapterIdNum, projectId: projectIdNum },
    })

    if (!chapter) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '章节不存在' } },
        { status: 404 }
      )
    }

    // 删除章节
    const deleted = await prisma.novelChapter.deleteMany({
      where: { id: chapterIdNum, projectId: projectIdNum },
    })

    if (deleted.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '章节不存在' } },
        { status: 404 }
      )
    }

    // 更新项目总字数
    await syncProjectChapterWordCount(prisma, chapter.projectId)

    return NextResponse.json({ success: true, data: { id: chapterIdNum } })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'delete_chapter', chapterId: chapterIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_ERROR', message: '删除章节失败' } },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logError } from '@/lib/logger'

// ============================================
// Schema 验证
// ============================================

const createChapterSchema = z.object({
  title: z.string().min(1, '章节标题不能为空').max(200),
  chapterNumber: z.number().int().positive(),
  summary: z.string().optional(),
  content: z.string().optional(),
})

// ============================================
// API Handlers
// ============================================

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * GET /api/novel/projects/{projectId}/chapters
 * 获取章节列表
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const chapters = await prisma.novelChapter.findMany({
      where: { projectId: projectIdNum },
      orderBy: [{ sortOrder: 'asc' }, { chapterNumber: 'asc' }],
      select: {
        id: true,
        chapterNumber: true,
        title: true,
        wordCount: true,
        status: true,
        summary: true,
        sortOrder: true,
        virtualWriterId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ success: true, data: chapters })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'list_chapters', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取章节列表失败' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/novel/projects/{projectId}/chapters
 * 创建章节
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json()
    const validatedData = createChapterSchema.parse(body)

    // 检查项目是否存在
    const project = await prisma.novelProject.findUnique({
      where: { id: projectIdNum },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    // 检查章节号是否已存在
    const existing = await prisma.novelChapter.findUnique({
      where: {
        projectId_chapterNumber: {
          projectId: projectIdNum,
          chapterNumber: validatedData.chapterNumber,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: '该章节号已存在' } },
        { status: 400 }
      )
    }

    const chapter = await prisma.novelChapter.create({
      data: {
        ...validatedData,
        projectId: projectIdNum,
        wordCount: validatedData.content ? validatedData.content.length : 0,
      },
    })

    // 更新项目字数
    if (validatedData.content) {
      await prisma.novelProject.update({
        where: { id: projectIdNum },
        data: {
          currentWordCount: { increment: validatedData.content.length },
          status: 'WRITING',
        },
      })
    }

    return NextResponse.json({ success: true, data: chapter }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'create_chapter', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_ERROR', message: '创建章节失败' } },
      { status: 500 }
    )
  }
}

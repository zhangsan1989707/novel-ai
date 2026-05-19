import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logError } from '@/lib/logger'

// ============================================
// Schema 验证
// ============================================

const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  genre: z.string().optional(),
  writingStyle: z.string().optional(),
  targetWordCount: z.number().int().positive().optional(),
  currentWordCount: z.number().int().min(0).optional(),
  chapterWordCount: z.number().int().positive().optional(),
  outline: z.string().optional(),
  outlineStages: z.object({
    stage1: z.array(z.object({ title: z.string(), summary: z.string() })).optional(),
    stage2: z.array(z.object({ title: z.string(), summary: z.string() })).optional(),
    stage3: z.array(z.object({ title: z.string(), summary: z.string() })).optional(),
    stage4: z.array(z.object({ title: z.string(), summary: z.string() })).optional(),
  }).optional(),
  worldSetting: z.string().optional(),
  powerSystem: z.string().optional(),
  protagonistProfile: z.string().optional(),
  protagonistGoal: z.string().optional(),
  antagonistSetting: z.string().optional(),
  endingPlan: z.string().optional(),
  writingPrompt: z.string().optional(),
  coverImage: z.string().optional(),
  totalVolumes: z.number().int().min(1).max(10).optional(),
  status: z.enum(['DRAFT', 'WRITING', 'COMPLETED', 'PAUSED']).optional(),
  aiModelId: z.number().int().positive().nullable().optional(),
  pace: z.number().min(0).max(1).optional(),
  darkness: z.number().min(0).max(1).optional(),
  humor: z.number().min(0).max(1).optional(),
  romance: z.number().min(0).max(1).optional(),
  powerGrowth: z.number().min(0).max(1).optional(),
  conflictIntensity: z.number().min(0).max(1).optional(),
  mysteryDensity: z.number().min(0).max(1).optional(),
})

// ============================================
// API Handlers
// ============================================

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * GET /api/novel/projects/{projectId}
 * 获取项目详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  let id: number | null = null
  try {
    const { projectId } = await params
    id = parseInt(projectId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const project = await prisma.novelProject.findUnique({
      where: { id },
      include: {
        aiModelConfig: true,
        chapters: {
          orderBy: { chapterNumber: 'asc' },
          select: {
            id: true,
            chapterNumber: true,
            title: true,
            wordCount: true,
            status: true,
            sortOrder: true,
            summary: true,
            content: true,
          },
        },
        arcPlans: {
          orderBy: { arcNumber: 'asc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    // 实时计算当前总字数
    const totalWordCount = project.chapters.reduce((sum, chapter) => {
      return sum + (chapter.wordCount || 0)
    }, 0)

    // 返回带计算后字数的项目数据
    return NextResponse.json({
      success: true,
      data: {
        ...project,
        currentWordCount: totalWordCount, // 实时计算替换数据库字段
      }
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_project', projectId: id })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取项目详情失败' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/novel/projects/{projectId}
 * 更新项目
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  let id: number | null = null
  try {
    const { projectId } = await params
    id = parseInt(projectId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = updateProjectSchema.parse(body)

    const project = await prisma.novelProject.update({
      where: { id },
      data: validatedData,
      include: {
        aiModelConfig: true,
      },
    })

    return NextResponse.json({ success: true, data: project })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'update_project', projectId: id })
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_ERROR', message: '更新项目失败' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/novel/projects/{projectId}
 * 删除项目
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  let id: number | null = null
  try {
    const { projectId } = await params
    id = parseInt(projectId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    await prisma.novelProject.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'delete_project', projectId: id })
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_ERROR', message: '删除项目失败' } },
      { status: 500 }
    )
  }
}

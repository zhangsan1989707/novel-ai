import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logError } from '@/lib/logger'

// ============================================
// Schema 验证
// ============================================

const createProjectSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  description: z.string().optional(),
  genre: z.string().optional(),
  writingStyle: z.string().optional(),
  targetWordCount: z.coerce.number().int().positive().optional(),
  chapterWordCount: z.coerce.number().int().positive().default(3000),
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
  totalVolumes: z.coerce.number().int().min(1).max(10).default(4),
  aiModelId: z.coerce.number().int().positive().optional(),
  targetAudience: z.enum(['MALE', 'FEMALE']).optional(),
})

const updateProjectSchema = createProjectSchema.partial()

// ============================================
// API Handlers
// ============================================

/**
 * GET /api/novel/projects
 * 获取项目列表（支持分页和筛选）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '12')
    const status = searchParams.get('status')
    const genre = searchParams.get('genre')
    const search = searchParams.get('search')

    const skip = (page - 1) * pageSize

    // 构建查询条件
    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (genre) where.genre = genre
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // TODO: 获取当前用户ID（暂用固定值，后续接入认证后修改）
    const creatorId = 1

    const [projects, total, statsResult] = await Promise.all([
      prisma.novelProject.findMany({
        where: { ...where, creatorId },
        include: {
          aiModelConfig: true,
          _count: { select: { chapters: true } },
          chapters: {
            select: { wordCount: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.novelProject.count({ where: { ...where, creatorId } }),
      // 获取统计数据（所有项目的总字数和 AI 调用次数）
      Promise.all([
        // 所有项目的总字数
        prisma.novelProject.aggregate({
          where: { creatorId },
          _count: true,
        }),
        // AI 调用次数
        prisma.aIUsage.count({
          where: { userId: creatorId },
        }),
      ]),
    ])

    // 获取所有项目的总字数
    const allProjectsWordCount = await prisma.novelChapter.aggregate({
      where: {
        project: { creatorId },
      },
      _sum: { wordCount: true },
    })

    // 为每个项目实时计算总字数
    const projectsWithWordCount = projects.map(project => ({
      ...project,
      currentWordCount: project.chapters.reduce((sum, chapter) => {
        return sum + (chapter.wordCount || 0)
      }, 0)
    }))

    return NextResponse.json({
      success: true,
      data: {
        projects: projectsWithWordCount,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        stats: {
          totalProjects: total,
          totalWordCount: allProjectsWordCount._sum.wordCount || 0,
          aiCallCount: statsResult[1],
        },
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_projects' })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取项目列表失败' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/novel/projects
 * 创建新项目
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createProjectSchema.parse(body)

    // TODO: 获取当前用户ID（暂用固定值，后续接入认证后修改）
    let creatorId = 1

    // 确保用户存在
    const user = await prisma.user.findUnique({ where: { id: creatorId } })
    if (!user) {
      const newUser = await prisma.user.create({
        data: {
          email: 'dev@example.com',
          name: '开发者',
          password: 'hashed_password_placeholder',
        },
      })
      creatorId = newUser.id
    }

    const project = await prisma.novelProject.create({
      data: {
        ...validatedData,
        creatorId,
      },
      include: {
        aiModelConfig: true,
      },
    })

    return NextResponse.json({ success: true, data: project }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'create_project' })
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_ERROR', message: '创建项目失败' } },
      { status: 500 }
    )
  }
}

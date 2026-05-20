import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logError } from '@/lib/logger'
import { getCurrentUserId } from '@/lib/auth'
import { createProviderFromConfigId, createProviderFromDefaultConfig, getDefaultAIConfigRecord } from '@/lib/ai/factory'
import { refreshBlueprintConsole } from '@/lib/engine/blueprint-console'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

// ============================================
// Schema 验证
// ============================================

const PLATFORM_ENUM = z.enum(['QIDIAN', 'FANQIE', 'FEILU', 'JINJIANG', 'QIMAO'])
const LENGTH_TYPE_ENUM = z.enum(['SHORT', 'MEDIUM', 'LONG', 'ULTRA_LONG'])

const createProjectSchema = z.object({
  title: z.string().max(200).optional(),
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
  platform: PLATFORM_ENUM.optional(),
  lengthType: LENGTH_TYPE_ENUM.optional(),
  corePitch: z.string().optional(),
})

function normalizeGeneratedTitle(text: string): string {
  return text
    .trim()
    .replace(/^["'`【】《》\[\]\s]+/, '')
    .replace(/["'`【】《》\[\]\s]+$/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 50)
}

function buildFallbackTitle(input: {
  corePitch?: string
  description?: string
  genre?: string
}): string {
  const pitch = input.corePitch || input.description || ''
  const match = pitch.match(/([^，。！？,.;；]{2,18})/)
  const core = match?.[1]?.trim()

  if (core) {
    return normalizeGeneratedTitle(`${core}记`)
  }

  if (input.genre) {
    return `${input.genre}小说`
  }

  return '未命名小说项目'
}

async function generateNovelTitle(input: {
  corePitch?: string
  description?: string
  genre?: string
  writingStyle?: string
  platform?: string
  lengthType?: string
  aiModelId?: number
}): Promise<string | null> {
  const pitch = input.corePitch || input.description || '暂无'
  const textPrompt = `请根据一句话卖点生成一个中文小说标题，只输出标题，不要解释。

卖点：${pitch}`

  try {
    const provider = input.aiModelId
      ? await createProviderFromConfigId(input.aiModelId)
      : await createProviderFromDefaultConfig()

    if (!provider) return null

    const attempts = [
      {
        prompt: textPrompt,
        params: {
          temperature: 0.2,
          maxTokens: 192,
          timeoutMs: 20000,
        },
      },
      {
        prompt: `请直接给出最适合这个卖点的中文小说标题，只输出标题：${pitch}`,
        params: {
          temperature: 0.2,
          maxTokens: 96,
          timeoutMs: 20000,
        },
      },
    ] as const

    for (const attempt of attempts) {
      try {
        const result = await provider.generate(attempt.prompt, attempt.params)
        if (!result.content?.trim()) continue

        const title = normalizeGeneratedTitle(result.content)
        if (title) return title
      } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)), {
          type: 'generate_project_title_attempt',
        })
      }
    }
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'generate_project_title' })
  }

  return null
}

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

    const creatorId = getCurrentUserId()

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

    let creatorId = getCurrentUserId()

    // 确保用户存在：优先使用当前 ID，否则回退到开发用户（按邮箱查找或创建）
    const userById = await prisma.user.findUnique({ where: { id: creatorId } })
    if (!userById) {
      const devEmail = 'dev@example.com'
      let devUser = await prisma.user.findUnique({ where: { email: devEmail } })
      if (!devUser) {
        devUser = await prisma.user.create({
          data: {
            email: devEmail,
            name: '开发者',
            password: 'hashed_password_placeholder',
          },
        })
      }
      creatorId = devUser.id
    }

  const title = validatedData.title?.trim()
      || await generateNovelTitle({
        corePitch: validatedData.corePitch,
        description: validatedData.description,
        genre: validatedData.genre,
        writingStyle: validatedData.writingStyle,
        platform: validatedData.platform,
        lengthType: validatedData.lengthType,
        aiModelId: validatedData.aiModelId,
      })
      || buildFallbackTitle({
        corePitch: validatedData.corePitch,
        description: validatedData.description,
        genre: validatedData.genre,
      })

    const aiModelId = validatedData.aiModelId ?? (await getDefaultAIConfigRecord())?.id

    const project = await prisma.novelProject.create({
      data: {
        ...validatedData,
        aiModelId,
        title,
        creatorId,
      },
      include: {
        aiModelConfig: true,
      },
    })

    try {
      await withTimeout(
        refreshBlueprintConsole(project.id, '项目刚创建完成，请生成初始 AI 动态设定中枢。'),
        12000,
        'refreshBlueprintConsole'
      )
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        type: 'create_project_bootstrap_console',
        projectId: project.id,
      })
    }

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

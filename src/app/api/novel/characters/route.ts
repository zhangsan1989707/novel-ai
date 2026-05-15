import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const createCharacterSchema = z.object({
  projectId: z.number().int().positive(),
  name: z.string().min(1),
  role: z.enum(['PROTAGONIST', 'ANTAGONIST', 'SUPPORTING', 'MINOR']).default('SUPPORTING'),
  description: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  appearance: z.string().optional(),
  personality: z.string().optional(),
  catchphrases: z.array(z.string()).optional(),
  background: z.string().optional(),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
})

/**
 * GET /api/novel/characters
 * 获取角色列表（支持筛选）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const isPublic = searchParams.get('isPublic')
    const creatorId = searchParams.get('creatorId')
    const tags = searchParams.get('tags')

    const where: Record<string, unknown> = {}

    if (projectId) {
      where.projectId = parseInt(projectId, 10)
    }

    if (isPublic === 'true') {
      where.isPublic = true
    } else if (creatorId) {
      where.creatorId = parseInt(creatorId, 10)
    }

    if (tags) {
      where.tags = { hasSome: tags.split(',') }
    }

    const characters = await prisma.character.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({
      success: true,
      data: characters,
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: $1 })
    return NextResponse.json(
      { success: false, error: { code: 'GET_ERROR', message: '获取角色列表失败' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/novel/characters
 * 创建角色
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createCharacterSchema.parse(body)

    // 获取项目的创建者
    const project = await prisma.novelProject.findUnique({
      where: { id: data.projectId },
      select: { creatorId: true },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    const character = await prisma.character.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        role: data.role,
        aliases: data.aliases || [],
        background: data.description || data.background,
        appearance: data.appearance,
        personality: data.personality,
        catchphrases: data.catchphrases || [],
        isPublic: data.isPublic,
        tags: data.tags || [],
        creatorId: data.isPublic ? project.creatorId : null,
      },
    })

    return NextResponse.json({
      success: true,
      data: character,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'create_character', projectId: data?.projectId })
    const errorMessage = error instanceof Error ? error.message : '创建角色失败'
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_ERROR', message: errorMessage } },
      { status: 500 }
    )
  }
}
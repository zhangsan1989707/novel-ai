import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { WriterType } from '@/types'
import { logError } from '@/lib/logger'
import { getCurrentUserId } from '@/lib/auth'

// ============================================
// Schema 验证
// ============================================

const createVirtualWriterSchema = z.object({
  name: z.string().min(1, '请输入作家名称').max(50, '名称最多50字'),
  description: z.string().optional(),
  writerType: z.nativeEnum(WriterType).default(WriterType.CUSTOM),
  isPublic: z.boolean().default(false),
  tags: z.string().optional(),
})

const updateVirtualWriterSchema = createVirtualWriterSchema.partial()

// ============================================
// GET /api/novel/virtual-writers
// 获取虚拟作家列表
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const search = searchParams.get('search') || ''
    const writerType = searchParams.get('writerType')
    const trainingStatus = searchParams.get('trainingStatus')

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ]
    }

    if (writerType) {
      where.writerType = writerType
    }

    if (trainingStatus) {
      where.trainingStatus = trainingStatus
    }

    const [writers, total] = await Promise.all([
      prisma.virtualWriter.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: {
              documents: true,
              chapters: true,
            },
          },
        },
      }),
      prisma.virtualWriter.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        writers,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'list_virtual_writers' })
    return NextResponse.json(
      { success: false, error: { code: 'GET_ERROR', message: '获取列表失败' } },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/novel/virtual-writers
// 创建虚拟作家
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createVirtualWriterSchema.parse(body)

    const creatorId = await getCurrentUserId()

    const writer = await prisma.virtualWriter.create({
      data: {
        ...data,
        creatorId,
      },
    })

    return NextResponse.json({
      success: true,
      data: writer,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'create_virtual_writer' })
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_ERROR', message: '创建失败' } },
      { status: 500 }
    )
  }
}

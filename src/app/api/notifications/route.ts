import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

// ============================================
// Schema 验证
// ============================================

const createNotificationSchema = z.object({
  type: z.enum(['SYSTEM', 'TASK', 'QUOTA', 'ERROR']).default('SYSTEM'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  link: z.string().optional(),
  projectId: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const DEFAULT_USER_ID = 1 // TODO: 后续接入认证后修改

// ============================================
// API Handlers
// ============================================

/**
 * GET /api/notifications
 * 获取用户通知列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const where = {
      userId: DEFAULT_USER_ID,
      ...(unreadOnly ? { isRead: false } : {}),
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ])

    const unreadCount = await prisma.notification.count({
      where: { userId: DEFAULT_USER_ID, isRead: false },
    })

    return NextResponse.json({
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    })
  } catch (error) {
    console.error('获取通知列表失败:', error)
    return NextResponse.json(
      { error: '获取通知列表失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications
 * 创建新通知
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createNotificationSchema.parse(body)

    const notification = await prisma.notification.create({
      data: {
        userId: DEFAULT_USER_ID,
        type: data.type,
        priority: data.priority,
        title: data.title,
        content: data.content,
        link: data.link,
        projectId: data.projectId,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ data: notification }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '参数验证失败', details: error.issues },
        { status: 400 }
      )
    }
    console.error('创建通知失败:', error)
    return NextResponse.json(
      { error: '创建通知失败' },
      { status: 500 }
    )
  }
}

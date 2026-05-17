import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth'

const DEFAULT_USER_ID = getCurrentUserId()

/**
 * PATCH /api/notifications/read-all
 * 标记所有通知为已读
 */
export async function PATCH(request: NextRequest) {
  try {
    const { prisma } = await import('@/lib/prisma')

    const result = await prisma.notification.updateMany({
      where: {
        userId: DEFAULT_USER_ID,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return NextResponse.json({
      data: { count: result.count },
      message: `已标记 ${result.count} 条通知为已读`,
    })
  } catch (error) {
    console.error('标记所有通知已读失败:', error)
    return NextResponse.json(
      { error: '标记所有通知已读失败' },
      { status: 500 }
    )
  }
}

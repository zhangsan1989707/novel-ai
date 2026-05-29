import { NextRequest, NextResponse } from 'next/server'

/**
 * PATCH /api/notifications/[id]/read
 * 标记单条通知为已读
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const notificationId = parseInt(id)

    if (isNaN(notificationId)) {
      return NextResponse.json({ error: '无效的通知 ID' }, { status: 400 })
    }

    // TODO: 后续接入认证后，需要验证通知是否属于当前用户
    const { prisma } = await import('@/lib/prisma')
    const { getCurrentUserId } = await import('@/lib/auth')
    const userId = await getCurrentUserId()

    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return NextResponse.json({ data: notification })
  } catch (error) {
    console.error('标记通知已读失败:', error)
    return NextResponse.json(
      { error: '标记通知已读失败' },
      { status: 500 }
    )
  }
}

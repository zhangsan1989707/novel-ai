import { NextRequest, NextResponse } from 'next/server'

/**
 * DELETE /api/notifications/[id]
 * 删除单条通知
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const notificationId = parseInt(id)

    if (isNaN(notificationId)) {
      return NextResponse.json({ error: '无效的通知 ID' }, { status: 400 })
    }

    const { prisma } = await import('@/lib/prisma')
    const { getCurrentUserId } = await import('@/lib/auth')
    const userId = await getCurrentUserId()

    const existing = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    })

    if (!existing) {
      return NextResponse.json({ error: '通知不存在或无权限访问' }, { status: 404 })
    }

    await prisma.notification.delete({ where: { id: notificationId } })

    return NextResponse.json({ data: { id: notificationId } })
  } catch (error) {
    console.error('删除通知失败:', error)
    return NextResponse.json({ error: '删除通知失败' }, { status: 500 })
  }
}

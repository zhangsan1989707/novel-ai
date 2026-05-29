import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/auth'
import type { ProjectHealthReport } from '@/lib/engine/project-health'

function buildNotificationTitle(projectTitle: string) {
  return `项目健康提醒：${projectTitle}`
}

function buildNotificationContent(report: ProjectHealthReport): string {
  const lines = [
    `健康分：${report.healthScore}/100（${report.healthLevel === 'critical' ? '严重' : report.healthLevel === 'warning' ? '告警' : '健康'}）`,
    `建议动作：${report.primaryAction}`,
  ]

  if (report.issues.length > 0) {
    lines.push(`当前问题：${report.issues.slice(0, 4).map(item => item.message).join('；')}`)
  }

  if (report.recommendations.length > 0) {
    lines.push(`推荐动作：${report.recommendations.slice(0, 3).join('；')}`)
  }

  return lines.join('\n')
}

export async function syncProjectHealthNotification(projectId: number, projectTitle: string, report: ProjectHealthReport): Promise<void> {
  const userId = await getCurrentUserId()
  const title = buildNotificationTitle(projectTitle)
  const content = buildNotificationContent(report)

  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      projectId,
      title,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (report.healthLevel === 'healthy') {
    if (existing && !existing.isRead) {
      await prisma.notification.update({
        where: { id: existing.id },
        data: {
          isRead: true,
          readAt: new Date(),
          content: `${content}\n\n当前已恢复健康，可继续生产`,
          priority: 'LOW',
          type: 'SYSTEM',
        },
      })
    }
    return
  }

  const payload = {
    userId,
    projectId,
    type: report.healthLevel === 'critical' ? 'ERROR' : 'TASK',
    priority: report.healthLevel === 'critical' ? 'HIGH' : 'NORMAL',
    title,
    content,
    metadata: {
      kind: 'project_health',
      healthLevel: report.healthLevel,
      healthScore: report.healthScore,
      primaryAction: report.primaryAction,
      recommendations: report.recommendations.slice(0, 3),
      updatedAt: new Date().toISOString(),
    } as Prisma.InputJsonValue,
  } satisfies Prisma.NotificationUncheckedCreateInput

  if (existing) {
    await prisma.notification.update({
      where: { id: existing.id },
      data: payload as Prisma.NotificationUncheckedUpdateInput,
    })
    return
  }

  await prisma.notification.create({
    data: payload,
  })
}

import { prisma } from '@/lib/prisma'
import type { ArcPlan } from '@prisma/client'

export type ArcEventStatus =
  | 'pending'
  | 'started'
  | 'completed'
  | 'advanced'
  | 'delayed'
  | 'skipped'

export interface ArcEventSeed {
  arcPlanId?: string | null
  arcNumber?: number | null
  eventKey: string
  eventDescription: string
  plannedChapterNo?: number | null
}

export async function syncArcEventsFromPlans(projectId: number, plans: Array<Pick<ArcPlan, 'id' | 'arcNumber' | 'startChapter' | 'keyEvents' | 'name'>>): Promise<void> {
  for (const plan of plans) {
    for (let index = 0; index < plan.keyEvents.length; index++) {
      const eventDescription = plan.keyEvents[index]
      const eventKey = `arc-${plan.arcNumber}-event-${index + 1}`
      await prisma.arcEventLedger.upsert({
        where: {
          projectId_eventKey: {
            projectId,
            eventKey,
          },
        },
        update: {
          arcPlanId: plan.id,
          arcNumber: plan.arcNumber,
          eventDescription,
          plannedChapterNo: plan.startChapter,
        },
        create: {
          projectId,
          arcPlanId: plan.id,
          arcNumber: plan.arcNumber,
          eventKey,
          eventDescription,
          plannedChapterNo: plan.startChapter,
          status: 'pending',
        },
      })
    }
  }
}

export async function getPendingOrStartedArcEvents(projectId: number): Promise<Array<{ eventKey: string; eventDescription: string; status: ArcEventStatus; plannedChapterNo: number | null; actualChapterNo: number | null }>> {
  const rows = await prisma.arcEventLedger.findMany({
    where: {
      projectId,
      status: { in: ['pending', 'started', 'delayed'] },
    },
    orderBy: [
      { arcNumber: 'asc' },
      { plannedChapterNo: 'asc' },
      { createdAt: 'asc' },
    ],
    select: {
      eventKey: true,
      eventDescription: true,
      status: true,
      plannedChapterNo: true,
      actualChapterNo: true,
    },
  })

  return rows.map(row => ({
    ...row,
    status: row.status as ArcEventStatus,
    plannedChapterNo: row.plannedChapterNo ?? null,
    actualChapterNo: row.actualChapterNo ?? null,
  }))
}

export async function advanceArcEvent(projectId: number, eventKey: string, status: ArcEventStatus, actualChapterNo: number, notes?: string): Promise<void> {
  await prisma.arcEventLedger.update({
    where: {
      projectId_eventKey: {
        projectId,
        eventKey,
      },
    },
    data: {
      status,
      actualChapterNo,
      notes: notes ?? null,
    },
  })
}

export function buildArcEventPromptContext(events: Awaited<ReturnType<typeof getPendingOrStartedArcEvents>>): string {
  if (events.length === 0) {
    return '暂无待推进 Arc 事件。'
  }

  const lines = events.map(event => {
    const chapterHint = event.actualChapterNo ? `actual=${event.actualChapterNo}` : event.plannedChapterNo ? `plan=${event.plannedChapterNo}` : '未分配章节'
    return `- [${event.status}] ${event.eventKey}：${event.eventDescription}（${chapterHint}）`
  })

  return [
    '以下是 ArcEventLedger 中未完成的事件，下一章规划时不得重复已发生事件，只能推进、延后或标记跳过。',
    ...lines,
  ].join('\n')
}

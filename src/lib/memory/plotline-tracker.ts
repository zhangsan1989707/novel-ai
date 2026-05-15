/**
 * 伏笔追踪 Memory 模块
 */
import { prisma } from '@/lib/prisma'
import type { PlotlineData } from '@/lib/engine/types'
import { PlotlineStatus } from '@prisma/client'

/**
 * 获取所有进行中的伏笔
 */
export async function getOpenPlotlines(projectId: number): Promise<PlotlineData[]> {
  const plotlines = await prisma.plotline.findMany({
    where: { projectId, status: PlotlineStatus.OPEN },
    orderBy: { plantedAt: 'asc' },
  })

  return plotlines.map(p => ({
    id: p.id,
    type: p.type,
    description: p.description,
    plantedAt: p.plantedAt,
    resolvedAt: p.resolvedAt,
    plannedAt: p.plannedAt,
    status: p.status,
  }))
}

/**
 * 创建新伏笔
 */
export async function createPlotline(
  projectId: number,
  description: string,
  plantedAt: number,
  type: 'FORESHADOW' | 'SUBPLOT' | 'CONFLICT' = 'FORESHADOW',
  plannedAt?: number
): Promise<string> {
  const plotline = await prisma.plotline.create({
    data: {
      projectId,
      type,
      description,
      plantedAt,
      plannedAt,
      status: PlotlineStatus.OPEN,
    },
  })
  return plotline.id
}

/**
 * 批量创建伏笔
 */
export async function batchCreatePlotlines(
  projectId: number,
  plotlines: { description: string; plantedAt: number; type?: 'FORESHADOW' | 'SUBPLOT' | 'CONFLICT'; plannedAt?: number }[]
): Promise<string[]> {
  const results = await Promise.all(
    plotlines.map(p =>
      prisma.plotline.create({
        data: {
          projectId,
          type: p.type || 'FORESHADOW',
          description: p.description,
          plantedAt: p.plantedAt,
          plannedAt: p.plannedAt,
          status: PlotlineStatus.OPEN,
        },
      })
    )
  )
  return results.map(r => r.id)
}

/**
 * 标记伏笔已回收
 */
export async function resolvePlotline(
  plotlineId: string,
  resolvedAt: number
): Promise<void> {
  await prisma.plotline.update({
    where: { id: plotlineId },
    data: {
      status: PlotlineStatus.RESOLVED,
      resolvedAt,
    },
  })
}

/**
 * 批量标记伏笔已回收
 */
export async function batchResolvePlotlines(
  plotlineIds: string[],
  resolvedAt: number
): Promise<void> {
  await prisma.plotline.updateMany({
    where: { id: { in: plotlineIds } },
    data: {
      status: PlotlineStatus.RESOLVED,
      resolvedAt,
    },
  })
}

/**
 * 获取伏笔列表（按状态）
 */
export async function getPlotlinesByStatus(
  projectId: number,
  status: PlotlineStatus
): Promise<PlotlineData[]> {
  const plotlines = await prisma.plotline.findMany({
    where: { projectId, status },
    orderBy: { plantedAt: 'asc' },
  })

  return plotlines.map(p => ({
    id: p.id,
    type: p.type,
    description: p.description,
    plantedAt: p.plantedAt,
    resolvedAt: p.resolvedAt,
    plannedAt: p.plannedAt,
    status: p.status,
  }))
}

/**
 * 获取项目所有伏笔统计
 */
export async function getPlotlineStats(projectId: number): Promise<{
  total: number
  open: number
  resolved: number
  abandoned: number
}> {
  const [total, open, resolved, abandoned] = await Promise.all([
    prisma.plotline.count({ where: { projectId } }),
    prisma.plotline.count({ where: { projectId, status: PlotlineStatus.OPEN } }),
    prisma.plotline.count({ where: { projectId, status: PlotlineStatus.RESOLVED } }),
    prisma.plotline.count({ where: { projectId, status: PlotlineStatus.ABANDONED } }),
  ])

  return { total, open, resolved, abandoned }
}

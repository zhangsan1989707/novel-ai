import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  let projectIdNum: number | null = null
  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId)
    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const usages = await prisma.aIUsage.findMany({
      where: { projectId: projectIdNum },
      select: {
        usageType: true,
        vendor: true,
        totalTokens: true,
        totalCost: true,
      },
    })

    const byUsageTypeMap = new Map<string, { totalCost: number; totalTokens: number; count: number }>()
    const byVendorMap = new Map<string, { totalCost: number; count: number }>()
    let totalCost = 0

    for (const u of usages) {
      const cost = u.totalCost.toNumber()
      totalCost += cost

      const existing = byUsageTypeMap.get(u.usageType) || { totalCost: 0, totalTokens: 0, count: 0 }
      byUsageTypeMap.set(u.usageType, {
        totalCost: existing.totalCost + cost,
        totalTokens: existing.totalTokens + u.totalTokens,
        count: existing.count + 1,
      })

      const vExisting = byVendorMap.get(u.vendor) || { totalCost: 0, count: 0 }
      byVendorMap.set(u.vendor, {
        totalCost: vExisting.totalCost + cost,
        count: vExisting.count + 1,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        totalCost,
        byUsageType: Array.from(byUsageTypeMap.entries()).map(([usageType, v]) => ({ usageType, ...v })),
        byVendor: Array.from(byVendorMap.entries()).map(([vendor, v]) => ({ vendor, ...v })),
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      type: 'batch_cost',
      projectId: projectIdNum,
    })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取批次成本失败' } },
      { status: 500 }
    )
  }
}

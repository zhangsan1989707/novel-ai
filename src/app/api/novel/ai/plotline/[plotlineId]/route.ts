import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'

const requestSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'ABANDONED']).optional(),
  resolvedAt: z.number().int().positive().optional(),
  plannedAt: z.number().int().positive().optional(),
})

/**
 * PATCH /api/novel/ai/plotline/[plotlineId]
 * 更新伏笔状态（手动标记回收/放弃）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ plotlineId: string }> }
) {
  let plotlineId: string | null = null
  try {
    const { plotlineId: paramPlotlineId } = await params
    plotlineId = paramPlotlineId

    const body = await request.json()
    const updates = requestSchema.parse(body)

    // 构建更新数据
    const updateData: {
      status?: 'OPEN' | 'RESOLVED' | 'ABANDONED'
      resolvedAt?: number | null
      plannedAt?: number | null
    } = {}

    if (updates.status) {
      updateData.status = updates.status
    }
    if (updates.resolvedAt !== undefined) {
      updateData.resolvedAt = updates.resolvedAt
    }
    if (updates.plannedAt !== undefined) {
      updateData.plannedAt = updates.plannedAt
    }

    const updated = await prisma.plotline.update({
      where: { id: paramPlotlineId },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        resolvedAt: updated.resolvedAt,
        plannedAt: updated.plannedAt,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'update_plotline', plotlineId })
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_ERROR', message: '更新伏笔失败' } },
      { status: 500 }
    )
  }
}
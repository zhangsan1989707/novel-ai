import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params
    const projectId = parseInt(projectIdStr)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const arcPlanCount = await prisma.arcPlan.count({ where: { projectId } })
    if (arcPlanCount === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'ArcPlan不存在，无法确认' } },
        { status: 404 }
      )
    }

    await prisma.novelProject.update({
      where: { id: projectId },
      data: {
        arcPlanConfirmedAt: new Date(),
        workflowStage: 'GENERATE',
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        workflowStage: 'GENERATE',
      },
    })
  } catch (error) {
    console.error('Confirm arc plans error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '确认ArcPlan失败' } },
      { status: 500 }
    )
  }
}

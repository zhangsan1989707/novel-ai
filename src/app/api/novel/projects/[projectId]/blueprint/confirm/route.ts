import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

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
    if (!await requireProjectOwner(projectId)) {
      return projectNotFoundResponse()
    }

    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      include: {
        bookBlueprint: { select: { id: true } },
      },
    })

    if (!project || !project.bookBlueprint) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Blueprint不存在，无法确认' } },
        { status: 404 }
      )
    }

    await prisma.novelProject.update({
      where: { id: projectId },
      data: {
        blueprintConfirmedAt: new Date(),
        arcPlanConfirmedAt: null,
        workflowStage: 'ARC_PLAN_CONFIRM',
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        workflowStage: 'ARC_PLAN_CONFIRM',
      },
    })
  } catch (error) {
    console.error('Confirm blueprint error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '确认Blueprint失败' } },
      { status: 500 }
    )
  }
}

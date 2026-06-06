import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params
    const projectId = parseInt(projectIdStr)
    const body = await request.json()

    if (isNaN(projectId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    if (!await requireProjectOwner(projectId)) {
      return projectNotFoundResponse()
    }

    const project = await prisma.novelProject.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    const updateData: Record<string, number> = {}
    const allowedFields = ['pace', 'darkness', 'humor', 'romance', 'powerGrowth', 'conflictIntensity', 'mysteryDensity']

    for (const field of allowedFields) {
      if (typeof body[field] === 'number') {
        updateData[field] = Math.max(0, Math.min(1, body[field]))
      }
    }

    await prisma.novelProject.update({
      where: { id: projectId },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: {
        message: '风格参数已更新',
        ...Object.fromEntries(allowedFields.map(f => [f, updateData[f] ?? (project as Record<string, unknown>)[f] ?? 0.5])),
      },
    })
  } catch (error) {
    console.error('Steering update error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '更新风格参数失败' } },
      { status: 500 }
    )
  }
}

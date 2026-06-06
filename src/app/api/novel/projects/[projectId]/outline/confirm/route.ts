import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
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

    const chapterCount = await prisma.novelChapter.count({
      where: { projectId, chapterOutline: { not: Prisma.DbNull } },
    })
    if (chapterCount === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '没有可确认的章节大纲' } },
        { status: 404 }
      )
    }

    await prisma.novelProject.update({
      where: { id: projectId },
      data: {
        outlineConfirmedAt: new Date(),
        workflowStage: 'GENERATE',
      },
    })

    return NextResponse.json({
      success: true,
      data: { workflowStage: 'GENERATE', chapterCount },
    })
  } catch (error) {
    console.error('Confirm outline error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '确认大纲失败' } },
      { status: 500 }
    )
  }
}

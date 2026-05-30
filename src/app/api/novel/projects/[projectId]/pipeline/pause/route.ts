import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pauseJob } from '@/lib/engine/generation-job'

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

    const project = await prisma.novelProject.findUnique({ where: { id: projectId } })
    if (!project || !project.pipelineJobId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '没有可暂停的生成任务' } },
        { status: 404 }
      )
    }

    const job = await prisma.generationJob.findUnique({
      where: { id: project.pipelineJobId },
      select: { status: true },
    })
    if (!job || job.status === 'COMPLETED' || job.status === 'FAILED') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATE', message: '当前生成任务不能暂停' } },
        { status: 400 }
      )
    }

    if (job.status !== 'PAUSED') {
      await pauseJob(project.pipelineJobId)
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: project.pipelineJobId,
        status: 'PAUSED',
      },
    })
  } catch (error) {
    console.error('Pipeline pause error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '暂停生成任务失败' } },
      { status: 500 }
    )
  }
}

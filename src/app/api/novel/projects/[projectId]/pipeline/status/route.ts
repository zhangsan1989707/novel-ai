import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sanitizePipelineRuntime } from '@/lib/engine/pipeline-runtime'

export async function GET(
  request: NextRequest,
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
    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    let jobId = project.pipelineJobId
    if (!jobId) {
      const latestJob = await prisma.generationJob.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      })
      jobId = latestJob?.id || null
    }

    if (!jobId) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'IDLE',
          currentStep: '',
          progress: 0,
          currentChapter: 0,
          totalChapters: 0,
          runtime: sanitizePipelineRuntime(undefined),
        },
      })
    }

    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'IDLE',
          currentStep: '',
          progress: 0,
          currentChapter: 0,
          totalChapters: 0,
          runtime: sanitizePipelineRuntime(undefined),
        },
      })
    }

    const totalSteps = 8
    const stepProgress = totalSteps > 0 ? (job.stepIndex / totalSteps) * 100 : 0

    return NextResponse.json({
      success: true,
      data: {
        status: job.status,
        currentStep: job.currentStep || '',
        progress: Math.round(stepProgress),
        currentChapter: job.currentChapter,
        totalChapters: job.totalChapters,
        error: job.errorMessage || undefined,
        pipelineJobId: job.id,
        runtime: sanitizePipelineRuntime(
          job.payload && typeof job.payload === 'object'
            ? (job.payload as Record<string, unknown>).runtime
            : undefined
        ),
        updatedAt: job.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Pipeline status error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '查询生成状态失败' } },
      { status: 500 }
    )
  }
}

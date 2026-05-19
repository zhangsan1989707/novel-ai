import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createJob } from '@/lib/engine/generation-job'
import { runProductionPipeline } from '@/lib/engine/production-pipeline'

export async function POST(
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

    const activeJob = await prisma.generationJob.findFirst({
      where: {
        projectId,
        status: { in: ['PENDING', 'RUNNING', 'PAUSED'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (activeJob) {
      return NextResponse.json({
        success: true,
        data: { jobId: activeJob.id, projectId, status: activeJob.status },
      })
    }

    const jobId = await createJob(projectId)
    void runProductionPipeline(jobId)

    return NextResponse.json({
      success: true,
      data: { jobId, projectId, status: 'pending' },
    })
  } catch (error) {
    console.error('Pipeline start error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '启动流水线失败' } },
      { status: 500 }
    )
  }
}

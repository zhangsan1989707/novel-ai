import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runProductionPipeline } from '@/lib/engine/production-pipeline'
import { normalizeGenerationSpeedMode } from '@/lib/ai/speed-mode'
import { failStaleRunningJobs } from '@/lib/engine/generation-job'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params
    const projectId = Number.parseInt(projectIdStr, 10)

    if (Number.isNaN(projectId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    await failStaleRunningJobs({ projectId })

    const job = await prisma.generationJob.findFirst({
      where: {
        projectId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!job) {
      return NextResponse.json({
        success: true,
        data: { status: 'IDLE', message: '没有待推进的生成任务' },
      })
    }

    const payload = job.payload && typeof job.payload === 'object'
      ? job.payload as Record<string, unknown>
      : {}
    const speedMode = normalizeGenerationSpeedMode(payload.speedMode)

    await runProductionPipeline(job.id, { speedMode })

    return NextResponse.json({
      success: true,
      data: { jobId: job.id, projectId, status: 'processed', speedMode },
    })
  } catch (error) {
    console.error('Pipeline run-next error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '推进 AI 生成失败' } },
      { status: 500 }
    )
  }
}

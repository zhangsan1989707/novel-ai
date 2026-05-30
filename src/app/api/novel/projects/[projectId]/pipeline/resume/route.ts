import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { failStaleRunningJobs, prepareJobRecovery, resumeJob } from '@/lib/engine/generation-job'
import { runProductionPipeline } from '@/lib/engine/production-pipeline'
import { normalizeGenerationSpeedMode } from '@/lib/ai/speed-mode'

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
        { success: false, error: { code: 'NOT_FOUND', message: '没有可恢复的生成任务' } },
        { status: 404 }
      )
    }

    await failStaleRunningJobs({ projectId })

    const resumed = await prepareJobRecovery(project.pipelineJobId, { mode: 'continue' })
      || await resumeJob(project.pipelineJobId)
    if (!resumed) {
      return NextResponse.json(
        { success: false, error: { code: 'RESUME_FAILED', message: '恢复任务失败，任务可能不在失败或暂停状态' } },
        { status: 400 }
      )
    }
    const job = await prisma.generationJob.findUnique({
      where: { id: project.pipelineJobId },
      select: { payload: true },
    })
    const payload = job?.payload && typeof job.payload === 'object'
      ? job.payload as Record<string, unknown>
      : {}
    const speedMode = normalizeGenerationSpeedMode(payload.speedMode)
    if (process.env.NOVEL_AI_PIPELINE_INLINE !== 'false') {
      runProductionPipeline(project.pipelineJobId, { speedMode }).catch(err =>
        console.error('Pipeline resume error:', err)
      )
    }

    return NextResponse.json({ success: true, data: { jobId: project.pipelineJobId, status: 'PENDING', speedMode } })
  } catch (error) {
    console.error('Pipeline resume error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '恢复生成任务失败' } },
      { status: 500 }
    )
  }
}

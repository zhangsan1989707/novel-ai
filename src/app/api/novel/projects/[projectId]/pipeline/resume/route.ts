import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { prepareJobRecovery, resumeJob } from '@/lib/engine/generation-job'
import { runProductionPipeline } from '@/lib/engine/production-pipeline'

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

    const resumed = await prepareJobRecovery(project.pipelineJobId, { mode: 'continue' })
      || await resumeJob(project.pipelineJobId)
    if (!resumed) {
      return NextResponse.json(
        { success: false, error: { code: 'RESUME_FAILED', message: '恢复任务失败，任务可能不在失败或暂停状态' } },
        { status: 400 }
      )
    }
    void runProductionPipeline(project.pipelineJobId)

    return NextResponse.json({ success: true, data: { jobId: project.pipelineJobId, status: 'pending' } })
  } catch (error) {
    console.error('Pipeline resume error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '恢复生成任务失败' } },
      { status: 500 }
    )
  }
}

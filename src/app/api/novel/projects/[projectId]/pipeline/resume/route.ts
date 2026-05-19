import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resumeJob } from '@/lib/engine/generation-job'

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

    const project = await prisma.novelProject.findUnique({ where: { id: projectId } })
    if (!project || !project.pipelineJobId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '没有可恢复的流水线任务' } },
        { status: 404 }
      )
    }

    const resumed = await resumeJob(project.pipelineJobId)
    if (!resumed) {
      return NextResponse.json(
        { success: false, error: { code: 'RESUME_FAILED', message: '恢复任务失败，任务可能不在失败状态' } },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, data: { jobId: project.pipelineJobId, status: 'pending' } })
  } catch (error) {
    console.error('Pipeline resume error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '恢复流水线失败' } },
      { status: 500 }
    )
  }
}
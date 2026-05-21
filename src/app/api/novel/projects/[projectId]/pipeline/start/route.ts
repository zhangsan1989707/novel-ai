import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createJob } from '@/lib/engine/generation-job'
import { runProductionPipeline } from '@/lib/engine/production-pipeline'
import { getProjectMaintenanceSummary } from '@/lib/engine/auto-maintenance'

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

    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        aiModelId: true,
        bookBlueprint: { select: { id: true } },
        arcPlans: { select: { id: true } },
        storyState: { select: { id: true } },
        worldState: { select: { id: true } },
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    const maintenanceSummary = await getProjectMaintenanceSummary(projectId)
    const bootstrapRunning = maintenanceSummary.bootstrapQueued || maintenanceSummary.bootstrapRunning
    const ragRunning = maintenanceSummary.ragQueued || maintenanceSummary.ragRunning
    const initializationIncomplete =
      !project.aiModelId ||
      !project.bookBlueprint ||
      project.arcPlans.length === 0 ||
      !project.storyState ||
      !project.worldState

    if (bootstrapRunning || ragRunning || initializationIncomplete) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INITIALIZING',
            message: bootstrapRunning || ragRunning
              ? 'AI 正在初始化创作系统或重建 RAG 索引，请完成后再开始生成'
              : '创作系统尚未初始化完成，请稍后再开始生成',
          },
        },
        { status: 409 }
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
      { success: false, error: { code: 'INTERNAL_ERROR', message: '启动 AI 生产失败' } },
      { status: 500 }
    )
  }
}

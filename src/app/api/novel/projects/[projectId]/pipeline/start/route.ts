import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createJob, failStaleRunningJobs } from '@/lib/engine/generation-job'
import { runProductionPipeline } from '@/lib/engine/production-pipeline'
import { getProjectMaintenanceSummary } from '@/lib/engine/auto-maintenance'
import { getWorkflowBlockReason } from '@/lib/engine/project-flow'
import { normalizeGenerationSpeedMode, generationSpeedModes } from '@/lib/ai/speed-mode'
import { z } from 'zod'

const startPipelineSchema = z.object({
  speedMode: z.enum(generationSpeedModes).optional(),
})

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

    let speedMode = normalizeGenerationSpeedMode(undefined)
    try {
      const body = await request.json()
      const parsed = startPipelineSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '请求参数无效' } },
          { status: 400 }
        )
      }
      speedMode = normalizeGenerationSpeedMode(parsed.data.speedMode)
    } catch {
      speedMode = normalizeGenerationSpeedMode(undefined)
    }

    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        aiModelId: true,
        workflowStage: true,
        blueprintConfirmedAt: true,
        arcPlanConfirmedAt: true,
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

    const flowBlockReason = getWorkflowBlockReason({
      workflowStage: project.workflowStage,
      blueprintConfirmedAt: project.blueprintConfirmedAt,
      arcPlanConfirmedAt: project.arcPlanConfirmedAt,
      hasBlueprint: Boolean(project.bookBlueprint),
      hasArcPlans: project.arcPlans.length > 0,
    })
    if (flowBlockReason) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FLOW_BLOCKED',
            message: flowBlockReason,
          },
        },
        { status: 409 }
      )
    }

    const maintenanceSummary = await getProjectMaintenanceSummary(projectId)
    const bootstrapRunning = maintenanceSummary.bootstrapQueued || maintenanceSummary.bootstrapRunning
    const ragRunning = maintenanceSummary.ragQueued || maintenanceSummary.ragRunning
    if (bootstrapRunning || ragRunning) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INITIALIZING',
            message: 'AI 正在初始化创作系统或重建 RAG 索引，请完成后再开始生成',
          },
        },
        { status: 409 }
      )
    }

    await failStaleRunningJobs({ projectId })

    const activeJob = await prisma.generationJob.findFirst({
      where: {
        projectId,
        status: { in: ['PENDING', 'RUNNING', 'PAUSED'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (activeJob) {
      if (activeJob.status === 'PENDING') {
        runProductionPipeline(activeJob.id, { speedMode }).catch(err =>
          console.error('Pipeline retry error:', err)
        )
      }

      const payload = activeJob.payload && typeof activeJob.payload === 'object'
        ? activeJob.payload as Record<string, unknown>
        : {}
      return NextResponse.json({
        success: true,
        data: {
          jobId: activeJob.id,
          projectId,
          status: activeJob.status,
          speedMode: normalizeGenerationSpeedMode(payload.speedMode),
        },
      })
    }

    const jobId = await createJob(projectId, 'FULL_PIPELINE', speedMode)
    if (process.env.NOVEL_AI_PIPELINE_INLINE !== 'false') {
      runProductionPipeline(jobId, { speedMode }).catch(err =>
        console.error('Pipeline start error:', err)
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        projectId,
        status: 'pending',
        speedMode,
        runner: process.env.NOVEL_AI_PIPELINE_INLINE === 'false' ? 'external' : 'inline',
      },
    })
  } catch (error) {
    console.error('Pipeline start error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '启动 AI 生产失败' } },
      { status: 500 }
    )
  }
}

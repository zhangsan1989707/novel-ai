import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { createJob, failStaleRunningJobs, resumeJob, updateJobStep } from '@/lib/engine/generation-job'
import { runProductionPipeline } from '@/lib/engine/production-pipeline'
import { getProjectMaintenanceSummary } from '@/lib/engine/auto-maintenance'
import { getWorkflowBlockReason } from '@/lib/engine/project-flow'
import { readProjectPipelineSnapshot } from '@/lib/engine/project-pipeline-snapshot'
import { normalizeGenerationSpeedMode, generationSpeedModes, type GenerationSpeedMode } from '@/lib/ai/speed-mode'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'
import { z } from 'zod'

const startPipelineSchema = z.object({
  speedMode: z.enum(generationSpeedModes).optional(),
})

async function buildStartPipelineData(
  projectId: number,
  jobId: number,
  speedMode: GenerationSpeedMode,
  runner?: 'external' | 'inline'
) {
  const snapshot = await readProjectPipelineSnapshot(projectId)
  return {
    jobId,
    projectId,
    status: snapshot?.status || 'PENDING',
    speedMode: snapshot?.speedMode || speedMode,
    runner,
    snapshot,
    totalChapters: snapshot?.totalChapters,
    runtimeSummary: snapshot?.runtimeSummary,
  }
}

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

    const projectOwner = await requireProjectOwner(projectId)
    if (!projectOwner) {
      return projectNotFoundResponse()
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
        outlineConfirmedAt: true,
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

    const outlineCount = await prisma.novelChapter.count({
      where: { projectId, chapterOutline: { not: Prisma.DbNull } },
    })

    const flowBlockReason = getWorkflowBlockReason({
      workflowStage: project.workflowStage,
      blueprintConfirmedAt: project.blueprintConfirmedAt,
      arcPlanConfirmedAt: project.arcPlanConfirmedAt,
      outlineConfirmedAt: project.outlineConfirmedAt,
      hasBlueprint: Boolean(project.bookBlueprint),
      hasArcPlans: project.arcPlans.length > 0,
      hasOutlines: outlineCount > 0,
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

    const failedJob = await prisma.generationJob.findFirst({
      where: {
        projectId,
        status: 'FAILED',
      },
      orderBy: { createdAt: 'desc' },
    })
    if (failedJob) {
      await prisma.novelProject.update({
        where: { id: projectId },
        data: { pipelineJobId: null },
      })
    }

    const activeJob = await prisma.generationJob.findFirst({
      where: {
        projectId,
        status: { in: ['PENDING', 'RUNNING', 'PAUSED'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (activeJob) {
      if (activeJob.status === 'PENDING') {
        // PENDING状态的任务可能是之前创建但未启动的，直接运行
        await updateJobStep(activeJob.id, 'blueprint' as any, 1)
        runProductionPipeline(activeJob.id, { speedMode }).catch(err =>
          console.error('Pipeline retry error:', err)
        )
      } else if (activeJob.status === 'RUNNING') {
        // 如果已经在运行，直接返回
        const payload = activeJob.payload && typeof activeJob.payload === 'object'
          ? activeJob.payload as Record<string, unknown>
          : {}
        return NextResponse.json({
          success: true,
          data: await buildStartPipelineData(projectId, activeJob.id, normalizeGenerationSpeedMode(payload.speedMode)),
        })
      } else if (activeJob.status === 'PAUSED') {
        // 如果任务是暂停状态，先恢复它
        await resumeJob(activeJob.id)
        runProductionPipeline(activeJob.id, { speedMode }).catch(err =>
          console.error('Pipeline resume error:', err)
        )
      }

      // 处理完上面的分支后返回
      const payload = activeJob.payload && typeof activeJob.payload === 'object'
        ? activeJob.payload as Record<string, unknown>
        : {}
      return NextResponse.json({
        success: true,
        data: await buildStartPipelineData(projectId, activeJob.id, normalizeGenerationSpeedMode(payload.speedMode)),
      })
    }

    const jobId = await createJob(projectId, 'FULL_PIPELINE', speedMode)
    const runner = process.env.NOVEL_AI_PIPELINE_INLINE === 'false' ? 'external' : 'inline'
    if (runner === 'inline') {
      runProductionPipeline(jobId, { speedMode }).catch(err =>
        console.error('Pipeline start error:', err)
      )
    }

    return NextResponse.json({
      success: true,
      data: await buildStartPipelineData(projectId, jobId, speedMode, runner),
    })
  } catch (error) {
    console.error('Pipeline start error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '启动 AI 生产失败' } },
      { status: 500 }
    )
  }
}

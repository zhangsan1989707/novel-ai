import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autoPipelineScheduler } from '@/lib/pipeline/scheduler'
import { getProjectMaintenanceSummary } from '@/lib/engine/auto-maintenance'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const pid = parseInt(projectId)

    if (isNaN(pid)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      startChapter = 1,
      endChapter,
      speedMode = 'balanced',
      qualityGate,
    } = body

    if (!endChapter || endChapter < startChapter) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: '无效的章节范围' } },
        { status: 400 }
      )
    }

    const project = await prisma.novelProject.findUnique({
      where: { id: pid },
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

    const maintenanceSummary = await getProjectMaintenanceSummary(pid)
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
              ? 'AI 正在初始化创作系统或重建 RAG 索引，请完成后再启动全自动流水线'
              : '创作系统尚未初始化完成，请稍后再启动全自动流水线',
          },
        },
        { status: 409 }
      )
    }

    const activeProgress = autoPipelineScheduler.getProgress(pid)
    if (activeProgress && (activeProgress.status === 'running' || activeProgress.status === 'paused')) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_RUNNING', message: '该项目已有流水线在运行中' } },
        { status: 409 }
      )
    }

    autoPipelineScheduler.start({
      projectId: pid,
      startChapter,
      endChapter,
      speedMode,
      qualityGate: qualityGate || { enabled: false },
    }).catch(console.error)

    return NextResponse.json({
      success: true,
      data: {
        projectId: pid,
        startChapter,
        endChapter,
        speedMode,
        status: 'started',
      },
    })
  } catch (error) {
    console.error('Auto pipeline start error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '启动自动流水线失败' } },
      { status: 500 }
    )
  }
}

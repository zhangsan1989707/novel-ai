import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createProjectProvider, ensureArcPlans, ensureBlueprint } from '@/lib/engine/production-pipeline'
import { initStoryState, initWorldState } from '@/lib/engine/story-state'
import { loadProjectHealthReport } from '@/lib/engine/project-health'
import { syncProjectHealthNotification } from '@/lib/notifications/project-health'
import { refreshBlueprintConsole } from '@/lib/engine/blueprint-console'
import { getDefaultAIConfigRecord } from '@/lib/ai/factory'

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

    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        aiModelId: true,
        targetWordCount: true,
        chapterWordCount: true,
        totalVolumes: true,
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    if (!project.aiModelId) {
      const defaultConfig = await getDefaultAIConfigRecord()
      if (!defaultConfig) {
        return NextResponse.json(
          { success: false, error: { code: 'MODEL_NOT_BOUND', message: '请先绑定 AI 模型' } },
          { status: 400 }
        )
      }

      await prisma.novelProject.update({
        where: { id: projectId },
        data: { aiModelId: defaultConfig.id },
      })
    }

    const provider = await createProjectProvider(projectId)
    const blueprint = await ensureBlueprint(projectId, provider)
    const arcPlans = await ensureArcPlans(projectId, provider)
    const totalPlanned = Math.max(
      25,
      Math.ceil((project.targetWordCount || 300000) / (project.chapterWordCount || 3000)),
      (project.totalVolumes || 4) * 25
    )

    await initWorldState(projectId)
    await initStoryState(projectId, totalPlanned)
    await refreshBlueprintConsole(projectId, '项目初始化完成，请继续同步当前 AI 动态设定中枢。')

    const report = await loadProjectHealthReport(projectId)
    if (report) {
      await syncProjectHealthNotification(projectId, project.title, report)
    }

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        blueprintId: blueprint.id,
        arcPlanCount: arcPlans.length,
        totalPlanned,
        worldStateInitialized: true,
        storyStateInitialized: true,
      },
    })
  } catch (error) {
    console.error('Bootstrap error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '初始化创作系统失败' } },
      { status: 500 }
    )
  }
}

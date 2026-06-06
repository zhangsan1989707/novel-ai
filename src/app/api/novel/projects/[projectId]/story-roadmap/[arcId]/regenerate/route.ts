import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createProjectProvider } from '@/lib/engine/production-pipeline'
import { parseAiJsonObject } from '@/lib/engine/ai-json'
import { buildStoryRoadmapItem } from '@/lib/engine/story-roadmap'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; arcId: string }> }
) {
  try {
    const { projectId: projectIdStr, arcId } = await params
    const projectId = parseInt(projectIdStr)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    if (!await requireProjectOwner(projectId)) {
      return projectNotFoundResponse()
    }

    const body = await request.json().catch(() => ({}))
    const userNote = typeof body.userNote === 'string' ? body.userNote.trim() : ''

    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      include: {
        bookBlueprint: true,
        arcPlans: {
          orderBy: { arcNumber: 'asc' },
        },
      },
    })

    if (!project?.bookBlueprint) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目或Blueprint不存在' } },
        { status: 404 }
      )
    }

    const arc = project.arcPlans.find(item => item.id === arcId)
    if (!arc) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '阶段路线不存在' } },
        { status: 404 }
      )
    }

    const provider = await createProjectProvider(projectId)
    const prompt = `你是长篇网文路线导演。请只重写当前这个阶段的故事路线，用用户能看懂的自然语言表达，不要输出技术字段解释。

项目：${project.title}
题材：${project.genre || '未知'}
蓝图核心卖点：${project.bookBlueprint.corePitch}
世界方向：${project.bookBlueprint.worldDirection || ''}
主线方向：${project.bookBlueprint.mainlineDirection || ''}
成长方向：${project.bookBlueprint.growthDirection || ''}

当前阶段：
- 阶段编号：第${arc.arcNumber}阶段
- 原阶段名：${arc.name}
- 章节范围：${arc.startChapter}-${arc.endChapter || arc.startChapter}
- 当前描述：${arc.description || ''}
- 现有目标：${arc.goals.join('；') || '无'}
- 现有关键事件：${arc.keyEvents.join('；') || '无'}

用户补充要求：
${userNote || '无，请保持整体路线稳定，只优化这一阶段表达和方向。'}

请输出 JSON：
{
  "name": "更适合用户理解的阶段名称",
  "description": "这一阶段主要写什么，要求自然语言说明",
  "goals": ["读者看点1", "读者看点2", "读者看点3"],
  "keyEvents": ["阶段限制1", "阶段限制2", "阶段限制3"]
}`

    const result = await provider.generate(prompt, {
      temperature: 0.3,
      maxTokens: 1200,
      timeoutMs: 120000,
      responseFormat: { type: 'json_object' },
    })

    const parsed = parseAiJsonObject<Record<string, unknown>>(result.content)
    const goals = Array.isArray(parsed.goals) ? parsed.goals.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean) : arc.goals
    const keyEvents = Array.isArray(parsed.keyEvents) ? parsed.keyEvents.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean) : arc.keyEvents

    const updatedArc = await prisma.$transaction(async tx => {
      const updated = await tx.arcPlan.update({
        where: { id: arc.id },
        data: {
          name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : arc.name,
          description: typeof parsed.description === 'string' && parsed.description.trim() ? parsed.description.trim() : arc.description,
          goals,
          keyEvents,
        },
      })

      await tx.novelProject.update({
        where: { id: projectId },
        data: {
          workflowStage: 'ARC_PLAN_CONFIRM',
          arcPlanConfirmedAt: null,
        },
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      data: {
        roadmapItem: buildStoryRoadmapItem({
          id: updatedArc.id,
          arcNumber: updatedArc.arcNumber,
          name: updatedArc.name,
          stage: updatedArc.stage,
          description: updatedArc.description,
          startChapter: updatedArc.startChapter,
          endChapter: updatedArc.endChapter,
          goals: updatedArc.goals,
          keyEvents: updatedArc.keyEvents,
        }),
      },
    })
  } catch (error) {
    console.error('Regenerate story roadmap error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '重生成故事路线失败' } },
      { status: 500 }
    )
  }
}

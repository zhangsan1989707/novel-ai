import { ArcStage as PrismaArcStage } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createProviderFromConfigId, createProviderFromDefaultConfig } from '@/lib/ai/factory'
import { calculateBatchSize } from '@/lib/engine/batch-planner'
import { parseAiJsonArray } from '@/lib/engine/ai-json'
import { normalizeArcPlanOutputs, resolveProjectPlanningTargets } from '@/lib/engine/project-length'
import { toInternalPlatform, toPrismaArcStage } from '@/lib/engine/production-mapping'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

export async function GET(
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
    if (!await requireProjectOwner(projectId)) {
      return projectNotFoundResponse()
    }

    const arcPlans = await prisma.arcPlan.findMany({
      where: { projectId },
      orderBy: { arcNumber: 'asc' },
    })

    return NextResponse.json({ success: true, data: arcPlans })
  } catch (error) {
    console.error('Get arc plans error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '获取ArcPlan失败' } },
      { status: 500 }
    )
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
    if (!await requireProjectOwner(projectId)) {
      return projectNotFoundResponse()
    }

    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      include: { aiModelConfig: true, bookBlueprint: true },
    })
    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    const blueprint = project.bookBlueprint
    if (!blueprint) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_BLUEPRINT', message: '请先生成Book Blueprint' } },
        { status: 400 }
      )
    }

    const provider = project.aiModelId
      ? await createProviderFromConfigId(project.aiModelId)
      : await createProviderFromDefaultConfig()

    if (!provider) {
      return NextResponse.json(
        { success: false, error: { code: 'AI_CONFIG_ERROR', message: 'AI配置不可用' } },
        { status: 500 }
      )
    }

    const planningTargets = resolveProjectPlanningTargets({
      lengthType: project.lengthType,
      targetWordCount: project.targetWordCount,
      chapterWordCount: project.chapterWordCount,
    })
    const targetWordCount = planningTargets.effectiveTargetWordCount
    const chapterWordCount = planningTargets.chapterWordCount
    const totalChapters = planningTargets.effectiveTotalChapters
    const platform = toInternalPlatform(project.platform)

    const stages = planningTargets.stageSequence
    const chaptersPerStage = Math.ceil(totalChapters / stages.length)

    const batchSize = calculateBatchSize(platform, 'opening', 1, 1)

    const prompt = `你是一个小说策划师。请根据以下信息生成这部小说的Arc Plan（阶段规划）：

平台：${project.platform || '起点'}
题材：${project.genre || '未知'}
一句话卖点：${project.corePitch || project.description || '暂无'}
目标字数：约${targetWordCount}字
总章数：约${totalChapters}章
每章字数：约${chapterWordCount}字

Book Blueprint：
- 核心卖点：${blueprint.corePitch || ''}
- 世界方向：${blueprint.worldDirection || ''}
- 主线方向：${blueprint.mainlineDirection || ''}
- 成长方向：${blueprint.growthDirection || ''}
- 终局方向：${blueprint.endingDirection || ''}
- 约束条件：${JSON.stringify(blueprint.constraints || [])}

请将全书分为${stages.length}个阶段（Arc），每个阶段包含约${chaptersPerStage}章。必须按这个顺序输出阶段：${stages.join(', ')}。以JSON数组格式输出（不要包含markdown代码块标记）：
[
  {
    "arcNumber": 1,
    "name": "阶段名称",
    "stage": "OPENING",
    "description": "阶段描述",
    "startChapter": 1,
    "endChapter": ${chaptersPerStage},
    "batchSize": ${batchSize},
    "goals": ["目标1", "目标2", "目标3"],
    "keyEvents": ["关键事件1", "关键事件2", "关键事件3"]
  }
]

阶段枚举值只能是：${stages.join(', ')}
batchSize必须保守控制在 5-15 之间：开局5-8，成长8-12，扩张10-15，中段冲突8-12，前置高潮5-8，终局3-6。`

    let result = ''
    for await (const token of provider.generateStream(prompt, {
      temperature: 0.2,
      responseFormat: { type: 'json_object' },
    })) {
      result += token
    }

    let arcPlansData: Record<string, unknown>[]
    try {
      arcPlansData = parseAiJsonArray<Record<string, unknown>>(result)
    } catch {
      const retryPrompt = `${prompt}\n\n上一次输出未严格符合 JSON 数组。请只输出一个合法 JSON 数组，不要解释，不要代码块，不要多余文本。`
      let retry = ''
      for await (const token of provider.generateStream(retryPrompt, {
        temperature: 0.1,
        responseFormat: { type: 'json_object' },
      })) {
        retry += token
      }
      try {
        arcPlansData = parseAiJsonArray<Record<string, unknown>>(retry)
      } catch {
        return NextResponse.json(
          { success: false, error: { code: 'PARSE_ERROR', message: 'ArcPlan JSON解析失败' } },
          { status: 500 }
        )
      }
    }

    await prisma.arcPlan.deleteMany({ where: { projectId } })

    const normalizedArcPlans = normalizeArcPlanOutputs(arcPlansData, totalChapters, stages)
    const created = []
    for (const ap of normalizedArcPlans) {
      const plan = await prisma.arcPlan.create({
        data: {
          projectId,
          arcNumber: ap.arcNumber,
          name: ap.name || `第${ap.arcNumber}阶段`,
          stage: toPrismaArcStage(ap.stage) as PrismaArcStage,
          description: ap.description || '',
          startChapter: ap.startChapter,
          endChapter: ap.endChapter,
          batchSize: Math.max(3, Math.min(15, ap.batchSize || batchSize)),
          goals: ap.goals,
          keyEvents: ap.keyEvents,
          isCompleted: false,
        },
      })
      created.push(plan)
    }

    await prisma.novelProject.update({
      where: { id: projectId },
      data: {
        workflowStage: 'ARC_PLAN_CONFIRM',
        arcPlanConfirmedAt: null,
      },
    })

    return NextResponse.json({ success: true, data: created })
  } catch (error) {
    console.error('Arc plan generation error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'ArcPlan生成失败' } },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    if (!await requireProjectOwner(projectId)) {
      return projectNotFoundResponse()
    }

    const body = await request.json()
    const plans = Array.isArray(body.arcPlans) ? body.arcPlans : []
    if (plans.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '缺少 ArcPlan 数据' } },
        { status: 400 }
      )
    }

    const existing = await prisma.arcPlan.findMany({
      where: { projectId },
      orderBy: { arcNumber: 'asc' },
    })
    const existingMap = new Map(existing.map(plan => [plan.id, plan]))

    const updated = await prisma.$transaction(async tx => {
      const results = []
      for (const item of plans) {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string') continue
        const current = existingMap.get(item.id)
        if (!current) continue

        const startChapter = typeof item.startChapter === 'number' ? Math.max(1, Math.floor(item.startChapter)) : current.startChapter
        const endChapter = typeof item.endChapter === 'number'
          ? Math.max(startChapter, Math.floor(item.endChapter))
          : current.endChapter
        const goals = Array.isArray(item.goals)
          ? item.goals.filter((goal: unknown): goal is string => typeof goal === 'string').map((goal: string) => goal.trim()).filter(Boolean)
          : current.goals
        const keyEvents = Array.isArray(item.keyEvents)
          ? item.keyEvents.filter((event: unknown): event is string => typeof event === 'string').map((event: string) => event.trim()).filter(Boolean)
          : current.keyEvents

        results.push(await tx.arcPlan.update({
          where: { id: current.id },
          data: {
            name: typeof item.name === 'string' ? item.name.trim() || current.name : current.name,
            startChapter,
            endChapter,
            batchSize: typeof item.batchSize === 'number'
              ? Math.max(3, Math.min(15, Math.floor(item.batchSize)))
              : current.batchSize,
            goals,
            keyEvents,
          },
        }))
      }

      await tx.novelProject.update({
        where: { id: projectId },
        data: {
          workflowStage: 'ARC_PLAN_CONFIRM',
          arcPlanConfirmedAt: null,
        },
      })

      return results
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update arc plans error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '更新ArcPlan失败' } },
      { status: 500 }
    )
  }
}

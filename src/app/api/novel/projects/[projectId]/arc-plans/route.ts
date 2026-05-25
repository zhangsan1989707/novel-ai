import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createProviderFromConfigId, createProviderFromDefaultConfig } from '@/lib/ai/factory'
import { calculateBatchSize } from '@/lib/engine/batch-planner'
import { parseAiJsonArray } from '@/lib/engine/ai-json'
import { toInternalPlatform, toPrismaArcStage } from '@/lib/engine/production-mapping'

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

    const targetWordCount = project.targetWordCount || 300000
    const chapterWordCount = project.chapterWordCount || 3000
    const totalChapters = Math.ceil(targetWordCount / chapterWordCount)
    const platform = toInternalPlatform(project.platform)

    const stages = ['OPENING', 'GROWTH', 'EXPANSION', 'MID_CONFLICT', 'PRE_FINALE', 'FINALE']
    const chaptersPerStage = Math.ceil(totalChapters / stages.length)

    const batchSize = calculateBatchSize(platform, 'opening', 1, 1)

    const prompt = `你是一个小说策划师。请根据以下信息生成这部小说的Arc Plan（阶段规划）：

平台：${project.platform || '起点'}
题材：${project.genre || '未知'}
一句话卖点：${project.corePitch || project.description || '暂无'}
总章数：约${totalChapters}章
每章字数：约${chapterWordCount}字

Book Blueprint：
- 核心卖点：${blueprint.corePitch || ''}
- 世界方向：${blueprint.worldDirection || ''}
- 主线方向：${blueprint.mainlineDirection || ''}
- 成长方向：${blueprint.growthDirection || ''}
- 终局方向：${blueprint.endingDirection || ''}
- 约束条件：${JSON.stringify(blueprint.constraints || [])}

请将全书分为6个阶段（Arc），每个阶段包含约${chaptersPerStage}章。以JSON数组格式输出（不要包含markdown代码块标记）：
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

阶段枚举值只能是：OPENING, GROWTH, EXPANSION, MID_CONFLICT, PRE_FINALE, FINALE
batchSize建议范围10-30，根据阶段节奏调整。`

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

    const created = []
    for (const ap of arcPlansData) {
      const plan = await prisma.arcPlan.create({
        data: {
          projectId,
          arcNumber: (ap.arcNumber as number) || 1,
          name: (ap.name as string) || `第${ap.arcNumber}阶段`,
          stage: toPrismaArcStage(ap.stage) as any,
          description: (ap.description as string) || '',
          startChapter: (ap.startChapter as number) || 1,
          endChapter: (ap.endChapter as number) || null,
          batchSize: (ap.batchSize as number) || batchSize,
          goals: Array.isArray(ap.goals) ? (ap.goals as string[]) : [],
          keyEvents: Array.isArray(ap.keyEvents) ? (ap.keyEvents as string[]) : [],
          isCompleted: false,
        },
      })
      created.push(plan)
    }

    return NextResponse.json({ success: true, data: created })
  } catch (error) {
    console.error('Arc plan generation error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'ArcPlan生成失败' } },
      { status: 500 }
    )
  }
}

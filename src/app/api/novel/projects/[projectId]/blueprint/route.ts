import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createProviderFromConfigId, createProviderFromDefaultConfig } from '@/lib/ai/factory'
import { parseAiJsonObject } from '@/lib/engine/ai-json'
import { normalizePopularFictionProfile } from '@/lib/engine/popular-fiction'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean) : []
}

function toPopularFictionJson(value: unknown) {
  const normalized = normalizePopularFictionProfile(value)
  return normalized ? (normalized as unknown as Prisma.InputJsonValue) : Prisma.JsonNull
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
      include: { aiModelConfig: true },
    })
    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
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

    const prompt = `你是一个小说策划师。请根据以下信息生成本书的Book Blueprint：

平台：${project.platform || '起点'}
题材：${project.genre || '未知'}
一句话卖点：${project.corePitch || project.description || '暂无'}
风格：${project.writingStyle || '默认'}
长度：${project.lengthType || 'LONG'}

请以JSON格式输出以下内容（不要包含markdown代码块标记）：
{
  "corePitch": "重新提炼的核心卖点（一句话）",
  "worldDirection": "世界构建方向（势力、地图层级、修炼体系等）",
  "mainlineDirection": "主线推进方向（核心冲突、阶段规划）",
  "growthDirection": "主角成长方向（技能、地位、势力、境界等）",
  "endingDirection": "可能的终局方向（仅作为远景参考，不决定具体结局）",
  "platformStrategy": "平台策略（章节长度、钩子密度、高潮频率）",
  "genreStrategy": "题材策略（世界扩张、冲突形态、读者期待）",
  "styleStrategy": "风格策略（叙事口吻、节奏、去AI味方向）",
  "popularFictionProfile": {
    "emotionEngine": { "primaryEmotion": "爽", "openingBomb": "开篇情绪炸弹", "readerPayoff": "读者回报", "forbiddenSlowStart": true },
    "cheatAbility": { "name": "金手指名称", "oneLineRule": "一句话规则", "firstRevealChapter": 1, "firstPayoffChapter": 3, "growthMechanism": "成长机制", "limitation": "限制", "readerFantasy": "读者代入点" },
    "conflictEngine": { "conflictTypes": ["羞辱", "打脸"], "conflictFrequency": "每1-2章一次强冲突", "payoffInterval": "1-3章一次回报", "hookStrategy": "每章结尾必须给下一章承诺" },
    "characterTagEngine": { "protagonistTags": ["稳健", "记仇"], "behaviorProofs": [{ "tag": "稳健", "requiredScene": "遇强敌先探信息", "forbiddenBehavior": "无脑硬冲" }] }
  },
  "constraints": ["约束条件1", "约束条件2"]
}`

    let result = ''
    for await (const token of provider.generateStream(prompt, {
      temperature: 0.2,
      responseFormat: { type: 'json_object' },
    })) {
      result += token
    }

    let blueprint: Record<string, unknown>
    try {
      blueprint = parseAiJsonObject<Record<string, unknown>>(result)
    } catch {
      const retryPrompt = `${prompt}\n\n上一次输出未严格符合 JSON。请只输出一个合法 JSON 对象，不要解释，不要代码块，不要多余文本。`
      let retry = ''
      for await (const token of provider.generateStream(retryPrompt, {
        temperature: 0.1,
        responseFormat: { type: 'json_object' },
      })) {
        retry += token
      }
      try {
        blueprint = parseAiJsonObject<Record<string, unknown>>(retry)
      } catch {
        return NextResponse.json(
          { success: false, error: { code: 'PARSE_ERROR', message: 'Blueprint JSON解析失败' } },
          { status: 500 }
        )
      }
    }

    const constraints = Array.isArray(blueprint.constraints) ? (blueprint.constraints as string[]) : []
    const data = {
      corePitch: (blueprint.corePitch as string) || '',
      worldDirection: (blueprint.worldDirection as string) || '',
      mainlineDirection: (blueprint.mainlineDirection as string) || '',
      growthDirection: (blueprint.growthDirection as string) || '',
      endingDirection: (blueprint.endingDirection as string) || '',
      platformStrategy: (blueprint.platformStrategy as string) || '',
      genreStrategy: (blueprint.genreStrategy as string) || '',
      styleStrategy: (blueprint.styleStrategy as string) || '',
      popularFictionProfile: toPopularFictionJson(blueprint.popularFictionProfile),
      constraints,
    }

    const existing = await prisma.bookBlueprint.findUnique({ where: { projectId } })
    if (existing) {
      await prisma.bookBlueprint.update({ where: { projectId }, data })
    } else {
      await prisma.bookBlueprint.create({ data: { projectId, ...data } })
    }

    await prisma.novelProject.update({
      where: { id: projectId },
      data: {
        workflowStage: 'BLUEPRINT_CONFIRM',
        blueprintConfirmedAt: null,
        arcPlanConfirmedAt: null,
      },
    })

    const saved = await prisma.bookBlueprint.findUnique({ where: { projectId } })

    return NextResponse.json({ success: true, data: saved })
  } catch (error) {
    console.error('Blueprint generation error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Blueprint生成失败' } },
      { status: 500 }
    )
  }
}

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

    const blueprint = await prisma.bookBlueprint.findUnique({ where: { projectId } })

    if (!blueprint) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Blueprint不存在' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: blueprint })
  } catch (error) {
    console.error('Get blueprint error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '获取Blueprint失败' } },
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
    const existing = await prisma.bookBlueprint.findUnique({ where: { projectId } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Blueprint不存在' } },
        { status: 404 }
      )
    }

    const data = {
      corePitch: typeof body.corePitch === 'string' ? body.corePitch.trim() : existing.corePitch,
      worldDirection: typeof body.worldDirection === 'string' ? body.worldDirection.trim() : existing.worldDirection,
      mainlineDirection: typeof body.mainlineDirection === 'string' ? body.mainlineDirection.trim() : existing.mainlineDirection,
      growthDirection: typeof body.growthDirection === 'string' ? body.growthDirection.trim() : existing.growthDirection,
      endingDirection: typeof body.endingDirection === 'string' ? body.endingDirection.trim() : existing.endingDirection,
      platformStrategy: typeof body.platformStrategy === 'string' ? body.platformStrategy.trim() : existing.platformStrategy,
      genreStrategy: typeof body.genreStrategy === 'string' ? body.genreStrategy.trim() : existing.genreStrategy,
      styleStrategy: typeof body.styleStrategy === 'string' ? body.styleStrategy.trim() : existing.styleStrategy,
      popularFictionProfile: body.popularFictionProfile !== undefined
        ? toPopularFictionJson(body.popularFictionProfile)
        : existing.popularFictionProfile ?? Prisma.JsonNull,
      constraints: body.constraints !== undefined ? normalizeStringArray(body.constraints) : existing.constraints,
    }

    const [saved] = await prisma.$transaction([
      prisma.bookBlueprint.update({
        where: { projectId },
        data,
      }),
      prisma.novelProject.update({
        where: { id: projectId },
        data: {
          workflowStage: 'BLUEPRINT_CONFIRM',
          blueprintConfirmedAt: null,
          arcPlanConfirmedAt: null,
        },
      }),
    ])

    return NextResponse.json({ success: true, data: saved })
  } catch (error) {
    console.error('Update blueprint error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '更新Blueprint失败' } },
      { status: 500 }
    )
  }
}

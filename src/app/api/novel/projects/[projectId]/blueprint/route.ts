import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createProviderFromConfigId, createProviderFromDefaultConfig } from '@/lib/ai/factory'
import { parseAiJsonObject } from '@/lib/engine/ai-json'

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
      constraints,
    }

    const existing = await prisma.bookBlueprint.findUnique({ where: { projectId } })
    if (existing) {
      await prisma.bookBlueprint.update({ where: { projectId }, data })
    } else {
      await prisma.bookBlueprint.create({ data: { projectId, ...data } })
    }

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

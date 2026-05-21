import { prisma } from '@/lib/prisma'
import { createProviderFromConfigId, createProviderFromDefaultConfig } from '@/lib/ai/factory'
import type { AIProvider } from '@/lib/ai/types'
import { calculateBatchSize } from './batch-planner'
import { toInternalArcStage, toInternalPlatform, toPrismaArcStage } from './production-mapping'
import { parseAiJsonArray, parseAiJsonObject } from './ai-json'
import { buildChapterListPrompt } from '../prompts/novel/chapter-list'

type BlueprintOutput = {
  corePitch?: string
  worldDirection?: string
  mainlineDirection?: string
  growthDirection?: string
  endingDirection?: string
  constraints?: string[]
}

type ArcPlanOutput = {
  arcNumber?: number
  name?: string
  stage?: string
  description?: string
  startChapter?: number
  endChapter?: number
  batchSize?: number
  goals?: string[]
  keyEvents?: string[]
}

export async function createProjectProvider(projectId: number): Promise<AIProvider> {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    select: { aiModelId: true },
  })

  if (project?.aiModelId) {
    const provider = await createProviderFromConfigId(project.aiModelId)
    if (provider) return provider
  }

  return createProviderFromDefaultConfig()
}

export async function ensureBlueprint(projectId: number, provider: AIProvider) {
  const existing = await prisma.bookBlueprint.findUnique({ where: { projectId } })
  if (existing) return existing

  const project = await prisma.novelProject.findUnique({ where: { id: projectId } })
  if (!project) throw new Error('项目不存在')

  const prompt = `你是 AI 网文导演系统的总策划。请生成 Book Blueprint，只定义长篇方向，不要生成完整章节。

项目信息：
- 标题：${project.title}
- 平台：${project.platform || 'QIDIAN'}
- 题材：${project.genre || '未知'}
- 一句话卖点：${project.corePitch || project.description || '暂无'}
- 风格：${project.writingStyle || '默认'}
- 长度类型：${project.lengthType || 'LONG'}

输出 JSON，不要 markdown：
{
  "corePitch": "重新提炼的一句话卖点",
  "worldDirection": "世界扩张方向，包含地图、势力、力量层级",
  "mainlineDirection": "主线推进方向，强调长期矛盾而非提前收束",
  "growthDirection": "主角成长方向",
  "endingDirection": "远景终局可能性，只能作为远景，不决定近期结局",
  "constraints": ["禁止提前大结局", "当前阶段只解决阶段矛盾"]
}`

  const result = await provider.generate(prompt, {
    temperature: 0.2,
    maxTokens: 2000,
    timeoutMs: 120000,
    responseFormat: { type: 'json_object' },
  })
  let blueprint: BlueprintOutput
  try {
    blueprint = parseAiJsonObject<BlueprintOutput>(result.content)
  } catch (error) {
    const retryPrompt = `${prompt}\n\n上一次输出未严格符合 JSON。请只输出一个合法 JSON 对象，不要解释，不要代码块，不要多余文本。`
    const retry = await provider.generate(retryPrompt, {
      temperature: 0.1,
      maxTokens: 1200,
      timeoutMs: 120000,
      responseFormat: { type: 'json_object' },
    })
    try {
      blueprint = parseAiJsonObject<BlueprintOutput>(retry.content)
    } catch {
      throw new Error(`Blueprint 生成失败：${error instanceof Error ? error.message : 'JSON 解析失败'}`)
    }
  }
  const data = {
    corePitch: blueprint.corePitch || project.corePitch || project.description || project.title,
    worldDirection: blueprint.worldDirection || '',
    mainlineDirection: blueprint.mainlineDirection || '',
    growthDirection: blueprint.growthDirection || '',
    endingDirection: blueprint.endingDirection || '',
    constraints: Array.isArray(blueprint.constraints) ? blueprint.constraints : [],
  }

  return prisma.bookBlueprint.create({ data: { projectId, ...data } })
}

export async function ensureArcPlans(projectId: number, provider: AIProvider) {
  const existing = await prisma.arcPlan.findMany({ where: { projectId }, orderBy: { arcNumber: 'asc' } })
  if (existing.length > 0) return existing

  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: { bookBlueprint: true },
  })
  if (!project || !project.bookBlueprint) throw new Error('Book Blueprint 不存在')

  const totalChapters = Math.max(1, Math.ceil((project.targetWordCount || 300000) / (project.chapterWordCount || 3000)))
  const stages = ['OPENING', 'GROWTH', 'EXPANSION', 'MID_CONFLICT', 'PRE_FINALE', 'FINALE']
  const chaptersPerStage = Math.ceil(totalChapters / stages.length)
  const platform = toInternalPlatform(project.platform)

  const prompt = `你是 AI 网文导演系统的阶段规划 Agent。请基于 Book Blueprint 生成 Arc Plan。

要求：
- 只规划阶段，不要列出全书所有章节
- 前 85% 进度不得出现最终决战、大结局、天下太平、一切结束
- 每个 Arc 都要保留后续扩张空间
- batchSize 范围 10-30

项目信息：
- 标题：${project.title}
- 平台：${project.platform || 'QIDIAN'}
- 题材：${project.genre || '未知'}
- 总章数：约 ${totalChapters} 章
- 每阶段约 ${chaptersPerStage} 章

Book Blueprint：
- 核心卖点：${project.bookBlueprint.corePitch}
- 世界方向：${project.bookBlueprint.worldDirection || ''}
- 主线方向：${project.bookBlueprint.mainlineDirection || ''}
- 成长方向：${project.bookBlueprint.growthDirection || ''}
- 远景终局：${project.bookBlueprint.endingDirection || ''}

输出 JSON 数组，不要 markdown。stage 只能是 OPENING, GROWTH, EXPANSION, MID_CONFLICT, PRE_FINALE, FINALE：
[
  {
    "arcNumber": 1,
    "name": "阶段名称",
    "stage": "OPENING",
    "description": "阶段描述",
    "startChapter": 1,
    "endChapter": ${chaptersPerStage},
    "batchSize": ${calculateBatchSize(platform, 'opening', 0.5, 0.5)},
    "goals": ["阶段目标"],
    "keyEvents": ["关键事件"]
  }
]`

  const result = await provider.generate(prompt, {
    temperature: 0.2,
    maxTokens: 5000,
    timeoutMs: 120000,
    responseFormat: { type: 'json_object' },
  })
  let arcPlans: ArcPlanOutput[]
  try {
    arcPlans = parseAiJsonArray<ArcPlanOutput>(result.content)
  } catch (error) {
    const retryPrompt = `${prompt}\n\n上一次输出未严格符合 JSON 数组。请只输出一个合法 JSON 数组，不要解释，不要代码块，不要多余文本。`
    const retry = await provider.generate(retryPrompt, {
      temperature: 0.1,
      maxTokens: 3000,
      timeoutMs: 120000,
      responseFormat: { type: 'json_object' },
    })
    try {
      arcPlans = parseAiJsonArray<ArcPlanOutput>(retry.content)
    } catch {
      throw new Error(`ArcPlan 生成失败：${error instanceof Error ? error.message : 'JSON 解析失败'}`)
    }
  }
  const created = []

  for (let index = 0; index < arcPlans.length; index++) {
    const item = arcPlans[index]
    const arcNumber = item.arcNumber || index + 1
    const stage = toInternalArcStage(item.stage || stages[index] || 'OPENING')
    const defaultBatchSize = calculateBatchSize(platform, stage, 0.5, 0.5)
    created.push(await prisma.arcPlan.create({
      data: {
        projectId,
        arcNumber,
        name: item.name || `第${arcNumber}阶段`,
        stage: toPrismaArcStage(stage) as any,
        description: item.description || '',
        startChapter: item.startChapter || (index * chaptersPerStage + 1),
        endChapter: item.endChapter || Math.min(totalChapters, (index + 1) * chaptersPerStage),
        batchSize: Math.max(10, Math.min(30, item.batchSize || defaultBatchSize)),
        goals: Array.isArray(item.goals) ? item.goals : [],
        keyEvents: Array.isArray(item.keyEvents) ? item.keyEvents : [],
      },
    }))
  }

  return created
}

import { ArcStage as PrismaArcStage, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AIService } from '@/lib/ai/service'
import type { AIProvider } from '@/lib/ai/types'
import {
  normalizeGenerationSpeedMode,
  type GenerationRole,
  type GenerationSpeedMode,
} from '@/lib/ai/speed-mode'
import type { PipelineStep, StorySteering } from '@/types'
import { calculateBatchSize } from './batch-planner'
import { clearJobRecoveryTarget, completeJob, failJob, saveCheckpoint, updateJobRuntime, updateJobStep } from './generation-job'
import { validateOutline } from './outline-validator'
import { toInternalArcStage, toInternalPlatform, toPrismaArcStage } from './production-mapping'
import { runChapterGenerationPipeline } from './orchestrator'
import { parseAiJsonArray, parseAiJsonObject } from './ai-json'
import { buildChapterListPrompt } from '../prompts/novel/chapter-list'
import {
  archiveChapterRuntime,
  appendChapterLiveContent,
  createPipelineRuntimeState,
  sanitizePipelineRuntime,
} from './pipeline-runtime'
import { initStoryState, initWorldState } from './story-state'
import { loadProjectHealthReport } from './project-health'
import { syncProjectHealthNotification } from '@/lib/notifications/project-health'
import type { SSEEvent } from './types'
import { getPlatformTemplate } from './platform-style'
import { canStartGeneration, getWorkflowBlockReason } from './project-flow'
import { normalizeArcPlanOutputs, resolveProjectPlanningTargets } from './project-length'
import { buildPopularFictionPromptBlock, normalizePopularFictionProfile } from './popular-fiction'
import type { PopularFictionProfile } from './popular-fiction'
import type { ChapterOutline, BlueprintOutput, ArcPlanOutput, PlotlineGuard, ResumePlan } from './pipeline-types'
import { STRATEGY_PREFIXES, STAGE_BATCH_RANGES } from './pipeline-types'
import { isJobPaused, resolveResumePlan } from './pipeline-checkpoint'
import { normalizeChapterTitle } from './chapter-metadata'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toPopularFictionJson(value: PopularFictionProfile | null | undefined) {
  return value ? (value as unknown as Prisma.InputJsonValue) : Prisma.JsonNull
}

function getConservativeBatchRange(stage: ReturnType<typeof toInternalArcStage>) {
  return STAGE_BATCH_RANGES[stage] || { min: 5, max: 12 }
}

function toConservativeBatchSize(stage: ReturnType<typeof toInternalArcStage>, raw: number): number {
  const range = getConservativeBatchRange(stage)
  return clamp(raw, range.min, range.max)
}

function buildProjectSteering(project: {
  pace: number | null
  darkness: number | null
  humor: number | null
  romance: number | null
  powerGrowth: number | null
  conflictIntensity: number | null
  mysteryDensity: number | null
}): StorySteering {
  return {
    pace: project.pace ?? 0.5,
    darkness: project.darkness ?? 0.3,
    humor: project.humor ?? 0.3,
    romance: project.romance ?? 0.2,
    powerGrowth: project.powerGrowth ?? 0.5,
    conflictIntensity: project.conflictIntensity ?? 0.5,
    mysteryDensity: project.mysteryDensity ?? 0.3,
  }
}

function serializeStrategy(prefix: string, value: string | undefined | null): string | null {
  const normalized = value?.trim()
  if (!normalized) return null
  return `${prefix}:${normalized}`
}

function extractStrategy(constraints: string[], prefix: string): string | null {
  const raw = constraints.find(item => item.startsWith(`${prefix}:`))
  if (!raw) return null
  return raw.slice(prefix.length + 1).trim() || null
}

function deriveFallbackStrategies(project: {
  platform: unknown
  genre?: string | null
  writingStyle?: string | null
  chapterWordCount?: number | null
  pace: number | null
  darkness: number | null
  humor: number | null
  romance: number | null
  powerGrowth: number | null
  conflictIntensity: number | null
  mysteryDensity: number | null
}) {
  const platform = toInternalPlatform(project.platform as never)
  const template = getPlatformTemplate(platform)
  const steering = buildProjectSteering(project)
  const paceText = steering.pace >= 0.68 ? '快节奏推进' : steering.pace <= 0.35 ? '慢热铺垫' : '中速推进'
  const mysteryText = steering.mysteryDensity >= 0.6 ? '提高悬念留白' : '悬念服务于推进'
  const conflictText = steering.conflictIntensity >= 0.65 ? '高冲突高反馈' : '稳态冲突递进'
  const humorText = steering.humor >= 0.6 ? '保留轻松段落' : '减少跳脱桥段'
  const darknessText = steering.darkness >= 0.6 ? '强化压迫感' : '保持可持续追读基调'
  const chapterWordTarget = project.chapterWordCount || template.chapterWordTarget

  return {
    platformStrategy: `平台 ${platform} 以单章约 ${chapterWordTarget} 字、${template.pace} 节奏、${template.cliffhangerDensity} 钩子密度推进，批次目录必须服务持续连载而不是一次性收束。`,
    genreStrategy: project.genre
      ? `题材 ${project.genre} 需要持续扩张世界、冲突和成长层级，前中期只兑现阶段成果，不解决终局矛盾。`
      : '默认采用长篇连载题材策略，前中期保持世界扩张、矛盾升级与持续钩子。',
    styleStrategy: `风格 ${project.writingStyle || '默认'} 以 ${paceText}、${conflictText}、${mysteryText}、${humorText}、${darknessText} 为约束，并结合 romance=${steering.romance.toFixed(2)} / powerGrowth=${steering.powerGrowth.toFixed(2)} 调整桥段和成长反馈。`,
  }
}

function buildBlueprintStrategies(
  project: {
    platform: unknown
    genre?: string | null
    writingStyle?: string | null
    chapterWordCount?: number | null
    pace: number | null
    darkness: number | null
    humor: number | null
    romance: number | null
    powerGrowth: number | null
    conflictIntensity: number | null
    mysteryDensity: number | null
  },
  blueprint?: {
    platformStrategy?: string | null
    genreStrategy?: string | null
    styleStrategy?: string | null
    constraints?: string[] | null
  } | null
) {
  const constraints = (blueprint?.constraints || []).filter(Boolean)
  const fallback = deriveFallbackStrategies(project)
  const baseConstraints = constraints.filter(item => !Object.values(STRATEGY_PREFIXES).some(prefix => item.startsWith(`${prefix}:`)))
  const requiredGuardrails = [
    '禁止提前结局',
    '禁止主线终结',
    '禁止最大反派死亡',
    '禁止伏笔提前回收',
    '当前阶段只解决阶段矛盾',
    '保留后续世界扩张空间',
  ]

  return {
    platformStrategy: blueprint?.platformStrategy || extractStrategy(constraints, STRATEGY_PREFIXES.platform) || fallback.platformStrategy,
    genreStrategy: blueprint?.genreStrategy || extractStrategy(constraints, STRATEGY_PREFIXES.genre) || fallback.genreStrategy,
    styleStrategy: blueprint?.styleStrategy || extractStrategy(constraints, STRATEGY_PREFIXES.style) || fallback.styleStrategy,
    guardrails: Array.from(new Set([...baseConstraints, ...requiredGuardrails])),
  }
}

function buildPlotlineBrief(plotlines: PlotlineGuard[]): string {
  if (plotlines.length === 0) return '暂无明确保护中的伏笔，由 AI 维持悬念留白。'
  return plotlines
    .slice(0, 8)
    .map(plotline => `${plotline.description}${plotline.plannedAt ? `（计划第${plotline.plannedAt}章回收）` : ''}`)
    .join('；')
}

export async function createProjectProvider(
  projectId: number,
  options?: {
    speedMode?: GenerationSpeedMode
    generationRole?: GenerationRole
  }
): Promise<AIProvider> {
  return AIService.createProvider({
    projectId,
    usageType: options?.generationRole ? `PIPELINE_${options.generationRole.toUpperCase()}` : 'PIPELINE',
    speedMode: options?.speedMode,
    generationRole: options?.generationRole,
  })
}

export async function ensureBlueprint(projectId: number, provider: AIProvider) {
  const existing = await prisma.bookBlueprint.findUnique({ where: { projectId } })
  if (existing) return existing

  const project = await prisma.novelProject.findUnique({ where: { id: projectId } })
  if (!project) throw new Error('项目不存在')
  const fallbackStrategies = deriveFallbackStrategies(project)

  const prompt = `你是 AI 网文导演系统的总策划。请生成 Book Blueprint，只定义长篇方向，不要生成完整章节。

项目信息：
- 标题：${project.title}
- 平台：${project.platform || 'QIDIAN'}
- 题材：${project.genre || '未知'}
- 一句话卖点：${project.corePitch || project.description || '暂无'}
- 风格：${project.writingStyle || '默认'}
- 长度类型：${project.lengthType || 'LONG'}
- 平台基线策略：${fallbackStrategies.platformStrategy}
- 题材基线策略：${fallbackStrategies.genreStrategy}
- 风格基线策略：${fallbackStrategies.styleStrategy}

硬约束：
- 前 85% 进度不得提前结局、不得主线终结
- 最大反派不得提前死亡或彻底退场
- 伏笔不得大面积提前回收
- 每个阶段只解决阶段矛盾，必须保留后续扩张空间

输出 JSON，不要 markdown：
{
  "corePitch": "重新提炼的一句话卖点",
  "worldDirection": "世界扩张方向，包含地图、势力、力量层级",
  "mainlineDirection": "主线推进方向，强调长期矛盾而非提前收束",
  "growthDirection": "主角成长方向",
  "endingDirection": "远景终局可能性，只能作为远景，不决定近期结局",
  "platformStrategy": "平台策略，说明章节长度、钩子密度、高潮频率如何控制",
  "genreStrategy": "题材策略，说明世界扩张、冲突形态和读者期待管理",
  "styleStrategy": "风格策略，说明叙事口吻、爽点组织、去AI味方向",
  "popularFictionProfile": {
    "emotionEngine": {
      "primaryEmotion": "爽",
      "openingBomb": "第一章的情绪炸弹",
      "readerPayoff": "读者最先期待得到的回报",
      "forbiddenSlowStart": true
    },
    "cheatAbility": {
      "name": "金手指名称",
      "oneLineRule": "一句话规则",
      "firstRevealChapter": 1,
      "firstPayoffChapter": 3,
      "growthMechanism": "如何升级",
      "limitation": "限制条件",
      "readerFantasy": "读者代入点"
    },
    "conflictEngine": {
      "conflictTypes": ["羞辱", "利益争夺"],
      "conflictFrequency": "每1-2章至少一次明确压迫或反击",
      "payoffInterval": "1-3章内必须有一次阶段回报",
      "hookStrategy": "每章结尾留下下一章承诺或新威胁"
    },
    "characterTagEngine": {
      "protagonistTags": ["护短", "记仇", "稳健"],
      "behaviorProofs": [
        { "tag": "护短", "requiredScene": "同伴受辱时主角会设局反击", "forbiddenBehavior": "关键时刻装看不见" }
      ]
    }
  },
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
    platformStrategy: blueprint.platformStrategy || fallbackStrategies.platformStrategy,
    genreStrategy: blueprint.genreStrategy || fallbackStrategies.genreStrategy,
    styleStrategy: blueprint.styleStrategy || fallbackStrategies.styleStrategy,
    popularFictionProfile: toPopularFictionJson(normalizePopularFictionProfile(blueprint.popularFictionProfile)),
    constraints: Array.from(new Set([
      ...(Array.isArray(blueprint.constraints) ? blueprint.constraints : []),
      serializeStrategy(STRATEGY_PREFIXES.platform, blueprint.platformStrategy || fallbackStrategies.platformStrategy),
      serializeStrategy(STRATEGY_PREFIXES.genre, blueprint.genreStrategy || fallbackStrategies.genreStrategy),
      serializeStrategy(STRATEGY_PREFIXES.style, blueprint.styleStrategy || fallbackStrategies.styleStrategy),
      '禁止提前结局',
      '禁止主线终结',
      '禁止最大反派死亡',
      '禁止伏笔提前回收',
      '当前阶段只解决阶段矛盾',
      '保留后续世界扩张空间',
    ].filter((item): item is string => Boolean(item)))),
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

  const planningTargets = resolveProjectPlanningTargets({
    lengthType: project.lengthType,
    targetWordCount: project.targetWordCount,
    chapterWordCount: project.chapterWordCount,
  })
  const totalChapters = planningTargets.effectiveTotalChapters
  const stages = planningTargets.stageSequence
  const chaptersPerStage = Math.ceil(totalChapters / stages.length)
  const platform = toInternalPlatform(project.platform)
  const blueprintStrategies = buildBlueprintStrategies(project, project.bookBlueprint)
  const popularFictionProfile = normalizePopularFictionProfile(
    (project.bookBlueprint as unknown as { popularFictionProfile?: unknown }).popularFictionProfile
  )

  const prompt = `你是 AI 网文导演系统的阶段规划 Agent。请基于 Book Blueprint 生成 Arc Plan。

要求：
- 只规划阶段，不要列出全书所有章节
- 前 85% 进度不得出现最终决战、大结局、天下太平、一切结束
- 不得让主线在中前期收束，不得让最大反派提前死亡
- 未到计划节点的伏笔不能集中回收
- 每个 Arc 都要保留后续扩张空间
- batchSize 必须保守，默认范围控制在 5-15 章之间
- 开局 5-8 章，成长 8-12 章，扩张 10-15 章，中段冲突 8-12 章，前置高潮 5-8 章，终局 3-6 章

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
- 平台策略：${blueprintStrategies.platformStrategy}
- 题材策略：${blueprintStrategies.genreStrategy}
- 风格策略：${blueprintStrategies.styleStrategy}
- 爆款四因子：${buildPopularFictionPromptBlock(popularFictionProfile)}
- 硬约束：${blueprintStrategies.guardrails.join('；')}

输出 JSON 数组，不要 markdown。你必须严格输出 ${stages.length} 个阶段，stage 只能按这个顺序出现：${stages.join(', ')}：
[
  {
    "arcNumber": 1,
    "name": "阶段名称",
    "stage": "OPENING",
    "description": "阶段描述",
    "startChapter": 1,
    "endChapter": ${chaptersPerStage},
        "batchSize": ${toConservativeBatchSize('opening', calculateBatchSize(platform, 'opening', 0.5, 0.5, {
      progressRatio: 0.05,
      stageRemainingChapters: chaptersPerStage,
      blueprintConstraints: blueprintStrategies.guardrails,
      genre: project.genre,
      writingStyle: project.writingStyle,
      steering: buildProjectSteering(project),
    }))},
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
  const normalizedArcPlans = normalizeArcPlanOutputs(arcPlans, totalChapters, stages)
  const created = []

  for (let index = 0; index < normalizedArcPlans.length; index++) {
    const item = normalizedArcPlans[index]
    const arcNumber = item.arcNumber || index + 1
    const stage = toInternalArcStage(item.stage || stages[index] || 'OPENING')
    const defaultBatchSize = toConservativeBatchSize(stage, calculateBatchSize(platform, stage, 0.5, 0.5, {
      progressRatio: clamp(index / Math.max(normalizedArcPlans.length, 1), 0, 0.95),
      stageRemainingChapters: Math.max(1, item.endChapter - item.startChapter + 1),
      blueprintConstraints: blueprintStrategies.guardrails,
      genre: project.genre,
      writingStyle: project.writingStyle,
      steering: buildProjectSteering(project),
    }))
    created.push(await prisma.arcPlan.create({
      data: {
        projectId,
        arcNumber,
        name: item.name || `第${arcNumber}阶段`,
        stage: toPrismaArcStage(stage) as PrismaArcStage,
        description: item.description || '',
        startChapter: item.startChapter,
        endChapter: item.endChapter,
        batchSize: toConservativeBatchSize(stage, item.batchSize || defaultBatchSize),
        goals: Array.isArray(item.goals) ? item.goals : [],
        keyEvents: Array.isArray(item.keyEvents) ? item.keyEvents : [],
      },
    }))
  }

  return created
}

function resolveResumeChapter(
  chapters: Array<{ chapterNumber: number; status: string }>,
  resumeFromChapterNumber?: number
) {
  const sorted = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)

  const minChapter = resumeFromChapterNumber || 1
  const firstIncomplete = sorted.find(
    chapter => chapter.chapterNumber >= minChapter && chapter.status !== 'COMPLETED'
  )
  if (firstIncomplete) return firstIncomplete.chapterNumber

  const maxChapterNumber = sorted.reduce((max, chapter) => Math.max(max, chapter.chapterNumber), 0)
  return Math.max(maxChapterNumber + 1, minChapter)
}

async function planChapterBatch(
  projectId: number,
  provider: AIProvider,
  options: { resumeFromChapterNumber?: number } = {}
): Promise<ChapterOutline[]> {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: {
      bookBlueprint: true,
      arcPlans: { orderBy: { arcNumber: 'asc' } },
      chapters: { orderBy: { chapterNumber: 'asc' } },
      plotlines: {
        where: { status: 'OPEN' },
        orderBy: [{ plannedAt: 'asc' }, { plantedAt: 'asc' }],
      },
      storyState: true,
      villains: true,
      worldState: true,
    },
  })
  if (!project || !project.bookBlueprint) throw new Error('项目 Blueprint 不完整')

  const existingMaxChapter = project.chapters.reduce((max, chapter) => Math.max(max, chapter.chapterNumber), 0)
  const nextChapterNumber = resolveResumeChapter(project.chapters, options.resumeFromChapterNumber)
  const currentArc =
    project.arcPlans.find(arc => {
      const arcEnd = arc.endChapter || Number.MAX_SAFE_INTEGER
      return nextChapterNumber >= arc.startChapter && nextChapterNumber <= arcEnd
    }) ||
    project.arcPlans.find(arc => !arc.isCompleted) ||
    project.arcPlans[0]
  if (!currentArc) throw new Error('Arc Plan 不存在')

  const startChapter = Math.max(nextChapterNumber, currentArc.startChapter)
  const endLimit = currentArc.endChapter || startChapter + currentArc.batchSize - 1
  if (startChapter > endLimit) return []

  const planningTargets = resolveProjectPlanningTargets({
    lengthType: project.lengthType,
    targetWordCount: project.targetWordCount,
    chapterWordCount: project.chapterWordCount,
  })
  const totalChapters = planningTargets.effectiveTotalChapters
  const progressRatio = startChapter / totalChapters
  const arcStage = toInternalArcStage(currentArc.stage)
  const stageRemainingChapters = Math.max(1, endLimit - startChapter + 1)
  const steering = buildProjectSteering(project)
  const blueprintStrategies = buildBlueprintStrategies(project, project.bookBlueprint)
  const popularFictionProfile = normalizePopularFictionProfile(
    (project.bookBlueprint as unknown as { popularFictionProfile?: unknown }).popularFictionProfile
  )
  const activePlotlines: PlotlineGuard[] = project.plotlines.map(plotline => ({
    description: plotline.description,
    plannedAt: plotline.plannedAt,
    plantedAt: plotline.plantedAt,
    status: plotline.status,
  }))
  const dynamicBatchSize = toConservativeBatchSize(arcStage, calculateBatchSize(
    toInternalPlatform(project.platform),
    arcStage,
    project.worldState
      ? clamp((project.worldState.mapLevel + project.worldState.factionCount + project.worldState.powerLevel + project.worldState.civilizationLevel) / 40, 0, 1.2)
      : 0.45,
    clamp(activePlotlines.length / 8, 0, 1.4),
    {
      progressRatio,
      stageRemainingChapters,
      openPlotlineCount: activePlotlines.length,
      steering,
      blueprintConstraints: blueprintStrategies.guardrails,
      hasFinalBossActive: project.villains.some(v => v.isFinalBoss && v.lifecycle === 'active'),
      genre: project.genre,
      writingStyle: project.writingStyle,
    }
  ))
  const endChapter = Math.min(endLimit, startChapter + dynamicBatchSize - 1)

  if (currentArc.batchSize !== dynamicBatchSize) {
    await prisma.arcPlan.update({
      where: { id: currentArc.id },
      data: { batchSize: dynamicBatchSize },
    })
  }

  const worldState = project.worldState
    ? `地图层级 ${project.worldState.mapLevel}/10，势力 ${project.worldState.factionCount}，力量上限 ${project.worldState.powerLevel}/10，文明层级 ${project.worldState.civilizationLevel}/10`
    : '世界状态未初始化，需要在当前批次逐步扩张'

  const existingChapters = project.chapters
    .filter(chapter => chapter.chapterNumber < startChapter)
    .map(chapter => ({
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      summary: chapter.summary || chapter.title || `第${chapter.chapterNumber}章`,
    }))

  const promptGuardrails = [
    `【Blueprint 策略】平台：${blueprintStrategies.platformStrategy}`,
    `【Blueprint 策略】题材：${blueprintStrategies.genreStrategy}`,
    `【Blueprint 策略】风格：${blueprintStrategies.styleStrategy}`,
    `【硬约束】${blueprintStrategies.guardrails.join('；')}`,
    `【批次约束】本批次只规划第 ${startChapter}-${endChapter} 章，共 ${endChapter - startChapter + 1} 章，必须连续编号。`,
    `【批次约束】禁止提前结局、禁止主线终结、禁止最大反派死亡、禁止伏笔提前回收。`,
    `【StoryState】当前主冲突：${project.storyState?.mainConflict || '待推进'}；当前章节进度：${project.storyState?.currentChapter || existingMaxChapter}`,
    `【伏笔保护】${buildPlotlineBrief(activePlotlines)}`,
    `【反派保护】${project.villains.filter(v => v.isFinalBoss || v.lifecycle === 'active').slice(0, 5).map(v => `${v.name}${v.isFinalBoss ? '（终极反派）' : ''}`).join('；') || '暂无明确反派，但必须避免“一战收官”结构'}`,
    `【动态批次】推荐批次大小 ${dynamicBatchSize} 章；当前 Arc 剩余 ${stageRemainingChapters} 章。`,
  ].join('\n')

  const prompt = buildChapterListPrompt({
    projectTitle: project.title,
    genre: project.genre || undefined,
    writingStyle: project.writingStyle || undefined,
    worldSetting: [
      project.worldSetting || '',
      `【当前 Arc】${currentArc.name} / ${arcStage}`,
      `【Arc 目标】${currentArc.goals.join('、') || '推进阶段目标'}`,
      `【关键事件】${currentArc.keyEvents.join('、') || '由 AI 决定'}`,
      `【世界状态】${worldState}`,
      `【当前全书进度】${Math.round(progressRatio * 100)}%`,
      `【Book Blueprint】核心卖点：${project.bookBlueprint.corePitch}\n世界方向：${project.bookBlueprint.worldDirection || ''}\n主线方向：${project.bookBlueprint.mainlineDirection || ''}\n成长方向：${project.bookBlueprint.growthDirection || ''}\n远景终局：${project.bookBlueprint.endingDirection || ''}`,
      `【爆款四因子】\n${buildPopularFictionPromptBlock(popularFictionProfile)}`,
      promptGuardrails,
    ].filter(Boolean).join('\n\n'),
    protagonistProfile: project.protagonistProfile || undefined,
    protagonistGoal: project.protagonistGoal || undefined,
    antagonistSetting: project.antagonistSetting || undefined,
    endingPlan: project.endingPlan || undefined,
    totalChapters: endChapter,
    titleStyle: 'webnovel',
    outline: undefined,
    outlineStages: undefined,
    existingChapters,
  })

  const expectedCount = endChapter - startChapter + 1
  const normalizeOutlines = (items: ChapterOutline[]) => items
    .filter(item => item.chapterNumber >= startChapter && item.chapterNumber <= endChapter)
    .map(item => ({
      chapterNumber: item.chapterNumber,
      title: normalizeChapterTitle(item.chapterNumber, item.title) || `第${item.chapterNumber}章`,
      summary: item.summary || item.title || `第${item.chapterNumber}章剧情推进`,
    }))

  let lastError: Error | null = null
  let outlines: ChapterOutline[] = []

  for (let attempt = 0; attempt < 3; attempt++) {
    const promptWithRetry = attempt === 0
      ? prompt
      : `${prompt}\n\n第 ${attempt} 次自动重试：上一次目录不合格。你必须严格输出从第 ${startChapter} 章到第 ${endChapter} 章的连续章节，共 ${expectedCount} 章；当前进度不到 85% 时禁止出现终局语义，禁止最大反派提前死亡，禁止伏笔集中回收。`
    const result = await provider.generate(promptWithRetry, {
      temperature: attempt === 0 ? 0.2 : 0.1,
      maxTokens: 8000,
      timeoutMs: 120000,
      responseFormat: { type: 'json_object' },
    })

    try {
      const chapterList = parseAiJsonObject<{ chapters?: ChapterOutline[] }>(result.content)
      outlines = normalizeOutlines(Array.isArray(chapterList.chapters) ? chapterList.chapters : [])
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('JSON 解析失败')
      continue
    }

    if (outlines.length !== expectedCount) {
      lastError = new Error(`章节目录章数不匹配，期望 ${expectedCount} 章，实际 ${outlines.length} 章`)
      continue
    }

    const protectedVillains = project.villains
      .filter(v => v.lifecycle === 'active' && (v.isFinalBoss || v.tier === 'final' || v.tier === 'arc'))
      .map(v => v.name)
    const validation = validateOutline(outlines, {
      progressRatio,
      currentArcName: currentArc.name,
      currentArcStage: currentArc.stage,
      finalBossNames: project.villains.filter(v => v.isFinalBoss).map(v => v.name),
      protectedVillainNames: protectedVillains,
      openPlotlines: activePlotlines,
      blueprintConstraints: blueprintStrategies.guardrails,
    })
    if (validation.passed) {
      lastError = null
      break
    }

    lastError = new Error(`当前批次目录触发防提前结局规则：${validation.violations.join('；')}`)
  }

  if (lastError) {
    throw lastError
  }

  for (const outline of outlines) {
    await prisma.novelChapter.upsert({
      where: { projectId_chapterNumber: { projectId, chapterNumber: outline.chapterNumber } },
      update: {
        title: outline.title,
        summary: outline.summary,
        chapterOutline: outline as unknown as Prisma.InputJsonValue,
        sortOrder: outline.chapterNumber,
      },
      create: {
        projectId,
        chapterNumber: outline.chapterNumber,
        title: outline.title,
        summary: outline.summary,
        chapterOutline: outline as unknown as Prisma.InputJsonValue,
        sortOrder: outline.chapterNumber,
        status: 'DRAFT',
      },
    })
  }

  return outlines
}

async function markCompletedArcIfNeeded(projectId: number) {
  const arcs = await prisma.arcPlan.findMany({ where: { projectId }, orderBy: { arcNumber: 'asc' } })
  for (const arc of arcs) {
    if (!arc.endChapter || arc.isCompleted) continue
    const incomplete = await prisma.novelChapter.count({
      where: {
        projectId,
        chapterNumber: { gte: arc.startChapter, lte: arc.endChapter },
        status: { not: 'COMPLETED' },
      },
    })
    if (incomplete === 0) {
      await prisma.arcPlan.update({ where: { id: arc.id }, data: { isCompleted: true } })
    }
  }
}

export async function runProductionPipeline(
  jobId: number,
  options?: {
    speedMode?: GenerationSpeedMode
  }
): Promise<void> {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } })
  if (!job) return

  // Immediately update the job to RUNNING to prevent stuck PENDING status
  await updateJobStep(jobId, 'blueprint' as PipelineStep, 1)

  const projectId = job.projectId
  const jobPayload = job.payload && typeof job.payload === 'object'
    ? job.payload as Record<string, unknown>
    : {}
  const speedMode = normalizeGenerationSpeedMode(options?.speedMode || jobPayload.speedMode)

  try {
    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      select: {
        chapterWordCount: true,
        workflowStage: true,
        blueprintConfirmedAt: true,
        arcPlanConfirmedAt: true,
        bookBlueprint: { select: { id: true } },
        arcPlans: { select: { id: true } },
      },
    })
    const targetWordCount = project?.chapterWordCount || 3000
    const flowBlockReason = getWorkflowBlockReason({
      workflowStage: project?.workflowStage,
      blueprintConfirmedAt: project?.blueprintConfirmedAt,
      arcPlanConfirmedAt: project?.arcPlanConfirmedAt,
      hasBlueprint: Boolean(project?.bookBlueprint),
      hasArcPlans: Boolean(project?.arcPlans.length),
    })
    if (flowBlockReason && !canStartGeneration({
      workflowStage: project?.workflowStage,
      blueprintConfirmedAt: project?.blueprintConfirmedAt,
      arcPlanConfirmedAt: project?.arcPlanConfirmedAt,
      hasBlueprint: Boolean(project?.bookBlueprint),
      hasArcPlans: Boolean(project?.arcPlans.length),
    })) {
      await failJob(jobId, flowBlockReason)
      return
    }
    let runtime = sanitizePipelineRuntime(
      job.payload && typeof job.payload === 'object'
        ? (job.payload as Record<string, unknown>).runtime
        : undefined
    )
    if (runtime.streamRevision === 0 && runtime.currentChapter === null && runtime.recentChapters.length === 0) {
      runtime = createPipelineRuntimeState(speedMode)
    } else {
      runtime = { ...runtime, speedMode }
    }
    let lastPersistAt = 0
    let persistChain = Promise.resolve()

    const queuePersist = (force: boolean = false) => {
      const now = Date.now()
      if (!force && now - lastPersistAt < 900) return
      runtime = {
        ...runtime,
        lastEventAt: new Date(now).toISOString(),
        streamRevision: runtime.streamRevision + 1,
      }
      lastPersistAt = now
      persistChain = persistChain
        .then(() => updateJobRuntime(jobId, runtime))
        .catch(() => undefined)
    }

    const setCurrentChapter = (chapterNumber: number, title?: string) => {
      const now = new Date().toISOString()
      runtime = {
        ...runtime,
        currentChapter: {
          chapterNumber,
          title,
          status: 'RUNNING',
          currentAgent: 'planner',
          currentPhase: 'planner',
          currentWordCount: 0,
          targetWordCount,
          liveContent: '',
          startedAt: now,
          updatedAt: now,
          phaseTimings: {},
        },
      }
      queuePersist(true)
    }

    const handlePipelineEvent = (event: SSEEvent) => {
      if (!runtime.currentChapter) return

      const now = new Date().toISOString()
      const current = { ...runtime.currentChapter, updatedAt: now }

      switch (event.type) {
        case 'start': {
          const agent = typeof event.data.agent === 'string' ? event.data.agent : current.currentAgent
          current.currentAgent = agent
          current.currentPhase = agent
          break
        }
        case 'agent_switch': {
          const agent = typeof event.data.agent === 'string' ? event.data.agent : current.currentAgent
          if ((agent === 'writer' || agent === 'polisher') && current.currentPhase !== agent) {
            current.liveContent = ''
          }
          current.currentAgent = agent
          current.currentPhase = agent
          break
        }
        case 'research': {
          current.currentAgent = 'research'
          current.currentPhase = 'research'
          current.lastMessage = `已加载 ${Number(event.data.refsCount || 0)} 条研究资料`
          break
        }
        case 'wordCount': {
          const count = Number(event.data.count || 0)
          if (Number.isFinite(count)) {
            current.currentWordCount = count
            current.lastTokenAt = now
          }
          break
        }
        case 'phase_timing': {
          const phase = String(event.data.phase || '')
          const durationMs = Number(event.data.durationMs || 0)
          if (phase) {
            current.phaseTimings = {
              ...current.phaseTimings,
              [phase]: durationMs,
            }
            runtime.lastPhase = phase
            runtime.lastPhaseDurationMs = durationMs
            current.currentPhase = phase
            current.lastMessage = `${phase} 完成，用时 ${durationMs}ms`
          }
          break
        }
        case 'validation': {
          current.currentAgent = 'validator'
          current.currentPhase = 'validator'
          current.lastMessage = `校验结果：${String(event.data.result || 'unknown')} / ${Number(event.data.score || 0)}分`
          break
        }
        case 'hook_warning': {
          const warnings = Array.isArray(event.data.warnings) ? event.data.warnings.filter(item => typeof item === 'string') : []
          current.lastMessage = warnings.join('；')
          break
        }
        case 'done': {
          current.status = 'COMPLETED'
          current.currentWordCount = Number(event.data.wordCount || current.currentWordCount || 0)
          current.qualityStatus = typeof event.data.qualityStatus === 'string' ? event.data.qualityStatus : undefined
          current.warning = typeof event.data.warning === 'string' ? event.data.warning : undefined
          current.totalDurationMs = Number(event.data.duration || 0) || current.totalDurationMs
          current.completedAt = now
          current.currentPhase = 'completed'
          current.lastMessage = current.warning || '章节生成完成'
          break
        }
        case 'error': {
          current.status = 'FAILED'
          current.error = typeof event.data.message === 'string' ? event.data.message : '生成失败'
          current.currentPhase = 'failed'
          current.lastMessage = current.error
          break
        }
        default:
          break
      }

      runtime = {
        ...runtime,
        currentChapter: current,
      }

      if (event.type === 'token') {
        runtime = appendChapterLiveContent(
          runtime,
          typeof event.data.content === 'string' ? event.data.content : ''
        )
        if (runtime.currentChapter) {
          runtime = {
            ...runtime,
            currentChapter: {
              ...runtime.currentChapter,
              lastTokenAt: now,
            },
          }
        }
      }

      const forcePersist = event.type === 'done' || event.type === 'error' || event.type === 'phase_timing'
      queuePersist(forcePersist)
    }

    const provider = await createProjectProvider(projectId, { speedMode, generationRole: 'blueprint' })
    const resumePlan = await resolveResumePlan(jobId)
    await clearJobRecoveryTarget(jobId)

    const projectForInit = await prisma.novelProject.findUnique({
      where: { id: projectId },
      select: { totalVolumes: true },
    })
    if (projectForInit) {
      await initWorldState(projectId)
      await initStoryState(projectId, projectForInit.totalVolumes * 25)
    }

    if (resumePlan.startFrom === 'blueprint') {
      await updateJobStep(jobId, 'blueprint' as PipelineStep, 1)
      const blueprint = await ensureBlueprint(projectId, provider)
      await saveCheckpoint(jobId, 'blueprint' as PipelineStep, { projectId }, { blueprintId: blueprint.id })
    }

    if (resumePlan.startFrom === 'blueprint' || resumePlan.startFrom === 'arc_plan') {
      await updateJobStep(jobId, 'arc_plan' as PipelineStep, 2)
      const arcPlanProvider = await createProjectProvider(projectId, { speedMode, generationRole: 'arc_plan' })
      const arcPlans = await ensureArcPlans(projectId, arcPlanProvider)
      await saveCheckpoint(jobId, 'arc_plan' as PipelineStep, { projectId }, { arcCount: arcPlans.length })
    }

    await updateJobStep(jobId, 'chapter_list' as PipelineStep, 3)
    const chapterListProvider = await createProjectProvider(projectId, { speedMode, generationRole: 'planner' })
    const outlines = await planChapterBatch(projectId, chapterListProvider, {
      resumeFromChapterNumber: resumePlan.resumeFromChapterNumber,
    })
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { totalChapters: outlines.length },
    })
    await saveCheckpoint(
      jobId,
      'chapter_list' as PipelineStep,
      {
        projectId,
        resumeFromChapterNumber: resumePlan.resumeFromChapterNumber,
      },
      { chapters: outlines }
    )

    if (await isJobPaused(jobId)) {
      await updateJobRuntime(jobId, runtime)
      return
    }

    let completed = 0
    for (const outline of outlines) {
      if (await isJobPaused(jobId)) {
        await updateJobRuntime(jobId, runtime)
        return
      }

      await updateJobStep(jobId, 'write' as PipelineStep, 4, outlines.length, outline.chapterNumber)
      setCurrentChapter(outline.chapterNumber, outline.title)
      const result = await runChapterGenerationPipeline(projectId, outline.chapterNumber, handlePipelineEvent, {
        speedMode,
      })
      await persistChain
      if (!result.success) {
        throw new Error(result.error || `第 ${outline.chapterNumber} 章生成失败`)
      }
      if (runtime.currentChapter) {
        runtime = archiveChapterRuntime(runtime, {
          ...runtime.currentChapter,
          title: runtime.currentChapter.title || outline.title,
        })
        queuePersist(true)
      }
      completed++
      await saveCheckpoint(
        jobId,
        'write' as PipelineStep,
        { chapterNumber: outline.chapterNumber },
        { chapterId: result.chapterId, completed, recoveredFrom: resumePlan.resumeFromChapterNumber }
      )
    }

    if (await isJobPaused(jobId)) {
      await updateJobRuntime(jobId, runtime)
      return
    }

    await updateJobStep(jobId, 'summarize' as PipelineStep, 8, outlines.length, completed)
    await markCompletedArcIfNeeded(projectId)
    await saveCheckpoint(jobId, 'summarize' as PipelineStep, { projectId }, { completedChapters: completed })
    await persistChain
    await completeJob(jobId)

    const report = await loadProjectHealthReport(projectId)
    if (report) {
      const project = await prisma.novelProject.findUnique({
        where: { id: projectId },
        select: { title: true },
      })
      if (project) {
        await syncProjectHealthNotification(projectId, project.title, report)
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await failJob(jobId, message)

    const report = await loadProjectHealthReport(projectId)
    if (report) {
      const project = await prisma.novelProject.findUnique({
        where: { id: projectId },
        select: { title: true },
      })
      if (project) {
        await syncProjectHealthNotification(projectId, project.title, report)
      }
    }
  }
}

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseAiJsonObject } from '@/lib/engine/ai-json'
import { resolveProjectPlanningTargets } from '@/lib/engine/project-length'
import { createProjectProvider, ensureArcPlans, ensureBlueprint } from '@/lib/engine/production-pipeline'
import { initStoryState, initWorldState } from '@/lib/engine/story-state'

type ProjectWithContext = Awaited<ReturnType<typeof loadProjectForBlueprintConsole>>

export interface BlueprintConsoleSnapshot {
  blueprintCard: {
    category: string
    coreSell: string
    currentPhase: string
    worldLevel: string
    currentMainline: string
    pacing: string
  }
  world: {
    summary: string
    mapRoute: string[]
    hiddenHierarchy: string
    factions: string
    expansionRoute: string
  }
  protagonist: {
    summary: string
    currentState: string
    growthRoute: string
  }
  style: {
    strategy: string
    payoffStrategy: string
    toneTags: string[]
  }
  suggestedTweaks: string[]
  lastGuidance?: string
  generatedAt?: string
}

type BlueprintConsoleProgress = {
  phase: string
  message: string
  stepIndex: number
  stepTotal: number
}

function getArcStageLabel(stage?: string | null) {
  switch ((stage || '').toUpperCase()) {
    case 'OPENING':
      return '开局铺垫期'
    case 'GROWTH':
      return '成长爆发期'
    case 'EXPANSION':
      return '势力扩张期'
    case 'MID_CONFLICT':
      return '中盘冲突期'
    case 'PRE_FINALE':
      return '大战蓄压期'
    case 'FINALE':
      return '终局决战期'
    default:
      return '蓝图推进期'
  }
}

function getWorldLevelLabel(level?: number | null) {
  if (!level || level <= 1) return '城市级'
  if (level <= 3) return '省域级'
  if (level <= 5) return '全国级'
  if (level <= 7) return '洲际级'
  if (level <= 9) return '国际级'
  return '世界级'
}

function getPacingLabel(project: {
  pace?: number | null
  conflictIntensity?: number | null
  humor?: number | null
  darkness?: number | null
}) {
  const tags: string[] = []
  if ((project.pace ?? 0.5) >= 0.75) tags.push('高节奏')
  else if ((project.pace ?? 0.5) <= 0.35) tags.push('慢热')
  else tags.push('稳步推进')

  if ((project.conflictIntensity ?? 0.5) >= 0.75) tags.push('高爽点')
  if ((project.humor ?? 0.3) >= 0.6) tags.push('强搞笑')
  if ((project.darkness ?? 0.3) >= 0.6) tags.push('偏黑暗')

  return tags.join('、')
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => String(item || '').trim())
    .filter(Boolean)
}

function buildFallbackSnapshot(project: NonNullable<ProjectWithContext>): BlueprintConsoleSnapshot {
  const currentArc = project.arcPlans.find(arc => {
    const currentChapter = project.storyState?.currentChapter || 0
    const arcEnd = arc.endChapter || Number.MAX_SAFE_INTEGER
    return currentChapter >= arc.startChapter && currentChapter <= arcEnd
  }) || project.arcPlans.find(arc => !arc.isCompleted) || project.arcPlans[0]

  const mapRoute = project.worldState?.regions?.length
    ? project.worldState.regions
    : project.bookBlueprint?.worldDirection
      ? project.bookBlueprint.worldDirection.split(/[→、,\n]/).map(item => item.trim()).filter(Boolean).slice(0, 4)
      : []

  const toneTags = [
    project.genre ? `${project.genre}向` : '',
    project.writingStyle || '',
    getPacingLabel(project),
  ].filter(Boolean)

  return {
    blueprintCard: {
      category: [project.platform || '', project.genre || '', project.writingStyle || ''].filter(Boolean).join(' / ') || 'AI 长篇项目',
      coreSell: project.bookBlueprint?.corePitch || project.corePitch || project.description || '待 AI 生成核心卖点',
      currentPhase: currentArc ? `${getArcStageLabel(currentArc.stage)} · ${currentArc.name}` : '待进入主线推进',
      worldLevel: getWorldLevelLabel(project.worldState?.mapLevel),
      currentMainline: project.storyState?.mainConflict || project.bookBlueprint?.mainlineDirection || '待 AI 明确当前主线',
      pacing: getPacingLabel(project),
    },
    world: {
      summary: project.worldSetting || project.bookBlueprint?.worldDirection || 'AI 将基于题材与蓝图自动维护世界设定。',
      mapRoute,
      hiddenHierarchy: project.worldState?.currentExpansion || project.powerSystem || '待 AI 补充隐藏层级',
      factions: project.antagonistSetting || `当前势力规模 ${project.worldState?.factionCount || 1} 组，后续按章节推进持续扩张。`,
      expansionRoute: project.bookBlueprint?.worldDirection || '先完成当前阶段，再向更高层级扩张。',
    },
    protagonist: {
      summary: project.protagonistProfile || '主角人设将由 AI 结合蓝图、章节和风格持续校正。',
      currentState: project.protagonistGoal || '待 AI 明确当前状态与最近目标。',
      growthRoute: project.bookBlueprint?.growthDirection || '从当前阶段持续升级，保持后续扩张空间。',
    },
    style: {
      strategy: project.writingPrompt || `${project.writingStyle || '当前风格'}，以 ${getPacingLabel(project)} 为主要输出节奏。`,
      payoffStrategy: project.endingPlan || '爽点、钩子和阶段回报由 AI 根据当前章节进度持续调度。',
      toneTags,
    },
    suggestedTweaks: [
      '提高爽点密度',
      '增强主角压迫感',
      '增加隐藏势力',
      '提升节奏推进',
    ],
    generatedAt: new Date().toISOString(),
  }
}

function extractStoredSnapshot(project: NonNullable<ProjectWithContext>): BlueprintConsoleSnapshot | null {
  const metadata = project.storyState?.metadata as Record<string, unknown> | null | undefined
  const stored = metadata?.blueprintConsole as BlueprintConsoleSnapshot | undefined
  if (!stored?.blueprintCard?.coreSell) return null
  return stored
}

export async function loadProjectForBlueprintConsole(projectId: number) {
  return prisma.novelProject.findUnique({
    where: { id: projectId },
    include: {
      aiModelConfig: true,
      bookBlueprint: true,
      storyState: true,
      worldState: true,
      arcPlans: {
        orderBy: { arcNumber: 'asc' },
      },
    },
  })
}

export async function buildBlueprintConsoleSnapshot(projectId: number) {
  const project = await loadProjectForBlueprintConsole(projectId)
  if (!project) {
    throw new Error('项目不存在')
  }

  return extractStoredSnapshot(project) || buildFallbackSnapshot(project)
}

function buildRefreshPrompt(project: NonNullable<ProjectWithContext>, guidance?: string) {
  const currentArc = project.arcPlans.find(arc => {
    const currentChapter = project.storyState?.currentChapter || 0
    const arcEnd = arc.endChapter || Number.MAX_SAFE_INTEGER
    return currentChapter >= arc.startChapter && currentChapter <= arcEnd
  }) || project.arcPlans.find(arc => !arc.isCompleted) || project.arcPlans[0]

  return `你是“AI 小说设定中枢”，不是表单助手。你的任务是输出“AI 当前理解的全书状态”，并且所有设定都应体现“AI 生成 + 用户微调”，不能写成让用户从零填写。

请基于下面项目事实，输出一个用于前端展示和后续写作控制的 JSON：

项目信息：
- 标题：${project.title}
- 平台：${project.platform || '未指定'}
- 题材：${project.genre || '未指定'}
- 风格：${project.writingStyle || '未指定'}
- 一句话卖点：${project.bookBlueprint?.corePitch || project.corePitch || project.description || '暂无'}
- 当前章节：${project.storyState?.currentChapter || 0}
- 当前阶段：${currentArc ? `${currentArc.name} / ${currentArc.stage}` : '未初始化'}
- 目标总章：${project.storyState?.totalPlanned || 0}
- 世界等级：${getWorldLevelLabel(project.worldState?.mapLevel)}
- 当前主线：${project.storyState?.mainConflict || project.bookBlueprint?.mainlineDirection || '待定'}
- 世界方向：${project.bookBlueprint?.worldDirection || project.worldSetting || '待定'}
- 成长方向：${project.bookBlueprint?.growthDirection || project.protagonistGoal || '待定'}
- 当前世界设定：${project.worldSetting || '待定'}
- 当前主角设定：${project.protagonistProfile || '待定'}
- 当前风格策略：${project.writingPrompt || '待定'}
- 节奏参数：pace=${project.pace ?? 0.5}, darkness=${project.darkness ?? 0.3}, humor=${project.humor ?? 0.3}, romance=${project.romance ?? 0.2}, powerGrowth=${project.powerGrowth ?? 0.5}, conflictIntensity=${project.conflictIntensity ?? 0.5}, mysteryDensity=${project.mysteryDensity ?? 0.3}

用户本次微调意图：
${guidance?.trim() || '无，按当前设定生成最新动态中枢'}

输出要求：
1. 这是“AI 当前理解的全书状态”，不是创作输入表。
2. 用户只能调整方向，不能被要求手工填写世界观。
3. 所有文本都面向前端直出，短、准、可读。
4. 结合当前阶段，给出动态世界等级和当前主线，不要写成终局总结。
5. suggestedTweaks 必须是用户可点击的微调方向短语。
6. 只输出 JSON，不要 markdown，不要解释。

JSON 结构：
{
  "blueprintCard": {
    "category": "例如：番茄都市神豪爽文",
    "coreSell": "一句话核心卖点",
    "currentPhase": "当前阶段描述",
    "worldLevel": "城市级/全国级/国际级等",
    "currentMainline": "当前主线",
    "pacing": "例如：高爽点、高钩子"
  },
  "world": {
    "summary": "AI 当前理解的世界设定摘要",
    "mapRoute": ["阶段地图1", "阶段地图2"],
    "hiddenHierarchy": "隐藏层级/更高世界",
    "factions": "当前关键势力结构",
    "expansionRoute": "未来扩张路线"
  },
  "protagonist": {
    "summary": "主角核心人设",
    "currentState": "主角当前状态",
    "growthRoute": "主角成长路线"
  },
  "style": {
    "strategy": "当前风格策略",
    "payoffStrategy": "当前爽点/钩子策略",
    "toneTags": ["标签1", "标签2", "标签3"]
  },
  "suggestedTweaks": ["短语1", "短语2", "短语3", "短语4"]
}`
}

function toProjectSettingText(snapshot: BlueprintConsoleSnapshot) {
  return {
    worldSetting: [
      snapshot.world.summary,
      snapshot.world.mapRoute.length > 0 ? `地图推进：${snapshot.world.mapRoute.join(' → ')}` : '',
      snapshot.world.hiddenHierarchy ? `隐藏层级：${snapshot.world.hiddenHierarchy}` : '',
      snapshot.world.factions ? `势力结构：${snapshot.world.factions}` : '',
    ].filter(Boolean).join('\n'),
    protagonistProfile: snapshot.protagonist.summary,
    protagonistGoal: `${snapshot.protagonist.currentState}\n成长路线：${snapshot.protagonist.growthRoute}`.trim(),
    antagonistSetting: snapshot.world.factions,
    endingPlan: snapshot.world.expansionRoute,
    writingPrompt: [
      snapshot.style.strategy,
      `爽点策略：${snapshot.style.payoffStrategy}`,
      snapshot.style.toneTags.length > 0 ? `标签：${snapshot.style.toneTags.join('、')}` : '',
    ].filter(Boolean).join('\n'),
    powerSystem: snapshot.world.hiddenHierarchy,
  }
}

export async function refreshBlueprintConsole(
  projectId: number,
  guidance?: string,
  onProgress?: (progress: BlueprintConsoleProgress) => Promise<void> | void
) {
  let project = await loadProjectForBlueprintConsole(projectId)
  if (!project) {
    throw new Error('项目不存在')
  }

  const provider = await createProjectProvider(projectId)

  await onProgress?.({ phase: 'load_project', message: '正在读取项目与现有内容', stepIndex: 1, stepTotal: 7 })
  await ensureBlueprint(projectId, provider)
  await onProgress?.({ phase: 'generate_blueprint', message: '正在生成或刷新 Book Blueprint', stepIndex: 2, stepTotal: 7 })
  await ensureArcPlans(projectId, provider)
  await onProgress?.({ phase: 'generate_arc_plans', message: '正在补齐阶段规划与长篇结构', stepIndex: 3, stepTotal: 7 })
  if (!project.worldState) {
    await initWorldState(projectId)
  }
  await onProgress?.({ phase: 'init_world_state', message: '正在初始化世界状态', stepIndex: 4, stepTotal: 7 })
  if (!project.storyState) {
    const planningTargets = resolveProjectPlanningTargets({
      lengthType: project.lengthType,
      targetWordCount: project.targetWordCount,
      chapterWordCount: project.chapterWordCount,
    })
    const totalPlanned = Math.max(
      25,
      planningTargets.effectiveTotalChapters,
      (project.totalVolumes || 4) * 25
    )
    await initStoryState(projectId, totalPlanned)
  }
  await onProgress?.({ phase: 'init_story_state', message: '正在初始化故事状态', stepIndex: 5, stepTotal: 7 })

  project = await loadProjectForBlueprintConsole(projectId)
  if (!project) {
    throw new Error('项目不存在')
  }

  const prompt = buildRefreshPrompt(project, guidance)
  await onProgress?.({ phase: 'generate_snapshot', message: '正在生成 AI 动态设定中枢', stepIndex: 6, stepTotal: 7 })
  const result = await provider.generate(prompt, {
    temperature: 0.35,
    maxTokens: 2400,
    timeoutMs: 120000,
    responseFormat: { type: 'json_object' },
  })

  let parsed: BlueprintConsoleSnapshot
  try {
    parsed = parseAiJsonObject<BlueprintConsoleSnapshot>(result.content)
  } catch (error) {
    const retry = await provider.generate(`${prompt}\n\n上次输出 JSON 不合法。请只输出合法 JSON 对象。`, {
      temperature: 0.2,
      maxTokens: 2400,
      timeoutMs: 120000,
      responseFormat: { type: 'json_object' },
    })
    try {
      parsed = parseAiJsonObject<BlueprintConsoleSnapshot>(retry.content)
    } catch {
      throw new Error(`蓝图中枢刷新失败：${error instanceof Error ? error.message : 'JSON 解析失败'}`)
    }
  }

  const snapshot: BlueprintConsoleSnapshot = {
    ...parsed,
    suggestedTweaks: normalizeStringList(parsed.suggestedTweaks).slice(0, 8),
    style: {
      ...parsed.style,
      toneTags: normalizeStringList(parsed.style?.toneTags).slice(0, 6),
    },
    world: {
      ...parsed.world,
      mapRoute: normalizeStringList(parsed.world?.mapRoute).slice(0, 6),
    },
    lastGuidance: guidance?.trim() || undefined,
    generatedAt: new Date().toISOString(),
  }

  const projectSettings = toProjectSettingText(snapshot)

  await onProgress?.({ phase: 'persist_snapshot', message: '正在回写设定中枢与世界状态', stepIndex: 7, stepTotal: 7 })
  await prisma.$transaction(async (tx) => {
    await tx.novelProject.update({
      where: { id: projectId },
      data: projectSettings,
    })

    await tx.bookBlueprint.upsert({
      where: { projectId },
      update: {
        corePitch: snapshot.blueprintCard.coreSell,
        worldDirection: snapshot.world.expansionRoute,
        mainlineDirection: snapshot.blueprintCard.currentMainline,
        growthDirection: snapshot.protagonist.growthRoute,
        platformStrategy: snapshot.blueprintCard.category,
        genreStrategy: snapshot.world.summary,
        styleStrategy: snapshot.style.strategy,
      },
      create: {
        projectId,
        corePitch: snapshot.blueprintCard.coreSell,
        worldDirection: snapshot.world.expansionRoute,
        mainlineDirection: snapshot.blueprintCard.currentMainline,
        growthDirection: snapshot.protagonist.growthRoute,
        endingDirection: snapshot.world.hiddenHierarchy || snapshot.world.expansionRoute,
        platformStrategy: snapshot.blueprintCard.category,
        genreStrategy: snapshot.world.summary,
        styleStrategy: snapshot.style.strategy,
        constraints: [],
      },
    })

    const storyState = await tx.storyState.findUnique({ where: { projectId } })
    const currentMetadata = (storyState?.metadata as Record<string, unknown> | null | undefined) || {}
    await tx.storyState.upsert({
      where: { projectId },
      update: {
        mainConflict: snapshot.blueprintCard.currentMainline,
        metadata: {
          ...currentMetadata,
          blueprintConsole: snapshot,
        } as unknown as Prisma.InputJsonValue,
      },
      create: {
        projectId,
        currentChapter: 0,
        totalPlanned: 100,
        emotionalArc: [],
        subConflicts: [],
        mainConflict: snapshot.blueprintCard.currentMainline,
        metadata: {
          blueprintConsole: snapshot,
        } as unknown as Prisma.InputJsonValue,
      },
    })

    await tx.worldState.upsert({
      where: { projectId },
      update: {
        currentExpansion: snapshot.world.expansionRoute,
        regions: snapshot.world.mapRoute,
      },
      create: {
        projectId,
        mapLevel: 1,
        factionCount: 1,
        powerLevel: 1,
        civilizationLevel: 1,
        classStructure: [],
        regions: snapshot.world.mapRoute,
        currentExpansion: snapshot.world.expansionRoute,
      },
    })
  })

  await onProgress?.({ phase: 'completed', message: '初始化完成', stepIndex: 7, stepTotal: 7 })
  return snapshot
}

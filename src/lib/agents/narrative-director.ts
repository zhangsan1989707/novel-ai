import { prisma } from '@/lib/prisma'
import { StorySteering } from '@/types'
import { applySteering, getSteeringSummary } from '@/lib/engine/story-steering'
import { getPlatformTemplate } from '@/lib/engine/platform-style'
import { toInternalPlatform } from '@/lib/engine/production-mapping'

interface DirectorContext {
  chapterNumber: number
  steeringPrompt: string
  platformConfig: string
  blueprintStrategy: string
  arcInfo: string
  villainInfo: string
  worldInfo: string
  progressInfo: string
  fullDirective: string
}

const STRATEGY_PREFIXES = {
  platform: '策略-平台',
  genre: '策略-题材',
  style: '策略-风格',
} as const

function extractStrategy(constraints: string[], prefix: string): string | null {
  const raw = constraints.find(item => item.startsWith(`${prefix}:`))
  if (!raw) return null
  return raw.slice(prefix.length + 1).trim() || null
}

function buildDerivedStrategies(args: {
  constraints: string[]
  blueprint?: {
    platformStrategy?: string | null
    genreStrategy?: string | null
    styleStrategy?: string | null
  } | null
  platform: string
  template: ReturnType<typeof getPlatformTemplate>
  genre?: string | null
  writingStyle?: string | null
  steering: StorySteering
}) {
  const steeringSummary = getSteeringSummary(args.steering)
  const platformStrategy = args.blueprint?.platformStrategy
    || extractStrategy(args.constraints, STRATEGY_PREFIXES.platform)
    || `平台以 ${args.template.chapterWordTarget} 字章节目标、${args.template.pace} 节奏和 ${args.template.cliffhangerDensity} 钩子密度为基线，批次规划优先保证追读感而不是一次性收束。`

  const genreStrategy = args.blueprint?.genreStrategy
    || extractStrategy(args.constraints, STRATEGY_PREFIXES.genre)
    || (args.genre
      ? `题材为 ${args.genre}，当前章节要持续扩张世界与冲突，只兑现阶段收益，不提前清空主线或最大反派。`
      : '题材未明确时默认采用长篇连载策略，保留世界扩张和后续升级空间。')

  const styleStrategy = args.blueprint?.styleStrategy
    || extractStrategy(args.constraints, STRATEGY_PREFIXES.style)
    || `风格参考 ${args.writingStyle || '默认长篇风格'}，当前 Story Steering 为 ${steeringSummary}，章节应把风格变化落实到桥段密度、悬念留白与成长曲线。`

  return {
    platformStrategy,
    genreStrategy,
    styleStrategy,
  }
}

export async function directChapter(chapterNumber: number, projectId: number): Promise<DirectorContext> {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: {
      arcPlans: { orderBy: { arcNumber: 'asc' } },
      plotlines: {
        where: { status: 'OPEN' },
        orderBy: [{ plannedAt: 'asc' }, { plantedAt: 'asc' }],
      },
      storyState: true,
      villains: true,
      worldState: true,
      bookBlueprint: true,
      chapters: { orderBy: { chapterNumber: 'asc' } },
    },
  })

  if (!project) throw new Error(`项目 ${projectId} 不存在`)

  const currentArc =
    project.arcPlans.find(a => {
      const arcEnd = a.endChapter || Number.MAX_SAFE_INTEGER
      return chapterNumber >= a.startChapter && chapterNumber <= arcEnd
    }) ||
    project.arcPlans.find(a => !a.isCompleted) ||
    project.arcPlans[0]
  const steering: StorySteering = {
    pace: project.pace || 0.5,
    darkness: project.darkness || 0.3,
    humor: project.humor || 0.3,
    romance: project.romance || 0.2,
    powerGrowth: project.powerGrowth || 0.5,
    conflictIntensity: project.conflictIntensity || 0.5,
    mysteryDensity: project.mysteryDensity || 0.3,
  }

  const platform = toInternalPlatform(project.platform)
  const template = getPlatformTemplate(platform)
  const blueprintConstraints = project.bookBlueprint?.constraints || []

  const totalChapters = project.chapters.length
  const estimatedTotal = project.targetWordCount
    ? Math.ceil(project.targetWordCount / project.chapterWordCount)
    : 100
  const progressRatio = estimatedTotal > 0 ? chapterNumber / estimatedTotal : 0

  const activeVillains = project.villains.filter(v => v.lifecycle === 'active')
  const escapedVillains = project.villains.filter(v => v.lifecycle === 'escaped')
  const finalBosses = activeVillains.filter(v => v.isFinalBoss)
  const protectedPlotlines = project.plotlines
    .filter(plotline => typeof plotline.plannedAt !== 'number' || plotline.plannedAt > chapterNumber)
    .slice(0, 5)

  const steeringSummary = getSteeringSummary(steering)
  const steeringPrompt = applySteering('', steering)
  const strategies = buildDerivedStrategies({
    constraints: blueprintConstraints,
    blueprint: project.bookBlueprint,
    platform,
    template,
    genre: project.genre,
    writingStyle: project.writingStyle,
    steering,
  })

  const platformConfig = `[平台配置]
平台：${platform}
节奏：${template.pace}
每章字数：${template.chapterWordTarget}字
爽点密度：${template.slapFaceDensity}
钩子密度：${template.cliffhangerDensity}`

  const blueprintStrategy = `[Blueprint 策略]
平台策略：${strategies.platformStrategy}
题材策略：${strategies.genreStrategy}
风格策略：${strategies.styleStrategy}
硬约束：${[
    ...blueprintConstraints.filter(item => !item.startsWith(`${STRATEGY_PREFIXES.platform}:`) && !item.startsWith(`${STRATEGY_PREFIXES.genre}:`) && !item.startsWith(`${STRATEGY_PREFIXES.style}:`)),
    '禁止提前结局',
    '禁止主线终结',
    '禁止最大反派死亡',
    '禁止伏笔提前回收',
  ].filter(Boolean).join('；')}`

  const arcInfo = currentArc
    ? `[当前阶段]
Arc ${currentArc.arcNumber}: ${currentArc.name}
阶段：${currentArc.stage}
批次大小：${currentArc.batchSize}
目标：${currentArc.goals.join('、')}
关键事件：${currentArc.keyEvents.join('、')}
阶段护栏：本阶段只允许完成局部阶段目标，必须保留后续升级、扩张和新钩子`
    : `[当前阶段]
初始阶段，尚未规划Arc`

  const villainInfo = `[反派状态]
活跃反派：${activeVillains.length > 0 ? activeVillains.map(v => v.name).join('、') : '暂无'}
${escapedVillains.length > 0 ? `逃脱反派（可复用）：${escapedVillains.map(v => v.name).join('、')}` : ''}
${finalBosses.length > 0 ? `终极反派保护：${finalBosses.map(v => v.name).join('、')} 在非终局阶段不得被彻底击败或死亡` : '尚未设定终极反派，当前阶段禁止塑造“一战收官”结构'}
${progressRatio < 0.7 ? '当前进度低于70%，终极Boss暂不出场' : '可考虑引入终极Boss线索'}`

  const worldInfo = project.worldState
    ? `[世界状态]
地图层级：${project.worldState.mapLevel}/10
势力数量：${project.worldState.factionCount}
修炼上限：${project.worldState.powerLevel}/10
文明层级：${project.worldState.civilizationLevel}/10
当前主冲突：${project.storyState?.mainConflict || '待 AI 持续塑造'}`
    : `[世界状态]
初始世界，待扩张`

  const blueprintInfo = project.bookBlueprint
    ? `[蓝图]
核心卖点：${project.bookBlueprint.corePitch}
世界方向：${project.bookBlueprint.worldDirection || '待定'}
主线方向：${project.bookBlueprint.mainlineDirection || '待定'}
成长方向：${project.bookBlueprint.growthDirection || '待定'}
远景终局：${project.bookBlueprint.endingDirection || '待定'}`
    : ''

  const progressInfo = `[进度]
当前章节：第${chapterNumber}章
总已完成：${totalChapters}章
预估总章：${estimatedTotal}章
进度：${Math.round(progressRatio * 100)}%
风格：${steeringSummary}
未回收伏笔：${protectedPlotlines.length > 0 ? protectedPlotlines.map(plotline => `${plotline.description}${plotline.plannedAt ? `(计划第${plotline.plannedAt}章)` : ''}`).join('；') : '暂无强制保护伏笔'}`

  const fullDirective = [
    `第${chapterNumber}章 导演指令`,
    blueprintInfo,
    blueprintStrategy,
    arcInfo,
    platformConfig,
    worldInfo,
    villainInfo,
    progressInfo,
    steeringPrompt,
  ].filter(Boolean).join('\n\n')

  return {
    chapterNumber,
    steeringPrompt,
    platformConfig,
    blueprintStrategy,
    arcInfo,
    villainInfo,
    worldInfo,
    progressInfo,
    fullDirective,
  }
}

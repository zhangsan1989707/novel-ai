import { prisma } from '@/lib/prisma'
import { calculateVolume, getAllVolumeSummaries } from './volume-summary'
import { getBookSummary } from './book-summary'
import { getCharacterProfilesForChapter } from './character-memory'
import { getOpenPlotlines } from './plotline-tracker'
import { getRecentChapterSummaries } from './chapter-summary'
import { getStoryState } from '@/lib/engine/story-state'
import { buildRAGContext } from '@/lib/engine/rag-vector'
import { decaySummary } from '@/lib/engine/context-compression'
import {
  buildContinuityAnchor,
  buildDynamicVocabulary,
  formatContinuityAnchorSection,
  type ContinuityAnchor,
} from '@/lib/engine/chapter-continuity'

/**
 * 获取上一章的结尾原文（用于跨章衔接）
 * 取最后 500 字作为衔接上下文
 */
async function getPreviousChapterEnding(
  projectId: number,
  chapterNo: number
): Promise<string | null> {
  if (chapterNo <= 1) return null
  const prevChapter = await prisma.novelChapter.findFirst({
    where: { projectId, chapterNumber: chapterNo - 1, status: 'COMPLETED' },
    select: { content: true },
  })
  if (!prevChapter?.content) return null
  const trimmed = prevChapter.content.trimEnd()
  // 取最后 500 字 — 既能捕获结尾钩子，又不会太占上下文
  return trimmed.slice(-500)
}

export type MemoryPackRole = 'planner' | 'writer' | 'validator' | 'summarizer'

export interface MemoryPackOptions {
  recentChapterCount?: number
  recentVolumeCount?: number
  characterLimit?: number
  plotlineLimit?: number
  researchLimit?: number
  speedMode?: 'FAST_ACCEPTANCE' | 'FINAL_POLISH'
  /** 启用记忆衰减压缩（默认 true） */
  enableDecay?: boolean
}

export interface MemoryPackSection {
  key: string
  title: string
  priority: number
  budget: number
  content: string
  truncated: boolean
}

export interface MemoryPack {
  projectId: number
  chapterNo: number
  totalVolumes: number
  currentVolume: number
  projectTitle: string
  genre: string | null
  writingStyle: string | null
  worldSetting: string | null
  powerSystem: string | null
  protagonistProfile: string | null
  protagonistGoal: string | null
  antagonistSetting: string | null
  endingPlan: string | null
  chapterWordCount: number
  currentWordCount: number
  targetWordCount: number | null
  bookBlueprint: {
    corePitch: string
    worldDirection: string | null
    mainlineDirection: string | null
    growthDirection: string | null
    endingDirection: string | null
    popularFictionProfile?: Record<string, unknown> | null
    constraints: string[]
  } | null
  bookSummary: Awaited<ReturnType<typeof getBookSummary>>
  volumeSummaries: Awaited<ReturnType<typeof getAllVolumeSummaries>>
  recentChapterSummaries: Awaited<ReturnType<typeof getRecentChapterSummaries>>
  openPlotlines: Awaited<ReturnType<typeof getOpenPlotlines>>
  characterProfiles: Awaited<ReturnType<typeof getCharacterProfilesForChapter>>
  storyState: Awaited<ReturnType<typeof getStoryState>>
  researchRefs: Array<{
    topic: string
    summary: string
    keyFacts: string[]
    creativeMaterials: string[]
  }>
  ragContext: {
    query: string
    context: string
    sources: Array<{ chapterNo: number; type: string; relevance: number }>
  } | null
  /** 上一章结尾原文（最后 500 字），用于跨章衔接 */
  previousChapterEnding: string | null
  /** 章节连续性锚点，用于防止跨章断裂 */
  continuityAnchor: ContinuityAnchor | null
  sections: MemoryPackSection[]
  plannerContext: string
  writerContext: string
  validatorContext: string
  summarizerContext: string
  /** 是否启用了记忆衰减 */
  enableDecay: boolean
}

function clampText(value: string, maxChars: number): string {
  const normalized = value
    .trim()
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, Math.max(0, maxChars - 1))}…`
}

function formatList(items: string[], prefix = '- '): string {
  return items.length > 0 ? items.map(item => `${prefix}${item}`).join('\n') : '无'
}

function formatCharacterProfile(character: Awaited<ReturnType<typeof getCharacterProfilesForChapter>>[number]): string {
  const aliasText = character.aliases.length > 0 ? `别名：${character.aliases.join('、')}` : ''
  const phraseText = character.catchphrases.length > 0 ? `口头禅：${character.catchphrases.join('、')}` : ''
  const stateText = Object.keys(character.currentState || {}).length > 0
    ? `当前状态：${JSON.stringify(character.currentState)}`
    : ''
  return [
    `【${character.name}】${character.role}`,
    character.appearance ? `外貌：${character.appearance}` : '',
    character.personality ? `性格：${character.personality}` : '',
    character.background ? `背景：${character.background}` : '',
    aliasText,
    phraseText,
    stateText,
    character.lastUpdated ? `最近更新：第${character.lastUpdated}章` : '',
  ].filter(Boolean).join('\n')
}

function formatStoryStateSection(storyState: NonNullable<MemoryPack['storyState']>): string {
  const arcTail = storyState.emotionalArc.slice(-6)
  return [
    `当前章进度：第${storyState.currentChapter}章 / 共${storyState.totalPlanned}章`,
    storyState.mainConflict ? `主线冲突：${storyState.mainConflict}` : '',
    storyState.subConflicts.length > 0
      ? `支线冲突：\n${storyState.subConflicts
        .slice(0, 5)
        .map(conflict => `- ${conflict.description}（${conflict.status}）`)
        .join('\n')}`
      : '',
    arcTail.length > 0
      ? `情绪曲线：${arcTail.map(point => `第${point.chapterNo}章=${point.value}`).join(' → ')}`
      : '',
  ].filter(Boolean).join('\n')
}

function buildSection(
  key: string,
  title: string,
  content: string,
  priority: number,
  budget: number
): MemoryPackSection {
  const trimmed = clampText(content, budget)
  return {
    key,
    title,
    priority,
    budget,
    content: trimmed,
    truncated: trimmed.length < content.length,
  }
}

function sortAndJoinSections(sections: MemoryPackSection[]): string {
  return sections
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map(section => `## ${section.title}\n${section.content}`)
    .join('\n\n')
}

function pickVolumeSummaries(
  volumeSummaries: Awaited<ReturnType<typeof getAllVolumeSummaries>>,
  currentVolume: number,
  recentVolumeCount: number
) {
  const selected = volumeSummaries.filter(volume => {
    const distance = currentVolume - volume.volumeNumber
    return distance >= 0 && distance < recentVolumeCount
  })
  return selected.sort((a, b) => a.volumeNumber - b.volumeNumber)
}

function buildBookBlueprintSection(blueprint: MemoryPack['bookBlueprint']): string {
  if (!blueprint) return ''
  return [
    `核心卖点：${blueprint.corePitch}`,
    blueprint.worldDirection ? `世界方向：${blueprint.worldDirection}` : '',
    blueprint.mainlineDirection ? `主线方向：${blueprint.mainlineDirection}` : '',
    blueprint.growthDirection ? `成长方向：${blueprint.growthDirection}` : '',
    blueprint.endingDirection ? `结局方向：${blueprint.endingDirection}` : '',
    blueprint.popularFictionProfile ? `爆款四因子：${JSON.stringify(blueprint.popularFictionProfile)}` : '',
    blueprint.constraints.length > 0 ? `约束：${blueprint.constraints.join('、')}` : '',
  ].filter(Boolean).join('\n')
}

function buildRecentChapterSection(
  summaries: MemoryPack['recentChapterSummaries']
): string {
  return summaries.length > 0
    ? summaries.map(item => `第${item.chapterNo}章：${item.summary}`).join('\n')
    : '暂无最近章节摘要'
}

function buildPlotlineSection(plotlines: MemoryPack['openPlotlines']): string {
  return plotlines.length > 0
    ? plotlines.map(plotline => `- [第${plotline.plantedAt}章] ${plotline.description}`).join('\n')
    : '暂无未回收伏笔'
}

/**
 * 根据章节年龄压缩摘要
 * - 近 10 章：保留完整摘要
 * - 10-30 章前：压缩为"关键事件 + 伏笔"两行
 * - 30+ 章前：压缩为"伏笔状态"一行（只保留未解决的伏笔引用）
 * 伏笔引用无论多老都必须保留完整
 */
export function compressChapterSummary(
  summary: string,
  chapterAge: number,
  openPlotlineRefs: string[]
): string {
  return decaySummary(summary, chapterAge, openPlotlineRefs)
}

function buildResearchSection(refs: MemoryPack['researchRefs']): string {
  return refs.length > 0
    ? refs.map(ref => {
      const facts = ref.keyFacts.length > 0 ? `\n  关键事实：${ref.keyFacts.join('；')}` : ''
      const materials = ref.creativeMaterials.length > 0 ? `\n  创作素材：${ref.creativeMaterials.join('；')}` : ''
      return `【${ref.topic}】${ref.summary}${facts}${materials}`
    }).join('\n\n')
    : '暂无研究资料'
}

function buildRagSection(ragContext: NonNullable<MemoryPack['ragContext']>): string {
  const sourceLines = ragContext.sources.length > 0
    ? ragContext.sources.map(source => `- 第${source.chapterNo}章 / ${source.type} / ${source.relevance.toFixed(2)}`).join('\n')
    : '无'

  return [
    `检索问题：${ragContext.query}`,
    `命中来源：\n${sourceLines}`,
    ragContext.context,
  ].filter(Boolean).join('\n\n')
}

function pickMemorySections(pack: MemoryPack, role: MemoryPackRole): MemoryPackSection[] {
  const sections: MemoryPackSection[] = []

  // 连续性锚点（仅 planner / writer 需要，用于跨章衔接）
  if ((role === 'planner' || role === 'writer') && pack.continuityAnchor) {
    sections.push(buildSection(
      'continuity-anchor',
      '章节连续性锚点',
      formatContinuityAnchorSection(pack.continuityAnchor),
      0,  // 最高优先级
      role === 'writer' ? 1200 : 900
    ))
  }

  sections.push(buildSection(
    'blueprint',
    '创作合同',
    buildBookBlueprintSection(pack.bookBlueprint),
    1,
    role === 'writer' ? 1600 : 1200
  ))

  if (pack.bookSummary) {
    sections.push(buildSection(
      'book-summary',
      '全书概览',
      [
        `整体摘要：${pack.bookSummary.summary}`,
        `主线概述：${pack.bookSummary.mainPlot}`,
        pack.bookSummary.thematicElements.length > 0 ? `主题元素：${pack.bookSummary.thematicElements.join('、')}` : '',
        `伏笔状态：总计${pack.bookSummary.totalPlotlines} / 已回收${pack.bookSummary.resolvedPlotlines} / 未回收${pack.bookSummary.openPlotlines}`,
      ].filter(Boolean).join('\n'),
      2,
      role === 'writer' ? 1800 : 1200
    ))
  }

  const selectedVolumes = pickVolumeSummaries(pack.volumeSummaries, pack.currentVolume, role === 'planner' ? 2 : 3)
  for (const volume of selectedVolumes) {
    sections.push(buildSection(
      `volume-${volume.volumeNumber}`,
      `第${volume.volumeNumber}卷概览`,
      [
        `卷摘要：${volume.summary}`,
        volume.keyEvents.length > 0 ? `关键事件：${formatList(volume.keyEvents)}` : '',
        volume.plantedPlotlines.length > 0 ? `本卷埋设：${formatList(volume.plantedPlotlines)}` : '',
        volume.resolvedPlotlines.length > 0 ? `本卷回收：${formatList(volume.resolvedPlotlines)}` : '',
      ].filter(Boolean).join('\n'),
      3 + volume.volumeNumber / 100,
      role === 'writer' ? 2000 : 1200
    ))
  }

  // 衰减模式下展示所有已衰减的摘要（旧章节已被压缩，总量可控）
  const recentSummaryLimit = pack.enableDecay
    ? pack.recentChapterSummaries.length
    : role === 'summarizer' ? 3 : role === 'validator' ? 5 : 5  // writer/planner 从 3 提升到 5
  const summaryLabel = pack.enableDecay ? '章节记忆（含衰减）' : `最近${recentSummaryLimit}章摘要`
  const summaryBudget = pack.enableDecay
    ? (role === 'writer' ? 4800 : 3200)  // 提升 writer 预算
    : (role === 'writer' ? 3200 : 2400)  // 提升 writer 预算
  sections.push(buildSection(
    'recent-chapters',
    summaryLabel,
    buildRecentChapterSection(pack.recentChapterSummaries.slice(-recentSummaryLimit)),
    4,
    summaryBudget
  ))

  sections.push(buildSection(
    'plotlines',
    '进行中的伏笔与剧情线',
    buildPlotlineSection(pack.openPlotlines),
    5,
    role === 'validator' ? 1400 : 1200
  ))

  sections.push(buildSection(
    'characters',
    '角色状态',
    pack.characterProfiles.length > 0
      ? pack.characterProfiles.slice(0, role === 'writer' ? 10 : 8).map(formatCharacterProfile).join('\n\n')
      : '暂无角色状态',
    6,
    role === 'writer' ? 2600 : 1800
  ))

  if (pack.ragContext?.context?.trim()) {
    sections.push(buildSection(
      'rag',
      '语义检索背景',
      buildRagSection(pack.ragContext),
      6.5,
      role === 'writer' ? 2400 : 1600
    ))
  }

  if (pack.storyState) {
    sections.push(buildSection(
      'story-state',
      '故事状态机',
      formatStoryStateSection(pack.storyState),
      7,
      role === 'writer' ? 1400 : 1000
    ))
  }

  if (role !== 'summarizer') {
    sections.push(buildSection(
      'research',
      '研究资料',
      buildResearchSection(pack.researchRefs),
      8,
      role === 'writer' ? 1800 : 1200
    ))
  }

  return sections.filter(section => section.content.trim().length > 0)
}

function formatPackForRole(pack: MemoryPack, role: MemoryPackRole): string {
  const sections = pickMemorySections(pack, role)
  const header = [
    `# 记忆编排包`,
    `- 章节：第${pack.chapterNo}章`,
    `- 当前卷：第${pack.currentVolume}卷`,
    `- 当前字数：${pack.currentWordCount}`,
    `- 目标字数：${pack.targetWordCount ?? '未设置'}`,
  ].join('\n')

  return [header, sortAndJoinSections(sections)].join('\n\n')
}

function buildRagQuery(pack: {
  projectTitle: string
  genre: string | null
  writingStyle: string | null
  chapterNo: number
  bookBlueprint: MemoryPack['bookBlueprint']
  storyState: MemoryPack['storyState']
  recentChapterSummaries: MemoryPack['recentChapterSummaries']
  openPlotlines: MemoryPack['openPlotlines']
  characterProfiles: MemoryPack['characterProfiles']
}) {
  const recentSummary = pack.recentChapterSummaries[pack.recentChapterSummaries.length - 1]?.summary || ''
  const openPlotlineText = pack.openPlotlines.slice(0, 4).map(plotline => plotline.description).join('；')
  const characterText = pack.characterProfiles.slice(0, 6).map(character => character.name).join('、')
  const conflictText = pack.storyState?.mainConflict || ''

  return [
    `小说：${pack.projectTitle}`,
    pack.genre ? `题材：${pack.genre}` : '',
    pack.writingStyle ? `风格：${pack.writingStyle}` : '',
    `当前章节：第${pack.chapterNo}章`,
    pack.bookBlueprint?.corePitch ? `核心卖点：${pack.bookBlueprint.corePitch}` : '',
    pack.bookBlueprint?.mainlineDirection ? `主线：${pack.bookBlueprint.mainlineDirection}` : '',
    recentSummary ? `最近摘要：${recentSummary}` : '',
    openPlotlineText ? `未回收伏笔：${openPlotlineText}` : '',
    characterText ? `角色：${characterText}` : '',
    conflictText ? `主冲突：${conflictText}` : '',
  ].filter(Boolean).join('\n')
}

export async function buildChapterMemoryPack(
  projectId: number,
  chapterNo: number,
  options: MemoryPackOptions = {}
): Promise<MemoryPack> {
  const enableDecay = options.enableDecay ?? true
  // 衰减模式下拉取更多章节摘要（旧章节会被压缩，不会撑爆上下文）
  const recentChapterCount = enableDecay
    ? Math.max(options.recentChapterCount ?? 3, 50)
    : (options.recentChapterCount ?? 3)
  const recentVolumeCount = options.recentVolumeCount ?? 2
  const characterLimit = options.characterLimit ?? 10
  const plotlineLimit = options.plotlineLimit ?? 10
  const researchLimit = options.researchLimit ?? 3
  const skipAIRerank = options.speedMode !== 'FINAL_POLISH'

  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: { bookBlueprint: true },
  })

  if (!project) {
    throw new Error(`Project ${projectId} not found`)
  }

  const [
    bookSummary,
    volumeSummaries,
    recentChapterSummaries,
    openPlotlines,
    characterProfiles,
    storyState,
    researchRefs,
    previousChapterEnding,
  ] = await Promise.all([
    getBookSummary(projectId),
    getAllVolumeSummaries(projectId),
    getRecentChapterSummaries(projectId, recentChapterCount),
    getOpenPlotlines(projectId),
    getCharacterProfilesForChapter(projectId, chapterNo, true),
    getStoryState(projectId),
    prisma.researchRef.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: researchLimit,
      select: { topic: true, summary: true, keyFacts: true, creativeMaterials: true },
    }),
    getPreviousChapterEnding(projectId, chapterNo),
  ])

  const currentVolume = calculateVolume(
    chapterNo,
    project.totalVolumes,
    Math.max(project.totalVolumes * 25, chapterNo)
  )

  // 应用记忆衰减压缩
  const decayedSummaries = enableDecay
    ? recentChapterSummaries.map(s => ({
        ...s,
        summary: compressChapterSummary(
          s.summary,
          chapterNo - s.chapterNo,
          openPlotlines.map(p => `[伏笔#${p.id}]`)
        ),
      })).filter(s => s.summary.length > 0)
    : recentChapterSummaries

  const bookBlueprint = project.bookBlueprint
    ? {
        corePitch: project.bookBlueprint.corePitch,
        worldDirection: project.bookBlueprint.worldDirection,
        mainlineDirection: project.bookBlueprint.mainlineDirection,
        growthDirection: project.bookBlueprint.growthDirection,
        endingDirection: project.bookBlueprint.endingDirection,
        popularFictionProfile: (project.bookBlueprint as unknown as { popularFictionProfile?: unknown }).popularFictionProfile as Record<string, unknown> | null,
        constraints: project.bookBlueprint.constraints,
      }
    : null

  const trimmedCharacters = characterProfiles
    .slice(0, characterLimit)
    .map(character => ({
      ...character,
      currentState: character.currentState || {},
    }))

  const trimmedPlotlines = openPlotlines.slice(0, plotlineLimit)

  // 构建动态词表和情绪数据
  const dynamicVocabulary = buildDynamicVocabulary({
    worldSetting: project.worldSetting,
    previousChapterEnding,
    recentChapterSummaries: decayedSummaries,
  })

  const emotionalArc = storyState?.emotionalArc || []
  const lastEmotionalPoint = emotionalArc.length > 0 ? emotionalArc[emotionalArc.length - 1] : null
  const previousEmotionalTone = lastEmotionalPoint
    ? (lastEmotionalPoint.value >= 70 ? '紧张' : lastEmotionalPoint.value >= 40 ? '平稳' : '舒缓')
    : undefined
  const emotionalArcTrend = emotionalArc.length >= 2
    ? (emotionalArc[emotionalArc.length - 1].value > emotionalArc[emotionalArc.length - 2].value + 10
      ? 'rising'
      : emotionalArc[emotionalArc.length - 1].value < emotionalArc[emotionalArc.length - 2].value - 10
        ? 'falling'
        : 'stable')
    : undefined

  const continuityAnchor = buildContinuityAnchor({
    chapterNo,
    previousChapterEnding,
    characterProfiles: trimmedCharacters,
    protagonistProfile: project.protagonistProfile,
    dynamicVocabulary,
    previousEmotionalTone,
    emotionalArcTrend,
  })
  const ragQuery = buildRagQuery({
    projectTitle: project.title,
    genre: project.genre,
    writingStyle: project.writingStyle,
    chapterNo,
    bookBlueprint,
    storyState,
    recentChapterSummaries: decayedSummaries,
    openPlotlines: trimmedPlotlines,
    characterProfiles: trimmedCharacters,
  })
  const ragContext = ragQuery.trim().length > 0
    ? await buildRAGContext(projectId, chapterNo, ragQuery, {
        maxChunks: 4,
        includeTypes: ['plot', 'character', 'setting'],
        rerank: !skipAIRerank,
      })
    : null

  const memoryPack: MemoryPack = {
    projectId,
    chapterNo,
    totalVolumes: project.totalVolumes,
    currentVolume,
    projectTitle: project.title,
    genre: project.genre,
    writingStyle: project.writingStyle,
    worldSetting: project.worldSetting,
    powerSystem: project.powerSystem,
    protagonistProfile: project.protagonistProfile,
    protagonistGoal: project.protagonistGoal,
    antagonistSetting: project.antagonistSetting,
    endingPlan: project.endingPlan,
    chapterWordCount: project.chapterWordCount,
    currentWordCount: project.currentWordCount,
    targetWordCount: project.targetWordCount,
    bookBlueprint,
    bookSummary,
    volumeSummaries: volumeSummaries.filter(volume => {
      const distance = currentVolume - volume.volumeNumber
      return distance >= 0 && distance < recentVolumeCount
    }),
    recentChapterSummaries: decayedSummaries,
    openPlotlines: trimmedPlotlines,
    characterProfiles: trimmedCharacters,
    storyState,
    researchRefs: researchRefs.map(ref => ({
      topic: ref.topic,
      summary: ref.summary,
      keyFacts: ref.keyFacts || [],
      creativeMaterials: ref.creativeMaterials || [],
    })),
    ragContext: ragContext
      ? {
          query: ragQuery,
          context: ragContext.context,
          sources: ragContext.sources,
        }
      : null,
    previousChapterEnding,
    continuityAnchor,
    sections: [],
    plannerContext: '',
    writerContext: '',
    validatorContext: '',
    summarizerContext: '',
    enableDecay,
  }

  memoryPack.sections = pickMemorySections(memoryPack, 'planner')
  memoryPack.plannerContext = formatPackForRole(memoryPack, 'planner')
  memoryPack.writerContext = formatPackForRole(memoryPack, 'writer')
  memoryPack.validatorContext = formatPackForRole(memoryPack, 'validator')
  memoryPack.summarizerContext = formatPackForRole(memoryPack, 'summarizer')

  return memoryPack
}

export function buildMemorySnapshotPack(pack: MemoryPack) {
  return {
    projectId: pack.projectId,
    chapterNo: pack.chapterNo,
    currentVolume: pack.currentVolume,
    totalVolumes: pack.totalVolumes,
    sectionCount: pack.sections.length,
    sections: pack.sections.map(section => ({
      key: section.key,
      title: section.title,
      priority: section.priority,
      budget: section.budget,
      truncated: section.truncated,
      content: section.content,
    })),
    stats: {
      recentChapterCount: pack.recentChapterSummaries.length,
      openPlotlineCount: pack.openPlotlines.length,
      characterCount: pack.characterProfiles.length,
      researchCount: pack.researchRefs.length,
      hasBookSummary: Boolean(pack.bookSummary),
      hasBlueprint: Boolean(pack.bookBlueprint),
      hasStoryState: Boolean(pack.storyState),
      ragSourceCount: pack.ragContext?.sources.length || 0,
      ragContextLength: pack.ragContext?.context.length || 0,
    },
  }
}

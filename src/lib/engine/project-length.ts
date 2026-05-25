const SHORT_STAGES = ['OPENING', 'GROWTH', 'MID_CONFLICT', 'FINALE'] as const
const FULL_STAGES = ['OPENING', 'GROWTH', 'EXPANSION', 'MID_CONFLICT', 'PRE_FINALE', 'FINALE'] as const

export type PlanningLengthType = 'SHORT' | 'MEDIUM' | 'LONG' | 'ULTRA_LONG'

type LengthPlanningRule = {
  minTargetWordCount: number
  minTotalChapters: number
  stageSequence: readonly string[]
}

const LENGTH_RULES: Record<PlanningLengthType, LengthPlanningRule> = {
  SHORT: {
    minTargetWordCount: 120000,
    minTotalChapters: 120,
    stageSequence: SHORT_STAGES,
  },
  MEDIUM: {
    minTargetWordCount: 500000,
    minTotalChapters: 500,
    stageSequence: FULL_STAGES,
  },
  LONG: {
    minTargetWordCount: 1000000,
    minTotalChapters: 1000,
    stageSequence: FULL_STAGES,
  },
  ULTRA_LONG: {
    minTargetWordCount: 10000000,
    minTotalChapters: 3000,
    stageSequence: FULL_STAGES,
  },
}

export function normalizePlanningLengthType(lengthType?: string | null): PlanningLengthType {
  switch ((lengthType || '').toUpperCase()) {
    case 'SHORT':
      return 'SHORT'
    case 'MEDIUM':
      return 'MEDIUM'
    case 'ULTRA_LONG':
      return 'ULTRA_LONG'
    case 'LONG':
    default:
      return 'LONG'
  }
}

export function getLengthPlanningRule(lengthType?: string | null): LengthPlanningRule {
  return LENGTH_RULES[normalizePlanningLengthType(lengthType)]
}

export function resolveProjectPlanningTargets(input: {
  lengthType?: string | null
  targetWordCount?: number | null
  chapterWordCount?: number | null
}) {
  const chapterWordCount = Math.max(1000, Math.floor(input.chapterWordCount || 3000))
  const rule = getLengthPlanningRule(input.lengthType)
  const requestedTargetWordCount = Math.max(0, Math.floor(input.targetWordCount || 0))
  const requestedTotalChapters = requestedTargetWordCount > 0 ? Math.ceil(requestedTargetWordCount / chapterWordCount) : 0
  const effectiveTargetWordCount = Math.max(requestedTargetWordCount, rule.minTargetWordCount)
  const effectiveTotalChapters = Math.max(
    Math.ceil(effectiveTargetWordCount / chapterWordCount),
    rule.minTotalChapters,
    requestedTotalChapters
  )

  return {
    chapterWordCount,
    requestedTargetWordCount,
    requestedTotalChapters,
    effectiveTargetWordCount,
    effectiveTotalChapters,
    minTargetWordCount: rule.minTargetWordCount,
    minTotalChapters: rule.minTotalChapters,
    stageSequence: [...rule.stageSequence],
    normalizedLengthType: normalizePlanningLengthType(input.lengthType),
  }
}

const STAGE_FALLBACK_CONTENT: Record<string, { name: string; description: string }> = {
  OPENING: {
    name: '主角入局',
    description: '负责建立主角处境、第一层压迫与第一批追读钩子。',
  },
  GROWTH: {
    name: '成长起势',
    description: '负责让主角建立优势、积累筹码，并把冲突推向更高层级。',
  },
  EXPANSION: {
    name: '世界扩张',
    description: '负责扩张地图、势力和问题规模，让故事明显变大。',
  },
  MID_CONFLICT: {
    name: '中段冲突',
    description: '负责让多条矛盾线相互碰撞，把风险、代价和压力抬高。',
  },
  PRE_FINALE: {
    name: '高潮前夜',
    description: '负责把终局筹码摆上桌，但不提前引爆真正结局。',
  },
  FINALE: {
    name: '最终因果',
    description: '负责集中兑现前期铺垫，完成主线冲突与核心因果回收。',
  },
}

export function normalizeArcPlanOutputs<T extends {
  arcNumber?: number
  name?: string
  stage?: string
  description?: string
  startChapter?: number
  endChapter?: number
  batchSize?: number
  goals?: string[]
  keyEvents?: string[]
}>(items: T[], totalChapters: number, stageSequence: string[]) {
  const expectedCount = Math.max(1, stageSequence.length)
  const normalizedTotal = Math.max(totalChapters, expectedCount)
  const baseSize = Math.floor(normalizedTotal / expectedCount)
  const remainder = normalizedTotal % expectedCount
  const normalized: Array<{
    arcNumber: number
    name: string
    stage: string
    description: string
    startChapter: number
    endChapter: number
    batchSize?: number
    goals: string[]
    keyEvents: string[]
  }> = []

  let cursor = 1

  for (let index = 0; index < expectedCount; index++) {
    const stage = stageSequence[index]
    const source = items[index]
    const remainingStages = expectedCount - index - 1
    const plannedSize = baseSize + (index < remainder ? 1 : 0)
    const minEnd = cursor
    const maxEnd = normalizedTotal - remainingStages
    const fallbackEnd = index === expectedCount - 1 ? normalizedTotal : cursor + plannedSize - 1
    const rawEnd = typeof source?.endChapter === 'number' ? source.endChapter : fallbackEnd
    const endChapter = Math.max(minEnd, Math.min(maxEnd, rawEnd))
    const fallback = STAGE_FALLBACK_CONTENT[stage] || {
      name: `第${index + 1}阶段`,
      description: '继续推进主线、升级冲突，并为后续发展留出空间。',
    }

    normalized.push({
      arcNumber: index + 1,
      name: source?.name?.trim() || fallback.name,
      stage,
      description: source?.description?.trim() || fallback.description,
      startChapter: cursor,
      endChapter,
      batchSize: typeof source?.batchSize === 'number' ? source.batchSize : undefined,
      goals: Array.isArray(source?.goals) ? source.goals.filter(Boolean) : [],
      keyEvents: Array.isArray(source?.keyEvents) ? source.keyEvents.filter(Boolean) : [],
    })

    cursor = endChapter + 1
  }

  if (normalized.length > 0) {
    normalized[normalized.length - 1].endChapter = normalizedTotal
  }

  return normalized
}

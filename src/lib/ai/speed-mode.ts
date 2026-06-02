import { AIVendor } from '@/types'

// 新版生成模式：从三个简化为两个
export const generationSpeedModes = ['FAST_ACCEPTANCE', 'FINAL_POLISH'] as const
export type GenerationSpeedMode = typeof generationSpeedModes[number]

// 兼容旧模式映射
const legacyModeMap: Record<string, GenerationSpeedMode> = {
  fast: 'FAST_ACCEPTANCE',
  quick_acceptance: 'FAST_ACCEPTANCE',
  balanced: 'FINAL_POLISH',
  balanced_quality: 'FINAL_POLISH',
  quality: 'FINAL_POLISH',
  polished_quality: 'FINAL_POLISH',
}

export type GenerationRole =
  | 'blueprint'
  | 'arc_plan'
  | 'planner'
  | 'writer'
  | 'polisher'
  | 'reviewer'
  | 'revision'
  | 'validator'
  | 'deslopper'
  | 'summarizer'
  | 'stream'

const mimoModelByMode: Record<GenerationSpeedMode, Record<GenerationRole, string>> = {
  FAST_ACCEPTANCE: {
    blueprint: 'mimo-v2.5',
    arc_plan: 'mimo-v2.5',
    planner: 'mimo-v2.5',
    writer: 'mimo-v2.5',
    polisher: 'mimo-v2.5',
    reviewer: 'mimo-v2.5',
    revision: 'mimo-v2.5',
    validator: 'mimo-v2.5',
    deslopper: 'mimo-v2.5',
    summarizer: 'mimo-v2.5',
    stream: 'mimo-v2.5',
  },
  FINAL_POLISH: {
    blueprint: 'mimo-v2.5-pro',
    arc_plan: 'mimo-v2.5-pro',
    planner: 'mimo-v2.5-pro',
    writer: 'mimo-v2.5-pro',
    polisher: 'mimo-v2.5-pro',
    reviewer: 'mimo-v2.5-pro',
    revision: 'mimo-v2.5-pro',
    validator: 'mimo-v2.5-pro',
    deslopper: 'mimo-v2.5-pro',
    summarizer: 'mimo-v2.5-pro',
    stream: 'mimo-v2.5-pro',
  },
}

export function normalizeGenerationSpeedMode(value: unknown): GenerationSpeedMode {
  if (typeof value === 'string') {
    // 先检查是否已经是新模式
    if (generationSpeedModes.includes(value as GenerationSpeedMode)) {
      return value as GenerationSpeedMode
    }
    // 兼容旧模式
    const mapped = legacyModeMap[value.toLowerCase()]
    if (mapped) return mapped
  }
  return 'FINAL_POLISH'
}

export function resolveMiMoModelId(
  speedMode: GenerationSpeedMode,
  role: GenerationRole
): string {
  return mimoModelByMode[speedMode][role]
}

export function resolveModelIdForRole(input: {
  vendor: AIVendor
  currentModelId: string
  speedMode?: GenerationSpeedMode
  role?: GenerationRole
}): string {
  if (input.vendor !== AIVendor.MIMO || !input.role) {
    return input.currentModelId
  }

  return resolveMiMoModelId(input.speedMode || 'FINAL_POLISH', input.role)
}

/**
 * 根据目标中文字数估算 maxTokens
 *
 * 背景：中文 LLM 中 1 个中文字符约等于 1.5-2 个 token，
 * 加上标点、换行等开销，取 2.5x 系数确保模型有足够 token 预算完成目标字数。
 * 之前 1.1x 系数严重低估，导致章节在 ~60% 字数时被硬截断。
 */
export function estimateMaxTokensForTargetWordCount(targetWordCount: number): number {
  return Math.ceil(Math.max(1, targetWordCount) * 2.5)
}

export function resolveEffectiveChapterWordCount(
  targetWordCount: number,
  speedMode: GenerationSpeedMode = 'FINAL_POLISH'
): number {
  const safeTarget = Math.max(1000, Math.floor(targetWordCount || 0))
  const multiplierByMode: Record<GenerationSpeedMode, number> = {
    FAST_ACCEPTANCE: 0.8,
    FINAL_POLISH: 1,
  }

  return Math.max(1000, Math.floor(safeTarget * multiplierByMode[speedMode]))
}

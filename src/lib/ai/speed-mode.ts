import { AIVendor } from '@/types'

export const generationSpeedModes = ['fast', 'balanced', 'quality'] as const
export type GenerationSpeedMode = typeof generationSpeedModes[number]

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
  fast: {
    blueprint: 'mimo-v2-flash',
    arc_plan: 'mimo-v2-flash',
    planner: 'mimo-v2-flash',
    writer: 'mimo-v2.5',
    polisher: 'mimo-v2.5',
    reviewer: 'mimo-v2-flash',
    revision: 'mimo-v2.5',
    validator: 'mimo-v2-flash',
    deslopper: 'mimo-v2.5',
    summarizer: 'mimo-v2-flash',
    stream: 'mimo-v2.5',
  },
  balanced: {
    blueprint: 'mimo-v2.5',
    arc_plan: 'mimo-v2.5',
    planner: 'mimo-v2.5',
    writer: 'mimo-v2.5',
    polisher: 'mimo-v2.5',
    reviewer: 'mimo-v2.5',
    revision: 'mimo-v2.5',
    validator: 'mimo-v2-flash',
    deslopper: 'mimo-v2.5',
    summarizer: 'mimo-v2-flash',
    stream: 'mimo-v2.5',
  },
  quality: {
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
  return generationSpeedModes.includes(value as GenerationSpeedMode)
    ? value as GenerationSpeedMode
    : 'balanced'
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

  return resolveMiMoModelId(input.speedMode || 'balanced', input.role)
}

export function estimateMaxTokensForTargetWordCount(targetWordCount: number): number {
  return Math.ceil(Math.max(1, targetWordCount) * 1.1)
}

export function resolveEffectiveChapterWordCount(
  targetWordCount: number,
  speedMode: GenerationSpeedMode = 'balanced'
): number {
  const safeTarget = Math.max(1000, Math.floor(targetWordCount || 0))
  const multiplierByMode: Record<GenerationSpeedMode, number> = {
    fast: 0.8,
    balanced: 0.9,
    quality: 1,
  }

  return Math.max(1000, Math.floor(safeTarget * multiplierByMode[speedMode]))
}

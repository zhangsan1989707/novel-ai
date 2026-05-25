import { Platform, ArcStage, PlatformTemplate, StorySteering } from '@/types'
import { getPlatformTemplate } from './platform-style'
import { toInternalArcStage, toInternalPlatform } from './production-mapping'

const stageMultipliers: Record<ArcStage, number> = {
  opening: 0.7,
  growth: 1.0,
  expansion: 1.2,
  mid_conflict: 0.8,
  pre_finale: 0.6,
  finale: 0.5,
}

const stageRanges: Record<ArcStage, { min: number; max: number }> = {
  opening: { min: 5, max: 8 },
  growth: { min: 8, max: 12 },
  expansion: { min: 10, max: 15 },
  mid_conflict: { min: 8, max: 12 },
  pre_finale: { min: 5, max: 8 },
  finale: { min: 3, max: 6 },
}

export interface BatchPlanningOptions {
  progressRatio?: number
  stageRemainingChapters?: number
  openPlotlineCount?: number
  steering?: Partial<StorySteering>
  blueprintConstraints?: string[]
  hasFinalBossActive?: boolean
  genre?: string | null
  writingStyle?: string | null
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getGenreFactor(genre?: string | null): number {
  const normalized = (genre || '').toLowerCase()
  if (!normalized) return 1
  if (/(悬疑|推理|mystery|thriller|惊悚)/.test(normalized)) return 0.82
  if (/(言情|romance|轻喜|治愈)/.test(normalized)) return 0.92
  if (/(玄幻|奇幻|仙侠|史诗|fantasy)/.test(normalized)) return 0.96
  if (/(都市|爽文|战神|系统|升级)/.test(normalized)) return 1.08
  return 1
}

function getStyleFactor(writingStyle?: string | null): number {
  const normalized = (writingStyle || '').toLowerCase()
  if (!normalized) return 1
  if (/(细腻|文学|慢热|考据|群像|诗意)/.test(normalized)) return 0.82
  if (/(冷峻|压抑|黑暗|克制)/.test(normalized)) return 0.9
  if (/(爽快|高燃|轻松|快节奏|热血)/.test(normalized)) return 1.08
  return 1
}

export function calculateBatchSize(
  platform: Platform,
  stage: ArcStage,
  worldComplexity: number,
  plotDensity: number,
  options: BatchPlanningOptions = {}
): number {
  const internalPlatform = toInternalPlatform(platform)
  const internalStage = toInternalArcStage(stage)
  const template: PlatformTemplate = getPlatformTemplate(internalPlatform)
  const baseline = template.batchSizeBaseline
  const multiplier = stageMultipliers[internalStage] || 1.0
  const complexityFactor = 0.78 + clamp(worldComplexity, 0, 1) * 0.36
  const densityFactor = 0.82 + clamp(plotDensity, 0, 1.5) * 0.3

  const steering = options.steering || {}
  const fastPaceBoost = ((steering.pace || 0.5) - 0.5) * 0.28
  const conflictBoost = ((steering.conflictIntensity || 0.5) - 0.5) * 0.18
  const mysteryPenalty = ((steering.mysteryDensity || 0.3) - 0.3) * 0.22
  const darknessPenalty = ((steering.darkness || 0.3) - 0.3) * 0.08
  const steeringFactor = clamp(1 + fastPaceBoost + conflictBoost - mysteryPenalty - darknessPenalty, 0.72, 1.22)

  const progressRatio = options.progressRatio ?? 0
  const stageRemaining = options.stageRemainingChapters ?? baseline
  const openPlotlineCount = options.openPlotlineCount ?? 0
  const remainingFactor = stageRemaining <= 8
    ? 0.74
    : stageRemaining <= 12
      ? 0.88
      : stageRemaining >= 24
        ? 1.08
        : 1
  const plotlineFactor = openPlotlineCount >= 10
    ? 0.78
    : openPlotlineCount >= 6
      ? 0.9
      : openPlotlineCount <= 2
        ? 1.06
        : 1
  const constraintFactor = (options.blueprintConstraints || []).some(item => /禁止提前结局|只解决阶段矛盾|保留扩张空间/.test(item))
    ? (progressRatio < 0.85 ? 0.92 : 0.98)
    : 1
  const villainFactor = options.hasFinalBossActive && progressRatio < 0.85 ? 0.88 : 1
  const progressFactor = progressRatio < 0.2
    ? 1.06
    : progressRatio > 0.78
      ? 0.84
      : 1
  const genreFactor = getGenreFactor(options.genre)
  const styleFactor = getStyleFactor(options.writingStyle)

  const raw = Math.round(
    baseline *
    multiplier *
    complexityFactor *
    densityFactor *
    steeringFactor *
    remainingFactor *
    plotlineFactor *
    constraintFactor *
    villainFactor *
    progressFactor *
    genreFactor *
    styleFactor
  )

  const range = stageRanges[internalStage] || { min: 5, max: 12 }
  return clamp(raw, range.min, range.max)
}

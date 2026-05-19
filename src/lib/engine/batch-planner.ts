import { Platform, ArcStage, PlatformTemplate } from '@/types'
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

export function calculateBatchSize(
  platform: Platform,
  stage: ArcStage,
  worldComplexity: number,
  plotDensity: number
): number {
  const internalPlatform = toInternalPlatform(platform)
  const internalStage = toInternalArcStage(stage)
  const template: PlatformTemplate = getPlatformTemplate(internalPlatform)
  const baseline = template.batchSizeBaseline
  const multiplier = stageMultipliers[internalStage] || 1.0
  const complexityFactor = 0.8 + worldComplexity * 0.4
  const densityFactor = 0.8 + plotDensity * 0.4

  const raw = Math.round(baseline * multiplier * complexityFactor * densityFactor)
  return Math.max(10, Math.min(30, raw))
}

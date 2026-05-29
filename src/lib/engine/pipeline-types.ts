import type { PopularFictionProfile } from './popular-fiction'
import { toInternalArcStage } from './production-mapping'

export type ChapterOutline = {
  chapterNumber: number
  title: string
  summary: string
}

export type BlueprintOutput = {
  corePitch?: string
  worldDirection?: string
  mainlineDirection?: string
  growthDirection?: string
  endingDirection?: string
  platformStrategy?: string
  genreStrategy?: string
  styleStrategy?: string
  popularFictionProfile?: PopularFictionProfile
  constraints?: string[]
}

export type ArcPlanOutput = {
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

export type PlotlineGuard = {
  description: string
  plannedAt?: number | null
  plantedAt?: number | null
  status?: string | null
}

export const STRATEGY_PREFIXES = {
  platform: '策略-平台',
  genre: '策略-题材',
  style: '策略-风格',
} as const

export const STAGE_BATCH_RANGES: Record<ReturnType<typeof toInternalArcStage>, { min: number; max: number }> = {
  opening: { min: 5, max: 8 },
  growth: { min: 8, max: 12 },
  expansion: { min: 10, max: 15 },
  mid_conflict: { min: 8, max: 12 },
  pre_finale: { min: 5, max: 8 },
  finale: { min: 3, max: 6 },
}

export type ResumePlan = {
  startFrom: 'blueprint' | 'arc_plan' | 'chapter_list' | 'write'
  resumeFromChapterNumber?: number
}
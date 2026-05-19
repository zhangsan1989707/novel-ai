import type { ArcStage, Platform } from '@/types'

export function toInternalPlatform(value: unknown): Platform {
  const normalized = String(value || 'qidian').toLowerCase()
  if (normalized === 'fanqie') return 'fanqie'
  if (normalized === 'feilu') return 'feilu'
  if (normalized === 'jinjiang') return 'jinjiang'
  if (normalized === 'qimao') return 'qimao'
  return 'qidian'
}

export function toInternalArcStage(value: unknown): ArcStage {
  const normalized = String(value || 'opening').toLowerCase()
  if (normalized === 'growth') return 'growth'
  if (normalized === 'expansion') return 'expansion'
  if (normalized === 'mid_conflict') return 'mid_conflict'
  if (normalized === 'pre_finale') return 'pre_finale'
  if (normalized === 'finale') return 'finale'
  return 'opening'
}

export function toPrismaArcStage(value: unknown): string {
  return toInternalArcStage(value).toUpperCase()
}

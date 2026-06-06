import type { PromptContext } from '@/lib/ai/types'
import type { NovelProject, NovelChapter } from '@prisma/client'

export interface ProjectDTO {
  id: number
  title: string
  description?: string
  genre?: string
  writingStyle?: string
  outline?: string
  worldSetting?: string
  powerSystem?: string
  protagonistProfile?: string
  protagonistGoal?: string
  antagonistSetting?: string
  endingPlan?: string
  writingPrompt?: string
  coverImage?: string
  targetWordCount?: number
  totalVolumes?: number
  outlineStages?: unknown
  aiModelConfig?: {
    vendor: string
    modelId: string
    apiEndpoint?: string
    apiKey?: string
  }
}

export interface ChapterDTO {
  id: number
  chapterNumber: number
  title: string
  status: string
  content?: string
  summary?: string
  generationPrompt?: string
  generationParams?: unknown
  virtualWriter?: {
    styleFeatures?: string
    vocabularyFeatures?: string
    sentenceFeatures?: string
    rhetoricFeatures?: string
    themeFeatures?: string
  }
}

export function toProjectDTO(
  raw: NovelProject & { aiModelConfig?: { vendor: string; modelId: string; apiKey?: string | null; apiEndpoint?: string | null } | null }
): ProjectDTO {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? undefined,
    genre: raw.genre ?? undefined,
    writingStyle: raw.writingStyle ?? undefined,
    outline: raw.outline ?? undefined,
    worldSetting: raw.worldSetting ?? undefined,
    powerSystem: raw.powerSystem ?? undefined,
    protagonistProfile: raw.protagonistProfile ?? undefined,
    protagonistGoal: raw.protagonistGoal ?? undefined,
    antagonistSetting: raw.antagonistSetting ?? undefined,
    endingPlan: raw.endingPlan ?? undefined,
    writingPrompt: raw.writingPrompt ?? undefined,
    coverImage: raw.coverImage ?? undefined,
    targetWordCount: raw.targetWordCount ?? undefined,
    totalVolumes: raw.totalVolumes ?? undefined,
    outlineStages: raw.outlineStages ?? undefined,
    aiModelConfig: raw.aiModelConfig
      ? {
          vendor: raw.aiModelConfig.vendor,
          modelId: raw.aiModelConfig.modelId,
          apiEndpoint: raw.aiModelConfig.apiEndpoint ?? undefined,
          apiKey: raw.aiModelConfig.apiKey ?? undefined,
        }
      : undefined,
  }
}

export function toChapterDTO(raw: NovelChapter & { virtualWriter?: { styleFeatures?: string | null; vocabularyFeatures?: string | null; sentenceFeatures?: string | null; rhetoricFeatures?: string | null; themeFeatures?: string | null } | null }): ChapterDTO {
  return {
    id: raw.id,
    chapterNumber: raw.chapterNumber,
    title: raw.title,
    status: raw.status,
    summary: raw.summary ?? undefined,
    content: raw.content ?? undefined,
    generationPrompt: raw.generationPrompt ?? undefined,
    generationParams: raw.generationParams ?? undefined,
    virtualWriter: raw.virtualWriter ? {
      styleFeatures: raw.virtualWriter.styleFeatures ?? undefined,
      vocabularyFeatures: raw.virtualWriter.vocabularyFeatures ?? undefined,
      sentenceFeatures: raw.virtualWriter.sentenceFeatures ?? undefined,
      rhetoricFeatures: raw.virtualWriter.rhetoricFeatures ?? undefined,
      themeFeatures: raw.virtualWriter.themeFeatures ?? undefined,
    } : undefined,
  }
}

export function isValidProjectId(id: string | number): id is number {
  if (typeof id === 'number') return id > 0
  const parsed = parseInt(id)
  return !isNaN(parsed) && parsed > 0
}

export function isValidChapterId(id: string | number): id is number {
  if (typeof id === 'number') return id > 0
  const parsed = parseInt(id)
  return !isNaN(parsed) && parsed > 0
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function assertProjectId(id: string | number): number {
  if (!isValidProjectId(id)) {
    throw new ValidationError('Invalid project ID', 'INVALID_PROJECT_ID')
  }
  return typeof id === 'number' ? id : parseInt(id)
}

export function assertChapterId(id: string | number): number {
  if (!isValidChapterId(id)) {
    throw new ValidationError('Invalid chapter ID', 'INVALID_CHAPTER_ID')
  }
  return typeof id === 'number' ? id : parseInt(id)
}

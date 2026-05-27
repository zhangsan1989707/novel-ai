import type { GenerationSpeedMode } from '@/lib/ai/speed-mode'

export type PipelineAgentPhase =
  | 'planner'
  | 'writer'
  | 'summarizer'
  | 'db_write'
  | 'polisher'
  | 'validator'
  | 'deslopper'
  | 'research'
  | 'system'

export type PipelineChapterTimings = Record<string, number | undefined>

export interface PipelineChapterRuntime {
  chapterNumber: number
  title?: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  currentAgent?: string
  currentPhase?: string
  currentWordCount: number
  targetWordCount: number
  startedAt: string
  updatedAt: string
  completedAt?: string
  lastTokenAt?: string
  phaseTimings: PipelineChapterTimings
  totalDurationMs?: number
  qualityStatus?: string
  warning?: string
  error?: string
  lastMessage?: string
}

export interface PipelineRuntimeState {
  currentChapter: PipelineChapterRuntime | null
  recentChapters: PipelineChapterRuntime[]
  speedMode?: GenerationSpeedMode
  lastEventAt?: string
  lastPhase?: string
  lastPhaseDurationMs?: number
  streamRevision: number
}

const MAX_RECENT_CHAPTERS = 8

export function createPipelineRuntimeState(speedMode?: GenerationSpeedMode): PipelineRuntimeState {
  return {
    currentChapter: null,
    recentChapters: [],
    speedMode,
    streamRevision: 0,
  }
}

export function sanitizePipelineRuntime(value: unknown): PipelineRuntimeState {
  const candidate = value && typeof value === 'object' ? value as Partial<PipelineRuntimeState> : {}
  return {
    currentChapter: isChapterRuntime(candidate.currentChapter) ? candidate.currentChapter : null,
    recentChapters: Array.isArray(candidate.recentChapters)
      ? candidate.recentChapters.filter(isChapterRuntime).slice(0, MAX_RECENT_CHAPTERS)
      : [],
    speedMode: isSpeedMode(candidate.speedMode) ? candidate.speedMode : undefined,
    lastEventAt: typeof candidate.lastEventAt === 'string' ? candidate.lastEventAt : undefined,
    lastPhase: typeof candidate.lastPhase === 'string' ? candidate.lastPhase : undefined,
    lastPhaseDurationMs: typeof candidate.lastPhaseDurationMs === 'number' ? candidate.lastPhaseDurationMs : undefined,
    streamRevision: typeof candidate.streamRevision === 'number' ? candidate.streamRevision : 0,
  }
}

function isSpeedMode(value: unknown): value is GenerationSpeedMode {
  return value === 'fast' || value === 'balanced' || value === 'quality'
}

export function archiveChapterRuntime(
  runtime: PipelineRuntimeState,
  chapter: PipelineChapterRuntime
): PipelineRuntimeState {
  const deduped = runtime.recentChapters.filter(item => item.chapterNumber !== chapter.chapterNumber)
  return {
    ...runtime,
    currentChapter: null,
    recentChapters: [chapter, ...deduped].slice(0, MAX_RECENT_CHAPTERS),
    lastEventAt: new Date().toISOString(),
    streamRevision: runtime.streamRevision + 1,
  }
}

function isChapterRuntime(value: unknown): value is PipelineChapterRuntime {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<PipelineChapterRuntime>
  return typeof item.chapterNumber === 'number'
    && typeof item.status === 'string'
    && typeof item.currentWordCount === 'number'
    && typeof item.targetWordCount === 'number'
    && typeof item.startedAt === 'string'
    && typeof item.updatedAt === 'string'
    && !!item.phaseTimings
}

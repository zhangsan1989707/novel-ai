import { AnalysisDimension } from '@/types'

export interface ReadingExperienceData {
  scores?: Record<string, number>
  readingFeel?: {
    hookSummary?: string
    wowPointSummary?: string
    fatigueSummary?: string
    chapterEndingSummary?: string
  }
  highlightChapters?: Array<{ chapter?: number; reason?: string }>
  fatigueChapters?: Array<{ chapterRange?: string; reason?: string }>
  readerTakeaway?: string
}

export const scoreLabels: Record<string, string> = {
  openingHook: '开篇抓力',
  pacing: '节奏推进',
  immersion: '沉浸感',
  chapterEndingHook: '章尾钩子',
  readerRetention: '追读驱动',
}

export function volumeLabel(vol: number) {
  if (vol === -1) return '整书'
  if (vol === 0) return '全卷'
  return `第${vol}卷`
}

export function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function extractChapterNo(anchorId: string) {
  const match = anchorId.match(/^(?:chapter-no|foreshadow-chapter|timeline-stage|plot-turning)-(\d+)$/)
  return match ? Number(match[1]) : null
}

export function chapterMatchesAnalysis(
  chapterNo: number,
  dimension: AnalysisDimension,
  data: Record<string, unknown>
) {
  switch (dimension) {
    case AnalysisDimension.CHAPTER_STRUCTURE: {
      const chapters = Array.isArray(data.chapters) ? data.chapters as Array<Record<string, unknown>> : []
      const current = chapters.some((chapter, index) => Number(chapter.number || index + 1) === chapterNo)
      const slow = Array.isArray(data.slowSections)
        ? (data.slowSections as Array<Record<string, unknown>>).some(item => rangeStart(stringValue(item.chapterRange || ''), 0) === chapterNo)
        : false
      const peak = Array.isArray(data.peakSections)
        ? (data.peakSections as Array<Record<string, unknown>>).some(item => rangeStart(stringValue(item.chapterRange || ''), 0) === chapterNo)
        : false
      return current || slow || peak || chapters.length === 0
    }
    case AnalysisDimension.FORESHADOWING: {
      const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : []
      return items.some(item => Number(item.chapter || 0) === chapterNo) || items.length === 0
    }
    case AnalysisDimension.PLOT_LINE: {
      const turningPoints = Array.isArray(data.turningPoints) ? data.turningPoints as Array<Record<string, unknown>> : []
      return turningPoints.some(item => Number(item.chapter || 0) === chapterNo) || turningPoints.length === 0
    }
    case AnalysisDimension.STORY_OVERVIEW: {
      const outline = (data.outline || {}) as Record<string, unknown>
      const stages = Array.isArray(outline.stageBreakdown) ? outline.stageBreakdown as Array<Record<string, unknown>> : []
      return stages.some(stage => {
        const range = stringValue(stage.chapterRange)
        const start = rangeStart(range, 0)
        if (start === chapterNo) return true
        const endMatch = range.match(/(\d+)\s*[-~]\s*(\d+)/)
        if (endMatch) {
          return chapterNo >= Number(endMatch[1]) && chapterNo <= Number(endMatch[2])
        }
        return false
      }) || stages.length === 0
    }
    case AnalysisDimension.READING_EXPERIENCE: {
      const highlights = Array.isArray(data.highlightChapters) ? data.highlightChapters as Array<{ chapter?: number }> : []
      const fatigue = Array.isArray(data.fatigueChapters) ? data.fatigueChapters as Array<{ chapterRange?: string }> : []
      return highlights.some(item => Number(item.chapter || 0) === chapterNo) ||
        fatigue.some(item => rangeStart(item.chapterRange || '', 0) === chapterNo) ||
        (!highlights.length && !fatigue.length)
    }
    case AnalysisDimension.CHARACTER_RELATION:
    case AnalysisDimension.CHARACTER_ARC:
    case AnalysisDimension.WORLD_SETTING:
    default:
      return true
  }
}

export function parseChapterMark(value: string) {
  const match = value.match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

export function rangeStart(value: string, fallback: number) {
  const match = value.match(/(\d+)/)
  return match ? Number(match[1]) : fallback
}
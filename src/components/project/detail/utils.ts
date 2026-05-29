import type { ProjectChapter } from '@/hooks/useProjectDetail'
import { pipelineStatusMap, pipelineStepMap, speedModeOptions } from './constants'
import type { GenerationSpeedMode } from '@/lib/ai/speed-mode'

export function getSpeedModeDescription(speedMode: GenerationSpeedMode) {
  return speedModeOptions.find(option => option.value === speedMode)?.description || ''
}

export function getPipelineStatusLabel(status: string) {
  return pipelineStatusMap[status] || status
}

export function getPipelineStepLabel(step: string) {
  return pipelineStepMap[step] || step || '等待中'
}

export function formatDuration(durationMs?: number) {
  if (!durationMs && durationMs !== 0) return '-'
  const seconds = Math.round(durationMs / 1000)
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60
  return `${minutes} 分 ${remainSeconds} 秒`
}

interface ArcPlan {
  arcNumber: number
  name: string
  startChapter?: number
  endChapter?: number | null
  chapters?: ProjectChapter[]
}

export function groupChaptersByArc(project: { chapters: ProjectChapter[]; arcPlans?: ArcPlan[] }) {
  const groups: Array<{ arcName: string; arcNumber: number; chapters: ProjectChapter[] }> = []
  const assignedChapterIds = new Set<number>()

  if (project.arcPlans?.length) {
    for (const arc of project.arcPlans) {
      const rangedChapters = typeof arc.startChapter === 'number'
        ? project.chapters.filter(chapter => {
            if (assignedChapterIds.has(chapter.id)) return false
            if (chapter.chapterNumber < arc.startChapter!) return false
            if (typeof arc.endChapter === 'number' && chapter.chapterNumber > arc.endChapter) return false
            return true
          })
        : []
      const chapters = arc.chapters?.length ? arc.chapters : rangedChapters
      chapters.forEach(chapter => assignedChapterIds.add(chapter.id))

      groups.push({
        arcName: arc.name,
        arcNumber: arc.arcNumber,
        chapters,
      })
    }
  }

  const remainingChapters = project.chapters.filter(chapter => !assignedChapterIds.has(chapter.id))

  if (remainingChapters.length > 0) {
    groups.push({
      arcName: groups.length === 0 ? '' : '未分阶段章节',
      arcNumber: (groups.at(-1)?.arcNumber || 0) + 1,
      chapters: remainingChapters,
    })
  }

  return groups
}

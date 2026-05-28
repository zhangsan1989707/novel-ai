import { describe, it, expect } from 'vitest'
import {
  getSpeedModeDescription,
  getPipelineStatusLabel,
  getPipelineStepLabel,
  formatDuration,
  groupChaptersByArc,
} from '@/components/project/detail/utils'
import {
  chapterStatusMap,
  projectStatusMap,
  pipelineStatusMap,
  pipelineStepMap,
  speedModeOptions,
  speedModeLabels,
  defaultSteeringValues,
} from '@/components/project/detail/constants'
import type { ProjectChapter } from '@/hooks/useProjectDetail'

describe('project-detail constants', () => {
  it('chapterStatusMap covers all statuses', () => {
    expect(chapterStatusMap.DRAFT).toBeDefined()
    expect(chapterStatusMap.GENERATING).toBeDefined()
    expect(chapterStatusMap.COMPLETED).toBeDefined()
    expect(chapterStatusMap.REVIEWING).toBeDefined()
  })

  it('projectStatusMap covers all statuses', () => {
    expect(projectStatusMap.DRAFT).toBeDefined()
    expect(projectStatusMap.WRITING).toBeDefined()
    expect(projectStatusMap.COMPLETED).toBeDefined()
    expect(projectStatusMap.PAUSED).toBeDefined()
  })

  it('pipelineStatusMap has correct Chinese labels', () => {
    expect(pipelineStatusMap.IDLE).toBe('空闲')
    expect(pipelineStatusMap.RUNNING).toBe('运行中')
    expect(pipelineStatusMap.COMPLETED).toBe('已完成')
    expect(pipelineStatusMap.FAILED).toBe('失败')
  })

  it('pipelineStepMap has correct Chinese labels', () => {
    expect(pipelineStepMap.BLUEPRINT).toBe('蓝图生成')
    expect(pipelineStepMap.WRITER).toBe('正文写作')
    expect(pipelineStepMap.VALIDATOR).toBe('一致性校验')
  })

  it('speedModeOptions has 3 modes', () => {
    expect(speedModeOptions).toHaveLength(3)
    expect(speedModeOptions.map(o => o.value)).toEqual(['fast', 'balanced', 'quality'])
  })

  it('speedModeLabels has correct labels', () => {
    expect(speedModeLabels.fast).toBe('快速验收')
    expect(speedModeLabels.balanced).toBe('均衡生成')
    expect(speedModeLabels.quality).toBe('精修质量')
  })

  it('defaultSteeringValues has all required fields', () => {
    expect(defaultSteeringValues.pace).toBe(0.5)
    expect(defaultSteeringValues.darkness).toBe(0.3)
    expect(defaultSteeringValues.humor).toBe(0.3)
    expect(defaultSteeringValues.romance).toBe(0.2)
    expect(defaultSteeringValues.powerGrowth).toBe(0.5)
  })
})

describe('project-detail utils', () => {
  describe('getSpeedModeDescription', () => {
    it('returns description for valid mode', () => {
      expect(getSpeedModeDescription('fast')).toContain('跳过重型审稿链')
    })

    it('returns empty string for unknown mode', () => {
      expect(getSpeedModeDescription('unknown' as any)).toBe('')
    })
  })

  describe('getPipelineStatusLabel', () => {
    it('returns Chinese label for known status', () => {
      expect(getPipelineStatusLabel('RUNNING')).toBe('运行中')
    })

    it('returns original status for unknown', () => {
      expect(getPipelineStatusLabel('UNKNOWN')).toBe('UNKNOWN')
    })
  })

  describe('getPipelineStepLabel', () => {
    it('returns Chinese label for known step', () => {
      expect(getPipelineStepLabel('WRITER')).toBe('正文写作')
    })

    it('returns fallback for empty string', () => {
      expect(getPipelineStepLabel('')).toBe('等待中')
    })
  })

  describe('formatDuration', () => {
    it('formats seconds correctly', () => {
      expect(formatDuration(5000)).toBe('5 秒')
    })

    it('formats minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1 分 30 秒')
    })

    it('returns dash for undefined', () => {
      expect(formatDuration(undefined)).toBe('-')
    })

    it('handles zero', () => {
      expect(formatDuration(0)).toBe('0 秒')
    })
  })

  describe('groupChaptersByArc', () => {
    const makeChapter = (id: number, chapterNumber: number): ProjectChapter => ({
      id,
      chapterNumber,
      title: `Chapter ${chapterNumber}`,
      wordCount: 1000,
      status: 'COMPLETED',
      sortOrder: chapterNumber,
    })

    it('groups chapters by arc plans', () => {
      const project = {
        chapters: [makeChapter(1, 1), makeChapter(2, 2), makeChapter(3, 3)],
        arcPlans: [
          { arcNumber: 1, name: 'Arc 1', chapters: [makeChapter(1, 1), makeChapter(2, 2)] },
          { arcNumber: 2, name: 'Arc 2', chapters: [makeChapter(3, 3)] },
        ],
      }
      const groups = groupChaptersByArc(project)
      expect(groups).toHaveLength(2)
      expect(groups[0].arcName).toBe('Arc 1')
      expect(groups[0].chapters).toHaveLength(2)
    })

    it('puts unassigned chapters in a separate group', () => {
      const project = {
        chapters: [makeChapter(1, 1), makeChapter(2, 2), makeChapter(3, 3)],
        arcPlans: [
          { arcNumber: 1, name: 'Arc 1', chapters: [makeChapter(1, 1)] },
        ],
      }
      const groups = groupChaptersByArc(project)
      expect(groups).toHaveLength(2)
      expect(groups[1].arcName).toBe('未分阶段章节')
      expect(groups[1].chapters).toHaveLength(2)
    })

    it('handles no arc plans', () => {
      const project = {
        chapters: [makeChapter(1, 1), makeChapter(2, 2)],
      }
      const groups = groupChaptersByArc(project)
      expect(groups).toHaveLength(1)
      expect(groups[0].chapters).toHaveLength(2)
    })
  })
})

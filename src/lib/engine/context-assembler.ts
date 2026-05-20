import { logger } from '../logger'
import { buildChapterMemoryPack } from '@/lib/memory'

// ================================
// 摘要类型
// ================================

export interface ChapterSummary {
  chapterNo: number
  title?: string
  summary: string
  keyEvents: string[]
  emotionalTone?: string
  importanceScore: number
}

export interface VolumeSummary {
  volumeNo: number
  summary: string
  keyEvents: string[]
  emotionalArc: Array<{ chapterNo: number; value: number }>
  chapterOverviews: Array<{ chapterNo: number; title?: string; summary: string }>
}

export interface BookSummary {
  summary: string
  mainPlot: string
  subPlots: string[]
  characterArcs: Array<{ characterId: string; name?: string; arcDescription: string }>
  thematicElements: string[]
  totalPlotlines: number
  resolvedPlotlines: number
  openPlotlines: number
}

export interface ContextConfig {
  maxTokens: number
  tokenBudget: {
    bookSummary: number
    volumeSummaries: number
    chapterSummaries: number
  }
  recentChapterCount: number
  recentVolumeCount: number
}

export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  maxTokens: 32000,
  tokenBudget: {
    bookSummary: 2000,
    volumeSummaries: 5000,
    chapterSummaries: 25000,
  },
  recentChapterCount: 10,
  recentVolumeCount: 3,
}

/**
 * 兼容层上下文组装器
 * 旧实现已收敛到 memory pack，这里只保留外部 API。
 */
export class ContextAssembler {
  private config: ContextConfig

  constructor(config: Partial<ContextConfig> = {}) {
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config }
  }

  async assembleContext(projectId: number, targetChapterNo: number): Promise<string> {
    logger.info({ projectId, targetChapterNo }, 'Assembling context from memory pack')

    const memoryPack = await buildChapterMemoryPack(projectId, targetChapterNo, {
      recentChapterCount: this.config.recentChapterCount,
      recentVolumeCount: this.config.recentVolumeCount,
      characterLimit: 10,
      plotlineLimit: 15,
      researchLimit: 3,
    })

    return memoryPack.writerContext
  }
}

export const contextAssembler = new ContextAssembler()

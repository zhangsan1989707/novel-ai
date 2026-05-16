import { prisma } from '../prisma'
import { logger } from '../logger'

// ================================
// 摘要类型
// ================================

export interface ChapterSummary {
  chapterNo: number
  title?: string
  summary: string
  keyEvents: string[]
  emotionalTone?: string
  importanceScore: number // 0-100
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

// ================================
// 默认配置
// ================================

export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  maxTokens: 32000,
  tokenBudget: {
    bookSummary: 2000,
    volumeSummaries: 5000,
    chapterSummaries: 25000
  },
  recentChapterCount: 10,
  recentVolumeCount: 3
}

// ================================
// 智能上下文组装器
// ================================

export class ContextAssembler {
  private config: ContextConfig

  constructor(config: Partial<ContextConfig> = {}) {
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config }
  }

  // ================================
  // 主方法：组装完整上下文
  // ================================

  async assembleContext(
    projectId: number,
    targetChapterNo: number
  ): Promise<string> {
    logger.info(
      { projectId, targetChapterNo },
      'Assembling context'
    )

    const parts: string[] = []

    // 1. 获取全书摘要（始终包含）
    const bookSummary = await this.getBookSummary(projectId)
    if (bookSummary) {
      parts.push(this.formatBookSummary(bookSummary))
    }

    // 2. 获取最近的卷摘要
    const volumeSummaries = await this.getRecentVolumeSummaries(
      projectId,
      targetChapterNo
    )
    for (const volSummary of volumeSummaries) {
      parts.push(this.formatVolumeSummary(volSummary))
    }

    // 3. 获取最近的章节摘要（按重要性排序）
    const chapterSummaries = await this.getRecentChapterSummaries(
      projectId,
      targetChapterNo
    )
    for (const chapterSummary of chapterSummaries) {
      parts.push(this.formatChapterSummary(chapterSummary))
    }

    // 4. 获取未回收的伏笔
    const openPlotlines = await this.getOpenPlotlines(projectId)
    if (openPlotlines.length > 0) {
      parts.push(this.formatPlotlines(openPlotlines))
    }

    // 5. 获取角色状态
    const characters = await this.getCharacterStates(projectId, targetChapterNo)
    if (characters.length > 0) {
      parts.push(this.formatCharacters(characters))
    }

    // 合并并检查长度（这里简化处理）
    const context = parts.join('\n\n---\n\n')

    logger.info(
      { projectId, targetChapterNo, contextLength: context.length },
      'Context assembled'
    )

    return context
  }

  // ================================
  // 获取数据的方法
  // ================================

  private async getBookSummary(projectId: number): Promise<BookSummary | null> {
    const summary = await prisma.bookSummary.findUnique({
      where: { projectId }
    })
    if (!summary) return null

    return {
      summary: summary.summary,
      mainPlot: summary.mainPlot,
      subPlots: summary.subPlots,
      characterArcs: summary.characterArcs as any[],
      thematicElements: summary.thematicElements,
      totalPlotlines: summary.totalPlotlines,
      resolvedPlotlines: summary.resolvedPlotlines,
      openPlotlines: summary.openPlotlines
    }
  }

  private async getRecentVolumeSummaries(
    projectId: number,
    targetChapterNo: number
  ): Promise<VolumeSummary[]> {
    // 计算目标章节所在的卷（简化处理）
    const chaptersPerVolume = 25
    const targetVolume = Math.ceil(targetChapterNo / chaptersPerVolume)
    
    const summaries = await prisma.volumeSummary.findMany({
      where: {
        projectId,
        volumeNumber: {
          gte: Math.max(1, targetVolume - this.config.recentVolumeCount),
          lte: targetVolume
        }
      },
      orderBy: { volumeNumber: 'desc' }
    })

    return summaries.map(s => ({
      volumeNo: s.volumeNumber,
      summary: s.summary,
      keyEvents: s.keyEvents,
      emotionalArc: s.emotionalArc as any[],
      chapterOverviews: []
    }))
  }

  private async getRecentChapterSummaries(
    projectId: number,
    targetChapterNo: number
  ): Promise<ChapterSummary[]> {
    const summaries = await prisma.chapterSummary.findMany({
      where: {
        projectId,
        chapterNo: {
          gte: Math.max(1, targetChapterNo - this.config.recentChapterCount),
          lt: targetChapterNo
        }
      },
      orderBy: { chapterNo: 'desc' }
    })

    // 按重要性排序（情绪强烈程度、包含伏笔等）
    const withScores = summaries.map(s => ({
      chapterNo: s.chapterNo,
      title: undefined,
      summary: s.summary,
      keyEvents: s.keyEvents,
      emotionalTone: s.emotionalTone ?? undefined,
      importanceScore: this.calculateImportance(s)
    }))

    // 重要性排序，但仍然保持时间顺序
    return withScores
      .sort((a, b) => {
        const scoreDiff = b.importanceScore - a.importanceScore
        if (Math.abs(scoreDiff) > 30) return scoreDiff
        return b.chapterNo - a.chapterNo
      })
  }

  private async getOpenPlotlines(projectId: number): Promise<Array<{
    id: string
    description: string
    plantedAt: number
  }>> {
    const plotlines = await prisma.plotline.findMany({
      where: {
        projectId,
        status: 'OPEN'
      },
      orderBy: { plantedAt: 'desc' }
    })

    return plotlines.map(p => ({
      id: p.id,
      description: p.description,
      plantedAt: p.plantedAt
    }))
  }

  private async getCharacterStates(
    projectId: number,
    targetChapterNo: number
  ): Promise<Array<{
    id: string
    name: string
    role: string
    currentState: unknown
  }>> {
    const characters = await prisma.character.findMany({
      where: {
        projectId,
        lastUpdated: {
          gte: Math.max(1, targetChapterNo - 20)
        }
      }
    })

    return characters.map(c => ({
      id: c.id,
      name: c.name,
      role: c.role,
      currentState: c.currentState
    }))
  }

  // ================================
  // 辅助方法
  // ================================

  private calculateImportance(summary: any): number {
    let score = 50

    // 包含关键事件
    if (summary.keyEvents && summary.keyEvents.length > 0) {
      score += summary.keyEvents.length * 5
    }

    // 情绪强度（假设情绪曲线有记录）
    if (summary.emotionalTone) {
      const intenseEmotions = ['紧张', '高潮', '悲伤', '愤怒']
      if (intenseEmotions.some(e => summary.emotionalTone.includes(e))) {
        score += 20
      }
    }

    // 包含伏笔处理
    if (summary.plantedPlotlines && summary.plantedPlotlines.length > 0) {
      score += 15
    }

    if (summary.resolvedPlotlines && summary.resolvedPlotlines.length > 0) {
      score += 20
    }

    return Math.min(100, score)
  }

  // ================================
  // 格式化方法
  // ================================

  private formatBookSummary(summary: BookSummary): string {
    return `# 全书概览\n\n` +
      `## 核心剧情\n${summary.mainPlot}\n\n` +
      `## 主题元素\n- ${summary.thematicElements.join('\n- ')}\n\n` +
      `## 伏笔状态\n总计: ${summary.totalPlotlines} | 已回收: ${summary.resolvedPlotlines} | 进行中: ${summary.openPlotlines}`
  }

  private formatVolumeSummary(summary: VolumeSummary): string {
    return `# 第 ${summary.volumeNo} 卷概览\n\n${summary.summary}\n\n` +
      `## 关键事件\n- ${summary.keyEvents.slice(0, 5).join('\n- ')}`
  }

  private formatChapterSummary(summary: ChapterSummary): string {
    return `## 第 ${summary.chapterNo} 章${summary.title ? ` - ${summary.title}` : ''}\n\n` +
      `${summary.summary}\n\n` +
      (summary.keyEvents.length > 0
        ? `### 关键事件\n- ${summary.keyEvents.slice(0, 3).join('\n- ')}`
        : '')
  }

  private formatPlotlines(plotlines: Array<{
    id: string
    description: string
    plantedAt: number
  }>): string {
    return `# 未回收的伏笔（${plotlines.length} 个）\n\n` +
      plotlines
        .slice(0, 15)
        .map(p => `- [第 ${p.plantedAt} 章] ${p.description}`)
        .join('\n')
  }

  private formatCharacters(characters: Array<{
    id: string
    name: string
    role: string
    currentState: unknown
  }>): string {
    return `# 当前角色状态\n\n` +
      characters
        .slice(0, 10)
        .map(c => `- ${c.name} (${c.role})`)
        .join('\n')
  }
}

// ================================
// 导出单例
// ================================

export const contextAssembler = new ContextAssembler()

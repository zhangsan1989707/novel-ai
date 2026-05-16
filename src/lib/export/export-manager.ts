import { prisma } from '../prisma'
import { logger } from '../logger'

// ================================
// 导出类型
// ================================

export type ExportFormat = 'TXT' | 'HTML' | 'EPUB' | 'MARKDOWN'

export interface ExportState {
  exportId: string
  projectId: number
  format: ExportFormat
  chapters: number[]
  exportedChapters: number[]
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  progress: number
  downloadUrl?: string
  error?: string
  createdAt: number
  completedAt?: number
}

// ================================
// 导出管理器
// ================================

export class ExportManager {
  private static readonly EXPORT_PREFIX = 'novel-export'

  // ================================
  // 开始导出
  // ================================

  static async startExport(
    projectId: number,
    format: ExportFormat = 'MARKDOWN',
    chapterNos?: number[]
  ): Promise<ExportState> {
    // 1. 获取项目信息
    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      include: { chapters: true }
    })

    if (!project) {
      throw new Error('Project not found')
    }

    // 2. 确定要导出的章节
    let targetChapters = chapterNos || []
    if (targetChapters.length === 0) {
      targetChapters = project.chapters
        .filter(c => c.status === 'COMPLETED')
        .map(c => c.chapterNumber)
        .sort((a, b) => a - b)
    }

    // 3. 检查是否有之前未完成的导出
    const lastExport = await this.getLastExport(projectId)
    if (lastExport && lastExport.status === 'IN_PROGRESS') {
      logger.info(
        { projectId, exportId: lastExport.exportId },
        'Resuming export'
      )
      return this.resumeExport(lastExport.exportId)
    }

    // 4. 创建新的导出状态
    const exportId = this.generateExportId()
    const exportState: ExportState = {
      exportId,
      projectId,
      format,
      chapters: targetChapters,
      exportedChapters: [],
      status: 'PENDING',
      progress: 0,
      createdAt: Date.now()
    }

    logger.info(
      { projectId, exportId, chapterCount: targetChapters.length },
      'Export STARTED'
    )

    // 5. 异步执行导出
    setImmediate(() => {
      this.performExport(exportState).catch(error => {
        logger.error({ exportId, error }, 'Export FAILED')
      })
    })

    return exportState
  }

  // ================================
  // 执行导出
  // ================================

  private static async performExport(state: ExportState): Promise<void> {
    let currentState: ExportState = { ...state, status: 'IN_PROGRESS' }

    try {
      // 从上次中断的位置继续
      const remainingChapters = currentState.chapters.filter(
        ch => !currentState.exportedChapters.includes(ch)
      )

      for (let i = 0; i < remainingChapters.length; i++) {
        const chapterNo = remainingChapters[i]

        // 导出单个章节
        const chapterContent = await this.exportChapter(
          currentState.projectId,
          chapterNo,
          currentState.format
        )

        // 更新进度
        currentState.exportedChapters.push(chapterNo)
        currentState.progress = Math.round(
          (currentState.exportedChapters.length / currentState.chapters.length) * 100
        )

        logger.info(
          { 
            exportId: currentState.exportId, 
            chapterNo, 
            progress: currentState.progress 
          },
          'Exported chapter'
        )

        // 模拟 IO 延迟
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // 完成
      currentState.status = 'COMPLETED'
      currentState.progress = 100
      currentState.completedAt = Date.now()
      currentState.downloadUrl = `/api/novel/projects/${currentState.projectId}/exports/${currentState.exportId}/download`

      logger.info(
        { exportId: currentState.exportId, duration: currentState.completedAt - currentState.createdAt },
        'Export COMPLETED'
      )

    } catch (error) {
      currentState.status = 'FAILED'
      currentState.error = error instanceof Error ? error.message : String(error)
      currentState.completedAt = Date.now()

      logger.error(
        { exportId: currentState.exportId, error },
        'Export FAILED'
      )
    }
  }

  // ================================
  // 恢复导出
  // ================================

  static async resumeExport(exportId: string): Promise<ExportState> {
    const state = await this.getExportState(exportId)
    if (!state) {
      throw new Error('Export not found')
    }

    if (state.status !== 'IN_PROGRESS' && state.status !== 'FAILED') {
      return state
    }

    logger.info({ exportId }, 'Resuming export')

    setImmediate(() => {
      this.performExport(state).catch(error => {
        logger.error({ exportId, error }, 'Export FAILED')
      })
    })

    return state
  }

  // ================================
  // 导出单个章节
  // ================================

  private static async exportChapter(
    projectId: number,
    chapterNo: number,
    format: ExportFormat
  ): Promise<string> {
    const chapter = await prisma.novelChapter.findUnique({
      where: {
        projectId_chapterNumber: { projectId, chapterNumber: chapterNo }
      }
    })

    if (!chapter) {
      throw new Error(`Chapter ${chapterNo} not found`)
    }

    const content = chapter.content || ''
    const title = chapter.title

    switch (format) {
      case 'MARKDOWN':
        return `## 第 ${chapterNo} 章${title ? `: ${title}` : ''}\n\n${content}\n\n`
      case 'HTML':
        return `<h2>第 ${chapterNo} 章${title ? `: ${title}` : ''}</h2>\n\n<p>${content.replace(/\n/g, '</p>\n<p>')}</p>\n\n`
      case 'TXT':
        return `第 ${chapterNo} 章${title ? `: ${title}` : ''}\n\n${content}\n\n`
      default:
        return content
    }
  }

  // ================================
  // 获取导出状态
  // ================================

  static async getExportState(exportId: string): Promise<ExportState | null> {
    // 实际项目中，这里会从数据库或缓存读取
    // 这里简化处理，返回 null
    return null
  }

  static async getLastExport(projectId: number): Promise<ExportState | null> {
    // 实际项目中，这里会从数据库或缓存读取
    return null
  }

  static async getProjectExports(projectId: number): Promise<ExportState[]> {
    // 实际项目中，这里会从数据库或缓存读取
    return []
  }

  // ================================
  // 取消导出
  // ================================

  static async cancelExport(exportId: string): Promise<void> {
    logger.info({ exportId }, 'Export CANCELLED')
  }

  // ================================
  // 生成 ID
  // ================================

  private static generateExportId(): string {
    return `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

export { ExportManager as default }

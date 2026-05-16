/**
 * 批量生成队列
 * 支持队列式批量生成章节
 */

import { logger } from './logger'

export interface BatchGenerationTask {
  id: string
  projectId: number
  startChapter: number
  endChapter: number
  priority: 'high' | 'normal' | 'low'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused'
  progress: number // 0-100
  currentChapter?: number
  createdAt: Date
  updatedAt: Date
  error?: string
  results?: BatchChapterResult[]
}

export interface BatchChapterResult {
  chapterNumber: number
  success: boolean
  content?: string
  error?: string
  duration?: number
}

export interface BatchGenerationOptions {
  maxConcurrent: number // 最大并发数，默认 3
  retryCount: number // 失败重试次数，默认 2
  retryDelay: number // 重试延迟(ms)，默认 5000
  onProgress?: (progress: BatchProgress) => void
  onChapterComplete?: (result: BatchChapterResult) => void
}

export interface BatchProgress {
  taskId: string
  total: number
  completed: number
  failed: number
  currentChapter: number
  progress: number // 0-100
  status: BatchGenerationTask['status']
}

/**
 * 批量生成队列类
 */
export class BatchGenerationQueue {
  private queue: Map<string, BatchGenerationTask> = new Map()
  private runningTasks: Map<string, AbortController> = new Map()
  private options: Required<BatchGenerationOptions>
  private isProcessing = false

  constructor(options: Partial<BatchGenerationOptions> = {}) {
    this.options = {
      maxConcurrent: options.maxConcurrent ?? 3,
      retryCount: options.retryCount ?? 2,
      retryDelay: options.retryDelay ?? 5000,
      onProgress: options.onProgress ?? (() => {}),
      onChapterComplete: options.onChapterComplete ?? (() => {}),
    }
  }

  /**
   * 创建批量生成任务
   */
  createTask(
    projectId: number,
    startChapter: number,
    endChapter: number,
    options?: Partial<Pick<BatchGenerationTask, 'priority'>>
  ): BatchGenerationTask {
    const task: BatchGenerationTask = {
      id: this.generateTaskId(),
      projectId,
      startChapter,
      endChapter,
      priority: options?.priority ?? 'normal',
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      results: [],
    }

    this.queue.set(task.id, task)
    logger.info({ taskId: task.id, projectId, startChapter, endChapter }, 'Batch task created')

    // 如果队列已停止处理，自动开始处理
    if (!this.isProcessing) {
      this.processQueue()
    }

    return task
  }

  /**
   * 暂停任务
   */
  pauseTask(taskId: string): boolean {
    const task = this.queue.get(taskId)
    if (!task || task.status === 'completed' || task.status === 'failed') {
      return false
    }

    const controller = this.runningTasks.get(taskId)
    if (controller) {
      controller.abort()
      this.runningTasks.delete(taskId)
    }

    task.status = 'paused'
    task.updatedAt = new Date()
    logger.info({ taskId }, 'Batch task paused')

    return true
  }

  /**
   * 恢复任务
   */
  resumeTask(taskId: string): boolean {
    const task = this.queue.get(taskId)
    if (!task || task.status !== 'paused') {
      return false
    }

    task.status = 'pending'
    task.updatedAt = new Date()
    logger.info({ taskId }, 'Batch task resumed')

    this.processQueue()
    return true
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const task = this.queue.get(taskId)
    if (!task) {
      return false
    }

    const controller = this.runningTasks.get(taskId)
    if (controller) {
      controller.abort()
      this.runningTasks.delete(taskId)
    }

    task.status = 'failed'
    task.error = 'Task cancelled by user'
    task.updatedAt = new Date()
    logger.info({ taskId }, 'Batch task cancelled')

    return true
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): BatchGenerationTask | undefined {
    return this.queue.get(taskId)
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): BatchGenerationTask[] {
    return Array.from(this.queue.values())
  }

  /**
   * 获取正在运行的任务数量
   */
  getRunningCount(): number {
    return this.runningTasks.size
  }

  /**
   * 清空已完成的任务
   */
  clearCompleted(): void {
    for (const [id, task] of this.queue) {
      if (task.status === 'completed' || task.status === 'failed') {
        this.queue.delete(id)
      }
    }
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    while (this.runningTasks.size < this.options.maxConcurrent) {
      // 按优先级获取下一个待处理任务
      const pendingTasks = Array.from(this.queue.values())
        .filter(t => t.status === 'pending')
        .sort((a, b) => {
          const priorityOrder = { high: 0, normal: 1, low: 2 }
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        })

      const nextTask = pendingTasks[0]
      if (!nextTask) break

      this.executeTask(nextTask)
    }

    this.isProcessing = false
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: BatchGenerationTask): Promise<void> {
    const controller = new AbortController()
    this.runningTasks.set(task.id, controller)

    task.status = 'running'
    task.updatedAt = new Date()

    const totalChapters = task.endChapter - task.startChapter + 1
    let completed = 0
    let failed = 0

    logger.info({ taskId: task.id, totalChapters }, 'Starting batch task execution')

    for (let chapterNo = task.startChapter; chapterNo <= task.endChapter; chapterNo++) {
      // 检查是否被暂停或取消
      if (controller.signal.aborted) {
        logger.info({ taskId: task.id, chapterNo }, 'Batch task aborted')
        break
      }

      const taskRef = this.queue.get(task.id)
      if (taskRef?.status === 'paused') {
        logger.info({ taskId: task.id, chapterNo }, 'Batch task paused')
        break
      }

      task.currentChapter = chapterNo
      task.updatedAt = new Date()

      const startTime = Date.now()
      let success = false
      let retryCount = 0

      while (retryCount <= this.options.retryCount) {
        try {
          // 调用章节生成函数（由外部提供）
          const content = await this.generateChapter(task.projectId, chapterNo, controller.signal)
          
          const result: BatchChapterResult = {
            chapterNumber: chapterNo,
            success: true,
            content,
            duration: Date.now() - startTime,
          }
          
          task.results = task.results || []
          task.results.push(result)
          success = true
          
          this.options.onChapterComplete(result)
          break
        } catch (err) {
          if (controller.signal.aborted) {
            throw err
          }
          
          retryCount++
          if (retryCount <= this.options.retryCount) {
            logger.warn({ taskId: task.id, chapterNo, retryCount }, 'Retrying chapter generation')
            await this.delay(this.options.retryDelay)
          }
        }
      }

      if (success) {
        completed++
      } else {
        failed++
        const result: BatchChapterResult = {
          chapterNumber: chapterNo,
          success: false,
          error: `Failed after ${this.options.retryCount} retries`,
          duration: Date.now() - startTime,
        }
        task.results = task.results || []
        task.results.push(result)
      }

      // 更新进度
      task.progress = Math.round(((completed + failed) / totalChapters) * 100)
      task.updatedAt = new Date()

      const progress: BatchProgress = {
        taskId: task.id,
        total: totalChapters,
        completed,
        failed,
        currentChapter: chapterNo,
        progress: task.progress,
        status: task.status,
      }

      this.options.onProgress(progress)
    }

    // 任务完成
    task.status = failed === totalChapters ? 'failed' : 'completed'
    task.updatedAt = new Date()
    this.runningTasks.delete(task.id)

    logger.info({ taskId: task.id, completed, failed, status: task.status }, 'Batch task completed')

    // 继续处理队列
    this.processQueue()
  }

  /**
   * 生成章节（由外部实现的抽象方法）
   */
  private async generateChapter(
    projectId: number,
    chapterNo: number,
    signal: AbortSignal
  ): Promise<string> {
    // 这里需要外部注入实际的生成逻辑
    // 暂时抛出错误，提示需要实现
    throw new Error('generateChapter must be implemented')
  }

  /**
   * 生成任务 ID
   */
  private generateTaskId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 导出单例
export const batchQueue = new BatchGenerationQueue()

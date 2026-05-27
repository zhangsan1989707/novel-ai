import { logger } from '../logger'
import { DraftManager } from './draft-manager'

// ================================
// 任务类型
// ================================

export type TaskType = 
  | 'GENERATE_CHAPTER'
  | 'GENERATE_SUMMARY'
  | 'ANALYZE_BOOK'
  | 'EXPORT_CHAPTER'

export type TaskStatus = 
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export interface Task {
  id: string
  type: TaskType
  projectId: number
  chapterNo?: number
  status: TaskStatus
  progress: number
  progressMessage: string
  error?: string
  result?: unknown
  createdAt: number
  startedAt?: number
  completedAt?: number
  retryCount: number
  maxRetries: number
  metadata: Record<string, unknown>
}

export interface TaskProgress {
  taskId: string
  status: TaskStatus
  progress: number
  message: string
  result?: unknown
  error?: string
}

// ================================
// 任务事件监听
// ================================

export interface TaskListener {
  onProgress: (progress: TaskProgress) => void
  onComplete: (result: unknown) => void
  onError: (error: string) => void
}

// ================================
// 任务队列管理器
// ================================

export class TaskQueue {
  private tasks: Map<string, Task> = new Map()
  private listeners: Map<string, TaskListener[]> = new Map()
  private running = false
  private worker?: Promise<void>

  // 单例模式
  private static instance: TaskQueue
  static getInstance(): TaskQueue {
    if (!TaskQueue.instance) {
      TaskQueue.instance = new TaskQueue()
    }
    return TaskQueue.instance
  }

  private constructor() {
    if (process.env.NOVEL_AI_LEGACY_TASK_QUEUE === 'true') {
      this.start()
    } else {
      logger.warn('Legacy TaskQueue is disabled; use GenerationJob pipeline routes for real novel production')
    }
  }

  // ================================
  // 队列启动/停止
  // ================================

  start(): void {
    if (process.env.NOVEL_AI_LEGACY_TASK_QUEUE !== 'true') {
      logger.warn('Legacy TaskQueue start skipped; set NOVEL_AI_LEGACY_TASK_QUEUE=true only for legacy tests')
      return
    }
    if (this.running) return
    this.running = true
    this.worker = this.runWorker()
    logger.info('Task queue STARTED')
  }

  async stop(): Promise<void> {
    this.running = false
    if (this.worker) {
      await this.worker
    }
    logger.info('Task queue STOPPED')
  }

  // ================================
  // 添加任务
  // ================================

  addTask(
    type: TaskType,
    projectId: number,
    chapterNo?: number,
    options: {
      maxRetries?: number
      metadata?: Record<string, unknown>
    } = {}
  ): string {
    const taskId = this.generateTaskId()
    const task: Task = {
      id: taskId,
      type,
      projectId,
      chapterNo,
      status: 'PENDING',
      progress: 0,
      progressMessage: 'Waiting in queue',
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      metadata: options.metadata || {}
    }

    this.tasks.set(taskId, task)
    this.notifyListeners(taskId, {
      taskId,
      status: 'PENDING',
      progress: 0,
      message: 'Waiting in queue'
    })

    logger.info(
      { taskId, type, projectId, chapterNo },
      'Task ADDED to queue'
    )

    return taskId
  }

  // ================================
  // 监听任务
  // ================================

  subscribe(taskId: string, listener: TaskListener): () => void {
    if (!this.listeners.has(taskId)) {
      this.listeners.set(taskId, [])
    }
    this.listeners.get(taskId)!.push(listener)

    // 立即发送当前状态
    const task = this.tasks.get(taskId)
    if (task) {
      listener.onProgress({
        taskId,
        status: task.status,
        progress: task.progress,
        message: task.progressMessage
      })
    }

    // 返回取消订阅函数
    return () => {
      const listeners = this.listeners.get(taskId)
      if (listeners) {
        const index = listeners.indexOf(listener)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }
  }

  // ================================
  // 任务操作
  // ================================

  getTask(taskId: string): Task | null {
    return this.tasks.get(taskId) || null
  }

  getTasksByProject(projectId: number): Task[] {
    return Array.from(this.tasks.values())
      .filter(task => task.projectId === projectId)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (task && (task.status === 'PENDING' || task.status === 'RUNNING')) {
      task.status = 'CANCELLED'
      task.progressMessage = 'Cancelled by user'
      this.notifyListeners(taskId, {
        taskId,
        status: 'CANCELLED',
        progress: task.progress,
        message: 'Cancelled by user'
      })
      logger.info({ taskId }, 'Task CANCELLED')
      return true
    }
    return false
  }

  // ================================
  // 更新任务进度
  // ================================

  private updateProgress(
    taskId: string,
    progress: number,
    message: string
  ): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    task.progress = progress
    task.progressMessage = message
    this.notifyListeners(taskId, {
      taskId,
      status: task.status,
      progress,
      message
    })
  }

  // ================================
  // 通知监听者
  // ================================

  private notifyListeners(taskId: string, progress: TaskProgress): void {
    const listeners = this.listeners.get(taskId)
    if (!listeners) return

    for (const listener of [...listeners]) {
      try {
        listener.onProgress(progress)
        if (progress.status === 'COMPLETED' && progress.result) {
          listener.onComplete(progress.result)
        }
        if (progress.status === 'FAILED' && progress.error) {
          listener.onError(progress.error)
        }
      } catch (error) {
        logger.error({ taskId, error }, 'Listener error')
      }
    }
  }

  // ================================
  // Worker 主循环
  // ================================

  private async runWorker(): Promise<void> {
    while (this.running) {
      try {
        await this.processNextTask()
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        logger.error({ error }, 'Worker error')
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  private async processNextTask(): Promise<void> {
    // 查找下一个待处理任务
    const pendingTask = Array.from(this.tasks.values())
      .find(task => task.status === 'PENDING')

    if (!pendingTask) {
      return
    }

    const taskId = pendingTask.id
    const task = this.tasks.get(taskId)!

    // 检查是否可以从断点恢复
    if (task.chapterNo) {
      const { draftState, resumeFrom } = await DraftManager.resumeFromBreakpoint(
        task.projectId,
        task.chapterNo
      )

      if (draftState && resumeFrom) {
        logger.info(
          { taskId, chapterNo: task.chapterNo, resumeFrom },
          'Resuming task from breakpoint'
        )
        task.metadata.resumeFrom = resumeFrom
        task.metadata.draftState = draftState
      }
    }

    // 更新任务状态
    task.status = 'RUNNING'
    task.startedAt = Date.now()
    this.updateProgress(taskId, 5, 'Starting...')

    try {
      // 执行任务
      await this.executeTask(task)

      // 任务成功
      task.status = 'COMPLETED'
      task.completedAt = Date.now()
      this.notifyListeners(taskId, {
        taskId,
        status: 'COMPLETED',
        progress: 100,
        message: 'Completed',
        result: task.result
      })

      logger.info(
        { taskId, type: task.type, duration: task.completedAt - (task.startedAt || 0) },
        'Task COMPLETED'
      )
    } catch (error) {
      // 任务失败
      task.retryCount++

      if (task.retryCount <= task.maxRetries) {
        task.status = 'PENDING'
        const delay = Math.pow(2, task.retryCount) * 1000
        this.updateProgress(
          taskId,
          task.progress,
          `Retrying in ${delay}ms (${task.retryCount}/${task.maxRetries})...`
        )

        logger.warn(
          { taskId, error, retryCount: task.retryCount },
          'Task FAILED, retrying...'
        )

        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        task.status = 'FAILED'
        task.completedAt = Date.now()
        task.error = error instanceof Error ? error.message : String(error)
        this.notifyListeners(taskId, {
          taskId,
          status: 'FAILED',
          progress: task.progress,
          message: 'Failed',
          error: task.error
        })

        logger.error(
          { taskId, error },
          'Task FAILED permanently'
        )
      }
    }
  }

  private async executeTask(task: Task): Promise<void> {
    switch (task.type) {
      case 'GENERATE_CHAPTER':
        await this.executeChapterGeneration(task)
        break
      case 'GENERATE_SUMMARY':
        await this.executeSummaryGeneration(task)
        break
      case 'ANALYZE_BOOK':
        await this.executeBookAnalysis(task)
        break
      case 'EXPORT_CHAPTER':
        await this.executeChapterExport(task)
        break
      default:
        await this.failUnsupportedTask(task, `未知任务类型: ${task.type}`)
    }
  }

  private async executeChapterGeneration(task: Task): Promise<void> {
    await this.failUnsupportedTask(task, 'TaskQueue 章节生成执行器尚未接入真实 production pipeline，请改用 /pipeline/start 或章节专用生成接口。')
  }

  private async executeSummaryGeneration(task: Task): Promise<void> {
    await this.failUnsupportedTask(task, 'TaskQueue 摘要生成执行器尚未接入真实摘要流程。')
  }

  private async executeBookAnalysis(task: Task): Promise<void> {
    await this.failUnsupportedTask(task, 'TaskQueue 拆书分析执行器尚未接入真实分析任务管理器。')
  }

  private async executeChapterExport(task: Task): Promise<void> {
    await this.failUnsupportedTask(task, 'TaskQueue 导出执行器尚未接入真实导出服务。')
  }

  private async failUnsupportedTask(task: Task, message: string): Promise<never> {
    this.updateProgress(task.id, task.progress || 5, message)
    logger.warn({ taskId: task.id, type: task.type }, message)
    throw new Error(message)
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

// ================================
// 导出单例
// ================================

export const taskQueue = TaskQueue.getInstance()

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AnalysisDimension } from '@/types'
import { logger, logError } from '@/lib/logger'

// ============================================
// 类型定义
// ============================================

export type AnalysisTaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface AnalysisTaskRecord {
  id: string
  projectId: number
  volumeNumber: number
  dimensions: AnalysisDimension[]
  contextChapterCount: number
  status: AnalysisTaskStatus
  progress: number
  progressMessage: string | null
  totalDimensions: number
  completedDimensions: number
  currentDimension: string | null
  errorMessage: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateAnalysisTaskParams {
  projectId: number
  volumeNumber: number
  dimensions: AnalysisDimension[]
  contextChapterCount: number
}

// ============================================
// AnalysisTaskManager
// ============================================

export class AnalysisTaskManager {
  private static instance: AnalysisTaskManager
  private activeTasks = new Map<string, AbortController>()

  static getInstance(): AnalysisTaskManager {
    if (!AnalysisTaskManager.instance) {
      AnalysisTaskManager.instance = new AnalysisTaskManager()
    }
    return AnalysisTaskManager.instance
  }

  /**
   * 创建分析任务
   */
  async createTask(params: CreateAnalysisTaskParams): Promise<AnalysisTaskRecord> {
    const { projectId, volumeNumber, dimensions, contextChapterCount } = params

    const task = await prisma.analysisTask.create({
      data: {
        projectId,
        volumeNumber,
        dimensions: dimensions as string[] as Prisma.InputJsonValue,
        contextChapterCount,
        totalDimensions: dimensions.length,
        completedDimensions: 0,
        status: 'PENDING',
        progress: 0,
        progressMessage: '任务已创建，等待执行',
      },
    })

    return this.mapTaskRecord(task)
  }

  /**
   * 获取项目最新的活跃任务（PENDING/RUNNING）
   */
  async getActiveTask(projectId: number): Promise<AnalysisTaskRecord | null> {
    const task = await prisma.analysisTask.findFirst({
      where: {
        projectId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!task) return null
    return this.mapTaskRecord(task)
  }

  /**
   * 获取项目最近的任务（包括已完成/失败）
   */
  async getLatestTask(projectId: number): Promise<AnalysisTaskRecord | null> {
    const task = await prisma.analysisTask.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    if (!task) return null
    return this.mapTaskRecord(task)
  }

  /**
   * 获取任务详情
   */
  async getTask(taskId: string): Promise<AnalysisTaskRecord | null> {
    const task = await prisma.analysisTask.findUnique({
      where: { id: taskId },
    })

    if (!task) return null
    return this.mapTaskRecord(task)
  }

  /**
   * 获取项目所有任务列表
   */
  async listTasks(projectId: number, limit = 10): Promise<AnalysisTaskRecord[]> {
    const tasks = await prisma.analysisTask.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return tasks.map(t => this.mapTaskRecord(t))
  }

  /**
   * 开始执行任务
   */
  async startTask(taskId: string): Promise<void> {
    const abortController = new AbortController()
    this.activeTasks.set(taskId, abortController)

    await prisma.analysisTask.update({
      where: { id: taskId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        progress: 5,
        progressMessage: '正在准备分析...',
      },
    })

    logger.info({ taskId, message: 'Analysis task started' })
  }

  /**
   * 更新任务进度
   */
  async updateProgress(
    taskId: string,
    progress: number,
    message: string,
    options?: { completedDimensions?: number; currentDimension?: string }
  ): Promise<void> {
    await prisma.analysisTask.update({
      where: { id: taskId },
      data: {
        progress,
        progressMessage: message,
        ...(options?.completedDimensions !== undefined && { completedDimensions: options.completedDimensions }),
        ...(options?.currentDimension !== undefined && { currentDimension: options.currentDimension }),
      },
    })
  }

  /**
   * 标记任务完成
   */
  async completeTask(taskId: string): Promise<void> {
    this.activeTasks.delete(taskId)

    await prisma.analysisTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        progressMessage: '分析完成',
        completedAt: new Date(),
      },
    })

    logger.info({ taskId, message: 'Analysis task completed' })
  }

  /**
   * 标记任务失败
   */
  async failTask(taskId: string, error: string): Promise<void> {
    this.activeTasks.delete(taskId)

    await prisma.analysisTask.update({
      where: { id: taskId },
      data: {
        status: 'FAILED',
        progressMessage: `分析失败: ${error}`,
        errorMessage: error,
        completedAt: new Date(),
      },
    })

    logError(new Error(error), { taskId, message: 'Analysis task failed' })
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const abortController = this.activeTasks.get(taskId)
    if (abortController) {
      abortController.abort()
      this.activeTasks.delete(taskId)
    }

    await prisma.analysisTask.update({
      where: { id: taskId },
      data: {
        status: 'CANCELLED',
        progressMessage: '分析已取消',
        completedAt: new Date(),
      },
    })

    logger.info({ taskId, message: 'Analysis task cancelled' })
  }

  /**
   * 获取任务的 AbortSignal
   */
  getAbortSignal(taskId: string): AbortSignal | undefined {
    return this.activeTasks.get(taskId)?.signal
  }

  /**
   * 计算进度百分比
   */
  static calculateProgress(dimensions: AnalysisDimension[], completedDimensions: number, currentStep: 'summary' | 'analysis' | 'done'): number {
    const totalSteps = dimensions.length
    if (currentStep === 'summary') return Math.round((1 / (totalSteps + 1)) * 100)
    if (currentStep === 'done') return 100
    return Math.round(((completedDimensions + 1) / (totalSteps + 1)) * 100)
  }

  /**
   * 映射数据库记录到类型安全对象
   */
  private mapTaskRecord(task: {
    id: string
    projectId: number
    volumeNumber: number
    dimensions: Prisma.JsonValue
    contextChapterCount: number
    status: AnalysisTaskStatus
    progress: number
    progressMessage: string | null
    totalDimensions: number
    completedDimensions: number
    currentDimension: string | null
    errorMessage: string | null
    startedAt: Date | null
    completedAt: Date | null
    createdAt: Date
    updatedAt: Date
  }): AnalysisTaskRecord {
    return {
      id: task.id,
      projectId: task.projectId,
      volumeNumber: task.volumeNumber,
      dimensions: (task.dimensions as string[]) as AnalysisDimension[],
      contextChapterCount: task.contextChapterCount,
      status: task.status,
      progress: task.progress,
      progressMessage: task.progressMessage,
      totalDimensions: task.totalDimensions,
      completedDimensions: task.completedDimensions,
      currentDimension: task.currentDimension,
      errorMessage: task.errorMessage,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }
  }
}

export const analysisTaskManager = AnalysisTaskManager.getInstance()

/**
 * 队列调度器
 * 协调 worker 池、限流器和任务轮询
 */

import { prisma } from '@/lib/prisma'
import { RateLimiter } from './rate-limiter'
import { WorkerPool } from './worker-pool'
import type { QueueConfig, WorkerMetrics, SchedulerStatus } from './types'
import { DEFAULT_QUEUE_CONFIG } from './types'
import { logger } from '@/lib/logger'

export class Scheduler {
  private config: QueueConfig
  private rateLimiter: RateLimiter
  private pool: WorkerPool
  private status: SchedulerStatus = 'stopped'
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private startedAt: number = 0

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config }
    this.rateLimiter = new RateLimiter(this.config.rateLimitPerMinute, 60_000)
    this.pool = new WorkerPool(this.config, this.rateLimiter)
  }

  getStatus(): SchedulerStatus {
    return this.status
  }

  /**
   * 启动调度器
   */
  start(): void {
    if (this.status === 'running') {
      logger.warn('调度器已在运行')
      return
    }

    this.status = 'running'
    this.startedAt = Date.now()
    logger.info({ config: this.config }, '队列调度器启动')

    this.pollTimer = setInterval(() => {
      this.tick().catch(err => {
        logger.error({ err }, '调度器 tick 异常')
      })
    }, this.config.pollIntervalMs)

    // 立即执行一次
    this.tick().catch(() => {})
  }

  /**
   * 停止调度器
   */
  async stop(): Promise<void> {
    if (this.status !== 'running') return

    this.status = 'stopping'
    logger.info('调度器停止中...')

    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }

    await this.pool.gracefulStop()
    this.status = 'stopped'
    logger.info('调度器已停止')
  }

  /**
   * 获取调度器指标
   */
  async getMetrics(): Promise<WorkerMetrics> {
    const poolMetrics = this.pool.getMetrics()
    const pendingJobs = await prisma.generationJob.count({
      where: { status: 'PENDING' },
    })

    return {
      activeWorkers: poolMetrics.activeWorkers,
      pendingJobs,
      completedLastHour: poolMetrics.completedLastHour,
      failedLastHour: poolMetrics.failedLastHour,
      avgProcessingTimeMs: poolMetrics.avgProcessingMs,
      rateLimit: this.rateLimiter.getMetrics(),
      uptime: this.status === 'running' ? Date.now() - this.startedAt : 0,
    }
  }

  private async tick(): Promise<void> {
    if (this.status !== 'running') return

    // 回收超时 worker
    await this.pool.reclaimStale()

    // 尝试派发任务
    const dispatched = await this.pool.tryDispatch()
    if (dispatched) {
      logger.debug({ active: this.pool.activeCount }, '任务已派发')
    }
  }
}

// 单例
let schedulerInstance: Scheduler | null = null

export function getScheduler(config?: Partial<QueueConfig>): Scheduler {
  if (!schedulerInstance) {
    schedulerInstance = new Scheduler(config)
  }
  return schedulerInstance
}

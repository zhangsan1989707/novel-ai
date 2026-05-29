/**
 * Worker 池管理
 * 管理多个并发 pipeline worker
 */

import { prisma } from '@/lib/prisma'
import { runProductionPipeline } from '@/lib/engine/production-pipeline'
import { normalizeGenerationSpeedMode } from '@/lib/ai/speed-mode'
import { RateLimiter } from './rate-limiter'
import type { QueueConfig } from './types'
import { logger } from '@/lib/logger'

export interface WorkerState {
  id: number
  jobId: number | null
  status: 'idle' | 'running' | 'stopping'
  startedAt: number | null
  lastActivityAt: number
}

export class WorkerPool {
  private workers: WorkerState[] = []
  private config: QueueConfig
  private rateLimiter: RateLimiter
  private metrics = {
    completed: 0,
    failed: 0,
    totalProcessingMs: 0,
    recentCompletions: [] as number[],
    recentFailures: [] as number[],
  }
  private stopping = false

  constructor(config: QueueConfig, rateLimiter: RateLimiter) {
    this.config = config
    this.rateLimiter = rateLimiter
    for (let i = 0; i < config.maxConcurrency; i++) {
      this.workers.push({
        id: i,
        jobId: null,
        status: 'idle',
        startedAt: null,
        lastActivityAt: Date.now(),
      })
    }
  }

  get activeCount(): number {
    return this.workers.filter(w => w.status === 'running').length
  }

  get idleCount(): number {
    return this.workers.filter(w => w.status === 'idle').length
  }

  get states(): WorkerState[] {
    return [...this.workers]
  }

  /**
   * 尝试分配一个空闲 worker 执行下一个任务
   */
  async tryDispatch(): Promise<boolean> {
    if (this.stopping) return false

    const idleWorker = this.workers.find(w => w.status === 'idle')
    if (!idleWorker) return false

    // 限流检查
    if (!this.rateLimiter.acquire()) {
      return false
    }

    // 通过 SELECT ... FOR UPDATE SKIP LOCKED 原子获取任务
    const jobs = await prisma.$queryRawUnsafe<Array<{ id: number; projectId: number; payload: unknown }>>(
      `UPDATE generation_jobs
       SET status = 'RUNNING', "startedAt" = NOW()
       WHERE id = (
         SELECT id FROM generation_jobs
         WHERE status = 'PENDING'
         ORDER BY priority DESC, created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, "projectId", payload`
    )

    if (jobs.length === 0) return false

    const job = jobs[0]
    idleWorker.jobId = job.id
    idleWorker.status = 'running'
    idleWorker.startedAt = Date.now()
    idleWorker.lastActivityAt = Date.now()

    // 异步执行，不阻塞调度器
    this.executeWorker(idleWorker, job).catch(err => {
      logger.error({ err, workerId: idleWorker.id, jobId: job.id }, 'Worker 执行异常')
    })

    return true
  }

  private async executeWorker(
    worker: WorkerState,
    job: { id: number; projectId: number; payload: unknown }
  ): Promise<void> {
    const payload = (job.payload && typeof job.payload === 'object')
      ? job.payload as Record<string, unknown>
      : {}
    const speedMode = normalizeGenerationSpeedMode(payload.speedMode)
    const startTime = Date.now()

    try {
      await runProductionPipeline(job.id, { speedMode })

      const duration = Date.now() - startTime
      this.metrics.completed++
      this.metrics.totalProcessingMs += duration
      this.metrics.recentCompletions.push(Date.now())
      this.trimOldMetrics()

      logger.info({ workerId: worker.id, jobId: job.id, duration }, 'Worker 任务完成')
    } catch (err) {
      this.metrics.failed++
      this.metrics.recentFailures.push(Date.now())
      this.trimOldMetrics()

      logger.error({ err, workerId: worker.id, jobId: job.id }, 'Worker 任务失败')

      // 更新任务状态为 FAILED
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', errorMessage: String(err) },
      }).catch(() => {})
    } finally {
      worker.jobId = null
      worker.status = 'idle'
      worker.startedAt = null
      worker.lastActivityAt = Date.now()
    }
  }

  /**
   * 回收超时 worker
   */
  async reclaimStale(): Promise<number> {
    const now = Date.now()
    let reclaimed = 0

    for (const worker of this.workers) {
      if (worker.status === 'running' && worker.startedAt) {
        if (now - worker.startedAt > this.config.staleTimeoutMs) {
          logger.warn({ workerId: worker.id, jobId: worker.jobId }, '回收超时 worker')
          worker.status = 'idle'
          worker.jobId = null
          worker.startedAt = null
          reclaimed++
        }
      }
    }

    return reclaimed
  }

  /**
   * 优雅停止所有 worker
   */
  async gracefulStop(timeoutMs: number = 60_000): Promise<void> {
    this.stopping = true
    const start = Date.now()

    while (this.activeCount > 0 && Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 1000))
    }

    // 强制标记未完成的 worker
    for (const worker of this.workers) {
      if (worker.status === 'running') {
        worker.status = 'stopping'
      }
    }
  }

  getMetrics() {
    const oneHourAgo = Date.now() - 3600_000
    return {
      activeWorkers: this.activeCount,
      completedLastHour: this.metrics.recentCompletions.filter(t => t > oneHourAgo).length,
      failedLastHour: this.metrics.recentFailures.filter(t => t > oneHourAgo).length,
      avgProcessingMs: this.metrics.completed > 0
        ? Math.round(this.metrics.totalProcessingMs / this.metrics.completed)
        : 0,
    }
  }

  private trimOldMetrics() {
    const cutoff = Date.now() - 3600_000
    this.metrics.recentCompletions = this.metrics.recentCompletions.filter(t => t > cutoff)
    this.metrics.recentFailures = this.metrics.recentFailures.filter(t => t > cutoff)
  }
}

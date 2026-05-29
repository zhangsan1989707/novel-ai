/**
 * 队列调度系统类型定义
 */

export interface QueueConfig {
  /** 最大并发 worker 数，默认 3 */
  maxConcurrency: number
  /** 最大重试次数，默认 3 */
  maxRetries: number
  /** 重试延迟（指数退避基准），默认 1000ms */
  retryDelayMs: number
  /** 每分钟最大 API 调用数，默认 60 */
  rateLimitPerMinute: number
  /** 任务超时时间，默认 30 分钟 */
  staleTimeoutMs: number
  /** 轮询间隔，默认 5000ms */
  pollIntervalMs: number
}

export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxConcurrency: 3,
  maxRetries: 3,
  retryDelayMs: 1000,
  rateLimitPerMinute: 60,
  staleTimeoutMs: 30 * 60 * 1000,
  pollIntervalMs: 5000,
}

export interface QueueJob {
  id: number
  projectId: number
  priority: number
  status: string
  payload: Record<string, unknown>
  createdAt: Date
}

export interface RateLimitMetrics {
  used: number
  remaining: number
  limit: number
  resetAt: Date
}

export interface WorkerMetrics {
  activeWorkers: number
  pendingJobs: number
  completedLastHour: number
  failedLastHour: number
  avgProcessingTimeMs: number
  rateLimit: RateLimitMetrics
  uptime: number
}

export type SchedulerStatus = 'stopped' | 'running' | 'stopping'

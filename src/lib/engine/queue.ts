/**
 * 简单任务队列实现
 * 使用数据库 + 内存队列，适合中小规模部署
 * 生产环境建议使用 BullMQ + Redis
 */
import { prisma } from '@/lib/prisma'

interface QueueJob {
  id: string
  projectId: number
  chapterNo: number
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  error?: string
}

// 内存队列（重启后丢失，生产环境用 BullMQ）
const jobQueue: Map<string, QueueJob> = new Map()
const MAX_QUEUE_SIZE = 10000
const MAX_JOB_AGE_MS = 24 * 60 * 60 * 1000
const STALE_RUNNING_THRESHOLD_MS = 30 * 60 * 1000

function cleanupQueue() {
  const now = Date.now()
  let removed = 0

  for (const [id, job] of jobQueue.entries()) {
    if (job.status === 'RUNNING') {
      const runningDuration = now - (job.startedAt?.getTime() || job.createdAt.getTime())
      if (runningDuration > STALE_RUNNING_THRESHOLD_MS) {
        job.status = 'FAILED'
        job.error = '任务超时，服务器可能已重启'
        job.completedAt = new Date()
        jobQueue.set(id, job)
      }
    }

    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      const age = now - (job.completedAt?.getTime() || job.createdAt.getTime())
      if (age > MAX_JOB_AGE_MS) {
        jobQueue.delete(id)
        removed++
      }
    }
  }

  if (jobQueue.size > MAX_QUEUE_SIZE) {
    const pendingCount = Array.from(jobQueue.values()).filter(j => j.status === 'PENDING').length
    if (pendingCount < jobQueue.size * 0.1) {
      const entries = Array.from(jobQueue.entries())
        .filter(([, j]) => j.status !== 'PENDING')
        .sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime())

      const toRemove = entries.slice(0, Math.max(0, jobQueue.size - MAX_QUEUE_SIZE * 0.7))
      for (const [id] of toRemove) {
        jobQueue.delete(id)
        removed++
      }
    }
  }
}

/**
 * 入队
 */
export async function enqueueChapterGeneration(
  projectId: number,
  chapterNo: number
): Promise<string> {
  const jobId = `job_${projectId}_${chapterNo}_${Date.now()}`

  const job: QueueJob = {
    id: jobId,
    projectId,
    chapterNo,
    status: 'PENDING',
    createdAt: new Date(),
  }

  jobQueue.set(jobId, job)
  cleanupQueue()

  // 同时记录到数据库
  await prisma.agentLog.create({
    data: {
      id: jobId,
      projectId,
      chapterNo,
      agentType: 'WRITER',
      status: 'START',
    },
  }).catch(() => {
    // 表可能不存在，跳过
  })

  return jobId
}

/**
 * 更新任务状态
 */
export async function updateJobStatus(
  jobId: string,
  status: QueueJob['status'],
  error?: string
): Promise<void> {
  const job = jobQueue.get(jobId)
  if (job) {
    job.status = status
    if (status === 'RUNNING') job.startedAt = new Date()
    if (status === 'COMPLETED' || status === 'FAILED') {
      job.completedAt = new Date()
      cleanupQueue()
    }
    if (error) job.error = error
    jobQueue.set(jobId, job)
  }
}

/**
 * 获取任务状态
 */
export async function getJobStatus(jobId: string): Promise<QueueJob | null> {
  return jobQueue.get(jobId) || null
}

/**
 * 出队（获取下一个待处理任务）
 */
export function dequeueJob(): QueueJob | undefined {
  for (const [id, job] of jobQueue.entries()) {
    if (job.status === 'PENDING') {
      job.status = 'RUNNING'
      job.startedAt = new Date()
      jobQueue.set(id, job)
      return job
    }
  }
  return undefined
}

/**
 * 队列长度
 */
export function getQueueLength(): number {
  let count = 0
  for (const job of jobQueue.values()) {
    if (job.status === 'PENDING') count++
  }
  return count
}

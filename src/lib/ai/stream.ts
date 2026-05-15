/**
 * SSE 流式进度支持
 * 支持多阶段进度报告
 */

import { logger } from './logger'

// ============================================
// 类型定义
// ============================================

/**
 * 生成阶段
 */
export enum GenerationPhase {
  PLANNING = 'planning',     // 策划
  WRITING = 'writing',       // 写作
  POLISHING = 'polishing',   // 润色
  VALIDATING = 'validating', // 校验
  FINALIZING = 'finalizing', // 保存
}

/**
 * 阶段进度信息
 */
export interface PhaseProgress {
  phase: GenerationPhase
  phaseIndex: number // 当前阶段索引 (0-4)
  phaseProgress: number // 阶段内进度 0-100
  totalProgress: number // 总体进度 0-100
  currentStep: string // 当前步骤描述
  estimatedTimeRemaining?: number // 预估剩余时间(ms)
}

/**
 * 生成结果
 */
export interface GenerationResult {
  success: boolean
  content?: string
  phases: PhaseProgress[]
  totalDuration: number
  error?: string
}

/**
 * SSE 事件类型
 */
export type SSEEventType = 
  | 'progress'    // 进度更新
  | 'phase'       // 阶段切换
  | 'chunk'       // 内容块
  | 'complete'    // 生成完成
  | 'error'       // 错误
  | 'heartbeat'   // 心跳保活

/**
 * SSE 事件数据
 */
export interface SSEEvent<T = unknown> {
  type: SSEEventType
  data: T
  timestamp: string
}

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (progress: PhaseProgress) => void | Promise<void>

/**
 * 内容块回调函数类型
 */
export type ChunkCallback = (chunk: string) => void | Promise<void>

/**
 * 完成回调函数类型
 */
export type CompleteCallback = (result: GenerationResult) => void | Promise<void>

/**
 * 错误回调函数类型
 */
export type ErrorCallback = (error: Error) => void | Promise<void>

// ============================================
// 阶段配置
// ============================================

const PHASE_CONFIG: Array<{
  phase: GenerationPhase
  name: string
  weight: number // 权重，用于计算总进度
}> = [
  { phase: GenerationPhase.PLANNING, name: '策划', weight: 0.15 },
  { phase: GenerationPhase.WRITING, name: '写作', weight: 0.50 },
  { phase: GenerationPhase.POLISHING, name: '润色', weight: 0.15 },
  { phase: GenerationPhase.VALIDATING, name: '校验', weight: 0.15 },
  { phase: GenerationPhase.FINALIZING, name: '保存', weight: 0.05 },
]

/**
 * 获取阶段名称
 */
export function getPhaseName(phase: GenerationPhase): string {
  const config = PHASE_CONFIG.find(c => c.phase === phase)
  return config?.name || phase
}

/**
 * 获取阶段索引
 */
export function getPhaseIndex(phase: GenerationPhase): number {
  return PHASE_CONFIG.findIndex(c => c.phase === phase)
}

/**
 * 计算总体进度
 */
export function calculateTotalProgress(
  currentPhase: GenerationPhase,
  phaseProgress: number
): number {
  const currentPhaseIndex = getPhaseIndex(currentPhase)
  
  // 已完成阶段的权重
  let completedWeight = 0
  for (let i = 0; i < currentPhaseIndex; i++) {
    completedWeight += PHASE_CONFIG[i].weight
  }
  
  // 当前阶段的进度权重
  const currentPhaseWeight = PHASE_CONFIG[currentPhaseIndex]?.weight || 0
  const currentPhaseContribution = currentPhaseWeight * (phaseProgress / 100)
  
  return Math.round((completedWeight + currentPhaseContribution) * 100)
}

// ============================================
// SSE 事件构建
// ============================================

/**
 * 创建 SSE 事件
 */
export function createSSEEvent<T>(type: SSEEventType, data: T): string {
  const event: SSEEvent<T> = {
    type,
    data,
    timestamp: new Date().toISOString(),
  }
  return `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`
}

/**
 * 创建进度 SSE 事件
 */
export function createProgressEvent(progress: PhaseProgress): string {
  return createSSEEvent('progress', progress)
}

/**
 * 创建内容块 SSE 事件
 */
export function createChunkEvent(chunk: string): string {
  return createSSEEvent('chunk', { content: chunk })
}

/**
 * 创建完成 SSE 事件
 */
export function createCompleteEvent(result: GenerationResult): string {
  return createSSEEvent('complete', result)
}

/**
 * 创建错误 SSE 事件
 */
export function createErrorEvent(error: string): string {
  return createSSEEvent('error', { message: error })
}

/**
 * 创建心跳 SSE 事件
 */
export function createHeartbeatEvent(): string {
  return createSSEEvent('heartbeat', { alive: true })
}

// ============================================
// 进度管理器
// ============================================

export class ProgressManager {
  private startTime: number
  private phases: PhaseProgress[] = []
  private chunks: string[] = []
  private currentPhase: GenerationPhase = GenerationPhase.PLANNING

  constructor() {
    this.startTime = Date.now()
  }

  /**
   * 更新阶段
   */
  setPhase(phase: GenerationPhase, step: string): void {
    this.currentPhase = phase
    const progress = this.createPhaseProgress(phase, 0, step)
    this.phases.push(progress)
    
    logger.debug({ phase, step }, 'Generation phase changed')
  }

  /**
   * 更新阶段进度
   */
  updateProgress(phaseProgress: number, step: string): PhaseProgress {
    const progress = this.createPhaseProgress(this.currentPhase, phaseProgress, step)
    
    // 更新最后一条记录
    if (this.phases.length > 0) {
      const lastIndex = this.phases.length - 1
      if (this.phases[lastIndex].phase === this.currentPhase) {
        this.phases[lastIndex] = progress
      } else {
        this.phases.push(progress)
      }
    } else {
      this.phases.push(progress)
    }
    
    return progress
  }

  /**
   * 添加内容块
   */
  addChunk(chunk: string): void {
    this.chunks.push(chunk)
  }

  /**
   * 获取所有内容
   */
  getContent(): string {
    return this.chunks.join('')
  }

  /**
   * 创建阶段进度对象
   */
  private createPhaseProgress(
    phase: GenerationPhase,
    phaseProgress: number,
    step: string
  ): PhaseProgress {
    const phaseIndex = getPhaseIndex(phase)
    const totalProgress = calculateTotalProgress(phase, phaseProgress)
    const elapsed = Date.now() - this.startTime
    
    // 预估剩余时间
    let estimatedTimeRemaining: number | undefined
    if (totalProgress > 5) {
      const rate = totalProgress / elapsed
      estimatedTimeRemaining = Math.round((100 - totalProgress) / rate)
    }

    return {
      phase,
      phaseIndex,
      phaseProgress,
      totalProgress,
      currentStep: step,
      estimatedTimeRemaining,
    }
  }

  /**
   * 获取结果
   */
  getResult(error?: string): GenerationResult {
    const totalDuration = Date.now() - this.startTime

    return {
      success: !error,
      content: error ? undefined : this.getContent(),
      phases: this.phases,
      totalDuration,
      error,
    }
  }
}

// ============================================
// SSE 流式响应辅助
// ============================================

/**
 * 创建 SSE 响应头
 */
export function createSSEHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
  }
}

/**
 * 包装为异步生成器（用于 API 路由）
 */
export async function* createSSEGenerator(
  progressManager: ProgressManager,
  options?: {
    heartbeatInterval?: number // 心跳间隔(ms)
    onProgress?: ProgressCallback
    onChunk?: ChunkCallback
  }
): AsyncGenerator<string, void, unknown> {
  const heartbeatInterval = options?.heartbeatInterval ?? 30000 // 默认 30 秒
  let lastHeartbeat = Date.now()

  while (true) {
    // 等待下一个事件（由外部通过回调触发）
    await new Promise<void>(resolve => {
      const checkInterval = setInterval(() => {
        // 检查是否超时
        if (Date.now() - lastHeartbeat > heartbeatInterval) {
          lastHeartbeat = Date.now()
          resolve()
          clearInterval(checkInterval)
        }
      }, 1000)
    })

    // 这里需要配合事件机制，实际使用时由外部控制
    yield ''
  }
}

// ============================================
// 便捷函数
// ============================================

/**
 * 快速创建带进度的生成函数包装器
 */
export function withProgressTracking<T>(
  fn: (
    onProgress: (phase: GenerationPhase, progress: number, step: string) => void,
    onChunk: (chunk: string) => void
  ) => Promise<T>
): () => Promise<{ result: T; progress: ProgressManager }> {
  return async () => {
    const progressManager = new ProgressManager()
    const chunks: string[] = []

    const onProgress = (phase: GenerationPhase, progress: number, step: string) => {
      progressManager.setPhase(phase, step)
      progressManager.updateProgress(progress, step)
    }

    const onChunk = (chunk: string) => {
      chunks.push(chunk)
      progressManager.addChunk(chunk)
    }

    const result = await fn(onProgress, onChunk)

    return { result, progress: progressManager }
  }
}

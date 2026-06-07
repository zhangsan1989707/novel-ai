/**
 * Orchestrator 辅助函数
 * 提取自 orchestrator.ts，用于减少主文件复杂度
 */
import type { SSEEvent, GenerationPhase } from './types'

export type SSEEmitter = (event: SSEEvent) => void

/**
 * 进度上报辅助函数
 */
export function emitProgress(
  emit: SSEEmitter,
  phase: GenerationPhase,
  chapterNo: number,
  totalChapters: number,
  completedChapters: number,
  currentWordCount: number,
  targetWordCount: number,
  message: string
) {
  emit({
    type: 'progress',
    data: {
      phase,
      chapterNo,
      totalChapters,
      completedChapters,
      currentWordCount,
      targetWordCount,
      message,
      lastHeartbeatAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * 阶段执行包装器
 * 统一处理阶段错误和 hook 触发
 */
export async function runPhase(
  phaseName: string,
  fn: () => Promise<void>,
  onError?: (error: Error) => void
): Promise<void> {
  try {
    await fn()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    if (onError) {
      onError(err)
    } else {
      throw err
    }
  }
}

/**
 * 阶段心跳控制器
 * 在无 token 回调的阶段（planner/summarizer/reviewer/validator）定期发送心跳，
 * 防止前端因 lastEventAt 过期而误判为任务卡住
 */
export function startPhaseHeartbeat(
  emit: SSEEmitter,
  phase: GenerationPhase,
  chapterNo: number,
  totalChapters: number,
  completedChapters: number,
  currentWordCount: number,
  targetWordCount: number,
  message: string,
  intervalMs: number = 25_000,
): { stop: () => void } {
  const timer = setInterval(() => {
    emitProgress(emit, phase, chapterNo, totalChapters, completedChapters, currentWordCount, targetWordCount, message)
  }, intervalMs)

  return { stop: () => clearInterval(timer) }
}

/**
 * 构建修复类型标签
 */
export function getRepairTypeLabel(repairType: string): string {
  switch (repairType) {
    case 'expand': return '扩写'
    case 'compress': return '压缩'
    case 'continue': return '续写'
    case 'rewrite': return '连续性修复'
    default: return '修复'
  }
}

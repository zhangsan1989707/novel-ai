'use client'

import { Button } from '@/components/ui'
import { Play, Pause, Square, RotateCcw, Loader2, Zap } from 'lucide-react'
import type { GenerationSpeedMode } from '@/lib/ai/speed-mode'
import type { PipelineStatus } from '@/hooks/useProjectPipeline'
import { formatSpeedMode, formatPipelineStatus, formatTimeAgo } from '@/lib/format-labels'
import { useState, useEffect } from 'react'

interface PipelineControlBarProps {
  pipeline: PipelineStatus | null
  pipelineStarting: boolean
  activeSpeedMode: GenerationSpeedMode
  speedModeOptions: Array<{ value: string; label: string; description: string }>
  estimatedTotalChapters: number | null
  onStart: () => void
  onPause: () => Promise<void>
  onResume: () => Promise<void>
  onCancel: () => Promise<void>
  onRetryChapter: (chapterNo: number) => Promise<void>
  onRestart: () => void
  onSpeedModeChange: (mode: GenerationSpeedMode) => void
}

export function PipelineControlBar({
  pipeline,
  pipelineStarting,
  activeSpeedMode,
  speedModeOptions,
  estimatedTotalChapters,
  onStart,
  onPause,
  onResume,
  onCancel,
  onRetryChapter,
  onRestart,
  onSpeedModeChange,
}: PipelineControlBarProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const isRunning = pipeline?.status === 'RUNNING' || pipeline?.status === 'PENDING'
  const isPaused = pipeline?.status === 'PAUSED'
  const isFailed = pipeline?.status === 'FAILED'
  const isIdle = !pipeline || pipeline.status === 'IDLE'

  const runtime = pipeline?.runtime
  const currentChapter = runtime?.currentChapter
  const currentChapterNo = pipeline?.currentChapter || currentChapter?.chapterNumber || 0
  const currentWordCount = currentChapter?.currentWordCount || 0
  const targetWordCount = currentChapter?.targetWordCount || 3000
  const totalChapters = pipeline?.totalChapters || estimatedTotalChapters || 300
  const completedChapters = pipeline?.completedChapters || 0
  const lastHeartbeat = pipeline?.lastHeartbeatAt

  // 检测是否卡住
  const isStale = lastHeartbeat ? 
    (currentTime.getTime() - new Date(lastHeartbeat).getTime()) > 60000 : false

  // 状态文案
  const statusText = isRunning
    ? `运行中 · 第${currentChapterNo}章 · ${currentWordCount}/${targetWordCount}字 · ${formatTimeAgo(lastHeartbeat)}`
    : isPaused
    ? '已暂停'
    : isFailed
    ? `失败：${pipeline?.error || '未知错误'}`
    : isIdle
    ? '就绪'
    : formatPipelineStatus(pipeline?.status || '')

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* 模式选择 */}
      <select
        value={activeSpeedMode}
        onChange={(e) => onSpeedModeChange(e.target.value as GenerationSpeedMode)}
        className="w-32 h-8 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 px-2"
        disabled={isRunning}
      >
        {speedModeOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1.5">
        {(isIdle || isFailed) && (
          <Button
            size="sm"
            variant="primary"
            onClick={isFailed ? onRestart : onStart}
            disabled={pipelineStarting}
            className="h-8 gap-1.5"
          >
            {pipelineStarting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isFailed ? '重新开始' : '开始生成'}
          </Button>
        )}

        {isRunning && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={onPause}
              className="h-8 gap-1.5"
            >
              <Pause className="h-3.5 w-3.5" />
              暂停
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancel}
              className="h-8 gap-1.5 text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950"
            >
              <Square className="h-3.5 w-3.5" />
              停止
            </Button>
            {isStale && currentChapterNo > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRetryChapter(currentChapterNo)}
                className="h-8 gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重试当前章
              </Button>
            )}
          </>
        )}

        {isPaused && (
          <Button
            size="sm"
            variant="primary"
            onClick={onResume}
            className="h-8 gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            继续生成
          </Button>
        )}
      </div>

      {/* 状态信息 */}
      <div className="flex-1 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        {isRunning && (
          <>
            <span className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" />
              {completedChapters}/{totalChapters}章
            </span>
            <span className={isStale ? 'text-orange-500' : ''}>
              {statusText}
            </span>
          </>
        )}
        {!isRunning && !isIdle && (
          <span>{statusText}</span>
        )}
      </div>
    </div>
  )
}

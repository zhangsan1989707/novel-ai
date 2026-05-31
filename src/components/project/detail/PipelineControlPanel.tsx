'use client'

import { Button, Progress } from '@/components/ui'
import { Play, Pause, Square, RotateCcw, Clock, Loader2, Zap } from 'lucide-react'
import type { GenerationSpeedMode } from '@/lib/ai/speed-mode'
import type { PipelineStatus } from '@/hooks/useProjectPipeline'
import type { ProjectRuntimeSummary } from '@/lib/engine/project-runtime'
import { formatPipelineStatus, formatTimeAgo, formatDuration, speedModeLabels, formatAgentType } from '@/lib/format-labels'
import { useState, useEffect } from 'react'

interface PipelineControlPanelProps {
  pipeline: PipelineStatus | null
  runtimeSummary?: ProjectRuntimeSummary | null
  activeSpeedMode: GenerationSpeedMode
  selectedSpeedMode: GenerationSpeedMode
  speedModeOptions: Array<{ value: string; label: string; description: string }>
  estimatedTotalChapters: number | null
  pipelineStarting: boolean
  hasBoundModel: boolean
  maintenanceActive: boolean
  flowBlockedReason?: string | null
  continuousWaiting?: boolean
  handleStartPipeline: () => void
  handlePausePipeline: () => Promise<void>
  handleResumePipeline: () => Promise<void>
  handleRecoverPipeline: (action: 'continue' | 'retry_chapter' | 'retry_batch', chapterNumber?: number) => Promise<void>
  handleCancelPipeline: () => Promise<void>
  onSpeedModeChange: (mode: GenerationSpeedMode) => void
}

const phaseLabels: Record<string, string> = {
  'planning': '章节规划',
  'chapter_contract': '构建契约',
  'writing': '正文生成',
  'polishing': '文风润色',
  'summarizing': '摘要整理',
  'reviewing': '内容复核',
  'validating': '质量校验',
  'deslopping': '去AI味',
  'word_count_check': '字数校验',
  'truncation_check': '截断检测',
  'quality_gate': '质量门禁',
  'repairing': '内容修复',
  'committing': '保存入库',
  'completed': '已完成',
  'planner': '章节规划',
  'writer': '正文写作',
  'polisher': '文风润色',
  'validator': '质量校验',
  'summarizer': '摘要整理',
  'reviewer': '内容复核',
  'deslopper': '去AI味',
  'validator_deslopper': '校验+去AI味',
  'polisher_summarizer': '润色+摘要',
}

function formatPhaseOrAgent(phase: string): string {
  if (!phase) return '等待中'
  return phaseLabels[phase] || phaseLabels[phase.toLowerCase()] || formatAgentType(phase) || phase
}

function getStaleStatus(lastHeartbeatAt: string | null | undefined): 'normal' | 'warning' | 'stale' {
  if (!lastHeartbeatAt) return 'normal'
  const seconds = (Date.now() - new Date(lastHeartbeatAt).getTime()) / 1000
  if (seconds > 180) return 'stale'
  if (seconds > 60) return 'warning'
  return 'normal'
}

export function PipelineControlPanel({
  pipeline,
  runtimeSummary,
  activeSpeedMode,
  selectedSpeedMode,
  speedModeOptions,
  estimatedTotalChapters,
  pipelineStarting,
  hasBoundModel,
  maintenanceActive,
  flowBlockedReason,
  continuousWaiting,
  handleStartPipeline,
  handlePausePipeline,
  handleResumePipeline,
  handleRecoverPipeline,
  handleCancelPipeline,
  onSpeedModeChange,
}: PipelineControlPanelProps) {
  const [, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const isRunning = pipeline?.status === 'RUNNING' || pipeline?.status === 'PENDING'
  const isPaused = pipeline?.status === 'PAUSED'
  const isFailed = pipeline?.status === 'FAILED'
  const isIdle = !pipeline?.status || pipeline.status === 'IDLE'
  const isCompleted = pipeline?.status === 'COMPLETED'

  const runtime = pipeline?.runtime
  const currentChapterRuntime = runtime?.currentChapter
  const totalChapters = runtimeSummary?.totalChapters || pipeline?.totalChapters || estimatedTotalChapters || 300
  const completedChapters = runtimeSummary?.completedChapters ?? pipeline?.completedChapters ?? 0
  const currentChapterNo = runtimeSummary?.currentChapterNo || pipeline?.currentChapter || currentChapterRuntime?.chapterNumber || 0
  const currentWordCount = currentChapterRuntime?.currentWordCount || 0
  const targetWordCount = currentChapterRuntime?.targetWordCount || 3000
  const currentPhase = currentChapterRuntime?.currentPhase || pipeline?.currentStep || ''
  const chapterProgress = currentChapterRuntime
    ? Math.round((currentWordCount / targetWordCount) * 100)
    : pipeline?.currentChapterProgress || 0
  const staleStatus = pipeline ? getStaleStatus(pipeline.lastHeartbeatAt) : 'normal'

  const canStart = runtimeSummary?.canStart ?? (!isRunning && !isPaused && hasBoundModel && !maintenanceActive && !flowBlockedReason)
  const canPause = runtimeSummary?.canPause ?? isRunning
  const canResume = runtimeSummary?.canResume ?? (isPaused || isFailed)
  const canRepair = runtimeSummary?.canRepair ?? isFailed
  const borderColor = isRunning ? 'border-blue-200 dark:border-blue-800'
    : isPaused ? 'border-yellow-200 dark:border-yellow-800'
    : isFailed ? 'border-red-200 dark:border-red-800'
    : 'border-gray-200 dark:border-gray-700'

  const bgColor = isRunning ? 'bg-blue-50/50 dark:bg-blue-950/20'
    : isPaused ? 'bg-yellow-50/50 dark:bg-yellow-950/20'
    : isFailed ? 'bg-red-50/50 dark:bg-red-950/20'
    : 'bg-white dark:bg-gray-900'

  // ===== 空闲状态：简洁一行 =====
  if (isIdle) {
    return (
      <div className={`rounded-lg border ${borderColor} ${bgColor} px-4 py-3`}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-200">生成控制</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              当前状态：{runtimeSummary?.stageLabel || '准备就绪'} · 当前模式：{speedModeLabels[activeSpeedMode]}
              {speedModeOptions.find(o => o.value === selectedSpeedMode)?.description
                ? ` — ${speedModeOptions.find(o => o.value === selectedSpeedMode)!.description}`
                : ''}
            </div>
          </div>
          <select
            value={selectedSpeedMode}
            onChange={(e) => onSpeedModeChange(e.target.value as GenerationSpeedMode)}
            className="h-8 rounded-md border border-gray-300 bg-white px-2.5 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            aria-label="生成速度模式"
          >
            {speedModeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Button
            variant="primary"
            size="sm"
            onClick={handleStartPipeline}
            loading={pipelineStarting}
            disabled={!canStart}
            className="h-8 gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            开始生成
          </Button>
        </div>
        {flowBlockedReason && (
          <div className="mt-2 text-xs text-gray-500">{flowBlockedReason}</div>
        )}
      </div>
    )
  }

  // ===== 运行中 / 暂停 / 失败 / 已完成：完整面板 =====
  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor}`}>
      {/* 主区域 */}
      <div className="px-4 py-3 space-y-3">
        {/* 顶部：整本进度 */}
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <div className="flex items-center gap-2">
                {isRunning && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                  </span>
                )}
                {isPaused && <Pause className="h-4 w-4 text-yellow-500" />}
                {isFailed && <span className="text-red-500 font-bold text-xs">✕ 失败</span>}
                {isCompleted && <span className="text-green-500 font-bold text-xs">✓ 完成</span>}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  整本进度：{completedChapters} / {totalChapters} 章
                </span>
              </div>
              <span className="text-xs text-gray-500 tabular-nums">{pipeline?.progress || 0}%</span>
            </div>
            <Progress value={pipeline?.progress || 0} max={100} size="sm" />
          </div>
        </div>

        {/* 当前章节信息（运行中才显示） */}
        {isRunning && currentChapterNo > 0 && (
          <div className="rounded-md border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  第 {currentChapterNo} 章
                </span>
              </div>
              <span className="text-sm text-blue-600 dark:text-blue-300">
                {formatPhaseOrAgent(currentPhase)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap tabular-nums">
                {currentWordCount.toLocaleString()} / {targetWordCount.toLocaleString()} 字
              </span>
              <div className="flex-1"><Progress value={chapterProgress} max={100} size="sm" /></div>
              <span className="text-xs text-gray-500 tabular-nums w-8 text-right">{chapterProgress}%</span>
            </div>
          </div>
        )}

        {/* 底部：状态信息 + 操作按钮 */}
        <div className="flex items-center justify-between">
          {/* 左侧状态数据 */}
          <div className="flex items-center gap-5 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              状态：{runtimeSummary?.stageLabel || formatPipelineStatus(pipeline?.status || 'IDLE')}
            </span>
            <span className="flex items-center gap-1">
              模式：
              <select
                value={selectedSpeedMode}
                onChange={(e) => onSpeedModeChange(e.target.value as GenerationSpeedMode)}
                disabled={isRunning}
                className="h-6 rounded border border-gray-300 bg-white px-1.5 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 disabled:opacity-60"
                aria-label="生成速度模式"
              >
                {speedModeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              心跳：{formatTimeAgo(pipeline?.lastHeartbeatAt)}
              {staleStatus === 'warning' && <span className="text-yellow-500 ml-1">⚠</span>}
              {staleStatus === 'stale' && <span className="text-red-500 ml-1">⚠</span>}
            </span>
            {(isRunning || isPaused) && (
              <span>
                时长：{isRunning ? formatDuration(runtime?.currentChapter?.startedAt) : '-'}
              </span>
            )}
          </div>

          {/* 右侧操作按钮 */}
          <div className="flex items-center gap-1.5">
            {isRunning && (
              <>
                {staleStatus !== 'normal' && currentChapterNo > 0 && (
                  <Button variant="outline" size="sm" onClick={() => handleRecoverPipeline('retry_chapter', currentChapterNo)} className="h-8 gap-1">
                    <RotateCcw className="h-3.5 w-3.5" />
                    重试当前章
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handlePausePipeline} disabled={!canPause} className="h-8 gap-1">
                  <Pause className="h-3.5 w-3.5" />
                  暂停
                </Button>
                <Button variant="danger" size="sm" onClick={handleCancelPipeline} className="h-8 gap-1">
                  <Square className="h-3.5 w-3.5" />
                  停止
                </Button>
              </>
            )}
            {isPaused && (
              <>
                <Button variant="primary" size="sm" onClick={handleResumePipeline} disabled={!canResume} className="h-8 gap-1">
                  <Play className="h-3.5 w-3.5" />
                  继续
                </Button>
                <Button variant="danger" size="sm" onClick={handleCancelPipeline} className="h-8 gap-1">
                  <Square className="h-3.5 w-3.5" />
                  停止
                </Button>
              </>
            )}
            {isFailed && (
              <>
                <Button variant="primary" size="sm" onClick={handleStartPipeline} className="h-8 gap-1">
                  <RotateCcw className="h-3.5 w-3.5" />
                  重新开始
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleRecoverPipeline('continue')} disabled={!canRepair} className="h-8 gap-1">
                  <Loader2 className="h-3.5 w-3.5" />
                  断点恢复
                </Button>
              </>
            )}
            {isCompleted && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartPipeline}
                disabled={!canStart}
                className="h-8 gap-1"
              >
                <Play className="h-3.5 w-3.5" />
                继续生成
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 错误信息条 */}
      {pipeline?.error && (
        <div className="border-t border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-4 py-2 text-sm text-red-700 dark:text-red-200">
          {pipeline.error}
        </div>
      )}

      {/* 卡住警告条 */}
      {staleStatus === 'stale' && (
        <div className="border-t border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/20 px-4 py-2 text-sm text-orange-700 dark:text-orange-200">
          超过 3 分钟无心跳响应，任务可能卡住。建议重试当前章节或停止。
        </div>
      )}

      {/* 持续生成等待条 */}
      {continuousWaiting && isCompleted && (
        <div className="border-t border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 px-4 py-2 text-sm text-blue-700 dark:text-blue-200">
          <span className="inline-block mr-1.5 align-middle">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          </span>
          持续生成模式：正在准备下一批次...
        </div>
      )}
    </div>
  )
}

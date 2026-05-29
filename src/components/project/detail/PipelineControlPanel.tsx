'use client'

import { Button, Card, CardContent, Progress } from '@/components/ui'
import { Layers, Pause, Play, Loader2, Activity, FileText, Hash, Gauge, AlertTriangle } from 'lucide-react'
import type { GenerationSpeedMode } from '@/lib/ai/speed-mode'
import type { PipelineStatus } from '@/hooks/useProjectPipeline'
import { getPipelineStatusLabel, getPipelineStepLabel } from './utils'
import { speedModeLabels } from './constants'

interface PipelineControlPanelProps {
  pipeline: PipelineStatus
  activeSpeedMode: GenerationSpeedMode
  handlePausePipeline: () => Promise<void>
  handleResumePipeline: () => Promise<void>
  handleRecoverPipeline: (action: 'continue' | 'retry_chapter' | 'retry_batch', chapterNumber?: number) => Promise<void>
}

const statusConfig: Record<string, { color: string; bgColor: string; borderColor: string; pulse: boolean }> = {
  RUNNING: {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50/80 dark:bg-blue-950/30',
    borderColor: 'border-l-blue-500',
    pulse: true,
  },
  PAUSED: {
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50/80 dark:bg-amber-950/30',
    borderColor: 'border-l-amber-500',
    pulse: false,
  },
  FAILED: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50/80 dark:bg-red-950/30',
    borderColor: 'border-l-red-500',
    pulse: false,
  },
  COMPLETED: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50/80 dark:bg-emerald-950/30',
    borderColor: 'border-l-emerald-500',
    pulse: false,
  },
  PENDING: {
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50/80 dark:bg-purple-950/30',
    borderColor: 'border-l-purple-500',
    pulse: false,
  },
}

export function PipelineControlPanel({
  pipeline,
  activeSpeedMode,
  handlePausePipeline,
  handleResumePipeline,
  handleRecoverPipeline,
}: PipelineControlPanelProps) {
  if (!pipeline.status || pipeline.status === 'IDLE') {
    return null
  }

  const config = statusConfig[pipeline.status] || statusConfig.RUNNING
  const isRunning = pipeline.status === 'RUNNING'
  const isFailed = pipeline.status === 'FAILED'
  const isPaused = pipeline.status === 'PAUSED'

  return (
    <Card className={`border-l-4 ${config.borderColor} overflow-hidden ${config.bgColor} ${isRunning ? 'animate-pipeline-glow' : ''}`}>
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${isRunning ? 'bg-blue-500/15 dark:bg-blue-400/15' : isFailed ? 'bg-red-500/15 dark:bg-red-400/15' : 'bg-amber-500/15 dark:bg-amber-400/15'}`}>
            {isRunning ? (
              <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
            ) : isFailed ? (
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            ) : (
              <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-semibold ${config.color}`}>流水线状态</h3>
              {isRunning && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {getPipelineStatusLabel(pipeline.status)} · {getPipelineStepLabel(pipeline.currentStep)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-xl font-bold ${config.color}`}>{pipeline.progress}%</span>
          {isRunning && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">进行中</p>
          )}
        </div>
      </div>

      <CardContent className="px-5 pb-4 pt-0 space-y-3">
        <div className="relative">
          <Progress
            value={pipeline.progress}
            max={100}
            size="sm"
            className={isRunning ? '[&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:via-blue-400 [&>div]:to-blue-300 [&>div]:animate-shimmer' : ''}
          />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">当前章节</div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{pipeline.currentChapter || '—'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Hash className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">总章节</div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{pipeline.totalChapters || '—'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">速度模式</div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{speedModeLabels[activeSpeedMode]}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">当前阶段</div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{getPipelineStepLabel(pipeline.currentStep)}</div>
            </div>
          </div>
        </div>

        {pipeline.error && (
          <div className="rounded-lg border border-red-200/60 bg-red-50/70 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{pipeline.error}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {isRunning && (
            <Button variant="outline" size="sm" onClick={handlePausePipeline} className="gap-1.5">
              <Pause className="h-4 w-4" />
              暂停生成
            </Button>
          )}
          {isPaused && (
            <Button variant="primary" size="sm" onClick={handleResumePipeline} className="gap-1.5">
              <Play className="h-4 w-4" />
              继续生成
            </Button>
          )}
          {isFailed && (
            <>
              <Button variant="primary" size="sm" onClick={() => handleRecoverPipeline('continue')} className="gap-1.5">
                <Play className="h-4 w-4" />
                继续执行
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleRecoverPipeline('retry_chapter')} className="gap-1.5">
                <Loader2 className="h-4 w-4" />
                重试当前章节
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
'use client'

import { Button, Card, CardContent, CardHeader, CardTitle, Progress } from '@/components/ui'
import { Layers, Pause, Play, Loader2, Square } from 'lucide-react'
import type { GenerationSpeedMode } from '@/lib/ai/speed-mode'
import type { PipelineStatus } from '@/hooks/useProjectPipeline'
import { getPipelineStatusLabel, getPipelineStepLabel } from './utils'
import { speedModeLabels } from './constants'

interface PipelineControlPanelProps {
  pipeline: PipelineStatus
  activeSpeedMode: GenerationSpeedMode
  estimatedTotalChapters: number | null
  handlePausePipeline: () => Promise<void>
  handleResumePipeline: () => Promise<void>
  handleRecoverPipeline: (action: 'continue' | 'retry_chapter' | 'retry_batch', chapterNumber?: number) => Promise<void>
  handleCancelPipeline: () => Promise<void>
}

export function PipelineControlPanel({
  pipeline,
  activeSpeedMode,
  estimatedTotalChapters,
  handlePausePipeline,
  handleResumePipeline,
  handleRecoverPipeline,
  handleCancelPipeline,
}: PipelineControlPanelProps) {
  if (!pipeline.status || pipeline.status === 'IDLE') {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-5 w-5 text-blue-600" />
          流水线状态
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
          <div>阶段：{getPipelineStepLabel(pipeline.currentStep)}</div>
          <div>进度：{pipeline.progress}%</div>
        </div>
        <Progress value={pipeline.progress} max={100} size="sm" />
        <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-4">
          <div>
            <div className="text-xs text-gray-500">状态</div>
            <div className="font-medium">{getPipelineStatusLabel(pipeline.status)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">下一章</div>
            <div className="font-medium">{pipeline.nextChapterNumber || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">目标章节</div>
            <div className="font-medium">{estimatedTotalChapters?.toLocaleString() || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">速度模式</div>
            <div className="font-medium">{speedModeLabels[activeSpeedMode]}</div>
          </div>
        </div>

        {pipeline.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
            {pipeline.error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(pipeline.status === 'RUNNING' || pipeline.status === 'PENDING') && (
            <Button variant="danger" size="sm" onClick={handleCancelPipeline} className="gap-1.5">
              <Square className="h-4 w-4" />
              停止
            </Button>
          )}
          {pipeline.status === 'RUNNING' && (
            <Button variant="outline" size="sm" onClick={handlePausePipeline} className="gap-1.5">
              <Pause className="h-4 w-4" />
              暂停
            </Button>
          )}
          {pipeline.status === 'PAUSED' && (
            <Button variant="primary" size="sm" onClick={handleResumePipeline} className="gap-1.5">
              <Play className="h-4 w-4" />
              继续
            </Button>
          )}
          {pipeline.status === 'FAILED' && (
            <Button variant="outline" size="sm" onClick={() => handleRecoverPipeline('continue')} className="gap-1.5">
              <Loader2 className="h-4 w-4" />
              继续执行
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

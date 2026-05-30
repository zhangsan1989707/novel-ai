'use client'

import { Button, Card, CardContent, CardHeader, CardTitle, Progress } from '@/components/ui'
import { Layers, Pause, Play, Loader2, Square, RotateCcw, Clock, Activity, BookOpen, Zap } from 'lucide-react'
import type { GenerationSpeedMode } from '@/lib/ai/speed-mode'
import type { PipelineStatus } from '@/hooks/useProjectPipeline'
import { formatPipelineStatus, formatPipelineStep, formatAgentType, formatTimeAgo, formatDuration, speedModeLabels } from '@/lib/format-labels'
import { useState, useEffect } from 'react'

interface PipelineControlPanelProps {
  pipeline: PipelineStatus
  activeSpeedMode: GenerationSpeedMode
  estimatedTotalChapters: number | null
  handlePausePipeline: () => Promise<void>
  handleResumePipeline: () => Promise<void>
  handleRecoverPipeline: (action: 'continue' | 'retry_chapter' | 'retry_batch', chapterNumber?: number) => Promise<void>
  handleCancelPipeline: () => Promise<void>
  handleRestartPipeline: () => void
}

// 阶段权重映射，用于计算当前章节进度
const phaseWeights: Record<string, number> = {
  'chapter_contract': 5,
  'writing': 10,
  'word_count_check': 65,
  'truncation_check': 75,
  'quality_gate': 85,
  'repairing': 92,
  'committing': 98,
  'completed': 100,
}

// 阶段中文名映射 - 同时支持阶段名和 agent 名
const phaseLabels: Record<string, string> = {
  // 阶段名
  'planning': '章节规划',
  'chapter_contract': '构建章节契约',
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
  'failed': '生成失败',
  // Agent 名（小写）
  'planner': '章节规划',
  'writer': '正文写作',
  'polisher': '文风润色',
  'validator': '质量校验',
  'summarizer': '摘要整理',
  'reviewer': '内容复核',
  'deslopper': '去AI味',
  // 组合 Agent
  'validator_deslopper': '校验+去AI味',
  'polisher_summarizer': '润色+摘要',
  'review_revision': '审稿修订',
}

/**
 * 格式化阶段/Agent 名称为中文
 */
function formatPhaseOrAgent(phase: string): string {
  if (!phase) return '等待中'
  return phaseLabels[phase] || phaseLabels[phase.toLowerCase()] || formatAgentType(phase) || phase
}

// 检测是否卡住
function getStaleStatus(lastHeartbeatAt: string | null | undefined): 'normal' | 'warning' | 'stale' {
  if (!lastHeartbeatAt) return 'normal'
  const lastHeartbeat = new Date(lastHeartbeatAt)
  const now = new Date()
  const secondsSinceLastHeartbeat = (now.getTime() - lastHeartbeat.getTime()) / 1000
  
  if (secondsSinceLastHeartbeat > 180) return 'stale'
  if (secondsSinceLastHeartbeat > 60) return 'warning'
  return 'normal'
}

export function PipelineControlPanel({
  pipeline,
  activeSpeedMode,
  estimatedTotalChapters,
  handlePausePipeline,
  handleResumePipeline,
  handleRecoverPipeline,
  handleCancelPipeline,
  handleRestartPipeline,
}: PipelineControlPanelProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // 每秒更新时间，用于刷新"多久前"显示
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!pipeline.status || pipeline.status === 'IDLE') {
    return null
  }

  const runtime = pipeline.runtime
  const currentChapterRuntime = runtime?.currentChapter
  const staleStatus = getStaleStatus(pipeline.lastHeartbeatAt)
  const totalChapters = pipeline.totalChapters || estimatedTotalChapters || 300
  const completedChapters = pipeline.completedChapters || 0
  const currentChapterNo = pipeline.currentChapter || currentChapterRuntime?.chapterNumber || 0
  const currentWordCount = currentChapterRuntime?.currentWordCount || 0
  const targetWordCount = currentChapterRuntime?.targetWordCount || 3000
  const currentPhase = currentChapterRuntime?.currentPhase || pipeline.currentStep || ''
  const chapterProgress = currentChapterRuntime 
    ? Math.round((currentWordCount / targetWordCount) * 100)
    : pipeline.currentChapterProgress || 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-5 w-5 text-blue-600" />
          流水线状态
          {staleStatus === 'warning' && (
            <span className="ml-2 text-sm text-yellow-600">⚠️ 可能卡住</span>
          )}
          {staleStatus === 'stale' && (
            <span className="ml-2 text-sm text-red-600">❌ 任务卡住</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 整本书进度 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <BookOpen className="h-4 w-4" />
              <span>整本生成进度</span>
            </div>
            <div className="font-medium">
              {completedChapters} / {totalChapters} 章
            </div>
          </div>
          <Progress value={pipeline.progress} max={100} size="sm" />
          <div className="text-xs text-gray-500 text-right">{pipeline.progress}%</div>
        </div>

        {/* 当前章节信息 */}
        {pipeline.status === 'RUNNING' && currentChapterNo > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-blue-800 dark:text-blue-200">
                第 {currentChapterNo} 章
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-300">
                {formatPhaseOrAgent(currentPhase)}
              </div>
            </div>
            
            {/* 当前章节字数进度 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">当前字数</span>
                <span className="font-mono">
                  {currentWordCount.toLocaleString()} / {targetWordCount.toLocaleString()}
                </span>
              </div>
              <Progress value={chapterProgress} max={100} size="sm" />
            </div>
            
            {/* 当前阶段步骤 */}
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span>{formatPhaseOrAgent(currentPhase)}</span>
              </div>
            </div>
          </div>
        )}

        {/* 详细状态信息 */}
        <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-4">
          <div>
            <div className="text-xs text-gray-500">状态</div>
            <div className="font-medium">{formatPipelineStatus(pipeline.status)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">速度模式</div>
            <div className="font-medium">{speedModeLabels[activeSpeedMode]}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              最近心跳
            </div>
            <div className="font-medium">
              {formatTimeAgo(pipeline.lastHeartbeatAt)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Activity className="h-3 w-3" />
              运行时长
            </div>
            <div className="font-medium">
              {pipeline.status === 'RUNNING' ? formatDuration(runtime?.currentChapter?.startedAt) : '-'}
            </div>
          </div>
        </div>

        {/* 错误信息 */}
        {pipeline.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
            <div className="font-medium mb-1">错误信息</div>
            {pipeline.error}
          </div>
        )}

        {/* 卡住提示 */}
        {staleStatus === 'stale' && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-200">
            <div className="font-medium mb-1">任务可能卡住</div>
            超过 3 分钟没有收到心跳响应，建议重试当前章节或停止任务。
          </div>
        )}

        {/* 操作按钮 */}
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
          {pipeline.status === 'RUNNING' && staleStatus !== 'normal' && currentChapterNo > 0 && (
            <Button variant="outline" size="sm" onClick={() => handleRecoverPipeline('retry_chapter', currentChapterNo)} className="gap-1.5">
              <RotateCcw className="h-4 w-4" />
              重试当前章
            </Button>
          )}
          {pipeline.status === 'PAUSED' && (
            <Button variant="primary" size="sm" onClick={handleResumePipeline} className="gap-1.5">
              <Play className="h-4 w-4" />
              继续
            </Button>
          )}
          {pipeline.status === 'FAILED' && (
            <>
              <Button variant="primary" size="sm" onClick={handleRestartPipeline} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                重新开始
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleRecoverPipeline('continue')} className="gap-1.5">
                <Loader2 className="h-4 w-4" />
                从断点恢复
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

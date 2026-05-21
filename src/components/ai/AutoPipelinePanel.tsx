'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Progress, toast } from '@/components/ui'
import { Rocket, Play, Pause, Zap, Scale, Sparkles, Loader2, CheckCircle2, XCircle, Clock, Settings, AlertCircle, Shield } from 'lucide-react'

interface PipelineProgress {
  jobId: number
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'IDLE'
  startChapter: number
  endChapter: number
  total: number
  completed: number
  failed: number
  currentChapter: number
  currentStep: string
  startedAt: string
  chapters: Array<{
    chapterNumber: number
    status: 'completed' | 'failed' | 'pending' | 'generating'
    error?: string
  }>
  totalChapters?: number
  completedChapters?: number
  failedChapters?: number
  elapsedMs?: number
}

interface AutoPipelinePanelProps {
  projectId: number
  maxChapter: number
  blocked?: boolean
  blockedMessage?: string
  onClose?: () => void
}

const speedModes = [
  { value: 'fast', label: '快速', desc: '仅写作，~20s/章', icon: 'Zap' },
  { value: 'balanced', label: '均衡', desc: '策划+写作+摘要，~40s/章', icon: 'Scale' },
  { value: 'quality', label: '精品', desc: '全流程6Agent，~90s/章', icon: 'Sparkles' },
] as const

type SpeedMode = typeof speedModes[number]['value']

function getSpeedIcon(icon: string) {
  switch (icon) {
    case 'Zap': return <Zap className="h-5 w-5" />
    case 'Scale': return <Scale className="h-5 w-5" />
    case 'Sparkles': return <Sparkles className="h-5 w-5" />
    default: return <Zap className="h-5 w-5" />
  }
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}分${remainingSeconds}秒`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}时${remainingMinutes}分`
}

function estimateRemaining(completed: number, failed: number, total: number, elapsedMs: number): string {
  const done = completed + failed
  if (done === 0 || done >= total) return '-'
  const avgMs = elapsedMs / done
  const remainingMs = avgMs * (total - done)
  return formatElapsed(Math.round(remainingMs))
}

export function AutoPipelinePanel({ projectId, maxChapter, blocked = false, blockedMessage, onClose }: AutoPipelinePanelProps) {
  const defaultStart = maxChapter > 0 ? maxChapter + 1 : 1
  const [startChapter, setStartChapter] = useState(defaultStart)
  const [endChapter, setEndChapter] = useState(defaultStart + 2)
  const [speedMode, setSpeedMode] = useState<SpeedMode>('balanced')
  const [qualityGateEnabled, setQualityGateEnabled] = useState(false)
  const [maxAiScore, setMaxAiScore] = useState(50)
  const [maxRetries, setMaxRetries] = useState(3)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<PipelineProgress | null>(null)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/auto-pipeline/status`)
      const data = await res.json()
      if (data.success) {
        const p = data.data as PipelineProgress
        setProgress(p)
        if (p.status === 'COMPLETED') {
          setRunning(false)
          toast.success(`全自动流水线完成 — 成功 ${p.completed} 章，失败 ${p.failed} 章`)
        } else if (p.status === 'FAILED') {
          setRunning(false)
          toast.error('全自动流水线执行失败')
        } else if (p.status === 'PAUSED') {
          setRunning(false)
        }
      }
    } catch {
      // silent fail on polling
    }
  }, [projectId])

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (running) {
      pollRef.current = setInterval(fetchStatus, 2000)
      fetchStatus()
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [running, fetchStatus])

  useEffect(() => {
    if (running && startTime) {
      setElapsedMs(Date.now() - startTime.getTime())
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTime.getTime())
      }, 500)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [running, startTime])

  const handleStart = async () => {
    if (blocked) {
      toast.error(blockedMessage || '创作系统仍在初始化，请完成后再启动全自动流水线')
      return
    }

    if (startChapter < 1) {
      toast.error('起始章节必须大于0')
      return
    }
    if (endChapter < startChapter) {
      toast.error('结束章节不能小于起始章节')
      return
    }

    setRunning(true)
    setStartTime(new Date())
    setProgress(null)

    try {
      const res = await fetch(`/api/novel/projects/${projectId}/auto-pipeline/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startChapter,
          endChapter,
          speedMode,
          qualityGate: {
            enabled: qualityGateEnabled,
            maxAiScore,
            maxRetries,
            autoRewrite: true,
          },
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setRunning(false)
        toast.error(data.error?.message || '启动失败')
      }
    } catch {
      setRunning(false)
      toast.error('启动失败')
    }
  }

  const handlePause = async () => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/auto-pipeline/pause`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        setRunning(false)
        setProgress((prev) => (prev ? { ...prev, status: 'PAUSED' } : prev))
        toast.success('全自动流水线已暂停')
      } else {
        toast.error(data.error?.message || '暂停失败')
      }
    } catch {
      toast.error('暂停失败')
    }
  }

  const handleResume = async () => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/auto-pipeline/resume`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        setRunning(true)
        toast.success('全自动流水线已恢复')
      } else {
        toast.error(data.error?.message || '恢复失败')
      }
    } catch {
      toast.error('恢复失败')
    }
  }

  const active = running || (progress !== null && (progress.status === 'RUNNING' || progress.status === 'PAUSED'))
  const finished = progress !== null && (progress.status === 'COMPLETED' || progress.status === 'FAILED')
  const paused = progress !== null && progress.status === 'PAUSED'
  const doneCount = progress ? (progress.completed + progress.failed) : 0
  const progressPercent = progress && progress.total > 0
    ? Math.round((doneCount / progress.total) * 100)
    : 0

  return (
    <div className="space-y-6">
      {blocked && !active && !finished && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <div className="font-medium">创作系统正在初始化</div>
          <div className="mt-1 text-xs leading-5">
            {blockedMessage || '请等待蓝图、阶段规划、世界状态与故事状态完成初始化后再启动全自动流水线。'}
          </div>
        </div>
      )}

      {!active && !finished && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-5 w-5 text-blue-600" />
                章节范围设置
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="起始章节"
                  type="number"
                  value={startChapter}
                  onChange={(e) => setStartChapter(parseInt(e.target.value) || 1)}
                  min={1}
                />
                <Input
                  label="结束章节"
                  type="number"
                  value={endChapter}
                  onChange={(e) => setEndChapter(parseInt(e.target.value) || 1)}
                  min={startChapter}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-5 w-5 text-amber-600" />
                速度模式
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {speedModes.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setSpeedMode(mode.value)}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-all ${
                      speedMode === mode.value
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    <div className={speedMode === mode.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}>
                      {getSpeedIcon(mode.icon)}
                    </div>
                    <span className={`text-sm font-medium ${
                      speedMode === mode.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {mode.label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      {mode.desc}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-purple-600" />
                质量门禁
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={qualityGateEnabled}
                  onChange={(e) => setQualityGateEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  启用AI检测质量门禁
                </span>
              </label>

              {qualityGateEnabled && (
                <div className="space-y-4 pl-7">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      AI检测阈值
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={maxAiScore}
                        onChange={(e) => setMaxAiScore(parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-10 text-right">
                        {maxAiScore}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      得分越低AI痕迹越重，低于阈值将触发重写
                    </p>
                  </div>

                  <Input
                    label="最大重试次数"
                    type="number"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(parseInt(e.target.value) || 1)}
                    min={1}
                    max={10}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={handleStart}
                className="flex-1 gap-2"
                disabled={blocked}
              >
                <Play className="h-4 w-4" />
              {blocked ? '初始化中' : '一键启动全自动流水线'}
              </Button>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                取消
              </Button>
            )}
          </div>
        </>
      )}

      {active && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {paused ? (
                <Pause className="h-5 w-5 text-amber-600" />
              ) : (
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              )}
              {paused ? '全自动流水线已暂停' : '全自动流水线运行中'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  第 {progress?.currentChapter || '-'} 章 / 共 {progress?.total || '-'} 章
                </span>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {progressPercent}%
                </span>
              </div>
              <Progress value={doneCount} max={progress?.total || 1} size="md" />
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3">
                <div className="flex items-center justify-center gap-1.5 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">成功</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">
                  {progress?.completed ?? 0}
                </p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3">
                <div className="flex items-center justify-center gap-1.5 text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">失败</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-300">
                  {progress?.failed ?? 0}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                <div className="flex items-center justify-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">剩余</span>
                </div>
                <p className="mt-1 text-sm font-bold text-gray-700 dark:text-gray-300">
                  {progress ? estimateRemaining(progress.completed, progress.failed, progress.total, elapsedMs) : '-'}
                </p>
              </div>
            </div>

            {progress?.chapters && progress.chapters.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {progress.chapters.map((ch) => (
                  <div
                    key={ch.chapterNumber}
                    className={`flex items-center justify-between rounded-md px-3 py-1.5 text-xs ${
                      ch.status === 'completed'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : ch.status === 'failed'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                        : ch.status === 'generating'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span>第 {ch.chapterNumber} 章</span>
                    <span className="flex items-center gap-1">
                      {ch.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                      {ch.status === 'failed' && <AlertCircle className="h-3 w-3" />}
                      {ch.status === 'generating' && <Loader2 className="h-3 w-3 animate-spin" />}
                      {ch.status === 'completed' ? '完成' : ch.status === 'failed' ? ch.error || '失败' : ch.status === 'generating' ? '生成中' : '等待'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-center text-xs text-gray-500 dark:text-gray-400">
              已运行 {formatElapsed(elapsedMs)}
              {progress && progress.total > 0 && doneCount < progress.total && (
                <> · 预计剩余 {estimateRemaining(progress.completed, progress.failed, progress.total, elapsedMs)}</>
              )}
            </div>

            <div className="flex gap-3">
              {progress?.status === 'RUNNING' ? (
                <Button variant="outline" onClick={handlePause} className="flex-1 gap-2">
                  <Pause className="h-4 w-4" />
                  暂停
                </Button>
              ) : progress?.status === 'PAUSED' ? (
                <Button variant="primary" onClick={handleResume} className="flex-1 gap-2">
                  <Play className="h-4 w-4" />
                  继续运行
                </Button>
              ) : null}
              {onClose && (
                <Button variant="outline" onClick={onClose}>
                  关闭
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {finished && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {progress.status === 'COMPLETED' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {progress.status === 'COMPLETED' ? '流水线执行完成' : '流水线执行失败'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">总章节</p>
                  <p className="mt-1 text-2xl font-bold text-gray-700 dark:text-gray-300">
                    {progress.total}
                  </p>
                </div>
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3">
                  <p className="text-sm text-green-600 dark:text-green-400">成功</p>
                  <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">
                    {progress.completed}
                  </p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">失败</p>
                  <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-300">
                    {progress.failed}
                  </p>
                </div>
              </div>

              {progress.chapters && progress.chapters.length > 0 && (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {progress.chapters.map((ch) => (
                    <div
                      key={ch.chapterNumber}
                      className={`flex items-center justify-between rounded-md px-3 py-1.5 text-xs ${
                        ch.status === 'completed'
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      }`}
                    >
                      <span>第 {ch.chapterNumber} 章</span>
                      <span className="flex items-center gap-1">
                        {ch.status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {ch.status === 'completed' ? '完成' : ch.error || '失败'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={() => {
                    setProgress(null)
                    setRunning(false)
                    setStartTime(null)
                  }}
                  className="flex-1 gap-2"
                >
                  <Rocket className="h-4 w-4" />
                  再次启动
                </Button>
                {onClose && (
                  <Button variant="outline" onClick={onClose}>
                    关闭
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

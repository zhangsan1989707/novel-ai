'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { toast } from '@/components/ui'
import type { PipelineRuntimeState } from '@/lib/engine/pipeline-runtime'
import type { GenerationSpeedMode } from '@/lib/ai/speed-mode'
import type { ProjectRuntimeSummary } from '@/lib/engine/project-runtime'

export interface PipelineStatus {
  status: 'IDLE' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED'
  currentStep: string
  progress: number
  currentChapter: number
  totalChapters: number
  completedChapters: number
  actualChapterCount: number
  nextChapterNumber: number
  currentChapterProgress?: number
  error?: string
  pipelineJobId?: number
  speedMode?: GenerationSpeedMode
  runtime?: PipelineRuntimeState
  runtimeSummary?: ProjectRuntimeSummary
  lastHeartbeatAt?: string | null
  updatedAt?: string
}

export function useProjectPipeline(options: {
  projectId: number
  selectedSpeedMode: GenerationSpeedMode
  setSelectedSpeedMode: (mode: GenerationSpeedMode) => void
  setChapterDirectoryTouched: (value: boolean) => void
  setSelectedChapterNumber: (updater: (prev: number | null) => number | null) => void
  onCompleted?: () => void
  onFailed?: () => void
}) {
  const {
    projectId,
    selectedSpeedMode,
    setSelectedSpeedMode,
    setChapterDirectoryTouched,
    setSelectedChapterNumber,
    onCompleted,
    onFailed,
  } = options

  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null)
  const [pipelineStarting, setPipelineStarting] = useState(false)
  const lastPipelineStatusRef = useRef<PipelineStatus['status'] | null>(null)
  const lastSnapshotUpdatedAtRef = useRef<string | null>(null)
  const pipelineStreamRef = useRef<EventSource | null>(null)
  const onCompletedRef = useRef(onCompleted)
  const onFailedRef = useRef(onFailed)
  const pollAbortRef = useRef<AbortController | null>(null)
  const setSelectedChapterNumberRef = useRef(setSelectedChapterNumber)
  const applySnapshotRef = useRef<(snapshot: PipelineStatus) => void>(() => {})

  useEffect(() => {
    onCompletedRef.current = onCompleted
  })
  useEffect(() => {
    onFailedRef.current = onFailed
  })
  useEffect(() => {
    setSelectedChapterNumberRef.current = setSelectedChapterNumber
  })

  useLayoutEffect(() => {
    applySnapshotRef.current = (nextPipeline: PipelineStatus) => {
      const nextStatus = nextPipeline.status
      const prevStatus = lastPipelineStatusRef.current
      const nextUpdatedAt = nextPipeline.updatedAt || ''

      if (nextUpdatedAt && lastSnapshotUpdatedAtRef.current) {
        if (nextUpdatedAt < lastSnapshotUpdatedAtRef.current) return
      }
      if (nextUpdatedAt) {
        lastSnapshotUpdatedAtRef.current = nextUpdatedAt
      }

      setPipeline(nextPipeline)
      lastPipelineStatusRef.current = nextStatus

      const nextLiveChapterNumber = nextPipeline.runtime?.currentChapter?.chapterNumber || null
      if (nextStatus === 'RUNNING' && nextLiveChapterNumber) {
        setSelectedChapterNumberRef.current(() => nextLiveChapterNumber)
      }

      if (nextStatus === 'COMPLETED' && prevStatus !== 'COMPLETED') {
        toast.success(`AI 生成完成，共生成 ${nextPipeline.totalChapters} 章`)
        onCompletedRef.current?.()
      } else if (nextStatus === 'FAILED' && prevStatus !== 'FAILED') {
        toast.error(nextPipeline.error || 'AI 生成失败')
        onFailedRef.current?.()
      }
    }
  })

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    let polling = false

    const pollPipeline = async () => {
      if (polling) return
      polling = true
      try {
        const controller = new AbortController()
        pollAbortRef.current?.abort()
        pollAbortRef.current = controller
        const res = await fetch(`/api/novel/projects/${projectId}/pipeline/status`, {
          signal: controller.signal,
        })
        const data = await res.json()
        if (data.success) {
          applySnapshotRef.current(data.data)
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      } finally {
        polling = false
      }
    }

    pollPipeline()

    timer = setInterval(pollPipeline, 5000)
    return () => {
      if (timer) clearInterval(timer)
      pollAbortRef.current?.abort()
    }
  }, [projectId])

  useEffect(() => {
    if (pipelineStreamRef.current) {
      pipelineStreamRef.current.close()
      pipelineStreamRef.current = null
    }

    const eventSource = new EventSource(`/api/novel/projects/${projectId}/pipeline/stream`)
    pipelineStreamRef.current = eventSource

    eventSource.addEventListener('pipeline', (event) => {
      try {
        const snapshot = JSON.parse((event as MessageEvent).data) as PipelineStatus
        applySnapshotRef.current(snapshot)
      } catch {
      }
    })

    eventSource.onerror = () => {
      eventSource.close()
      if (pipelineStreamRef.current === eventSource) {
        pipelineStreamRef.current = null
      }
    }

    return () => {
      eventSource.close()
      if (pipelineStreamRef.current === eventSource) {
        pipelineStreamRef.current = null
      }
    }
  }, [projectId])

  const handleStartPipeline = async ({
    hasBoundModel,
    maintenanceActive,
    flowBlockedReason,
    blueprintConfirmedAt,
    arcPlanConfirmedAt,
  }: {
    hasBoundModel: boolean
    maintenanceActive: boolean
    flowBlockedReason: string | null
    blueprintConfirmedAt?: string | null
    arcPlanConfirmedAt?: string | null
  }) => {
    if (!hasBoundModel) {
      toast.error('请先绑定 AI 模型')
      return
    }

    if (maintenanceActive) {
      toast.error('项目仍在初始化，请稍后再试')
      return
    }

    if (!blueprintConfirmedAt) {
      toast.error('请先确认全书蓝图')
      return
    }

    if (!arcPlanConfirmedAt) {
      toast.error('请先确认故事路线图')
      return
    }

    setPipelineStarting(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)
      const res = await fetch(`/api/novel/projects/${projectId}/pipeline/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speedMode: selectedSpeedMode }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json()
      if (data.success) {
        const startData = data.data as {
          speedMode?: GenerationSpeedMode
          snapshot?: PipelineStatus
          jobId?: number
          totalChapters?: number
          runtimeSummary?: ProjectRuntimeSummary
          runner?: 'external' | 'inline'
        }
        toast.success(startData.runner === 'inline' ? 'AI 生成已启动' : 'AI 生成已进入生产队列')
        setSelectedSpeedMode(startData.speedMode || selectedSpeedMode)
        if (startData.snapshot) {
          applySnapshotRef.current(startData.snapshot)
        } else {
          setPipeline({
            status: 'PENDING',
            currentStep: 'BLUEPRINT',
            progress: 0,
            currentChapter: 0,
            totalChapters: startData.totalChapters || 300,
            completedChapters: 0,
            actualChapterCount: 0,
            nextChapterNumber: 1,
            pipelineJobId: startData.jobId,
            speedMode: startData.speedMode || selectedSpeedMode,
            runtime: {
              currentChapter: null,
              recentChapters: [],
              speedMode: startData.speedMode || selectedSpeedMode,
              streamRevision: 0,
            },
            runtimeSummary: startData.runtimeSummary,
          })
        }
      } else {
        toast.error(data.error?.message || '启动失败')
      }
    } catch {
      toast.error('启动 AI 生成失败')
    } finally {
      setPipelineStarting(false)
    }
  }

  const handleResumePipeline = async () => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/pipeline/resume`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('已恢复 AI 生成')
      } else {
        toast.error(data.error?.message || '恢复失败')
      }
    } catch {
      toast.error('恢复失败')
    }
  }

  const handlePausePipeline = async () => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/pipeline/pause`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('已暂停 AI 生成')
      } else {
        toast.error(data.error?.message || '暂停失败')
      }
    } catch {
      toast.error('暂停失败')
    }
  }

  const handleRecoverPipeline = async (action: 'continue' | 'retry_chapter' | 'retry_batch', chapterNumber?: number) => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/pipeline/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, chapterNumber }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.data?.message || '恢复动作已触发')
        onCompleted?.()
      } else {
        toast.error(data.error?.message || '恢复失败')
      }
    } catch {
      toast.error('恢复失败')
    }
  }

  const handleCancelPipeline = async () => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/pipeline/cancel`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('已停止 AI 生成')
        setPipeline(null)
      } else {
        toast.error(data.error?.message || '停止失败')
      }
    } catch {
      toast.error('停止失败')
    }
  }

  return {
    pipeline,
    setPipeline,
    pipelineStarting,
    handleStartPipeline,
    handleResumePipeline,
    handlePausePipeline,
    handleRecoverPipeline,
    handleCancelPipeline,
  }
}

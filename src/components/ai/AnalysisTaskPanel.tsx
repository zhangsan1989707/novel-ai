'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui'

interface AnalysisTask {
  id: string
  projectId: number
  volumeNumber: number
  dimensions: string[]
  contextChapterCount: number
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  progress: number
  progressMessage: string | null
  totalDimensions: number
  completedDimensions: number
  currentDimension: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

interface AnalysisTaskPanelProps {
  projectId: number
  onTaskComplete?: () => void
  compact?: boolean
}

const statusConfig = {
  PENDING: { label: '等待中', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
  RUNNING: { label: '执行中', icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  COMPLETED: { label: '已完成', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
  FAILED: { label: '已失败', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  CANCELLED: { label: '已取消', icon: AlertCircle, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800/20' },
}

const dimensionLabels: Record<string, string> = {
  STORY_OVERVIEW: '故事总览',
  CHARACTER_RELATION: '人物关系',
  CHARACTER_ARC: '角色成长',
  PLOT_LINE: '剧情线',
  FORESHADOWING: '伏笔悬念',
  CHAPTER_STRUCTURE: '章节结构',
  READING_EXPERIENCE: '阅读体验',
  WORLD_SETTING: '世界观设定',
}

const volumeLabel = (vol: number) => {
  if (vol === -1) return '整书'
  if (vol === 0) return '全卷'
  return `第${vol}卷`
}

export function AnalysisTaskPanel({ projectId, onTaskComplete, compact = false }: AnalysisTaskPanelProps) {
  const [task, setTask] = useState<AnalysisTask | null>(null)
  const [loading, setLoading] = useState(true)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 获取任务状态
  const fetchTask = useCallback(async (latest = false) => {
    try {
      const params = new URLSearchParams()
      if (latest) params.set('latest', 'true')
      const res = await fetch(`/api/novel/projects/${projectId}/analysis-task?${params}`)
      const data = await res.json()
      if (data.success) {
        setTask(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch task:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // 初始加载
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchTask(true)
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [fetchTask])

  // 轮询活跃任务
  useEffect(() => {
    if (task?.status === 'RUNNING' || task?.status === 'PENDING') {
      pollIntervalRef.current = setInterval(() => {
        fetchTask()
      }, 2000)
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [task?.status, fetchTask])

  // 任务完成时通知父组件
  useEffect(() => {
    if (task?.status === 'COMPLETED' && task.startedAt) {
      onTaskComplete?.()
    }
  }, [task?.status, task?.startedAt, onTaskComplete])

  if (loading && !task) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载分析任务...
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        分析任务尚未创建，系统会自动发起拆书分析并在这里显示进度。
      </div>
    )
  }

  const config = statusConfig[task.status]
  const StatusIcon = config.icon

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bg}`}>
        <StatusIcon className={`h-4 w-4 ${config.color} ${task.status === 'RUNNING' ? 'animate-spin' : ''}`} />
        <span className={`text-sm ${config.color}`}>
          {config.label}
        </span>
        {task.status === 'RUNNING' && (
          <span className="text-sm text-muted-foreground ml-1">
            {task.progress}%
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 任务状态卡片 */}
      <div className={`border rounded-lg p-4 ${config.bg}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 p-1.5 rounded-full ${config.bg}`}>
              <StatusIcon className={`h-5 w-5 ${config.color} ${task.status === 'RUNNING' ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">拆书分析任务</span>
                <Badge variant={
                  task.status === 'COMPLETED' ? 'success' :
                  task.status === 'RUNNING' ? 'primary' :
                  task.status === 'FAILED' ? 'danger' : 'default'
                }>
                  {config.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                分析范围: {volumeLabel(task.volumeNumber)} · {task.totalDimensions} 个维度
              </p>
              {task.progressMessage && (
                <p className="text-sm mt-1">{task.progressMessage}</p>
              )}
              {task.errorMessage && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{task.errorMessage}</p>
              )}
            </div>
          </div>

        </div>

        {/* 进度条 */}
        {(task.status === 'PENDING' || task.status === 'RUNNING') && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>进度</span>
              <span>{task.progress}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${task.progress}%` }}
              />
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>已完成 {task.completedDimensions}/{task.totalDimensions} 个维度</span>
              {task.currentDimension && (
                <>
                  <span>·</span>
                  <span>当前: {dimensionLabels[task.currentDimension] || task.currentDimension}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* 已完成维度列表 */}
        {task.status === 'COMPLETED' && (
          <div className="mt-3">
            <div className="text-xs text-muted-foreground mb-1">
              分析维度
            </div>
            <div className="flex flex-wrap gap-1.5">
              {task.dimensions.map(dim => (
                <span
                  key={dim}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                >
                  <CheckCircle className="h-3 w-3" />
                  {dimensionLabels[dim] || dim}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {task.errorMessage && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
          <AlertCircle className="h-4 w-4" />
          {task.errorMessage}
        </div>
      )}
    </div>
  )
}

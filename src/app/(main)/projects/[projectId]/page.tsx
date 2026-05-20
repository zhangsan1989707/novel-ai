'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Progress, Modal, toast, MoreActionsMenu } from '@/components/ui'
import { ProjectForm, ProjectFormData } from '@/components/project'
import { StorySteeringPanel, Toolbox, AutoPipelinePanel } from '@/components/ai'
import { CoverGenerator, PlotAnalyzer, ResearchPanel, ReviewPanel, DeslopPanel, ExportPanel } from '@/components/ai'
import { BookOpen, Clock, Target, Users, Layers, Search, ClipboardList, Rocket, Shield, Sparkles, ChevronRight, ChevronDown, Wrench, Eye, Play, AlertCircle, CheckCircle2, Loader2, Download } from 'lucide-react'
import type { ProjectStatus } from '@/types'
import type { PipelineRuntimeState } from '@/lib/engine/pipeline-runtime'

interface Chapter {
  id: number
  chapterNumber: number
  title: string
  wordCount: number
  status: 'DRAFT' | 'GENERATING' | 'COMPLETED' | 'REVIEWING'
  sortOrder: number
  summary?: string
  content?: string | null
}

interface ArcPlan {
  id: number
  arcNumber: number
  name: string
  stage: string
  goals: string[]
  keyEvents: string[]
  batchSize: number
  isCompleted: boolean
  chapters?: Chapter[]
}

interface Project {
  id: number
  title: string
  description?: string | null
  genre?: string | null
  writingStyle?: string | null
  targetWordCount?: number | null
  currentWordCount: number
  chapterWordCount: number
  outline?: string | null
  worldSetting?: string | null
  powerSystem?: string | null
  protagonistProfile?: string | null
  protagonistGoal?: string | null
  antagonistSetting?: string | null
  endingPlan?: string | null
  writingPrompt?: string | null
  status: ProjectStatus
  totalVolumes: number
  coverImage?: string | null
  aiModelId?: number | null
  aiModelConfig?: { id: number; name: string; vendor: string } | null
  projectMode: 'CREATE' | 'ANALYZE'
  storyType?: string
  pace?: number
  darkness?: number
  humor?: number
  romance?: number
  powerGrowth?: number
  conflictIntensity?: number
  mysteryDensity?: number
  chapters: Chapter[]
  arcPlans?: ArcPlan[]
  recentCommits?: Array<{
    id: string
    chapterNo: number
    source: string
    status: string
    projectionStatus: Record<string, string>
    replayCount: number
    appliedAt?: string | null
    createdAt: string
  }>
  preflight?: {
    ready: boolean
    healthScore: number
    healthLevel: 'critical' | 'warning' | 'healthy'
    primaryAction: string
    recommendations: string[]
    hasModel: boolean
    hasBlueprint: boolean
    hasArcPlans: boolean
    hasStoryState: boolean
    hasWorldState: boolean
    totalChapters: number
    completedChapters: number
    reviewingChapters: number
    draftChapters: number
    emptyCompletedChapters: number
    recentCommitFailures: number
    chapterSummaryCount: number
    volumeSummaryCount: number
    bookSummaryCount: number
    characterCount: number
    plotlineCount: number
    openPlotlineCount: number
    resolvedPlotlineCount: number
    researchRefCount: number
    ragDocumentCount: number
    chapterSummaryCoverage: number
    volumeSummaryCoverage: number
    memoryCoverageScore: number
    strandScore: number
    wordCountComplianceRate: number
    overduePlotlineCount: number
    activeVillainCount: number
    finalBossCount: number
    issues: Array<{
      severity: 'error' | 'warning' | 'info'
      code: string
      message: string
    }>
  }
  createdAt: string
  updatedAt: string
}

interface PipelineStatus {
  status: 'IDLE' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED'
  currentStep: string
  progress: number
  currentChapter: number
  totalChapters: number
  error?: string
  pipelineJobId?: number
  runtime?: PipelineRuntimeState
  updatedAt?: string
}

const chapterStatusMap: Record<string, { label: string; variant: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' }> = {
  DRAFT: { label: '未写作', variant: 'default' },
  GENERATING: { label: '生成中', variant: 'primary' },
  COMPLETED: { label: '已完成', variant: 'success' },
  REVIEWING: { label: '待审稿', variant: 'warning' },
}

const projectStatusMap: Record<ProjectStatus, { label: string; variant: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' }> = {
  DRAFT: { label: '草稿', variant: 'default' },
  WRITING: { label: '写作中', variant: 'primary' },
  COMPLETED: { label: '已完成', variant: 'success' },
  PAUSED: { label: '已暂停', variant: 'warning' },
}

const pipelineStatusMap: Record<PipelineStatus['status'], string> = {
  IDLE: '空闲',
  PENDING: '准备中',
  RUNNING: '运行中',
  COMPLETED: '已完成',
  FAILED: '失败',
  PAUSED: '已暂停',
}

const pipelineStepMap: Record<string, string> = {
  BLUEPRINT: '蓝图生成',
  ARC_PLAN: '阶段规划',
  CHAPTER_LIST: '章节目录',
  WRITE: '章节写作',
  SUMMARIZE: '总结收尾',
  PLANNER: '章节策划',
  WRITER: '正文写作',
  SUMMARIZER: '摘要整理',
  DB_WRITE: '结果回写',
  RESEARCH: '资料整理',
  DESLOPPER: '去AI味',
  VALIDATOR: '一致性校验',
  PLAN: '策划',
  REVIEW: '审稿',
  POLISH: '润色',
  DRAFT: '草稿生成',
  VALIDATE: '校验',
  INITIALIZE: '初始化',
}

const healthLevelMap: Record<NonNullable<Project['preflight']>['healthLevel'], { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  healthy: { label: '健康', variant: 'success' },
  warning: { label: '告警', variant: 'warning' },
  critical: { label: '严重', variant: 'danger' },
}

function getPipelineStatusLabel(status: PipelineStatus['status']) {
  return pipelineStatusMap[status] || status
}

function getPipelineStepLabel(step: string) {
  if (!step) return '初始化'
  return pipelineStepMap[step.toUpperCase()] || step
}

function formatDuration(durationMs?: number) {
  if (!durationMs || durationMs <= 0) return '-'
  if (durationMs < 1000) return `${durationMs}ms`
  const seconds = durationMs / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
}

type DashboardTab = 'dashboard' | 'settings'

function groupChaptersByArc(project: Project): { arcName: string; arcNumber: number; chapters: Chapter[] }[] {
  const arcPlans = project.arcPlans || []
  if (arcPlans.length === 0) {
    return [{ arcName: '', arcNumber: 0, chapters: project.chapters }]
  }

  const chapterMap = new Map<number, Chapter[]>()
  for (const chapter of project.chapters) {
    const arcNumber = Math.floor((chapter.chapterNumber - 1) / 20) + 1
    if (!chapterMap.has(arcNumber)) {
      chapterMap.set(arcNumber, [])
    }
    chapterMap.get(arcNumber)!.push(chapter)
  }

  return arcPlans.map(ap => ({
    arcName: ap.name,
    arcNumber: ap.arcNumber,
    chapters: chapterMap.get(ap.arcNumber) || [],
  }))
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = parseInt(params.projectId as string)

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showToolbox, setShowToolbox] = useState(false)
  const [showChapterPreview, setShowChapterPreview] = useState(false)
  const [previewChapter, setPreviewChapter] = useState<Chapter | null>(null)
  const [showResearchModal, setShowResearchModal] = useState(false)
  const [showCoverModal, setShowCoverModal] = useState(false)
  const [showPlotAnalysisModal, setShowPlotAnalysisModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showDeslopModal, setShowDeslopModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showAutoPipelineModal, setShowAutoPipelineModal] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pipelineStarting, setPipelineStarting] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard')

  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null)
  const lastPipelineStatusRef = useRef<PipelineStatus['status'] | null>(null)
  const pipelineStreamRef = useRef<EventSource | null>(null)

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}`)
      const data = await res.json()
      if (data.success) {
        setProject(data.data)
      } else {
        setError(data.error.message)
      }
    } catch {
      setError('获取项目详情失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const applyPipelineSnapshot = useCallback((nextPipeline: PipelineStatus) => {
    const nextStatus = nextPipeline.status
    const prevStatus = lastPipelineStatusRef.current
    setPipeline(nextPipeline)
    lastPipelineStatusRef.current = nextStatus

    if (nextStatus === 'COMPLETED' && prevStatus !== 'COMPLETED') {
      toast.success(`流水线执行完成 — 共生成 ${nextPipeline.totalChapters} 章`)
      fetchProject()
    } else if (nextStatus === 'FAILED' && prevStatus !== 'FAILED') {
      toast.error(nextPipeline.error || '流水线执行失败')
      fetchProject()
    }
  }, [fetchProject])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchProject()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchProject])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const pollPipeline = async () => {
      try {
        const res = await fetch(`/api/novel/projects/${projectId}/pipeline/status`)
        const data = await res.json()
        if (data.success) {
          applyPipelineSnapshot(data.data)
        }
      } catch {
        // silent fail on polling errors
      }
    }

    pollPipeline()

    timer = setInterval(pollPipeline, 3000)
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [projectId, applyPipelineSnapshot])

  useEffect(() => {
    const eventSource = new EventSource(`/api/novel/projects/${projectId}/pipeline/stream`)
    pipelineStreamRef.current = eventSource

    eventSource.addEventListener('pipeline', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as PipelineStatus
        applyPipelineSnapshot(payload)
      } catch {
        // ignore parse errors
      }
    })

    eventSource.onerror = () => {
      eventSource.close()
      pipelineStreamRef.current = null
    }

    return () => {
      eventSource.close()
      pipelineStreamRef.current = null
    }
  }, [projectId, applyPipelineSnapshot])

  const handleUpdate = async (formData: ProjectFormData) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const result = await res.json()
      if (result.success) {
        setShowEditModal(false)
        toast.success('项目已更新')
        fetchProject()
      } else {
        toast.error(result.error?.message || '更新失败')
      }
    } catch {
      toast.error('更新失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}`, {
        method: 'DELETE',
      })
      const result = await res.json()
      if (result.success) {
        toast.success('项目已删除')
        router.push('/projects')
      } else {
        toast.error(result.error?.message || '删除失败')
      }
    } catch {
      toast.error('删除失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResumePipeline = async () => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/pipeline/resume`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('流水线已恢复')
        fetchProject()
      } else {
        toast.error(data.error?.message || '恢复失败')
      }
    } catch {
      toast.error('恢复失败')
    }
  }

  const handleStartPipeline = async () => {
    setPipelineStarting(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/pipeline/start`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('AI 生产流水线已启动')
        setPipeline({
          status: 'PENDING',
          currentStep: 'BLUEPRINT',
          progress: 0,
          currentChapter: 0,
          totalChapters: 0,
          pipelineJobId: data.data.jobId,
        })
      } else {
        toast.error(data.error?.message || '启动失败')
      }
    } catch {
      toast.error('启动失败')
    } finally {
      setPipelineStarting(false)
    }
  }

  const handleBootstrapProject = async () => {
    setBootstrapping(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/bootstrap`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('创作系统已初始化')
        await fetchProject()
      } else {
        toast.error(data.error?.message || '初始化失败')
      }
    } catch {
      toast.error('初始化失败，请重试')
    } finally {
      setBootstrapping(false)
    }
  }

  const openChapterPreview = (chapter: Chapter) => {
    setPreviewChapter(chapter)
    setShowChapterPreview(true)
  }

  const toolboxItems = [
    {
      id: 'research',
      label: '资料研究',
      description: 'AI辅助收集设定资料',
      icon: <Search className="h-4 w-4" />,
      onClick: () => setShowResearchModal(true),
    },
    {
      id: 'cover',
      label: '封面生成',
      description: 'AI生成小说封面',
      icon: <Rocket className="h-4 w-4" />,
      onClick: () => setShowCoverModal(true),
    },
    {
      id: 'plotAnalyzer',
      label: '剧情分析',
      description: '分析剧情结构和发展',
      icon: <ClipboardList className="h-4 w-4" />,
      onClick: () => setShowPlotAnalysisModal(true),
    },
    {
      id: 'review',
      label: '对抗审稿',
      description: '多模型交叉审稿',
      icon: <Shield className="h-4 w-4" />,
      onClick: () => setShowReviewModal(true),
    },
    {
      id: 'deslop',
      label: '去AI味',
      description: '润色去除AI痕迹',
      icon: <Sparkles className="h-4 w-4" />,
      onClick: () => setShowDeslopModal(true),
    },
  ]

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error || '项目不存在'}</p>
        <Button variant="outline" onClick={() => router.push('/projects')} className="mt-4">
          返回列表
        </Button>
      </div>
    )
  }

  const progress = project.targetWordCount
    ? Math.round((project.currentWordCount / project.targetWordCount) * 100)
    : null

  const completedChapters = project.chapters.filter(c => c.status === 'COMPLETED').length
  const reviewingChapters = project.chapters.filter(c => c.status === 'REVIEWING').length
  const arcGroups = groupChaptersByArc(project)
  const liveChapter = pipeline?.runtime?.currentChapter || null
  const recentChapterRuns = pipeline?.runtime?.recentChapters || []
  const hasBoundModel = Boolean(project.aiModelConfig)

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
        <button
          onClick={() => router.push('/projects')}
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          我的小说
        </button>
        <span>/</span>
        <span className="text-gray-900 dark:text-white font-medium">{project.title}</span>
      </div>

      {/* Pipeline Progress Panel */}
      {pipeline && (pipeline.status === 'RUNNING' || pipeline.status === 'PENDING') && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/60 dark:bg-blue-900/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className={`h-4 w-4 text-blue-600 ${pipeline.status === 'RUNNING' ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {pipeline.status === 'PENDING' ? '流水线准备中' : `流水线${getPipelineStatusLabel(pipeline.status)}`}
              </span>
            </div>
            <span className="text-xs text-blue-500">{pipeline.progress}%</span>
          </div>
          <Progress value={pipeline.progress} max={100} size="sm" />
          <div className="flex items-center justify-between mt-2 text-xs text-blue-600 dark:text-blue-400">
            <span>
              <span className="font-medium">{getPipelineStepLabel(pipeline.currentStep)}</span>
            </span>
            <span>
              第 {pipeline.currentChapter} / {pipeline.totalChapters} 章
            </span>
          </div>
          {liveChapter && (
            <div className="mt-3 rounded-md bg-blue-50/80 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
              <div className="flex items-center justify-between gap-3">
                <span>当前章节：第 {liveChapter.chapterNumber} 章 {liveChapter.title || ''}</span>
                <span>{getPipelineStepLabel(liveChapter.currentPhase || liveChapter.currentAgent || 'WRITE')}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span>已写 {liveChapter.currentWordCount} / {liveChapter.targetWordCount} 字</span>
                <span>最近阶段耗时：{formatDuration(pipeline.runtime?.lastPhaseDurationMs)}</span>
              </div>
              {liveChapter.lastMessage && (
                <div className="mt-1 truncate">{liveChapter.lastMessage}</div>
              )}
            </div>
          )}
        </div>
      )}

      {pipeline && pipeline.status === 'FAILED' && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-900/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">
              流水线执行失败
            </span>
          </div>
          {pipeline.error && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">{pipeline.error}</p>
          )}
          <Button variant="outline" size="sm" onClick={handleResumePipeline} className="gap-1.5">
            <Play className="h-3.5 w-3.5" />
            恢复运行
          </Button>
        </div>
      )}

      {pipeline && pipeline.status === 'COMPLETED' && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/60 dark:bg-green-900/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              流水线执行完成 — 共生成 {pipeline.totalChapters} 章
            </span>
          </div>
        </div>
      )}

      {/* Project Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{project.title}</h1>
          <Badge variant={projectStatusMap[project.status].variant}>
            {projectStatusMap[project.status].label}
          </Badge>
          {project.genre && <Badge variant="outline">{project.genre}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleStartPipeline}
            loading={pipelineStarting}
            disabled={pipeline?.status === 'RUNNING' || pipeline?.status === 'PENDING' || !hasBoundModel}
            className="gap-1.5"
          >
            <Rocket className="h-4 w-4" />
            启动 AI 生产
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowToolbox(true)}
            className="gap-1.5"
          >
            <Wrench className="h-4 w-4" />
            工具箱
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportModal(true)}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            导出
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAutoPipelineModal(true)}
            className="gap-1.5"
          >
            <Rocket className="h-4 w-4" />
            全自动流水线
          </Button>
          <MoreActionsMenu
            onEdit={() => setShowEditModal(true)}
            onDelete={() => setShowDeleteModal(true)}
            onExport={() => {
              const handleExport = async () => {
                try {
                  const res = await fetch(`/api/novel/projects/${projectId}/export-data`)
                  const data = await res.json()
                  if (data.success) {
                    let content = `${project.title}\n\n${'='.repeat(40)}\n\n`
                    for (const ch of data.data.chapters) {
                      content += `第${ch.chapterNumber}章 ${ch.title}\n\n${ch.content || ''}\n\n`
                    }
                    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${project.title}.txt`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                    toast.success('导出成功')
                  }
                } catch {
                  toast.error('导出失败')
                }
              }
              handleExport()
            }}
          />
        </div>
      </div>

      {/* Simplified Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'dashboard'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Layers className="h-4 w-4 inline mr-1.5" />
            创作总控
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Target className="h-4 w-4 inline mr-1.5" />
            项目设定
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className={`grid gap-6 transition-all duration-300 ${sidebarCollapsed ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]'}`}>
        <div className="space-y-6">
          {activeTab === 'dashboard' && (
            <>
              {/* Chapter Preview List */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                      章节目录
                      <Badge variant="secondary">
                        {completedChapters}/{project.chapters.length} 已完成
                      </Badge>
                      {reviewingChapters > 0 && (
                        <Badge variant="warning">
                          {reviewingChapters} 待审稿
                        </Badge>
                      )}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {project.chapters.length === 0 ? (
                    <div className="text-center py-12">
                      <BookOpen className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        暂无章节，启动流水线后自动生成
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleStartPipeline}
                        loading={pipelineStarting}
                        disabled={pipeline?.status === 'RUNNING' || pipeline?.status === 'PENDING' || !hasBoundModel}
                        className="mt-4 gap-1.5"
                      >
                        <Rocket className="h-4 w-4" />
                        启动 AI 生产
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {arcGroups.map((group, groupIdx) => (
                        <div key={groupIdx}>
                          {group.arcName && (
                            <div className="flex items-center gap-2 mb-2 px-1">
                              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                                {group.arcName}
                              </span>
                              <span className="text-xs text-gray-400">
                                {group.chapters.length} 章
                              </span>
                            </div>
                          )}
                          <div className="space-y-1">
                            {group.chapters.map((chapter) => (
                              <div
                                key={chapter.id}
                                onClick={() => openChapterPreview(chapter)}
                                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-all group"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <span className="text-gray-400 text-sm shrink-0">
                                    第{chapter.chapterNumber}章
                                  </span>
                                  <span className="font-medium text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {chapter.title || '无标题'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-xs text-gray-500">
                                    {(chapter.wordCount || 0).toLocaleString()} 字
                                  </span>
                                  <Badge variant={chapterStatusMap[chapter.status].variant} className="text-xs">
                                    {chapterStatusMap[chapter.status].label}
                                  </Badge>
                                  <Eye className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {pipeline && (liveChapter || recentChapterRuns.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="h-5 w-5 text-blue-600" />
                      流水线进度
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {liveChapter && (
                      <div className="rounded-md border border-blue-100 bg-blue-50/70 px-3 py-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            第 {liveChapter.chapterNumber} 章 {liveChapter.title || ''}
                          </div>
                          <Badge variant="primary">
                            {getPipelineStepLabel(liveChapter.currentPhase || liveChapter.currentAgent || 'WRITE')}
                          </Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <div>当前字数：{liveChapter.currentWordCount}</div>
                          <div>目标字数：{liveChapter.targetWordCount}</div>
                          <div>Planner：{formatDuration(liveChapter.phaseTimings.planner)}</div>
                          <div>Writer：{formatDuration(liveChapter.phaseTimings.writer)}</div>
                          <div>Summarizer：{formatDuration(liveChapter.phaseTimings.summarizer)}</div>
                          <div>DB 回写：{formatDuration(liveChapter.phaseTimings.db_write)}</div>
                        </div>
                        {liveChapter.lastMessage && (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{liveChapter.lastMessage}</p>
                        )}
                      </div>
                    )}

                    {recentChapterRuns.length > 0 && (
                      <div className="space-y-2">
                        {recentChapterRuns.slice(0, 4).map((chapterRun) => (
                          <div
                            key={`${chapterRun.chapterNumber}-${chapterRun.startedAt}`}
                            className="rounded-md border border-gray-200 px-3 py-2 text-xs dark:border-gray-800"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                第 {chapterRun.chapterNumber} 章 {chapterRun.title || ''}
                              </span>
                              <span className={chapterRun.status === 'FAILED' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}>
                                {chapterRun.status === 'FAILED' ? '失败' : chapterRun.qualityStatus === 'reviewing' ? '待审稿' : '完成'}
                              </span>
                            </div>
                            <div className="mt-1 grid grid-cols-2 gap-2 text-gray-500 dark:text-gray-400">
                              <div>Planner：{formatDuration(chapterRun.phaseTimings.planner)}</div>
                              <div>Writer：{formatDuration(chapterRun.phaseTimings.writer)}</div>
                              <div>Summarizer：{formatDuration(chapterRun.phaseTimings.summarizer)}</div>
                              <div>DB 回写：{formatDuration(chapterRun.phaseTimings.db_write)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {project.recentCommits && project.recentCommits.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="h-5 w-5 text-blue-600" />
                      章节提交
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {project.recentCommits.map((commit) => (
                      <div key={commit.id} className="rounded-md border border-gray-200 px-3 py-2 text-xs dark:border-gray-800">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            第 {commit.chapterNo} 章
                          </span>
                          <Badge variant={commit.status === 'accepted' ? 'success' : commit.status === 'replayed' ? 'primary' : 'warning'}>
                            {commit.status}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 text-gray-500 dark:text-gray-400">
                          <span>来源：{commit.source}</span>
                          <span>重放：{commit.replayCount}</span>
                        </div>
                        <div className="mt-1 text-gray-500 dark:text-gray-400">
                          {commit.appliedAt ? `已应用：${new Date(commit.appliedAt).toLocaleString()}` : '待应用'}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {project.preflight && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {project.preflight.ready ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                      )}
                      项目预检
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className={`rounded-md border px-3 py-3 ${
                      project.preflight.healthLevel === 'critical'
                        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300'
                        : project.preflight.healthLevel === 'warning'
                          ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                          : 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300'
                    }`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">项目健康分</div>
                        <Badge variant={healthLevelMap[project.preflight.healthLevel].variant}>
                          {healthLevelMap[project.preflight.healthLevel].label}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between gap-3">
                        <span className="text-2xl font-semibold">{project.preflight.healthScore}</span>
                        <span className="text-xs opacity-80">/100</span>
                      </div>
                      <div className="mt-2 text-xs leading-5 opacity-90">
                        {project.preflight.primaryAction}
                      </div>
                    </div>

                    {!project.preflight.hasModel && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                        <div className="font-medium">先绑定 AI 模型，再启动主链路</div>
                        <div className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-300">
                          绑定方式很简单：如果你已经在“系统设置 → AI 配置”里创建过配置，就点“编辑项目”在 AI 模型配置里选择它；
                          如果还没有配置，先去系统设置新增一个，再回来选择。
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="primary" onClick={() => setShowEditModal(true)}>
                            编辑项目
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => router.push('/settings')}>
                            去系统设置
                          </Button>
                        </div>
                      </div>
                    )}
                    {project.preflight.hasModel && (!project.preflight.hasBlueprint || !project.preflight.hasArcPlans || !project.preflight.hasStoryState) && (
                      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
                        <div className="font-medium">可以先一键初始化创作系统</div>
                        <div className="mt-1 text-xs leading-5 text-blue-700 dark:text-blue-300">
                          这会自动生成 Book Blueprint、Arc Plan、世界状态与故事状态。完成后再启动主流水线，长篇生产会更稳定。
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="primary" onClick={handleBootstrapProject} disabled={bootstrapping}>
                            {bootstrapping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                            一键初始化
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-400">
                      <div>模型：{project.preflight.hasModel ? '已绑定' : '未绑定'}</div>
                      <div>蓝图：{project.preflight.hasBlueprint ? '已生成' : '未生成'}</div>
                      <div>阶段规划：{project.preflight.hasArcPlans ? '已生成' : '未生成'}</div>
                      <div>故事状态：{project.preflight.hasStoryState ? '已初始化' : '未初始化'}</div>
                      <div>世界状态：{project.preflight.hasWorldState ? '已初始化' : '未初始化'}</div>
                      <div>已完成：{project.preflight.completedChapters} 章</div>
                      <div>待审稿：{project.preflight.reviewingChapters} 章</div>
                      <div>未写作：{project.preflight.draftChapters} 章</div>
                      <div>章节摘要：{project.preflight.chapterSummaryCount} 条</div>
                      <div>卷摘要：{project.preflight.volumeSummaryCount} 条</div>
                      <div>全书摘要：{project.preflight.bookSummaryCount > 0 ? '已生成' : '未生成'}</div>
                      <div>角色档案：{project.preflight.characterCount} 条</div>
                      <div>伏笔：{project.preflight.plotlineCount} 条</div>
                      <div>研究资料：{project.preflight.researchRefCount} 条</div>
                      <div>RAG 文档：{project.preflight.ragDocumentCount} 条</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                        <div className="text-gray-500 dark:text-gray-400">章节摘要覆盖</div>
                        <div className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                          {project.preflight.chapterSummaryCoverage}%
                        </div>
                      </div>
                      <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                        <div className="text-gray-500 dark:text-gray-400">记忆覆盖</div>
                        <div className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                          {project.preflight.memoryCoverageScore}/100
                        </div>
                      </div>
                      <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                        <div className="text-gray-500 dark:text-gray-400">追读稳定度</div>
                        <div className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                          {project.preflight.strandScore}/100
                        </div>
                      </div>
                      <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                        <div className="text-gray-500 dark:text-gray-400">字数合规率</div>
                        <div className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                          {project.preflight.wordCountComplianceRate}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                      <span className="text-gray-500 dark:text-gray-400">状态</span>
                      <Badge variant={project.preflight.ready ? 'success' : 'warning'}>
                        {project.preflight.ready ? '可继续生产' : '存在风险'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                        <div className="text-gray-500 dark:text-gray-400">伏笔</div>
                        <div className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                          {project.preflight.plotlineCount} / {project.preflight.overduePlotlineCount}
                        </div>
                        <div className="mt-1 text-[11px] text-gray-500">总数 / 超期</div>
                      </div>
                      <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                        <div className="text-gray-500 dark:text-gray-400">反派</div>
                        <div className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                          {project.preflight.activeVillainCount}
                        </div>
                        <div className="mt-1 text-[11px] text-gray-500">
                          {project.preflight.finalBossCount > 0 ? '已配置终局 Boss' : '缺少终局 Boss'}
                        </div>
                      </div>
                      <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                        <div className="text-gray-500 dark:text-gray-400">建议动作</div>
                        <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {project.preflight.primaryAction}
                        </div>
                      </div>
                    </div>

                    {project.preflight.issues.length > 0 ? (
                      <div className="space-y-2">
                        {project.preflight.issues.slice(0, 4).map(issue => (
                          <div
                            key={issue.code}
                            className={`rounded-md border px-3 py-2 ${
                              issue.severity === 'error'
                                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300'
                                : issue.severity === 'warning'
                                  ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                                  : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                            }`}
                          >
                            {issue.message}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-700 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300">
                        预检未发现阻断项
                      </div>
                    )}

                    {project.preflight.recommendations.length > 0 && (
                      <div className="rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-400">
                        <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">推荐动作</div>
                        <ul className="space-y-1">
                          {project.preflight.recommendations.slice(0, 3).map((item, index) => (
                            <li key={index}>- {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* StorySteering Panel */}
              <StorySteeringPanel
                projectId={projectId}
                initialValues={{
                  pace: project.pace ?? 0.5,
                  darkness: project.darkness ?? 0.3,
                  humor: project.humor ?? 0.3,
                  romance: project.romance ?? 0.2,
                  powerGrowth: project.powerGrowth ?? 0.5,
                  conflictIntensity: project.conflictIntensity ?? 0.5,
                  mysteryDensity: project.mysteryDensity ?? 0.3,
                }}
                onSave={() => fetchProject()}
              />
            </>
          )}

          {activeTab === 'settings' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-5 w-5 text-blue-600" />
                  项目设定
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectForm
                  defaultValues={{
                    title: project.title,
                    description: project.description ?? undefined,
                    genre: project.genre ?? undefined,
                    writingStyle: project.writingStyle ?? undefined,
                    targetWordCount: project.targetWordCount ?? undefined,
                    chapterWordCount: project.chapterWordCount,
                    totalVolumes: project.totalVolumes,
                    worldSetting: project.worldSetting ?? undefined,
                    powerSystem: project.powerSystem ?? undefined,
                    protagonistProfile: project.protagonistProfile ?? undefined,
                    protagonistGoal: project.protagonistGoal ?? undefined,
                    antagonistSetting: project.antagonistSetting ?? undefined,
                    endingPlan: project.endingPlan ?? undefined,
                    writingPrompt: project.writingPrompt ?? undefined,
                    aiModelId: project.aiModelId ?? undefined,
                  }}
                  onSubmit={handleUpdate}
                  onCancel={() => setActiveTab('dashboard')}
                  loading={submitting}
                  submitLabel="保存修改"
                  showAdvancedFields={false}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Sidebar */}
        <div className={`space-y-4 transition-all duration-300 ${sidebarCollapsed ? 'hidden' : ''}`}>
          <div className="flex items-center justify-end">
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
              title="收起侧栏"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-blue-600" />
                  写作进度
                </h3>
                <span className="text-lg font-bold text-blue-600">
                  {progress !== null ? `${progress}%` : '-'}
                </span>
              </div>
              {project.targetWordCount ? (
                <Progress value={project.currentWordCount} max={project.targetWordCount} showLabel size="sm" />
              ) : (
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                  <div className="h-full w-0 bg-blue-500 rounded-full" />
                </div>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm font-bold">{project.currentWordCount.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">当前</p>
                </div>
                <div>
                  <p className="text-sm font-bold">{project.targetWordCount?.toLocaleString() || '-'}</p>
                  <p className="text-xs text-gray-500">目标</p>
                </div>
                <div>
                  <p className="text-sm font-bold">{project.chapters.length}</p>
                  <p className="text-xs text-gray-500">章节</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">创作模式</span>
                <Badge variant={project.projectMode === 'CREATE' ? 'primary' : 'secondary'}>
                  {project.projectMode === 'CREATE' ? '创作' : '分析'}
                </Badge>
              </div>
              {project.aiModelConfig && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">AI 模型</span>
                  <span className="text-sm font-medium">{project.aiModelConfig.name}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">更新时间</span>
                <span className="text-sm">{new Date(project.updatedAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {project.protagonistProfile && (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5 mb-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  主角设定
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                  {project.protagonistProfile}
                </p>
              </CardContent>
            </Card>
          )}

          {project.worldSetting && (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5 mb-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  世界设定
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                  {project.worldSetting}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Collapsed Sidebar Toggle */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 border border-r-0 border-gray-200 dark:border-gray-700 rounded-l-lg px-1.5 py-3 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="展开侧栏"
        >
          <ChevronDown className="h-4 w-4 text-gray-500 rotate-90" />
        </button>
      )}

      {/* Toolbox */}
      <Toolbox
        open={showToolbox}
        onClose={() => setShowToolbox(false)}
        tools={toolboxItems}
      />

      {/* Chapter Preview Modal */}
      <Modal
        open={showChapterPreview}
        onClose={() => {
          setShowChapterPreview(false)
          setPreviewChapter(null)
        }}
        title={previewChapter ? `第${previewChapter.chapterNumber}章 · ${previewChapter.title || '无标题'}` : ''}
        className="max-w-3xl"
      >
        {previewChapter && (
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <Badge variant={chapterStatusMap[previewChapter.status].variant}>
                {chapterStatusMap[previewChapter.status].label}
              </Badge>
              <span className="text-sm text-gray-500">
                {(previewChapter.wordCount || 0).toLocaleString()} 字
              </span>
            </div>

            {previewChapter.summary && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
                <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">
                  章节概要
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {previewChapter.summary}
                </p>
              </div>
            )}

            {previewChapter.content ? (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 max-h-[60vh] overflow-y-auto">
                <div className="text-sm text-gray-800 dark:text-gray-200 leading-[2] whitespace-pre-wrap">
                  {previewChapter.content}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无正文内容</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => {
                setShowChapterPreview(false)
                setPreviewChapter(null)
              }}>
                关闭
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="编辑项目"
        className="max-w-2xl"
      >
        <ProjectForm
          defaultValues={{
            title: project.title,
            description: project.description ?? undefined,
            genre: project.genre ?? undefined,
            writingStyle: project.writingStyle ?? undefined,
            targetWordCount: project.targetWordCount ?? undefined,
            chapterWordCount: project.chapterWordCount,
            totalVolumes: project.totalVolumes,
            worldSetting: project.worldSetting ?? undefined,
            powerSystem: project.powerSystem ?? undefined,
            protagonistProfile: project.protagonistProfile ?? undefined,
            protagonistGoal: project.protagonistGoal ?? undefined,
            antagonistSetting: project.antagonistSetting ?? undefined,
            endingPlan: project.endingPlan ?? undefined,
            writingPrompt: project.writingPrompt ?? undefined,
            aiModelId: project.aiModelId ?? undefined,
          }}
          onSubmit={handleUpdate}
          onCancel={() => setShowEditModal(false)}
          loading={submitting}
          submitLabel="保存修改"
          showAdvancedFields={false}
        />
      </Modal>

      {/* Delete Project Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="删除项目"
        description="确定要删除这个项目吗？此操作不可撤销，所有章节内容也将被删除。"
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
            取消
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={submitting}>
            删除
          </Button>
        </div>
      </Modal>

      {/* Research Modal */}
      <Modal
        open={showResearchModal}
        onClose={() => setShowResearchModal(false)}
        title="资料研究"
        className="max-w-3xl"
      >
        <ResearchPanel projectId={projectId} />
      </Modal>

      {/* Cover Generator Modal */}
      <Modal
        open={showCoverModal}
        onClose={() => setShowCoverModal(false)}
        title="封面生成"
        className="max-w-4xl"
      >
        <CoverGenerator projectId={projectId} onCoverApplied={fetchProject} />
      </Modal>

      {/* Plot Analyzer Modal */}
      <Modal
        open={showPlotAnalysisModal}
        onClose={() => setShowPlotAnalysisModal(false)}
        title="剧情分析"
        className="max-w-4xl"
      >
        <PlotAnalyzer
          projectId={projectId}
          projectTitle={project.title}
          totalVolumes={project.totalVolumes}
        />
      </Modal>

      {/* Review Modal */}
      <Modal
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title="对抗式审稿"
        className="max-w-4xl"
      >
        <ReviewPanel
          projectId={projectId}
          chapters={project.chapters.map(ch => ({
            id: ch.id,
            chapterNumber: ch.chapterNumber,
            title: ch.title,
          }))}
        />
      </Modal>

      {/* Deslop Modal */}
      <Modal
        open={showDeslopModal}
        onClose={() => setShowDeslopModal(false)}
        title="去AI味"
        className="max-w-4xl"
      >
        <DeslopPanel projectId={projectId} />
      </Modal>

      {/* Export Modal */}
      <Modal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="多平台导出"
        className="max-w-2xl"
      >
        <ExportPanel
          projectId={projectId}
          projectTitle={project.title}
          chapterCount={project.chapters.length}
        />
      </Modal>

      {/* Auto Pipeline Modal */}
      <Modal
        open={showAutoPipelineModal}
        onClose={() => setShowAutoPipelineModal(false)}
        title="全自动流水线"
        className="max-w-2xl"
      >
        <AutoPipelinePanel
          projectId={projectId}
          maxChapter={project.chapters.length}
          onClose={() => setShowAutoPipelineModal(false)}
        />
      </Modal>
    </>
  )
}

'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Progress, Modal, toast, MoreActionsMenu, ExpandableList } from '@/components/ui'
import { BlueprintConsole, ProjectBaseInfoForm, ProjectBaseInfoFormData } from '@/components/project'
import { WorkflowBlueprintCard } from '@/components/project/WorkflowBlueprintCard'
import { WorkflowArcPlanCard } from '@/components/project/WorkflowArcPlanCard'
import { Toolbox, CharacterPanel } from '@/components/ai'
import { CoverGenerator, ResearchPanel, ReviewPanel, DeslopPanel, ExportPanel, AnalysisWorkbench } from '@/components/ai'
import { BookOpen, Clock, Target, Users, Layers, Search, ClipboardList, Rocket, Shield, Sparkles, ChevronRight, ChevronDown, Wrench, Eye, Play, Pause, AlertCircle, CheckCircle2, Loader2, Download } from 'lucide-react'
import { formatDisplayDate, formatDisplayDateTime } from '@/lib/helpers'
import type { ProjectStatus } from '@/types'
import type { PipelineRuntimeState } from '@/lib/engine/pipeline-runtime'
import type { BlueprintConsoleSnapshot } from '@/lib/engine/blueprint-console'

const INITIAL_VISIBLE_PROJECT_CHAPTERS_PER_GROUP = 10

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
  id: string
  arcNumber: number
  name: string
  stage: string
  startChapter: number
  endChapter?: number | null
  goals: string[]
  keyEvents: string[]
  batchSize: number
  isCompleted: boolean
  chapters?: Chapter[]
}

interface BookBlueprint {
  corePitch: string
  worldDirection?: string | null
  mainlineDirection?: string | null
  growthDirection?: string | null
  endingDirection?: string | null
  platformStrategy?: string | null
  genreStrategy?: string | null
  styleStrategy?: string | null
  popularFictionProfile?: Record<string, unknown> | null
  constraints: string[]
}

interface StoryRoadmapItem {
  arcId?: string
  arcNumber: number
  title: string
  chapterRange: string
  summary: string
  mainEmotion: string
  stagePayoff: string
  conflictFocus: string
  hookStrategy: string
  highlights: string[]
  forbidden: string[]
}

interface Project {
  id: number
  title: string
  description?: string | null
  genre?: string | null
  writingStyle?: string | null
  lengthType?: 'SHORT' | 'MEDIUM' | 'LONG' | 'ULTRA_LONG' | null
  targetWordCount?: number | null
  effectiveTargetWordCount?: number | null
  estimatedTotalChapters?: number
  expectedStageCount?: number
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
  workflowStage?: 'BLUEPRINT_CONFIRM' | 'ARC_PLAN_CONFIRM' | 'GENERATE'
  blueprintConfirmedAt?: string | null
  arcPlanConfirmedAt?: string | null
  bookBlueprint?: BookBlueprint | null
  arcPlans?: ArcPlan[]
  storyRoadmap?: StoryRoadmapItem[]
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
    blockers: string[]
    statusHeadline: string
    nextSteps: Array<{
      title: string
      detail: string
      urgency: 'now' | 'soon' | 'watch'
      blocking: boolean
      relatedIssueCodes: string[]
    }>
    riskHighlights: Array<{
      code: string
      title: string
      detail: string
      severity: 'error' | 'warning' | 'info'
    }>
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
  maintenanceSummary?: {
    bootstrapQueued: boolean
    bootstrapRunning: boolean
    ragQueued: boolean
    ragRunning: boolean
    bootstrapFailed: boolean
    ragFailed: boolean
    bootstrapError?: string | null
    ragError?: string | null
    queuedTaskCount: number
    bootstrapProgress?: {
      phase: string
      message: string
      stepIndex: number
      stepTotal: number
      percent: number
      updatedAt: string
    } | null
    ragProgress?: {
      phase: string
      message: string
      stepIndex: number
      stepTotal: number
      percent: number
      updatedAt: string
    } | null
  }
  blueprintConsole?: BlueprintConsoleSnapshot
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

const defaultSteeringValues = {
  pace: 0.5,
  darkness: 0.3,
  humor: 0.3,
  romance: 0.2,
  powerGrowth: 0.5,
  conflictIntensity: 0.5,
  mysteryDensity: 0.3,
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

type NextStepState = {
  badgeVariant: 'primary' | 'warning' | 'success' | 'secondary'
  badgeLabel: string
  title: string
  description: string
  ctaLabel: string
  ctaAction: 'start' | 'edit' | 'settings' | 'retry' | 'wait' | 'resume' | 'tab-settings' | 'confirm-blueprint' | 'confirm-arc-plan'
  disabled?: boolean
}

type DashboardTab = 'dashboard' | 'settings' | 'analysis' | 'characters'

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

interface ProjectDetailClientProps {
  initialProject: Project | null
}

export default function ProjectDetailPage({ initialProject }: ProjectDetailClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const projectId = useMemo(() => {
    const match = pathname?.match(/\/projects\/(\d+)(?:\/|$)/)
    return match ? Number(match[1]) : NaN
  }, [pathname])

  const [project, setProject] = useState<Project | null>(initialProject)
  const [loading, setLoading] = useState(!initialProject)
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pipelineStarting, setPipelineStarting] = useState(false)
  const [maintenanceRetrying, setMaintenanceRetrying] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard')

  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null)
  const lastPipelineStatusRef = useRef<PipelineStatus['status'] | null>(null)
  const pipelineStreamRef = useRef<EventSource | null>(null)
  const maintenanceActive = Boolean(
    project?.maintenanceSummary?.bootstrapQueued ||
    project?.maintenanceSummary?.bootstrapRunning ||
    project?.maintenanceSummary?.ragQueued ||
    project?.maintenanceSummary?.ragRunning
  )
  const bootstrapProgress = project?.maintenanceSummary?.bootstrapProgress || null
  const ragProgress = project?.maintenanceSummary?.ragProgress || null
  const maintenanceFailed = Boolean(
    !maintenanceActive && (
      project?.maintenanceSummary?.bootstrapFailed ||
      project?.maintenanceSummary?.ragFailed
    )
  )
  const projectInitializing = maintenanceActive

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
      setError('获取小说详情失败')
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
      toast.success(`AI 生成完成，共生成 ${nextPipeline.totalChapters} 章`)
      fetchProject()
    } else if (nextStatus === 'FAILED' && prevStatus !== 'FAILED') {
      toast.error(nextPipeline.error || 'AI 生成失败')
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
    if (!projectInitializing) return
    const timer = window.setInterval(() => {
      void fetchProject()
    }, 3000)
    return () => window.clearInterval(timer)
  }, [fetchProject, projectInitializing])

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

  const handleUpdate = async (formData: ProjectBaseInfoFormData) => {
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
        toast.success('小说已更新')
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
        toast.success('小说已删除')
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
        toast.success('AI 生成已恢复')
        fetchProject()
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
        toast.success('AI 生成已暂停')
        fetchProject()
      } else {
        toast.error(data.error?.message || '暂停失败')
      }
    } catch {
      toast.error('暂停失败')
    }
  }

  const handleStartPipeline = async () => {
    if (!project) return

    if (maintenanceActive) {
      toast.error('创作系统仍在初始化，请完成后再开始 AI 生成')
      return
    }

    if (!project.blueprintConfirmedAt) {
      toast.error('请先确认蓝图')
      return
    }

    if (!project.arcPlanConfirmedAt) {
      toast.error('请先确认故事路线图')
      return
    }

    setPipelineStarting(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/pipeline/start`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('AI 生成已启动')
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
      toast.error('启动 AI 生成失败')
    } finally {
      setPipelineStarting(false)
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
        fetchProject()
      } else {
        toast.error(data.error?.message || '恢复失败')
      }
    } catch {
      toast.error('恢复失败')
    }
  }

  const handleRetryMaintenance = async () => {
    setMaintenanceRetrying(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/maintenance/retry`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.data?.message || '已重新触发初始化任务')
        await fetchProject()
      } else {
        toast.error(data.error?.message || '重试初始化失败')
      }
    } catch {
      toast.error('重试初始化失败')
    } finally {
      setMaintenanceRetrying(false)
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
      label: project?.projectMode === 'ANALYZE' ? '拆书工作台' : '剧情分析',
      description: project?.projectMode === 'ANALYZE' ? '查看拆书结论与发起分析任务' : '分析剧情结构和发展',
      icon: <ClipboardList className="h-4 w-4" />,
      onClick: () => {
        if (project?.projectMode === 'ANALYZE') {
          setActiveTab('analysis')
          return
        }
        setShowPlotAnalysisModal(true)
      },
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
        <p className="text-red-500">{error || '小说不存在'}</p>
        <Button variant="outline" onClick={() => router.push('/projects')} className="mt-4">
          返回列表
        </Button>
      </div>
    )
  }

  const progress = project.targetWordCount
    ? Math.round((project.currentWordCount / (project.effectiveTargetWordCount || project.targetWordCount)) * 100)
    : null
  const effectiveTargetWordCount = project.effectiveTargetWordCount || project.targetWordCount || null
  const estimatedTotalChapters = project.estimatedTotalChapters || (effectiveTargetWordCount
    ? Math.ceil(effectiveTargetWordCount / Math.max(1, project.chapterWordCount || 3000))
    : null)

  const completedChapters = project.chapters.filter(c => c.status === 'COMPLETED').length
  const reviewingChapters = project.chapters.filter(c => c.status === 'REVIEWING').length
  const arcGroups = groupChaptersByArc(project)
  const liveChapter = pipeline?.runtime?.currentChapter || null
  const recentChapterRuns = pipeline?.runtime?.recentChapters || []
  const hasBoundModel = Boolean(project.aiModelConfig)
  const isAnalyzeMode = project.projectMode === 'ANALYZE'
  const workflowStage = project.workflowStage || (!project.blueprintConfirmedAt ? 'BLUEPRINT_CONFIRM' : !project.arcPlanConfirmedAt ? 'ARC_PLAN_CONFIRM' : 'GENERATE')
  const flowBlockedReason = !project.bookBlueprint
    ? '请先生成并确认全书蓝图'
    : !project.blueprintConfirmedAt
      ? 'Blueprint 未确认前，不允许启动正文生成'
      : !project.arcPlans?.length
        ? '请先生成 ArcPlan'
        : !project.arcPlanConfirmedAt
          ? '故事路线图未确认前，不允许生成章节目录'
          : null
  const steeringValues = {
    pace: project.pace ?? defaultSteeringValues.pace,
    darkness: project.darkness ?? defaultSteeringValues.darkness,
    humor: project.humor ?? defaultSteeringValues.humor,
    romance: project.romance ?? defaultSteeringValues.romance,
    powerGrowth: project.powerGrowth ?? defaultSteeringValues.powerGrowth,
    conflictIntensity: project.conflictIntensity ?? defaultSteeringValues.conflictIntensity,
    mysteryDensity: project.mysteryDensity ?? defaultSteeringValues.mysteryDensity,
  }
  const aiConsoleStatus = project.preflight ? {
    hasBlueprint: project.preflight.hasBlueprint,
    hasArcPlans: project.preflight.hasArcPlans,
    hasStoryState: project.preflight.hasStoryState,
    maintenanceActive,
    completedChapters: project.preflight.completedChapters,
    totalChapters: project.preflight.totalChapters,
    chapterSummaryCount: project.preflight.chapterSummaryCount,
    volumeSummaryCount: project.preflight.volumeSummaryCount,
    bookSummaryReady: project.preflight.bookSummaryCount > 0,
    primaryAction: project.preflight.primaryAction,
  } : undefined
  const nextStepState: NextStepState | null = project.preflight ? (() => {
    if (!project.preflight.hasModel) {
      return {
        badgeVariant: 'warning',
        badgeLabel: '阻断项',
        title: '先绑定可用模型',
        description: '当前项目还没有真正绑定可用的 AI 模型。先完成绑定，后续蓝图、目录和正文生产才会稳定接管。',
        ctaLabel: '前往模型设置',
        ctaAction: 'settings',
      }
    }

    if (maintenanceFailed) {
      return {
        badgeVariant: 'warning',
        badgeLabel: '需修复',
        title: '初始化任务失败，需要重试',
        description: project.maintenanceSummary?.bootstrapError || project.maintenanceSummary?.ragError || '后台初始化未完成，先修复初始化，再继续 AI 生产。',
        ctaLabel: '重试初始化',
        ctaAction: 'retry',
      }
    }

    if (maintenanceActive) {
      return {
        badgeVariant: 'secondary',
        badgeLabel: '等待中',
        title: 'AI 正在接管底层创作配置',
        description: '系统正在自动补齐 Blueprint、故事路线和故事状态。这里完成后，再开始整书生成。',
        ctaLabel: '等待完成',
        ctaAction: 'wait',
        disabled: true,
      }
    }

    if (!project.bookBlueprint || !project.blueprintConfirmedAt) {
      return {
        badgeVariant: 'warning',
        badgeLabel: '待确认',
        title: '先确认全书蓝图',
        description: '核心卖点、世界方向、主线方向、成长方向、终局方向以及平台/题材/风格策略需要先被人工确认，之后才能进入后续生产。',
        ctaLabel: '确认蓝图',
        ctaAction: 'confirm-blueprint',
      }
    }

    if (!project.arcPlans?.length || !project.arcPlanConfirmedAt) {
      return {
        badgeVariant: 'warning',
        badgeLabel: '待确认',
        title: '先确认故事路线图',
        description: 'AI 已经给出全书发展路线。你只需要判断故事这样发展是否顺眼，确认后才允许生成目录和正文。',
        ctaLabel: '确认故事路线',
        ctaAction: 'confirm-arc-plan',
      }
    }

    if (pipeline?.status === 'RUNNING' || pipeline?.status === 'PENDING') {
      return {
        badgeVariant: 'primary',
        badgeLabel: '进行中',
        title: 'AI 正在推进当前批次写作',
        description: liveChapter
          ? `当前已进入第 ${liveChapter.chapterNumber} 章，正在执行 ${getPipelineStepLabel(liveChapter.currentPhase || liveChapter.currentAgent || 'WRITE')}。`
          : '当前正在执行整书生成流水线，可以在下方章节区和进度区追踪状态。',
        ctaLabel: '查看 AI 调校',
        ctaAction: 'tab-settings',
      }
    }

    if (pipeline?.status === 'PAUSED' || pipeline?.status === 'FAILED') {
      return {
        badgeVariant: 'warning',
        badgeLabel: pipeline.status === 'PAUSED' ? '已暂停' : '已失败',
        title: pipeline.status === 'PAUSED' ? '生产已暂停，等待恢复' : '生产中断，建议恢复运行',
        description: pipeline.error || '可以先恢复运行；如果再次失败，再检查模型配置、预检项和最近章节状态。',
        ctaLabel: '恢复运行',
        ctaAction: 'resume',
      }
    }

    if (project.chapters.length === 0) {
      return {
        badgeVariant: 'primary',
        badgeLabel: '可开始',
        title: '可以开始第一轮 AI 生产',
        description: '前置条件已经基本齐备。下一步直接让 AI 生成蓝图、目录与首批章节，而不是继续手工配置。',
        ctaLabel: '开始 AI 生成',
        ctaAction: 'start',
      }
    }

    if (project.preflight.reviewingChapters > 0) {
      return {
        badgeVariant: 'warning',
        badgeLabel: '待处理',
        title: '已有章节进入待审稿状态',
        description: `当前有 ${project.preflight.reviewingChapters} 章处于待审稿状态。建议先回看这些章节，再继续大规模推进。`,
        ctaLabel: '查看 AI 调校',
        ctaAction: 'tab-settings',
      }
    }

    return {
      badgeVariant: 'success',
      badgeLabel: '可继续',
      title: '主链路畅通，可以继续生产',
      description: project.preflight.statusHeadline || project.preflight.primaryAction || '当前没有明显阻断，继续推进新章节和摘要回写即可。',
      ctaLabel: '继续 AI 生成',
      ctaAction: 'start',
    }
  })() : null

  const handleNextStep = () => {
    if (!nextStepState || nextStepState.disabled) return

    switch (nextStepState.ctaAction) {
      case 'start':
        void handleStartPipeline()
        break
      case 'confirm-blueprint':
        setActiveTab('dashboard')
        break
      case 'confirm-arc-plan':
        setActiveTab('dashboard')
        break
      case 'edit':
        setShowEditModal(true)
        break
      case 'settings':
        router.push('/settings')
        break
      case 'retry':
        void handleRetryMaintenance()
        break
      case 'resume':
        void handleResumePipeline()
        break
      case 'tab-settings':
        setActiveTab('settings')
        break
      case 'wait':
      default:
        break
    }
  }

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
      {!isAnalyzeMode && pipeline && (pipeline.status === 'RUNNING' || pipeline.status === 'PENDING' || pipeline.status === 'PAUSED') && (
        <div className={`mb-4 rounded-lg px-4 py-3 ${
          pipeline.status === 'PAUSED'
            ? 'border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-900/20'
            : 'border border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-900/20'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2
                className={`h-4 w-4 ${
                  pipeline.status === 'PAUSED'
                    ? 'text-amber-600'
                    : 'text-blue-600'
                } ${pipeline.status === 'RUNNING' ? 'animate-spin' : ''}`}
              />
              <span className={`text-sm font-medium ${
                pipeline.status === 'PAUSED'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-blue-700 dark:text-blue-300'
              }`}>
                {pipeline.status === 'PENDING'
                  ? 'AI 生成准备中'
                  : pipeline.status === 'PAUSED'
                    ? 'AI 生成已暂停'
                    : `AI 生成${getPipelineStatusLabel(pipeline.status)}`}
              </span>
            </div>
            <span className={`text-xs ${pipeline.status === 'PAUSED' ? 'text-amber-500' : 'text-blue-500'}`}>{pipeline.progress}%</span>
          </div>
          <Progress value={pipeline.progress} max={100} size="sm" />
          <div className={`flex items-center justify-between mt-2 text-xs ${
            pipeline.status === 'PAUSED'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-blue-600 dark:text-blue-400'
          }`}>
            <span>
              <span className="font-medium">{getPipelineStepLabel(pipeline.currentStep)}</span>
            </span>
            <span>
              第 {pipeline.currentChapter} / {pipeline.totalChapters} 章
            </span>
          </div>
          {liveChapter && (
            <div className={`mt-3 rounded-md px-3 py-2 text-xs ${
              pipeline.status === 'PAUSED'
                ? 'bg-amber-50/80 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                : 'bg-blue-50/80 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
            }`}>
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
          <div className="mt-3 flex items-center gap-2">
            {pipeline.status === 'RUNNING' || pipeline.status === 'PENDING' ? (
              <Button variant="outline" size="sm" onClick={handlePausePipeline} className="gap-1.5">
                <Pause className="h-3.5 w-3.5" />
                暂停
              </Button>
            ) : (
              <>
                <Button variant="primary" size="sm" onClick={() => handleRecoverPipeline('continue')} className="gap-1.5">
                  <Play className="h-3.5 w-3.5" />
                  继续生成
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRecoverPipeline('retry_chapter', liveChapter?.chapterNumber || pipeline.currentChapter)}
                  className="gap-1.5"
                >
                  重试当前章节
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleRecoverPipeline('retry_batch')} className="gap-1.5">
                  重试当前批次目录
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {!isAnalyzeMode && pipeline && pipeline.status === 'FAILED' && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-900/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-700 dark:text-red-300">
              AI 生成失败
            </span>
          </div>
          {pipeline.error && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">{pipeline.error}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => handleRecoverPipeline('continue')} className="gap-1.5">
              <Play className="h-3.5 w-3.5" />
              继续生成
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRecoverPipeline('retry_chapter', liveChapter?.chapterNumber || pipeline.currentChapter)}
              className="gap-1.5"
            >
              重试当前章节
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleRecoverPipeline('retry_batch')} className="gap-1.5">
              重试当前批次目录
            </Button>
          </div>
        </div>
      )}

      {!isAnalyzeMode && pipeline && pipeline.status === 'COMPLETED' && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/60 dark:bg-green-900/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              AI 生成完成，共生成 {pipeline.totalChapters} 章
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
          {isAnalyzeMode ? (
            <Badge variant="secondary">只读拆书模式</Badge>
          ) : (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartPipeline}
                loading={pipelineStarting}
                disabled={pipeline?.status === 'RUNNING' || pipeline?.status === 'PENDING' || pipeline?.status === 'PAUSED' || !hasBoundModel || maintenanceActive || Boolean(flowBlockedReason)}
                className="gap-1.5"
                title={flowBlockedReason || undefined}
              >
                <Rocket className="h-4 w-4" />
                {projectInitializing ? '初始化中' : '开始生成'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowToolbox(true)}
                className="gap-1.5"
              >
                <Wrench className="h-4 w-4" />
                辅助工具
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
            </>
          )}
        </div>
      </div>

      {isAnalyzeMode ? (
        <div className="space-y-6">
          <AnalysisWorkbench projectId={projectId} />
        </div>
      ) : (
        <>
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
            动态控制台
          </button>
          {project.projectMode === 'ANALYZE' && (
            <>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'analysis'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Layers className="h-4 w-4 inline mr-1.5" />
                结构分析
              </button>
              <button
                onClick={() => setActiveTab('characters')}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'characters'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Users className="h-4 w-4 inline mr-1.5" />
                角色档案
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className={`grid gap-6 transition-all duration-300 ${sidebarCollapsed ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]'}`}>
        <div className="space-y-6">
          {activeTab === 'dashboard' && (
            <>
              {nextStepState && (
                <Card className="border-blue-200 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={nextStepState.badgeVariant}>{nextStepState.badgeLabel}</Badge>
                          <span className="text-xs text-blue-700 dark:text-blue-300">导演总控建议的下一步</span>
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{nextStepState.title}</h2>
                        <p className="max-w-3xl text-sm leading-6 text-gray-700 dark:text-gray-300">
                          {nextStepState.description}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:min-w-48">
                        <Button
                          variant="primary"
                          onClick={handleNextStep}
                          disabled={nextStepState.disabled || pipelineStarting || maintenanceRetrying}
                          loading={nextStepState.ctaAction === 'start' ? pipelineStarting : nextStepState.ctaAction === 'retry' ? maintenanceRetrying : false}
                          className="gap-1.5"
                        >
                          <Rocket className="h-4 w-4" />
                          {nextStepState.ctaLabel}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setActiveTab('settings')}
                          className="gap-1.5"
                        >
                          <Target className="h-4 w-4" />
                          查看 AI 调校
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">主流程</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-slate-950/30">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              workflowStage === 'BLUEPRINT_CONFIRM'
                                ? 'warning'
                                : workflowStage === 'ARC_PLAN_CONFIRM'
                                  ? 'primary'
                                  : 'success'
                            }
                          >
                            {workflowStage === 'BLUEPRINT_CONFIRM'
                              ? '当前阶段：蓝图确认'
                              : workflowStage === 'ARC_PLAN_CONFIRM'
                                ? '当前阶段：路线确认'
                                : '当前阶段：开始生成'}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {project.blueprintConfirmedAt && project.arcPlanConfirmedAt ? '前置确认已完成' : '先完成前置确认，再交给 AI 连续生产'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {flowBlockedReason || '当前没有前置阻断，主链路已经解锁。'}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={project.blueprintConfirmedAt ? 'success' : 'warning'}>
                          蓝图{project.blueprintConfirmedAt ? '已确认' : '待确认'}
                        </Badge>
                        <Badge variant={project.arcPlanConfirmedAt ? 'success' : project.blueprintConfirmedAt ? 'warning' : 'secondary'}>
                          路线{project.arcPlanConfirmedAt ? '已确认' : '待确认'}
                        </Badge>
                        <Badge variant={flowBlockedReason ? 'secondary' : 'success'}>
                          生成{flowBlockedReason ? '未解锁' : '已解锁'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <WorkflowBlueprintCard
                    key={`bp-${project.updatedAt}-${project.blueprintConfirmedAt || 'pending'}`}
                    projectId={projectId}
                    blueprint={project.bookBlueprint}
                    confirmed={Boolean(project.blueprintConfirmedAt)}
                    confirmedAt={project.blueprintConfirmedAt}
                    onUpdated={fetchProject}
                  />
                  <WorkflowArcPlanCard
                    key={`arc-${project.updatedAt}-${project.arcPlanConfirmedAt || 'pending'}`}
                    projectId={projectId}
                    roadmap={project.storyRoadmap || []}
                    confirmed={Boolean(project.arcPlanConfirmedAt)}
                    disabled={!project.blueprintConfirmedAt}
                    onUpdated={fetchProject}
                  />
                  <Card className={`border-green-200 bg-green-50/60 dark:border-green-900/40 dark:bg-green-950/20 ${project.blueprintConfirmedAt && project.arcPlanConfirmedAt ? 'ring-1 ring-green-200 dark:ring-green-800/60' : ''}`}>
                    <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-medium text-green-800 dark:text-green-200">3. 开始生成</div>
                        <div className="mt-1 text-sm text-green-700 dark:text-green-300">
                          {project.blueprintConfirmedAt && project.arcPlanConfirmedAt
                            ? '主链路已经解锁，可以直接开始生成章节目录和正文。'
                            : '只有当 Blueprint 和 ArcPlan 都确认后，系统才允许生成章节目录和正文。'}
                        </div>
                        {flowBlockedReason && (
                          <div className="mt-2 text-xs text-green-700/80 dark:text-green-300/80">{flowBlockedReason}</div>
                        )}
                      </div>
                      <Button
                        variant="primary"
                        onClick={handleStartPipeline}
                        loading={pipelineStarting}
                        disabled={pipeline?.status === 'RUNNING' || pipeline?.status === 'PENDING' || pipeline?.status === 'PAUSED' || !hasBoundModel || maintenanceActive || Boolean(flowBlockedReason)}
                      >
                        开始生成
                      </Button>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>

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
                        暂无章节，开始 AI 生成后会自动生成
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleStartPipeline}
                        loading={pipelineStarting}
                        disabled={pipeline?.status === 'RUNNING' || pipeline?.status === 'PENDING' || pipeline?.status === 'PAUSED' || !hasBoundModel || maintenanceActive || Boolean(flowBlockedReason)}
                        className="mt-4 gap-1.5"
                        title={flowBlockedReason || undefined}
                      >
                        <Rocket className="h-4 w-4" />
                        {projectInitializing ? '初始化中' : '开始生成'}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {arcGroups.map((group, groupIdx) => {
                        const groupKey = `${group.arcNumber || 0}-${group.arcName || 'chapters'}-${groupIdx}`

                        return (
                          <div key={groupKey}>
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
                            <ExpandableList
                              items={group.chapters}
                              initialVisibleCount={INITIAL_VISIBLE_PROJECT_CHAPTERS_PER_GROUP}
                              className="space-y-1"
                              buttonClassName="gap-1.5"
                              collapsedLabel={(hiddenCount) => `展开剩余 ${hiddenCount} 章`}
                              expandedLabel="收起目录"
                              getKey={(chapter) => chapter.id}
                              renderItem={(chapter) => (
                                <div
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
                              )}
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {pipeline && (liveChapter || recentChapterRuns.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="h-5 w-5 text-blue-600" />
                      AI 生成进度
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
                          {commit.appliedAt ? `已应用：${formatDisplayDateTime(commit.appliedAt)}` : '待应用'}
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
                      小说预检
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
                        <div className="font-medium">小说健康分</div>
                        <Badge variant={healthLevelMap[project.preflight.healthLevel].variant}>
                          {healthLevelMap[project.preflight.healthLevel].label}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between gap-3">
                        <span className="text-2xl font-semibold">{project.preflight.healthScore}</span>
                        <span className="text-xs opacity-80">/100</span>
                      </div>
                      <div className="mt-2 text-xs leading-5 opacity-90">
                        {project.preflight.statusHeadline}
                      </div>
                    </div>

                    {nextStepState && (
                      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="text-sm font-medium text-blue-800 dark:text-blue-200">现在就做这一步</div>
                            <div className="mt-1 text-xs leading-5 text-blue-700 dark:text-blue-300">
                              {nextStepState.title}。{nextStepState.description}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={handleNextStep}
                            disabled={nextStepState.disabled || pipelineStarting || maintenanceRetrying}
                            loading={nextStepState.ctaAction === 'start' ? pipelineStarting : nextStepState.ctaAction === 'retry' ? maintenanceRetrying : false}
                          >
                            {nextStepState.ctaLabel}
                          </Button>
                        </div>
                      </div>
                    )}

                    {!project.preflight.hasModel && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                        <div className="font-medium">先绑定 AI 模型，再开始生成</div>
                        <div className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-300">
                          绑定方式很简单：如果你已经在“系统设置 → AI 配置”里创建过配置，就点“编辑小说”在 AI 模型配置里选择它；
                          如果还没有配置，先去系统设置新增一个，再回来选择。
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="primary" onClick={() => setShowEditModal(true)}>
                            编辑小说
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => router.push('/settings')}>
                            去系统设置
                          </Button>
                        </div>
                      </div>
                    )}
                    {project.preflight.hasModel && (maintenanceActive || maintenanceFailed || !project.preflight.hasBlueprint || !project.preflight.hasArcPlans || !project.preflight.hasStoryState || !project.preflight.hasWorldState) && (
                      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
                        <div className="font-medium">
                        {project.maintenanceSummary?.bootstrapQueued || project.maintenanceSummary?.bootstrapRunning
                            ? 'AI 正在自动补齐创作配置'
                            : maintenanceFailed
                              ? '创作系统初始化失败'
                            : project.maintenanceSummary?.ragQueued || project.maintenanceSummary?.ragRunning
                              ? 'AI 正在自动重建 RAG 索引'
                              : '系统会自动补齐创作配置'}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-blue-700 dark:text-blue-300">
                          {maintenanceFailed
                            ? (project.maintenanceSummary?.bootstrapError || project.maintenanceSummary?.ragError || '后台初始化任务失败，请检查当前 AI 模型配置后重试。')
                            : '系统会自动补齐 Book Blueprint、故事路线、世界状态、故事状态以及 RAG 索引。完成前请勿开始 AI 生成。页面会自动刷新，无需手动刷新。'}
                        </div>
                        {maintenanceFailed && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant="primary" onClick={handleRetryMaintenance} loading={maintenanceRetrying}>
                              重试初始化
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => router.push('/settings')}>
                              检查 AI 配置
                            </Button>
                          </div>
                        )}
                        {(bootstrapProgress || ragProgress) && (
                          <div className="mt-3 space-y-2">
                            {bootstrapProgress && (
                              <div className="rounded-md border border-blue-100 bg-white/70 px-3 py-2 dark:border-blue-900/40 dark:bg-blue-950/30">
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <span className="font-medium text-blue-800 dark:text-blue-200">初始化进度</span>
                                  <span className="text-blue-600 dark:text-blue-300">{bootstrapProgress.percent}%</span>
                                </div>
                                <div className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                                  {bootstrapProgress.message}
                                </div>
                                <Progress value={bootstrapProgress.percent} max={100} size="sm" className="mt-2" />
                                <div className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">
                                  第 {bootstrapProgress.stepIndex} / {bootstrapProgress.stepTotal} 步 · {bootstrapProgress.phase}
                                </div>
                              </div>
                            )}
                            {ragProgress && (
                              <div className="rounded-md border border-blue-100 bg-white/70 px-3 py-2 dark:border-blue-900/40 dark:bg-blue-950/30">
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <span className="font-medium text-blue-800 dark:text-blue-200">RAG 重建进度</span>
                                  <span className="text-blue-600 dark:text-blue-300">{ragProgress.percent}%</span>
                                </div>
                                <div className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                                  {ragProgress.message}
                                </div>
                                <Progress value={ragProgress.percent} max={100} size="sm" className="mt-2" />
                                <div className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">
                                  {ragProgress.phase}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-400">
                      <div>模型：{project.preflight.hasModel ? '已绑定' : '未绑定'}</div>
                      <div>蓝图：{project.preflight.hasBlueprint ? '已生成' : '未生成'}</div>
                      <div>故事路线：{project.preflight.hasArcPlans ? '已生成' : '未生成'}</div>
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
                        {project.maintenanceSummary?.queuedTaskCount ? (
                          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            后台任务：{project.maintenanceSummary.queuedTaskCount} 个
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 rounded-md border border-gray-200 px-3 py-3 dark:border-gray-800 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">RAG 索引</div>
                        <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {project.preflight.ragDocumentCount > 0
                            ? `已建立，共 ${project.preflight.ragDocumentCount} 条`
                            : project.maintenanceSummary?.ragQueued || project.maintenanceSummary?.ragRunning
                              ? 'AI 正在自动重建索引'
                              : project.preflight.completedChapters > 0 || project.preflight.bookSummaryCount > 0 || project.preflight.chapterSummaryCount > 0
                                ? '索引待补齐'
                              : '暂无可索引内容，写作后会自动建立'}
                        </div>
                        <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          用于语义检索、记忆回写和长篇上下文恢复
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

                    {project.preflight.blockers.length > 0 && (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                        <div className="mb-1 font-medium">当前阻断项</div>
                        <ul className="space-y-1">
                          {project.preflight.blockers.slice(0, 3).map((item, index) => (
                            <li key={index}>- {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {project.preflight.recommendations.length > 0 && (
                      <div className="rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-400">
                        <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">AI 建议的后续动作</div>
                        <ul className="space-y-1">
                          {project.preflight.recommendations.slice(0, 3).map((item, index) => (
                            <li key={index}>- {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {project.preflight.nextSteps.length > 0 && (
                      <div className="grid gap-2 md:grid-cols-3">
                        {project.preflight.nextSteps.slice(0, 3).map((step, index) => (
                          <div
                            key={`${step.title}-${index}`}
                            className="rounded-md border border-gray-200 px-3 py-3 text-xs dark:border-gray-800"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-gray-900 dark:text-gray-100">{step.title}</div>
                              <Badge variant={step.urgency === 'now' ? 'warning' : step.urgency === 'soon' ? 'primary' : 'secondary'}>
                                {step.urgency === 'now' ? '现在' : step.urgency === 'soon' ? '接下来' : '观察'}
                              </Badge>
                            </div>
                            <div className="mt-2 leading-5 text-gray-600 dark:text-gray-400">{step.detail}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {project.preflight.riskHighlights.length > 0 && (
                      <div className="grid gap-2 md:grid-cols-2">
                        {project.preflight.riskHighlights.slice(0, 4).map((risk) => (
                          <div
                            key={risk.code}
                            className={`rounded-md border px-3 py-3 text-xs ${
                              risk.severity === 'error'
                                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300'
                                : risk.severity === 'warning'
                                  ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                                  : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                            }`}
                          >
                            <div className="font-medium">{risk.title}</div>
                            <div className="mt-1 leading-5 opacity-90">{risk.detail}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

            </>
          )}

          {activeTab === 'analysis' && project.projectMode === 'ANALYZE' && (
            <AnalysisWorkbench projectId={projectId} />
          )}

          {activeTab === 'characters' && project.projectMode === 'ANALYZE' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-500" />
                  角色档案
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CharacterPanel projectId={projectId} />
              </CardContent>
            </Card>
          )}

          {activeTab === 'settings' && project.blueprintConsole && (
            <div className="space-y-6">
              <Card className="border-blue-200 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/20">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="text-sm font-medium text-blue-700 dark:text-blue-300">动态控制台</div>
                      <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">Blueprint / Arc / StoryState 的 AI 驱动中枢</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-700 dark:text-gray-300">
                        这里不再是手工配置卷数、章节数和高潮节点的后台。当前页面只展示 AI 当前接管的全书状态，并允许你通过 Story Steering 微调节奏、黑暗度、感情线、悬念密度等方向。
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <div className="rounded-xl border border-blue-200 bg-white/80 px-3 py-2 dark:border-blue-900/40 dark:bg-slate-950/40">
                        AI 控制：Blueprint、Arc Plan、批次大小、结构推进
                      </div>
                      <div className="rounded-xl border border-blue-200 bg-white/80 px-3 py-2 dark:border-blue-900/40 dark:bg-slate-950/40">
                        用户微调：节奏、黑暗、幽默、浪漫、冲突、成长、悬念
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <BlueprintConsole
                key={`${project.updatedAt}-${project.blueprintConsole.generatedAt || 'console'}`}
                projectId={projectId}
                initialData={project.blueprintConsole}
                steeringValues={steeringValues}
                aiStatus={aiConsoleStatus}
                onRefreshed={fetchProject}
                onEditBaseInfo={() => setShowEditModal(true)}
              />
            </div>
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
              {effectiveTargetWordCount ? (
                <Progress value={project.currentWordCount} max={effectiveTargetWordCount} showLabel size="sm" />
              ) : (
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                  <div className="h-full w-0 bg-blue-500 rounded-full" />
                </div>
              )}
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-sm font-bold">{project.currentWordCount.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">当前</p>
                </div>
                <div>
                  <p className="text-sm font-bold">{effectiveTargetWordCount?.toLocaleString() || '-'}</p>
                  <p className="text-xs text-gray-500">目标</p>
                </div>
                <div>
                  <p className="text-sm font-bold">{estimatedTotalChapters?.toLocaleString() || '-'}</p>
                  <p className="text-xs text-gray-500">预计章数</p>
                </div>
                <div>
                  <p className="text-sm font-bold">{project.chapters.length}</p>
                  <p className="text-xs text-gray-500">已建章节</p>
                </div>
              </div>
              {estimatedTotalChapters && project.expectedStageCount ? (
                <p className="mt-3 text-xs text-gray-500">
                  当前按 {project.lengthType || 'LONG'} 口径规划，全书预计约 {estimatedTotalChapters} 章，默认拆分为 {project.expectedStageCount} 个阶段。
                </p>
              ) : null}
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
                <span className="text-sm">{formatDisplayDate(project.updatedAt)}</span>
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

      </>
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
        title="编辑小说标题"
        description="这里只允许修改小说标题，其余设定由 AI 设定中枢维护。"
        className="max-w-xl"
      >
        <ProjectBaseInfoForm
          defaultValues={{
            title: project.title,
          }}
          onSubmit={handleUpdate}
          onCancel={() => setShowEditModal(false)}
          loading={submitting}
        />
      </Modal>

      {/* Delete Project Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="删除小说"
        description="确定要删除这本小说吗？此操作不可撤销，所有章节内容也将被删除。"
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
        title="拆书分析"
        className="max-w-4xl"
      >
        <AnalysisWorkbench projectId={projectId} />
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

    </>
  )
}

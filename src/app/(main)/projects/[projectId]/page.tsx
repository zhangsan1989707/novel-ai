'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Progress, Modal, toast, MoreActionsMenu } from '@/components/ui'
import { BlueprintConsole, ProjectBaseInfoForm, ProjectBaseInfoFormData } from '@/components/project'
import { Toolbox, CharacterPanel } from '@/components/ai'
import { CoverGenerator, ResearchPanel, ReviewPanel, DeslopPanel, ExportPanel, AnalysisWorkbench } from '@/components/ai'
import { BookOpen, Clock, Target, Users, Layers, Search, ClipboardList, Shield, Sparkles, ChevronRight, ChevronDown, Wrench, Eye, AlertCircle, CheckCircle2, Download } from 'lucide-react'
import type { ProjectStatus } from '@/types'
import type { BlueprintConsoleSnapshot } from '@/lib/engine/blueprint-console'

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
  maintenanceSummary?: {
    bootstrapQueued: boolean
    bootstrapRunning: boolean
    ragQueued: boolean
    ragRunning: boolean
    bootstrapFailed: boolean
    ragFailed: boolean
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

const healthLevelMap: Record<NonNullable<Project['preflight']>['healthLevel'], { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  healthy: { label: '健康', variant: 'success' },
  warning: { label: '告警', variant: 'warning' },
  critical: { label: '严重', variant: 'danger' },
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard')
  const bootstrapRecoveryRef = useRef<string | null>(null)
  const [recoveryClockMs, setRecoveryClockMs] = useState(0)
  const maintenanceActive = Boolean(
    project?.maintenanceSummary?.bootstrapQueued ||
    project?.maintenanceSummary?.bootstrapRunning ||
    project?.maintenanceSummary?.ragQueued ||
    project?.maintenanceSummary?.ragRunning
  )
  const bootstrapProgress = project?.maintenanceSummary?.bootstrapProgress || null
  const ragProgress = project?.maintenanceSummary?.ragProgress || null
  const bootstrapProgressUpdatedAtMs = bootstrapProgress?.updatedAt
    ? new Date(bootstrapProgress.updatedAt).getTime()
    : 0
  const bootstrapProgressStale = Boolean(
    project?.maintenanceSummary?.bootstrapRunning &&
    bootstrapProgressUpdatedAtMs > 0 &&
    recoveryClockMs > 0 &&
    recoveryClockMs - bootstrapProgressUpdatedAtMs > 45_000
  )
  const bootstrapStateMissing = Boolean(
    project &&
    (
      !project.preflight?.hasBlueprint ||
      !project.preflight?.hasArcPlans ||
      !project.preflight?.hasStoryState ||
      !project.preflight?.hasWorldState
    )
  )
  const bootstrapNeedsDirectRecovery = Boolean(
    project?.preflight?.hasModel &&
    bootstrapStateMissing &&
    (
      project?.maintenanceSummary?.bootstrapFailed ||
      bootstrapProgressStale ||
      (
        !project?.maintenanceSummary?.bootstrapQueued &&
        !project?.maintenanceSummary?.bootstrapRunning
      )
    )
  )
  const projectInitializing = Boolean(
    project && (
      !project.preflight?.ready ||
      maintenanceActive ||
      !project.preflight?.hasBlueprint ||
      !project.preflight?.hasArcPlans ||
      !project.preflight?.hasStoryState ||
      !project.preflight?.hasWorldState
    )
  )

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
      setRecoveryClockMs(Date.now())
      setLoading(false)
    }
  }, [projectId])

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
    if (!project || !bootstrapNeedsDirectRecovery) {
      bootstrapRecoveryRef.current = null
      return
    }

    const recoveryKey = [
      project.id,
      bootstrapProgress?.phase || 'idle',
      bootstrapProgress?.updatedAt || 'none',
      project.maintenanceSummary?.bootstrapFailed ? 'failed' : 'pending',
    ].join(':')

    if (bootstrapRecoveryRef.current === recoveryKey) return
    bootstrapRecoveryRef.current = recoveryKey

    let cancelled = false

    const recoverBootstrap = async () => {
      try {
        const res = await fetch(`/api/novel/projects/${projectId}/bootstrap`, {
          method: 'POST',
        })
        const data = await res.json()

        if (cancelled) return

        if (data.success) {
          toast.success('已接管初始化，正在继续补齐创作配置')
          void fetchProject()
        }
      } catch {
        // keep silent here; the polling banner already reflects current state
      }
    }

    void recoverBootstrap()

    return () => {
      cancelled = true
    }
  }, [project, projectId, fetchProject, bootstrapNeedsDirectRecovery, bootstrapProgress?.phase, bootstrapProgress?.updatedAt])



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
      icon: <Sparkles className="h-4 w-4" />,
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
    ? Math.round((project.currentWordCount / project.targetWordCount) * 100)
    : null

  const completedChapters = project.chapters.filter(c => c.status === 'COMPLETED').length
  const reviewingChapters = project.chapters.filter(c => c.status === 'REVIEWING').length
  const arcGroups = groupChaptersByArc(project)
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
            AI 设定中枢
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
                        暂无章节
                      </p>
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
                        {project.preflight.primaryAction}
                      </div>
                    </div>

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
                    {project.preflight.hasModel && (maintenanceActive || !project.preflight.hasBlueprint || !project.preflight.hasArcPlans || !project.preflight.hasStoryState || !project.preflight.hasWorldState) && (
                      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
                        <div className="font-medium">
                        {bootstrapNeedsDirectRecovery
                            ? '初始化卡住，正在直接补齐创作配置'
                            : project.maintenanceSummary?.bootstrapQueued || project.maintenanceSummary?.bootstrapRunning
                              ? 'AI 正在自动补齐创作配置'
                              : project.maintenanceSummary?.ragQueued || project.maintenanceSummary?.ragRunning
                                ? 'AI 正在自动重建 RAG 索引'
                                : '系统会自动补齐创作配置'}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-blue-700 dark:text-blue-300">
                          系统会自动补齐 Book Blueprint、阶段规划、世界状态、故事状态以及 RAG 索引。完成前请勿开始 AI 生成。页面会自动刷新，无需手动刷新。
                        </div>
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

            </>
          )}

          {activeTab === 'analysis' && project.projectMode === 'ANALYZE' && (
            <AnalysisWorkbench projectId={projectId} totalVolumes={project.totalVolumes} />
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
            <BlueprintConsole
              projectId={projectId}
              initialData={project.blueprintConsole}
              steeringValues={{
                pace: project.pace ?? 0.5,
                darkness: project.darkness ?? 0.3,
                humor: project.humor ?? 0.3,
                romance: project.romance ?? 0.2,
                powerGrowth: project.powerGrowth ?? 0.5,
                conflictIntensity: project.conflictIntensity ?? 0.5,
                mysteryDensity: project.mysteryDensity ?? 0.3,
              }}
              onRefreshed={fetchProject}
              onEditBaseInfo={() => setShowEditModal(true)}
            />
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
        <AnalysisWorkbench projectId={projectId} totalVolumes={project.totalVolumes} />
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

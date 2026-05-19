'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Progress, Modal, toast, MoreActionsMenu } from '@/components/ui'
import { ProjectForm, ProjectFormData } from '@/components/project'
import { StorySteeringPanel, Toolbox } from '@/components/ai'
import { CoverGenerator, PlotAnalyzer, ResearchPanel, ReviewPanel, DeslopPanel } from '@/components/ai'
import { BookOpen, Clock, Target, Users, Layers, Search, ClipboardList, Rocket, Shield, Sparkles, ChevronRight, ChevronDown, Wrench, Eye, Play, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { ProjectStatus } from '@/types'

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
  chapters: Chapter[]
  arcPlans?: ArcPlan[]
  createdAt: string
  updatedAt: string
}

interface PipelineStatus {
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  currentStep: string
  progress: number
  currentChapter: number
  totalChapters: number
  error?: string
  pipelineJobId?: string
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard')

  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null)

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
          setPipeline(data.data)

          if (data.data.status === 'COMPLETED' || data.data.status === 'FAILED') {
            fetchProject()
          }
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
  }, [projectId, fetchProject])

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

      {/* Pipeline Progress Panel */}
      {pipeline && pipeline.status === 'RUNNING' && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/60 dark:bg-blue-900/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                流水线运行中
              </span>
            </div>
            <span className="text-xs text-blue-500">{pipeline.progress}%</span>
          </div>
          <Progress value={pipeline.progress} max={100} size="sm" />
          <div className="flex items-center justify-between mt-2 text-xs text-blue-600 dark:text-blue-400">
            <span>
              <span className="font-medium">{pipeline.currentStep}</span>
            </span>
            <span>
              第 {pipeline.currentChapter} / {pipeline.totalChapters} 章
            </span>
          </div>
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
            variant="outline"
            size="sm"
            onClick={() => setShowToolbox(true)}
            className="gap-1.5"
          >
            <Wrench className="h-4 w-4" />
            工具箱
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

              {/* StorySteering Panel */}
              <StorySteeringPanel
                projectId={projectId}
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
    </>
  )
}
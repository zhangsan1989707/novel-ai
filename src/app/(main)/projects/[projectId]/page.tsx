'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Progress, Modal, ChaptersEmptyState, toast, MoreActionsMenu, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui'
import { ProjectForm, ProjectFormData, ChapterListGenerator, BatchGenerator } from '@/components/project'
import { BatchProgress } from '@/components/ai/BatchProgress'
import { PlotAnalyzer, ContinuationPanel, ResearchPanel, ReviewPanel, DeslopPanel, CoverGenerator, ShortStoryPanel } from '@/components/ai'
import { OutlineGenerator } from '@/components/ai/OutlineGenerator'
import { ChapterSummaryEditor } from '@/components/chapter/ChapterSummaryEditor'
import { BookOpen, Clock, Target, Users, Layers, Plus, ListChecks, FileText, Search, CheckCircle2, Circle, AlertCircle, ArrowRight, ClipboardList, PenLine, FileCheck2, Rocket, ChevronRight, ChevronDown, Wrench, Sparkles, Shield } from 'lucide-react'
import type { ProjectStatus } from '@/types'

interface Chapter {
  id: number
  chapterNumber: number
  title: string
  wordCount: number
  status: 'DRAFT' | 'GENERATING' | 'COMPLETED' | 'REVIEWING'
  sortOrder: number
  summary?: string
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
  outlineStages?: Record<string, { title: string; summary: string }[]> & {
    stages?: Array<{
      name: string
      description?: string
      coreEvents?: string[]
      chapterRatio?: number
      chapterPlan?: string
    }>
  }
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

type WorkflowStatus = 'complete' | 'active' | 'pending' | 'blocked'
type WorkflowAction = 'settings' | 'outline' | 'chapters' | 'write' | 'review'

interface WorkflowStep {
  id: WorkflowAction
  title: string
  description: string
  status: WorkflowStatus
  actionLabel: string
}

interface SetupGuard {
  label: string
}

function hasOutline(project: Project) {
  return Boolean(
    project.outline?.trim() ||
    (project.outlineStages && Object.keys(project.outlineStages).length > 0)
  )
}

function getCompletedChapterCount(project: Project) {
  return project.chapters.filter((chapter) => chapter.status === 'COMPLETED').length
}

function getWorkflow(project: Project): WorkflowStep[] {
  const basicSetupDone = Boolean(
    project.title &&
    project.description
  )
  const outlineDone = hasOutline(project)
  const chaptersDone = project.chapters.length > 0
  const writingDone = getCompletedChapterCount(project) > 0 || project.currentWordCount > 0
  const reviewReady = writingDone

  const steps: Array<Omit<WorkflowStep, 'status'>> = [
    {
      id: 'settings',
      title: '完善设定',
      description: basicSetupDone
        ? '标题和简介已就绪，可随时补充类型、风格等增强设定'
        : '请填写标题和简介，即可开始创作',
      actionLabel: basicSetupDone ? '编辑设定' : '补齐设定',
    },
    {
      id: 'outline',
      title: '生成大纲',
      description: '确定主线、卷纲、阶段目标和结局方向',
      actionLabel: '生成大纲',
    },
    {
      id: 'chapters',
      title: '生成目录',
      description: '把大纲拆成可执行的章节任务',
      actionLabel: '生成目录',
    },
    {
      id: 'write',
      title: '写作正文',
      description: '单章写作、继续生成或批量生成',
      actionLabel: chaptersDone ? '继续写作' : '开始写作',
    },
    {
      id: 'review',
      title: '审稿润色',
      description: '对抗审稿、去 AI 味和剧情检查',
      actionLabel: '开始审稿',
    },
  ]

  const completion = [basicSetupDone, outlineDone, chaptersDone, writingDone, reviewReady]
  const firstIncomplete = completion.findIndex((done) => !done)

  return steps.map((step, index) => {
    const isBlockedBySetup = !basicSetupDone && step.id !== 'settings'

    return {
      ...step,
      status: completion[index] ? 'complete' : isBlockedBySetup ? 'blocked' : firstIncomplete === index ? 'active' : 'pending',
    }
  })
}

function getMissingItems(project: Project): Array<{ label: string; action: WorkflowAction | null }> {
  const items: Array<{ label: string; action: WorkflowAction | null }> = []
  if (!project.description?.trim()) items.push({ label: '补充小说简介', action: 'settings' })
  if (!project.genre) items.push({ label: '选择小说类型（可选）', action: 'settings' })
  if (!project.writingStyle) items.push({ label: '选择写作风格（可选）', action: 'settings' })
  if (!project.aiModelConfig) items.push({ label: '绑定 AI 模型（可选）', action: 'settings' })
  if (!project.worldSetting?.trim()) items.push({ label: '补充世界设定（可选）', action: 'settings' })
  if (!project.protagonistProfile?.trim()) items.push({ label: '补充主角设定（可选）', action: 'settings' })
  if (!hasOutline(project)) items.push({ label: '生成大纲', action: 'outline' })
  if (project.chapters.length === 0) items.push({ label: '生成章节目录', action: 'chapters' })
  return items
}

function getSetupGuards(project: Project): SetupGuard[] {
  const guards: SetupGuard[] = []
  if (!project.description?.trim()) guards.push({ label: '填写小说简介' })
  return guards
}

type WorkbenchTab = 'outline' | 'chapters' | 'write' | 'review'

function getNextTab(project: Project): WorkbenchTab {
  if (!hasOutline(project)) return 'outline'
  if (project.chapters.length === 0) return 'chapters'
  if (getCompletedChapterCount(project) === 0) return 'write'
  return 'review'
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = parseInt(params.projectId as string)

  const initialTab = searchParams.get('tab') as WorkbenchTab | 'chapters' | 'outline' | 'settings' | null || 'outline'
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPlotAnalysisModal, setShowPlotAnalysisModal] = useState(false)
  const [showContinuationModal, setShowContinuationModal] = useState(false)
  const [batchProgressOpen, setBatchProgressOpen] = useState(false)
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [batchProgressInfo, setBatchProgressInfo] = useState({ progress: 0, completed: 0, total: 0 })
  const [selectedChapterIds, setSelectedChapterIds] = useState<number[]>([])
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [batchOptions, setBatchOptions] = useState<{
    chapterIds?: number[]
    useContext: boolean
    contextChapterCount: number
    temperature: number
    targetWordCount: number
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkbenchTab | 'chapters' | 'outline' | 'settings'>(initialTab)
  const [showGenerator, setShowGenerator] = useState(false)
  const [showOutlineGenerator, setShowOutlineGenerator] = useState(false)
  const [showResearchModal, setShowResearchModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showDeslopModal, setShowDeslopModal] = useState(false)
  const [showCoverModal, setShowCoverModal] = useState(false)
  const [showShortStoryModal, setShowShortStoryModal] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [reviewSubTab, setReviewSubTab] = useState<'review' | 'deslop'>('review')
  const [pendingChapters, setPendingChapters] = useState<{ chapterNumber: number; title: string; summary: string }[] | null>(null)
  const [expandedChapterId, setExpandedChapterId] = useState<number | null>(null)
  const [showSummaryEditor, setShowSummaryEditor] = useState(false)
  const [editingChapter, setEditingChapter] = useState<{ id: number; chapterNumber: number; title: string; summary: string } | null>(null)

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
        fetchProject()
      }
    } catch (err) {
      console.error('更新项目失败:', err)
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
    } catch (err) {
      console.error('删除项目失败:', err)
      toast.error('删除失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveSummary = async (chapterId: number, summary: string) => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success('概要已更新')
        fetchProject()
      } else {
        toast.error(result.error?.message || '更新失败')
      }
    } catch (err) {
      toast.error('更新失败')
    }
  }

  const openSummaryEditor = (chapter: Chapter) => {
    setEditingChapter({
      id: chapter.id,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title || '',
      summary: chapter.summary || '',
    })
    setShowSummaryEditor(true)
  }

  const toggleChapterSelection = (id: number) => {
    setSelectedChapterIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (!project) return
    if (selectedChapterIds.length === project.chapters.length) {
      setSelectedChapterIds([])
    } else {
      setSelectedChapterIds(project.chapters.map((ch) => ch.id))
    }
  }

  const handleApplyChapters = async (chapters: { chapterNumber: number; title: string; summary: string }[]) => {
    try {
      const existCheck = await fetch(`/api/novel/projects/${projectId}/chapters`)
      const existData = await existCheck.json()
      const existingMap = new Map<number, { id: number; hasContent: boolean; title: string }>()
      if (existData.success) {
        for (const c of existData.data as { id: number; chapterNumber: number; wordCount: number; title: string; content?: string }[]) {
          existingMap.set(c.chapterNumber, { id: c.id, hasContent: (c.wordCount || 0) > 0, title: c.title })
        }
      }

      const chapterNumbers = new Set(chapters.map((ch) => ch.chapterNumber))
      const chaptersToDelete: Array<{ chapterNumber: number; title: string; hasContent: boolean }> = []
      for (const [chapterNumber, info] of existingMap) {
        if (!chapterNumbers.has(chapterNumber)) {
          chaptersToDelete.push({ chapterNumber, title: info.title, hasContent: info.hasContent })
        }
      }

      if (chaptersToDelete.length > 0) {
        setPendingChapters(chapters)
        return
      }

      await doApplyChapters(chapters, existingMap, chapterNumbers)
    } catch (err) {
      console.error('创建章节失败:', err)
      toast.error('应用章节失败')
    }
  }

  const doApplyChapters = async (
    chapters: { chapterNumber: number; title: string; summary: string }[],
    existingMap: Map<number, { id: number; hasContent: boolean; title: string }>,
    chapterNumbers: Set<number>
  ) => {
    try {
      for (const ch of chapters) {
        const existing = existingMap.get(ch.chapterNumber)
        if (existing) {
          await fetch(`/api/novel/projects/${projectId}/chapters/${existing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: ch.title,
              summary: ch.summary,
            }),
          })
        } else {
          await fetch(`/api/novel/projects/${projectId}/chapters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chapterNumber: ch.chapterNumber,
              title: ch.title,
              summary: ch.summary,
              status: 'DRAFT',
            }),
          })
        }
      }

      const deletePromises: Promise<Response>[] = []
      for (const [chapterNumber, info] of existingMap) {
        if (!chapterNumbers.has(chapterNumber)) {
          deletePromises.push(
            fetch(`/api/novel/projects/${projectId}/chapters/${info.id}`, {
              method: 'DELETE',
            })
          )
        }
      }
      await Promise.all(deletePromises)

      toast.success(`已应用 ${chapters.length} 个章节`)
      fetchProject()
    } catch (err) {
      console.error('创建章节失败:', err)
      toast.error('应用章节失败')
    }
  }

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
  const workflow = getWorkflow(project)
  const currentStep = workflow.find((step) => step.status === 'active') ?? workflow[workflow.length - 1]
  const completedWorkflowCount = workflow.filter((step) => step.status === 'complete').length
  const workflowProgress = Math.round((completedWorkflowCount / workflow.length) * 100)
  const missingItems = getMissingItems(project)
  const setupGuards = getSetupGuards(project)
  const setupBlocked = setupGuards.length > 0
  const setupGuardLabels = setupGuards.map((guard) => guard.label)

  const openSettingsGuard = () => {
    toast.error(`请先完成：${setupGuardLabels.join('、')}`)
    setShowEditModal(true)
  }

  const openOutlineGenerator = () => {
    setShowOutlineGenerator(true)
  }

  const openChapterListGenerator = () => {
    if (!hasOutline(project)) {
      toast.error('请先生成或填写大纲，再拆分章节目录')
      setShowOutlineGenerator(true)
      return
    }
    setShowGenerator(true)
  }

  const handleWorkflowAction = (action: WorkflowAction) => {
    switch (action) {
      case 'settings':
        setShowEditModal(true)
        break
      case 'outline':
        openOutlineGenerator()
        break
      case 'chapters':
        openChapterListGenerator()
        break
      case 'write':
        if (project.chapters.length > 0) {
          const nextChapter = project.chapters.find((chapter) => chapter.status !== 'COMPLETED') ?? project.chapters[0]
          router.push(`/projects/${projectId}/chapters/${nextChapter.id}?tab=${activeTab}`)
        } else {
          openChapterListGenerator()
        }
        break
      case 'review':
        setActiveTab('review')
        break
    }
  }

  const handleContinueNext = () => {
    if (setupBlocked) {
      openSettingsGuard()
      return
    }
    const nextTab = getNextTab(project)
    switch (nextTab) {
      case 'outline':
        setActiveTab('outline')
        openOutlineGenerator()
        break
      case 'chapters':
        setActiveTab('chapters')
        openChapterListGenerator()
        break
      case 'write':
        setActiveTab('write')
        if (project.chapters.length > 0) {
          const nextChapter = project.chapters.find((chapter) => chapter.status !== 'COMPLETED') ?? project.chapters[0]
          router.push(`/projects/${projectId}/chapters/${nextChapter.id}?tab=${activeTab}`)
        }
        break
      case 'review':
        setActiveTab('review')
        break
    }
  }

  const getNextActionLabel = () => {
    if (setupBlocked) return `补齐设定`
    const nextTab = getNextTab(project)
    switch (nextTab) {
      case 'outline': return '生成大纲'
      case 'chapters': return '生成目录'
      case 'write': return getCompletedChapterCount(project) > 0 ? '继续写作' : '开始写作'
      case 'review': return '审稿润色'
    }
  }

  const nextUncompletedChapter = project.chapters.find((ch) => ch.status !== 'COMPLETED')

  return (
    <>
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

      {project.projectMode === 'CREATE' && (
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {workflow.map((step, index) => {
              const isComplete = step.status === 'complete'
              const isActive = step.status === 'active'
              const isBlocked = step.status === 'blocked'
              return (
                <div key={step.id} className="flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleWorkflowAction(step.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : isComplete
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : isBlocked
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : isActive ? (
                      <Circle className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                    <span>{step.title}</span>
                  </button>
                  {index < workflow.length - 1 && (
                    <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 mx-0.5" />
                  )}
                </div>
              )
            })}
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleContinueNext}
            className="shrink-0 gap-1.5"
          >
            <Sparkles className="h-4 w-4" />
            {getNextActionLabel()}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {project.projectMode === 'CREATE' && setupBlocked && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>请先完成：{setupGuardLabels.join('、')}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{project.title}</h1>
          <Badge variant={projectStatusMap[project.status].variant}>
            {projectStatusMap[project.status].label}
          </Badge>
          {project.genre && <Badge variant="outline">{project.genre}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500">
                <Wrench className="h-4 w-4" />
                高级工具
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowResearchModal(true)}>
                <Search className="h-4 w-4 mr-2 text-gray-400" />
                资料研究
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowCoverModal(true)}>
                <Rocket className="h-4 w-4 mr-2 text-gray-400" />
                封面生成
              </DropdownMenuItem>
              {project.genre?.includes('短篇') || project.storyType === 'SHORT' ? (
                <DropdownMenuItem onClick={() => setShowShortStoryModal(true)}>
                  <FileText className="h-4 w-4 mr-2 text-gray-400" />
                  短篇创作
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => setShowPlotAnalysisModal(true)}>
                <ClipboardList className="h-4 w-4 mr-2 text-gray-400" />
                分析剧情
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowContinuationModal(true)}>
                <PenLine className="h-4 w-4 mr-2 text-gray-400" />
                继续生成
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setBatchProgressOpen(true)
              }}>
                <ListChecks className="h-4 w-4 mr-2 text-gray-400" />
                批量生成
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      {project.projectMode === 'ANALYZE' && (
        <div className="flex border-b mb-6">
          <button
            onClick={() => setActiveTab('chapters')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'chapters'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            原著章节
          </button>
          <button
            onClick={() => setActiveTab('outline')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'outline'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            分析结果
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'settings'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            续写章节
          </button>
        </div>
      )}

      {project.projectMode === 'ANALYZE' && activeTab === 'chapters' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              原著章节
              <Badge variant="secondary" className="ml-2">
                {project.chapters.filter(c => c.status === 'REVIEWING').length} 章
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.chapters.filter(c => c.status === 'REVIEWING').length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>还没有导入原著章节</p>
                <p className="text-sm mt-1">上传小说文件后会自动导入章节</p>
              </div>
            ) : (
              <div className="space-y-2">
                {project.chapters.filter(c => c.status === 'REVIEWING').map((chapter) => (
                  <div
                    key={chapter.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-all"
                    onClick={() => router.push(`/projects/${projectId}/chapters/${chapter.id}?tab=${activeTab}`)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-gray-400">第{chapter.chapterNumber}章</span>
                      <span className="font-medium">{chapter.title || '无标题'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">{(chapter.wordCount || 0).toLocaleString()} 字</span>
                      <Badge variant="warning" className="text-xs">原著</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {project.projectMode === 'CREATE' && (
        <div className={`grid gap-6 transition-all duration-300 ${sidebarCollapsed ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]'}`}>
          <div className="space-y-0">
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('outline')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === 'outline'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <FileText className="h-4 w-4 inline mr-1.5" />
                  大纲
                </button>
                <button
                  onClick={() => setActiveTab('chapters')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === 'chapters'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <BookOpen className="h-4 w-4 inline mr-1.5" />
                  目录
                </button>
                <button
                  onClick={() => setActiveTab('write')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === 'write'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <PenLine className="h-4 w-4 inline mr-1.5" />
                  正文
                </button>
                <button
                  onClick={() => setActiveTab('review')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === 'review'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Shield className="h-4 w-4 inline mr-1.5" />
                  审稿润色
                </button>
              </div>
            </div>

            {activeTab === 'outline' && (
              <div className="space-y-4">
                {hasOutline(project) ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <FileText className="h-5 w-5 text-blue-600" />
                          大纲内容
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={openOutlineGenerator}>
                          重新生成
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {project.outlineStages && Object.keys(project.outlineStages).length > 0 ? (
                        <div className="space-y-4">
                          {project.outlineStages.stages && Array.isArray(project.outlineStages.stages) ? (
                            project.outlineStages.stages.map((stage, idx) => (
                              <div key={idx}>
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-medium text-gray-900 dark:text-white">{stage.name}</h4>
                                  {stage.chapterRatio != null && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                      约占全书{Math.round(stage.chapterRatio * 100)}%
                                    </span>
                                  )}
                                </div>
                                {stage.description && (
                                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">{stage.description}</div>
                                )}
                                {stage.coreEvents && stage.coreEvents.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-1">
                                    {stage.coreEvents.map((event: string, i: number) => (
                                      <span key={i} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{event}</span>
                                    ))}
                                  </div>
                                )}
                                {stage.chapterPlan && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 pl-3 border-l-2 border-blue-200 dark:border-blue-800">{stage.chapterPlan}</div>
                                )}
                              </div>
                            ))
                          ) : (
                            Object.entries(project.outlineStages)
                              .filter(([key]) => key !== 'stages')
                              .map(([stageName, stages]) => (
                              <div key={stageName}>
                                <h4 className="font-medium text-gray-900 dark:text-white mb-2">{stageName}</h4>
                                <div className="space-y-2">
                                  {Array.isArray(stages) && (stages as Array<{ title: string; summary: string }>).map((stage, idx) => (
                                    <div key={idx} className="pl-4 border-l-2 border-blue-200 dark:border-blue-800">
                                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{stage.title || stageName}</div>
                                      {stage.summary && (
                                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{stage.summary}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                          {project.outline?.trim() && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                              <h4 className="font-medium text-gray-900 dark:text-white mb-2">完整大纲</h4>
                              <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                {project.outline}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                          {project.outline}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-16">
                      <div className="text-center">
                        <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">还没有大纲</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                          生成大纲来确定故事的主线、阶段目标和结局方向
                        </p>
                        <Button
                          variant="primary"
                          onClick={openOutlineGenerator}
                          disabled={setupBlocked}
                        >
                          <Sparkles className="h-4 w-4 mr-1.5" />
                          生成大纲
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'chapters' && (
              <div className="space-y-4">
                {project.chapters.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <BookOpen className="h-5 w-5 text-blue-600" />
                          章节目录
                          <Badge variant="secondary">{project.chapters.length} 章</Badge>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={openChapterListGenerator}>
                            追加章节
                          </Button>
                          <Button variant="outline" size="sm" onClick={openChapterListGenerator}>
                            重新生成
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {project.chapters.map((chapter) => {
                          const isExpanded = expandedChapterId === chapter.id
                          return (
                            <div
                              key={chapter.id}
                              className="rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all overflow-hidden"
                            >
                              <div
                                className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-all"
                                onClick={() => setExpandedChapterId(isExpanded ? null : chapter.id)}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  <span className="text-gray-400 text-sm shrink-0">第{chapter.chapterNumber}章</span>
                                  <span className="font-medium truncate">{chapter.title || '无标题'}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-sm text-gray-500">{(chapter.wordCount || 0).toLocaleString()} 字</span>
                                  <Badge variant={chapterStatusMap[chapter.status].variant} className="text-xs">
                                    {chapterStatusMap[chapter.status].label}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openSummaryEditor(chapter)
                                    }}
                                    className="text-xs text-gray-500 hover:text-blue-600"
                                  >
                                    编辑概要
                                  </Button>
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="px-3 pb-3 pt-0 ml-7">
                                  <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 leading-relaxed">
                                    {chapter.summary || '暂无章节概要'}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-16">
                      <div className="text-center">
                        <BookOpen className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">还没有章节目录</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                          {hasOutline(project)
                            ? '基于大纲自动拆分章节目录'
                            : '请先生成大纲，再拆分章节目录'}
                        </p>
                        <Button
                          variant="primary"
                          onClick={openChapterListGenerator}
                          disabled={setupBlocked || !hasOutline(project)}
                        >
                          <Sparkles className="h-4 w-4 mr-1.5" />
                          生成目录
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'write' && (
              <div className="space-y-4">
                {batchGenerating && !batchProgressOpen && (
                  <div
                    className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    onClick={() => setBatchProgressOpen(true)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        正在后台生成 {batchProgressInfo.completed}/{batchProgressInfo.total} 章
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${batchProgressInfo.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-blue-500">{batchProgressInfo.progress}%</span>
                      <span className="text-xs text-blue-400">点击查看详情 →</span>
                    </div>
                  </div>
                )}
                {project.chapters.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isSelectMode && (
                            <>
                              <input
                                type="checkbox"
                                checked={selectedChapterIds.length === project.chapters.length && project.chapters.length > 0}
                                onChange={toggleSelectAll}
                                className="w-4 h-4"
                              />
                              <span className="text-sm text-gray-500">已选 {selectedChapterIds.length} 章</span>
                              <button
                                onClick={() => {
                                  setIsSelectMode(false)
                                  setSelectedChapterIds([])
                                }}
                                className="text-sm text-muted-foreground hover:text-foreground"
                              >
                                取消
                              </button>
                            </>
                          )}
                          {!isSelectMode && (
                            <CardTitle className="flex items-center gap-2 text-base">
                              <PenLine className="h-5 w-5 text-blue-600" />
                              正文写作
                              <Badge variant="secondary">
                                {getCompletedChapterCount(project)}/{project.chapters.length} 已完成
                              </Badge>
                            </CardTitle>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!isSelectMode && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsSelectMode(true)}
                                className="gap-1.5"
                              >
                                <ListChecks className="h-4 w-4" />
                                多选
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => router.push(`/projects/${projectId}/chapters/new`)}>
                                <Plus className="h-3.5 w-3.5" />
                                新建
                              </Button>
                            </>
                          )}
                          {isSelectMode && selectedChapterIds.length > 0 && (
                            <BatchGenerator
                              projectId={projectId}
                              chapters={project.chapters.filter(ch => selectedChapterIds.includes(ch.id))}
                              onGenerate={(options) => {
                                setBatchOptions(options)
                                setBatchProgressOpen(true)
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {project.chapters.map((chapter) => {
                          const statusLabel = chapter.status === 'DRAFT' && !chapter.wordCount
                            ? '未写作'
                            : chapter.status === 'DRAFT'
                              ? '已有草稿'
                              : chapterStatusMap[chapter.status].label
                          return (
                            <div
                              key={chapter.id}
                              className={`flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all ${
                                isSelectMode ? 'cursor-pointer' : 'cursor-pointer'
                              }`}
                              onClick={() => {
                                if (isSelectMode) {
                                  toggleChapterSelection(chapter.id)
                                } else {
                                  router.push(`/projects/${projectId}/chapters/${chapter.id}?tab=${activeTab}`)
                                }
                              }}
                            >
                              {isSelectMode && (
                                <input
                                  type="checkbox"
                                  checked={selectedChapterIds.includes(chapter.id)}
                                  onChange={() => toggleChapterSelection(chapter.id)}
                                  className="w-4 h-4 mr-3 accent-blue-600"
                                />
                              )}
                              <div className="flex items-center gap-3 flex-1">
                                <span className="text-gray-400">第{chapter.chapterNumber}章</span>
                                <span className="font-medium">{chapter.title || '无标题'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">{(chapter.wordCount || 0).toLocaleString()} 字</span>
                                <Badge variant={chapterStatusMap[chapter.status].variant} className="text-xs">
                                  {statusLabel}
                                </Badge>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-16">
                      <div className="text-center">
                        <PenLine className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">还没有章节</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                          先生成章节目录，然后逐章写作
                        </p>
                        <Button
                          variant="primary"
                          onClick={openChapterListGenerator}
                          disabled={setupBlocked || !hasOutline(project)}
                        >
                          <Sparkles className="h-4 w-4 mr-1.5" />
                          生成目录
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'review' && (
              <div className="space-y-4">
                {getCompletedChapterCount(project) > 0 ? (
                  <>
                    <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 pb-3">
                      <button
                        onClick={() => setReviewSubTab('review')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          reviewSubTab === 'review'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        <Shield className="h-4 w-4 inline mr-1" />
                        对抗审稿
                      </button>
                      <button
                        onClick={() => setReviewSubTab('deslop')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          reviewSubTab === 'deslop'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        <Sparkles className="h-4 w-4 inline mr-1" />
                        去 AI 味
                      </button>
                    </div>

                    {reviewSubTab === 'review' && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Shield className="h-5 w-5 text-blue-600" />
                            对抗式审稿
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ReviewPanel
                            projectId={projectId}
                            chapters={project.chapters.filter(ch => ch.status === 'COMPLETED').map(ch => ({
                              id: ch.id,
                              chapterNumber: ch.chapterNumber,
                              title: ch.title,
                            }))}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {reviewSubTab === 'deslop' && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Sparkles className="h-5 w-5 text-blue-600" />
                            去 AI 味
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <DeslopPanel projectId={projectId} />
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <FileCheck2 className="h-5 w-5 text-blue-600" />
                          已完成章节
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {project.chapters.filter(ch => ch.status === 'COMPLETED').map((chapter) => (
                            <div
                              key={chapter.id}
                              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-gray-400">第{chapter.chapterNumber}章</span>
                                <span className="font-medium">{chapter.title || '无标题'}</span>
                                <span className="text-sm text-gray-500">{(chapter.wordCount || 0).toLocaleString()} 字</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setReviewSubTab('review')
                                    setShowReviewModal(true)
                                  }}
                                >
                                  审稿优化
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => router.push(`/projects/${projectId}/chapters/${chapter.id}`)}
                                >
                                  查看
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="py-16">
                      <div className="text-center">
                        <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">还没有已完成的章节</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                          完成章节写作后，可以在此进行审稿和润色
                        </p>
                        <Button
                          variant="primary"
                          onClick={() => setActiveTab('write')}
                        >
                          去写作
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {showGenerator && project.projectMode === 'CREATE' && (
              <ChapterListGenerator
                projectId={projectId}
                projectTitle={project.title}
                genre={project.genre || undefined}
                writingStyle={project.writingStyle || undefined}
                worldSetting={project.worldSetting || undefined}
                protagonistProfile={project.protagonistProfile || undefined}
                protagonistGoal={project.protagonistGoal || undefined}
                antagonistSetting={project.antagonistSetting || undefined}
                endingPlan={project.endingPlan || undefined}
                outline={project.outline || undefined}
                outlineStages={project.outlineStages || undefined}
                aiModelId={project.aiModelId || undefined}
                chapters={project.chapters.map(ch => ({
                  chapterNumber: ch.chapterNumber,
                  title: ch.title,
                  summary: ch.summary || ''
                }))}
                onApply={handleApplyChapters}
                isExpanded={showGenerator}
                onToggle={setShowGenerator}
              />
            )}
          </div>

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
                  <span className="text-lg font-bold text-blue-600">{progress !== null ? `${progress}%` : '-'}</span>
                </div>
                {project.targetWordCount ? (
                  <Progress value={project.currentWordCount} max={project.targetWordCount} showLabel size="sm" />
                ) : (
                  <div className="w-full h-2 bg-muted rounded-full">
                    <div className="h-full w-0 bg-primary rounded-full" />
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
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">流程完成</span>
                    <span className="font-medium text-gray-900 dark:text-white">{workflowProgress}%</span>
                  </div>
                  <Progress value={workflowProgress} max={100} size="sm" />
                </div>
                {missingItems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {missingItems.slice(0, 4).map((item) => (
                      <Badge
                        key={item.label}
                        variant="warning"
                        className={`text-xs ${item.action ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                        onClick={item.action ? () => handleWorkflowAction(item.action!) : undefined}
                      >
                        {item.label}
                      </Badge>
                    ))}
                    {missingItems.length > 4 && (
                      <Badge variant="outline" className="text-xs">+{missingItems.length - 4}</Badge>
                    )}
                  </div>
                )}
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
      )}

      {sidebarCollapsed && project.projectMode === 'CREATE' && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 border border-r-0 border-gray-200 dark:border-gray-700 rounded-l-lg px-1.5 py-3 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="展开侧栏"
        >
          <ChevronDown className="h-4 w-4 text-gray-500 rotate-90" />
        </button>
      )}

      {batchOptions && (
        <BatchProgress
          projectId={projectId}
          options={batchOptions}
          open={batchProgressOpen}
          onClose={() => {
            setBatchProgressOpen(false)
            fetchProject()
          }}
          onStatusChange={(isGenerating, progress, completed, total) => {
            setBatchGenerating(isGenerating)
            setBatchProgressInfo({ progress, completed, total })
          }}
        />
      )}

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

      <Modal
        open={showOutlineGenerator}
        onClose={() => setShowOutlineGenerator(false)}
        title="生成大纲"
        className="max-w-4xl"
      >
        <OutlineGenerator
          projectTitle={project.title}
          genre={project.genre || undefined}
          writingStyle={project.writingStyle || undefined}
          worldSetting={project.worldSetting || undefined}
          protagonistProfile={project.protagonistProfile || undefined}
          protagonistGoal={project.protagonistGoal || undefined}
          antagonistSetting={project.antagonistSetting || undefined}
          endingPlan={project.endingPlan || undefined}
          aiModelId={project.aiModelId || undefined}
          showIntro={false}
          onApply={async (outline, outlineStages) => {
            try {
              const res = await fetch(`/api/novel/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outline, outlineStages: outlineStages || undefined }),
              })
              const result = await res.json()
              if (result.success) {
                toast.success('大纲已应用到项目')
                setShowOutlineGenerator(false)
                fetchProject()
              } else {
                toast.error(result.error?.message || '应用大纲失败')
              }
            } catch {
              toast.error('应用大纲失败，请重试')
            }
          }}
        />
      </Modal>

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

      <Modal
        open={showContinuationModal}
        onClose={() => setShowContinuationModal(false)}
        title="继续生成"
        className="max-w-2xl"
      >
        <ContinuationPanel projectId={projectId} />
      </Modal>

      <Modal
        open={showResearchModal}
        onClose={() => setShowResearchModal(false)}
        title="资料研究"
        className="max-w-3xl"
      >
        <ResearchPanel projectId={projectId} />
      </Modal>

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

      <Modal
        open={showDeslopModal}
        onClose={() => setShowDeslopModal(false)}
        title="去AI味"
        className="max-w-4xl"
      >
        <DeslopPanel projectId={projectId} />
      </Modal>

      <Modal
        open={showCoverModal}
        onClose={() => setShowCoverModal(false)}
        title="封面生成"
        className="max-w-4xl"
      >
        <CoverGenerator projectId={projectId} onCoverApplied={fetchProject} />
      </Modal>

      <Modal
        open={showShortStoryModal}
        onClose={() => setShowShortStoryModal(false)}
        title="短篇创作"
        className="max-w-4xl"
      >
        <ShortStoryPanel projectId={projectId} />
      </Modal>

      {project.projectMode === 'ANALYZE' && (
        <>
          <Modal
            open={showPlotAnalysisModal}
            onClose={() => setShowPlotAnalysisModal(false)}
            title="全文分析"
            className="max-w-4xl"
          >
            <PlotAnalyzer
              projectId={projectId}
              projectTitle={project.title}
              totalVolumes={project.totalVolumes}
            />
          </Modal>
          <Modal
            open={showContinuationModal}
            onClose={() => setShowContinuationModal(false)}
            title="续写本章"
            className="max-w-2xl"
          >
            <ContinuationPanel projectId={projectId} />
          </Modal>
        </>
      )}

      <Modal
        open={pendingChapters !== null}
        onClose={() => setPendingChapters(null)}
        title="⚠️ 目录变更确认"
        className="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            新目录与现有目录不一致，以下章节将被删除：
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {project.chapters
              .filter(ch => !new Set(pendingChapters?.map(c => c.chapterNumber)).has(ch.chapterNumber))
              .map(ch => (
                <div key={ch.id} className="flex items-center gap-2 text-sm p-2 rounded bg-red-50 dark:bg-red-900/20">
                  <span className="text-red-600 dark:text-red-400">第{ch.chapterNumber}章</span>
                  <span className="text-red-700 dark:text-red-300 font-medium">{ch.title}</span>
                  {ch.wordCount > 0 && (
                    <span className="text-red-500 text-xs">({ch.wordCount.toLocaleString()}字)</span>
                  )}
                </div>
              ))
            }
          </div>
          <p className="text-xs text-red-500">
            已有正文的章节删除后无法恢复，请确认是否继续。
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPendingChapters(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const chapters = pendingChapters!
                setPendingChapters(null)
                const existCheck = await fetch(`/api/novel/projects/${projectId}/chapters`)
                const existData = await existCheck.json()
                const existingMap = new Map<number, { id: number; hasContent: boolean; title: string }>()
                if (existData.success) {
                  for (const c of existData.data as { id: number; chapterNumber: number; wordCount: number; title: string; content?: string }[]) {
                    existingMap.set(c.chapterNumber, { id: c.id, hasContent: (c.wordCount || 0) > 0, title: c.title })
                  }
                }
                const chapterNumbers = new Set(chapters.map(ch => ch.chapterNumber))
                await doApplyChapters(chapters, existingMap, chapterNumbers)
              }}
            >
              确认应用（删除旧章节）
            </Button>
          </div>
        </div>
      </Modal>

      {showSummaryEditor && editingChapter && (
        <ChapterSummaryEditor
          open={showSummaryEditor}
          onOpenChange={setShowSummaryEditor}
          chapterId={editingChapter.id}
          chapterNumber={editingChapter.chapterNumber}
          title={editingChapter.title}
          summary={editingChapter.summary}
          projectId={projectId}
          onSave={handleSaveSummary}
        />
      )}
    </>
  )
}

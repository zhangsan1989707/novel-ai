'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Input, Textarea, Select, Card, CardContent, CardHeader, CardTitle, Badge, Progress, Modal, ChaptersEmptyState, toast, MoreActionsMenu, BatchChapterActionBar } from '@/components/ui'
import { ProjectForm, ProjectFormData, genreOptions, writingStyleOptions, ChapterListGenerator, BatchGenerator } from '@/components/project'
import { BatchProgress } from '@/components/ai/BatchProgress'
import { PlotAnalyzer, BookAnalysisPanel, ContinuationPanel, ContinuationResults, ResearchPanel, ReviewPanel, DeslopPanel, CoverGenerator, AgentManager, WorkflowHooksPanel, ShortStoryPanel } from '@/components/ai'
import { OutlineGenerator } from '@/components/ai/OutlineGenerator'
import { ArrowLeft, Pencil, Trash2, BookOpen, Clock, Target, Users, Layers, Plus, ListChecks, Sparkles, FileText, RefreshCw, Search, Shield, Wand2, Image, Bot, Workflow, BookMarked } from 'lucide-react'
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
  outlineStages?: Record<string, { title: string; summary: string }[]>
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
  DRAFT: { label: '草稿', variant: 'default' },
  GENERATING: { label: '生成中', variant: 'primary' },
  COMPLETED: { label: '已完成', variant: 'success' },
  REVIEWING: { label: '审核中', variant: 'warning' },
}

const projectStatusMap: Record<ProjectStatus, { label: string; variant: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' }> = {
  DRAFT: { label: '草稿', variant: 'default' },
  WRITING: { label: '写作中', variant: 'primary' },
  COMPLETED: { label: '已完成', variant: 'success' },
  PAUSED: { label: '已暂停', variant: 'warning' },
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
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [showPlotAnalysisModal, setShowPlotAnalysisModal] = useState(false)
  const [showContinuationModal, setShowContinuationModal] = useState(false)
  const [batchProgressOpen, setBatchProgressOpen] = useState(false)
  const [deleteChapterId, setDeleteChapterId] = useState<number | null>(null)
  const [selectedChapterIds, setSelectedChapterIds] = useState<number[]>([])
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [plotAnalysisTab, setPlotAnalysisTab] = useState<'analyze' | 'results'>('analyze')
  const [batchOptions, setBatchOptions] = useState<{
    chapterIds?: number[]
    useContext: boolean
    contextChapterCount: number
    temperature: number
    targetWordCount: number
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'chapters' | 'outline' | 'settings'>('chapters')
  const [showGenerator, setShowGenerator] = useState(false)
  const [showOutlineGenerator, setShowOutlineGenerator] = useState(false)
  const [showResearchModal, setShowResearchModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showDeslopModal, setShowDeslopModal] = useState(false)
  const [showCoverModal, setShowCoverModal] = useState(false)
  const [showShortStoryModal, setShowShortStoryModal] = useState(false)

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}`)
      const data = await res.json()
      if (data.success) {
        setProject(data.data)
      } else {
        setError(data.error.message)
      }
    } catch (err) {
      setError('获取项目详情失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchProject()
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

  const handleDeleteChapter = async () => {
    if (!deleteChapterId) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${deleteChapterId}`, {
        method: 'DELETE',
      })
      const result = await res.json()
      if (result.success) {
        setDeleteChapterId(null)
        fetchProject()
        toast.success('章节已删除')
      } else {
        toast.error(result.error?.message || '删除失败')
      }
    } catch (err) {
      console.error('删除章节失败:', err)
      toast.error('删除失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBatchDeleteChapters = async () => {
    if (selectedChapterIds.length === 0) return
    setSubmitting(true)
    try {
      for (const chapterId of selectedChapterIds) {
        await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}`, {
          method: 'DELETE',
        })
      }
      const count = selectedChapterIds.length
      setSelectedChapterIds([])
      setIsSelectMode(false)
      fetchProject()
      toast.success(`已删除 ${count} 个章节`)
    } catch (err) {
      console.error('批量删除章节失败:', err)
      toast.error('删除失败，请重试')
    } finally {
      setSubmitting(false)
    }
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
      const existingMap = new Map<number, number>()
      if (existData.success) {
        for (const c of existData.data as { id: number; chapterNumber: number }[]) {
          existingMap.set(c.chapterNumber, c.id)
        }
      }

      const chapterNumbers = new Set(chapters.map((ch) => ch.chapterNumber))

      for (const ch of chapters) {
        const existingId = existingMap.get(ch.chapterNumber)
        if (existingId) {
          await fetch(`/api/novel/projects/${projectId}/chapters/${existingId}`, {
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
      for (const [chapterNumber, existingId] of existingMap) {
        if (!chapterNumbers.has(chapterNumber)) {
          deletePromises.push(
            fetch(`/api/novel/projects/${projectId}/chapters/${existingId}`, {
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

  return (
    <>
      {/* 面包屑导航 */}
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
        <button
          onClick={() => router.push('/projects')}
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          我的小说
        </button>
        <span>/</span>
        <span className="text-gray-900 dark:text-white font-medium">{project.title}</span>
      </div>

      {/* 项目标题和状态 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            {project.genre && <Badge variant="outline">{project.genre}</Badge>}
            {project.writingStyle && <Badge variant="outline">{project.writingStyle}</Badge>}
            <Badge variant={projectStatusMap[project.status].variant}>
              {projectStatusMap[project.status].label}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      {/* 创作工具栏 */}
      {project.projectMode === 'CREATE' && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOutlineGenerator(true)}
                className="gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                生成大纲
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGenerator(true)}
                className="gap-1.5"
              >
                <ListChecks className="h-3.5 w-3.5" />
                生成目录
              </Button>
              <BatchGenerator
                projectId={projectId}
                chapters={project.chapters}
                onGenerate={(options) => {
                  setBatchOptions(options)
                  setBatchProgressOpen(true)
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPlotAnalysisModal(true)}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                分析剧情
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowContinuationModal(true)}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                继续生成
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResearchModal(true)}
                className="gap-1.5"
              >
                <Search className="h-3.5 w-3.5" />
                资料研究
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReviewModal(true)}
                className="gap-1.5"
              >
                <Shield className="h-3.5 w-3.5" />
                对抗审稿
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeslopModal(true)}
                className="gap-1.5"
              >
                <Wand2 className="h-3.5 w-3.5" />
                去AI味
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCoverModal(true)}
                className="gap-1.5"
              >
                <Image className="h-3.5 w-3.5" />
                封面生成
              </Button>
              {project.genre?.includes('短篇') || project.storyType === 'SHORT' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowShortStoryModal(true)}
                  className="gap-1.5"
                >
                  <BookMarked className="h-3.5 w-3.5" />
                  短篇创作
                </Button>
              ) : null}
              <div className="ml-auto">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push(`/projects/${projectId}/chapters/new`)}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新建章节
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：主要内容 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 进度卡片 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  写作进度
                </h2>
                <span className="text-xl font-bold text-blue-600">{progress !== null ? `${progress}%` : '-'}</span>
              </div>
              {project.targetWordCount ? (
                <Progress value={project.currentWordCount} max={project.targetWordCount} showLabel size="lg" />
              ) : (
                <div className="w-full h-3 bg-muted rounded-full">
                  <div className="h-full w-0 bg-primary rounded-full" />
                </div>
              )}
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xl font-bold">{project.currentWordCount.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">当前字数</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{project.targetWordCount?.toLocaleString() || '-'}</p>
                  <p className="text-xs text-gray-500">目标字数</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{project.chapters.length}</p>
                  <p className="text-xs text-gray-500">章节数</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tab 切换 - 分析模式 */}
          {project.projectMode === 'ANALYZE' && (
            <Card>
              <CardContent className="p-0">
                <div className="flex border-b">
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
              </CardContent>
            </Card>
          )}

          {/* 章节列表 - ANALYZE 模式 */}
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
                        onClick={() => router.push(`/projects/${projectId}/chapters/${chapter.id}`)}
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

          {/* 章节列表 - CREATE 模式 */}
          {project.projectMode === 'CREATE' && (
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
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        章节列表
                      </CardTitle>
                    )}
                  </div>
                  {!isSelectMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSelectMode(true)}
                      className="gap-1.5"
                    >
                      <ListChecks className="h-4 w-4" />
                      多选
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {project.chapters.length === 0 ? (
                  <ChaptersEmptyState
                    onCreate={() => router.push(`/projects/${projectId}/chapters/new`)}
                    onGenerate={() => setShowGenerator(true)}
                  />
                ) : (
                  <div className="space-y-2">
                    {project.chapters.map((chapter) => (
                      <div
                        key={chapter.id}
                        className={`flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all ${
                          isSelectMode ? 'cursor-pointer' : ''
                        }`}
                        onClick={() => !isSelectMode && router.push(`/projects/${projectId}/chapters/${chapter.id}`)}
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
                          {chapter.status === 'GENERATING' && (
                            <Badge variant="primary" className="text-xs">生成中</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500">{(chapter.wordCount || 0).toLocaleString()} 字</span>
                          <Badge variant={chapterStatusMap[chapter.status].variant} className="text-xs">
                            {chapterStatusMap[chapter.status].label}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 大纲生成器 */}
      {showOutlineGenerator && project.projectMode === 'CREATE' && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <OutlineGenerator
              projectTitle={project.title}
              genre={project.genre || undefined}
              writingStyle={project.writingStyle || undefined}
              worldSetting={project.worldSetting || undefined}
              protagonistProfile={project.protagonistProfile || undefined}
              protagonistGoal={project.protagonistGoal || undefined}
              antagonistSetting={project.antagonistSetting || undefined}
              endingPlan={project.endingPlan || undefined}
              onApply={(outline) => {
                console.log('生成的大纲:', outline)
                setShowOutlineGenerator(false)
              }}
              onClose={() => setShowOutlineGenerator(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* 目录生成器 */}
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

        {/* 右侧：信息面板 */}
        <div className="space-y-6">
          {/* 项目信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                项目信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <span className="text-sm text-gray-500">创建时间</span>
                <span className="text-sm">{new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">更新时间</span>
                <span className="text-sm">{new Date(project.updatedAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* 角色信息 */}
          {project.protagonistProfile && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  主角设定
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-4">
                  {project.protagonistProfile}
                </p>
              </CardContent>
            </Card>
          )}

          {/* 世界设定 */}
          {project.worldSetting && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  世界设定
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-4">
                  {project.worldSetting}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 批量进度 */}
      {batchProgressOpen && batchOptions && (
        <BatchProgress
          projectId={projectId}
          options={batchOptions}
          open={batchProgressOpen}
          onClose={() => {
            setBatchProgressOpen(false)
            fetchProject()
          }}
        />
      )}

      {/* 编辑项目 Modal */}
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

      {/* 删除项目 Modal */}
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

      {/* 分析剧情 Modal */}
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

      {/* 继续生成 Modal */}
      <Modal
        open={showContinuationModal}
        onClose={() => setShowContinuationModal(false)}
        title="继续生成"
        className="max-w-2xl"
      >
        <ContinuationPanel projectId={projectId} />
      </Modal>

      {/* 资料研究 Modal */}
      <Modal
        open={showResearchModal}
        onClose={() => setShowResearchModal(false)}
        title="资料研究"
        className="max-w-3xl"
      >
        <ResearchPanel projectId={projectId} />
      </Modal>

      {/* 对抗审稿 Modal */}
      <Modal
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title="对抗式审稿"
        className="max-w-4xl"
      >
        <ReviewPanel projectId={projectId} />
      </Modal>

      {/* 去AI味 Modal */}
      <Modal
        open={showDeslopModal}
        onClose={() => setShowDeslopModal(false)}
        title="去AI味"
        className="max-w-4xl"
      >
        <DeslopPanel projectId={projectId} />
      </Modal>

      {/* 封面生成 Modal */}
      <Modal
        open={showCoverModal}
        onClose={() => setShowCoverModal(false)}
        title="封面生成"
        className="max-w-4xl"
      >
        <CoverGenerator projectId={projectId} />
      </Modal>

      {/* 短篇创作 Modal */}
      <Modal
        open={showShortStoryModal}
        onClose={() => setShowShortStoryModal(false)}
        title="短篇创作"
        className="max-w-4xl"
      >
        <ShortStoryPanel projectId={projectId} />
      </Modal>

      {/* 分析模式特殊 Modal */}
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
    </>
  )
}
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Input, Textarea, Select, Card, CardContent, CardHeader, CardTitle, Badge, Progress, Modal } from '@/components/ui'
import { ProjectForm, ProjectFormData, genreOptions, writingStyleOptions, ChapterListGenerator, BatchGenerator, ExportMenu } from '@/components/project'
import { BatchProgress } from '@/components/ai/BatchProgress'
import { PlotAnalyzer, BookAnalysisPanel, ContinuationPanel, ContinuationResults } from '@/components/ai'
import { ArrowLeft, Pencil, Trash2, BookOpen, Clock, Target, Users, Layers, Plus, ListChecks, Sparkles } from 'lucide-react'
import type { ProjectStatus } from '@/types'

interface Chapter {
  id: number
  chapterNumber: number
  title: string
  wordCount: number
  status: 'DRAFT' | 'GENERATING' | 'COMPLETED' | 'REVIEWING'
  sortOrder: number
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

  // Modal 状态
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

  // 获取项目详情
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

  // 更新项目
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

  // 删除项目
  const handleDelete = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}`, {
        method: 'DELETE',
      })
      const result = await res.json()
      if (result.success) {
        router.push('/projects')
      }
    } catch (err) {
      console.error('删除项目失败:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // 删除章节
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
      }
    } catch (err) {
      console.error('删除章节失败:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // 批量删除章节
  const handleBatchDeleteChapters = async () => {
    if (selectedChapterIds.length === 0) return
    setSubmitting(true)
    try {
      // 逐个删除
      for (const chapterId of selectedChapterIds) {
        await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}`, {
          method: 'DELETE',
        })
      }
      setSelectedChapterIds([])
      setIsSelectMode(false)
      fetchProject()
    } catch (err) {
      console.error('批量删除章节失败:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // 切换章节选中
  const toggleChapterSelection = (id: number) => {
    setSelectedChapterIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  // 切换全选
  const toggleSelectAll = () => {
    if (!project) return
    if (selectedChapterIds.length === project.chapters.length) {
      setSelectedChapterIds([])
    } else {
      setSelectedChapterIds(project.chapters.map((ch) => ch.id))
    }
  }

  // 应用生成的章节列表
  const handleApplyChapters = async (chapters: { chapterNumber: number; title: string; summary: string }[]) => {
    try {
      // 获取已存在的章节号
      const existCheck = await fetch(`/api/novel/projects/${projectId}/chapters`)
      const existData = await existCheck.json()
      const existingNumbers = new Set(
        existData.success ? existData.data.map((c: { chapterNumber: number }) => c.chapterNumber) : []
      )

      // 批量创建章节，跳过已存在的
      for (const ch of chapters) {
        if (existingNumbers.has(ch.chapterNumber)) continue

        const res = await fetch(`/api/novel/projects/${projectId}/chapters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapterNumber: ch.chapterNumber,
            title: ch.title,
            summary: ch.summary,
            status: 'DRAFT',
          }),
        })
        const result = await res.json()
        if (!result.success) {
          console.error('创建章节失败:', result.error.message)
        }
      }
      // 刷新项目详情
      fetchProject()
    } catch (err) {
      console.error('创建章节失败:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="text-center">
          <p className="text-red-500">{error || '项目不存在'}</p>
          <Button variant="outline" onClick={() => router.push('/projects')} className="mt-4">
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  const progress = project.targetWordCount
    ? Math.round((project.currentWordCount / project.targetWordCount) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b">
        <div className="mx-auto max-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.push('/projects')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
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
            </div>
            <div className="flex items-center gap-2">
              {project.projectMode === 'CREATE' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push(`/projects/${projectId}/chapters/new`)}
                  className="gap-1.5"
                >
                  <Sparkles className="h-4 w-4" />
                  一键生成
                </Button>
              )}
              {project.projectMode === 'ANALYZE' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setShowPlotAnalysisModal(true)}>
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    全文分析
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setShowContinuationModal(true)}>
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    续写本章
                  </Button>
                </>
              )}
              <ExportMenu project={project} />
              <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
                <Pencil className="h-4 w-4 mr-1.5" />
                编辑
              </Button>
              <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
                <Trash2 className="h-4 w-4 mr-1.5" />
                删除
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：基本信息 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 进度卡片 */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    写作进度
                  </h2>
                  <span className="text-2xl font-bold text-blue-600">{progress}%</span>
                </div>
                <Progress value={progress} showLabel size="lg" />
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{project.currentWordCount.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">当前字数</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{project.targetWordCount?.toLocaleString() || '-'}</p>
                    <p className="text-sm text-gray-500">目标字数</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{project.chapters.length}</p>
                    <p className="text-sm text-gray-500">章节数</p>
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

            {/* 章节列表 */}
            {project.projectMode === 'ANALYZE' && activeTab === 'chapters' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      原著章节
                      <Badge variant="secondary" className="ml-2">
                        {project.chapters.filter(c => c.status === 'REVIEWING').length} 章
                      </Badge>
                    </CardTitle>
                  </div>
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
                          className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 group transition-all duration-150 cursor-pointer"
                        >
                          <div
                            className="flex items-center gap-3 flex-1"
                            onClick={() => router.push(`/projects/${projectId}/chapters/${chapter.id}`)}
                          >
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

            {/* 章节列表 - 仅 CREATE 模式显示 */}
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
                        </>
                      )}
                      {!isSelectMode && (
                        <CardTitle className="flex items-center gap-2">
                          <BookOpen className="h-5 w-5" />
                          章节列表
                        </CardTitle>
                      )}
                    </div>
                  <div className="flex items-center gap-2">
                    {isSelectMode ? (
                      <>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={selectedChapterIds.length === 0}
                          onClick={handleBatchDeleteChapters}
                          loading={submitting}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除 ({selectedChapterIds.length})
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          setIsSelectMode(false)
                          setSelectedChapterIds([])
                        }}>
                          取消
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsSelectMode(true)}
                          className="gap-1.5"
                        >
                          <ListChecks className="h-4 w-4" />
                          多选
                        </Button>
                        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
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
                          aiModelId={project.aiModelId || undefined}
                          onApply={handleApplyChapters}
                        />
                        <BatchGenerator
                          projectId={projectId}
                          chapters={project.chapters}
                          onGenerate={(options) => {
                            setBatchOptions(options)
                            setBatchProgressOpen(true)
                          }}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => router.push(`/projects/${projectId}/chapters/new`)}
                          className="gap-1.5"
                        >
                          <Plus className="h-4 w-4" />
                          新建章节
                        </Button>
                      </div>
                    )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {project.chapters.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>还没有章节</p>
                      <Button variant="outline" className="mt-2" onClick={() => router.push(`/projects/${projectId}/chapters/new`)}>
                        创建第一章
                      </Button>
                    </div>
                ) : (
                  <div className="space-y-2">
                    {project.chapters.map((chapter) => (
                      <div
                        key={chapter.id}
                        className={`flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 group transition-all duration-150 ${
                          isSelectMode ? 'cursor-pointer' : ''
                        }`}
                      >
                        {isSelectMode && (
                          <input
                            type="checkbox"
                            checked={selectedChapterIds.includes(chapter.id)}
                            onChange={() => toggleChapterSelection(chapter.id)}
                            className="w-4 h-4 mr-3 accent-blue-600"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div
                          className={`flex items-center gap-3 flex-1 ${isSelectMode ? '' : 'cursor-pointer'}`}
                          onClick={() => {
                            if (isSelectMode) {
                              toggleChapterSelection(chapter.id)
                            } else {
                              router.push(`/projects/${projectId}/chapters/${chapter.id}`)
                            }
                          }}
                        >
                          <span className="text-gray-400">第{chapter.chapterNumber}章</span>
                          <span className="font-medium">{chapter.title || '无标题'}</span>
                        </div>
                        {!isSelectMode && (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">{(chapter.wordCount || 0).toLocaleString()} 字</span>
                            <Badge variant={chapterStatusMap[chapter.status]?.variant} className="text-xs">
                              {chapterStatusMap[chapter.status]?.label}
                            </Badge>
                            <button
                              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteChapterId(chapter.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        {isSelectMode && (
                          <span className="text-sm text-gray-500">{(chapter.wordCount || 0).toLocaleString()} 字</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* 大纲 - CREATE 模式 */}
            {project.projectMode === 'CREATE' && project.outline && (
              <Card>
                <CardHeader>
                  <CardTitle>故事大纲</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{project.outline}</p>
                </CardContent>
              </Card>
            )}

            {/* 分析结果 - ANALYZE 模式 Tab */}
            {project.projectMode === 'ANALYZE' && activeTab === 'outline' && (
              <BookAnalysisPanel
                projectId={projectId}
                totalVolumes={project.totalVolumes}
              />
            )}

            {/* 续写章节 - ANALYZE 模式 Tab */}
            {project.projectMode === 'ANALYZE' && activeTab === 'settings' && (
              <ContinuationResults projectId={projectId} />
            )}
          </div>

          {/* 右侧：详细设定 */}
          <div className="space-y-6">
            {/* 统计信息 */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">创建时间</p>
                    <p className="font-medium">{new Date(project.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Layers className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">总卷数</p>
                    <p className="font-medium">{project.totalVolumes} 卷</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">每章字数</p>
                    <p className="font-medium">{project.chapterWordCount.toLocaleString()} 字</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 详细设定 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  详细设定
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.worldSetting && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">世界观</h4>
                    <p className="text-sm">{project.worldSetting}</p>
                  </div>
                )}
                {project.powerSystem && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">力量体系</h4>
                    <p className="text-sm">{project.powerSystem}</p>
                  </div>
                )}
                {project.protagonistProfile && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">主角人设</h4>
                    <p className="text-sm">{project.protagonistProfile}</p>
                  </div>
                )}
                {project.protagonistGoal && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">主角目标</h4>
                    <p className="text-sm">{project.protagonistGoal}</p>
                  </div>
                )}
                {project.antagonistSetting && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">反派设定</h4>
                    <p className="text-sm">{project.antagonistSetting}</p>
                  </div>
                )}
                {project.endingPlan && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">结局规划</h4>
                    <p className="text-sm">{project.endingPlan}</p>
                  </div>
                )}
                {project.writingPrompt && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">写作提示</h4>
                    <p className="text-sm">{project.writingPrompt}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

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
            description: project.description || '',
            genre: project.genre || '',
            writingStyle: project.writingStyle || '',
            targetWordCount: project.targetWordCount || undefined,
            chapterWordCount: project.chapterWordCount,
            coverImage: project.coverImage || '',
            totalVolumes: project.totalVolumes,
            worldSetting: project.worldSetting || '',
            powerSystem: project.powerSystem || '',
            protagonistProfile: project.protagonistProfile || '',
            protagonistGoal: project.protagonistGoal || '',
            antagonistSetting: project.antagonistSetting || '',
            endingPlan: project.endingPlan || '',
            writingPrompt: project.writingPrompt || '',
            aiModelId: project.aiModelId || undefined,
          }}
          onSubmit={handleUpdate}
          onCancel={() => setShowEditModal(false)}
          loading={submitting}
          submitLabel="保存"
        />
      </Modal>

      {/* 删除确认 Modal */}
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

      {/* 批量生成进度 Modal */}
      {batchOptions && (
        <BatchProgress
          projectId={projectId}
          chapterIds={batchOptions.chapterIds}
          useContext={batchOptions.useContext}
          contextChapterCount={batchOptions.contextChapterCount}
          temperature={batchOptions.temperature}
          targetWordCount={batchOptions.targetWordCount}
          open={batchProgressOpen}
          onClose={() => {
            setBatchProgressOpen(false)
            fetchProject()
          }}
          onComplete={(successCount, failCount) => {
            console.log(`生成完成: 成功 ${successCount}, 失败 ${failCount}`)
          }}
        />
      )}

      {/* 删除章节确认 Modal */}
      <Modal
        open={deleteChapterId !== null}
        onClose={() => setDeleteChapterId(null)}
        title="删除章节"
        description="确定要删除这个章节吗？此操作不可撤销。"
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteChapterId(null)}>
            取消
          </Button>
          <Button variant="danger" onClick={handleDeleteChapter} loading={submitting}>
            删除
          </Button>
        </div>
      </Modal>

      {/* 拆书分析 Modal */}
      <Modal
        open={showPlotAnalysisModal}
        onClose={() => setShowPlotAnalysisModal(false)}
        title="小说拆书分析"
        className="max-w-3xl"
      >
        <div className="flex border-b mb-4">
          <button
            onClick={() => setPlotAnalysisTab('analyze')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              plotAnalysisTab === 'analyze'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            新建分析
          </button>
          <button
            onClick={() => setPlotAnalysisTab('results')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              plotAnalysisTab === 'results'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            查看结果
          </button>
        </div>
        {plotAnalysisTab === 'analyze' ? (
          <PlotAnalyzer
            projectId={projectId}
            projectTitle={project.title}
            totalVolumes={project.totalVolumes}
            onAnalysisComplete={() => {
              setPlotAnalysisTab('results')
            }}
          />
        ) : (
          <BookAnalysisPanel
            projectId={projectId}
            totalVolumes={project.totalVolumes}
          />
        )}
      </Modal>

      {/* 续写 Modal */}
      <Modal
        open={showContinuationModal}
        onClose={() => setShowContinuationModal(false)}
        title="续写功能"
        className="max-w-3xl"
      >
        <ContinuationPanel
          projectId={projectId}
          onApply={(chapterId, content) => {
            setShowContinuationModal(false)
            fetchProject()
          }}
          onCancel={() => setShowContinuationModal(false)}
        />
      </Modal>
    </div>
  )
}

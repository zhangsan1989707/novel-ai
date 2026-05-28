'use client'

import { useState, useCallback } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Progress, Modal, toast, MoreActionsMenu } from '@/components/ui'
import { BlueprintConsole, ProjectBaseInfoForm } from '@/components/project'
import { WorkflowBlueprintCard } from '@/components/project/WorkflowBlueprintCard'
import { WorkflowArcPlanCard } from '@/components/project/WorkflowArcPlanCard'
import { Toolbox, CharacterPanel } from '@/components/ai'
import { CoverGenerator, ResearchPanel, ReviewPanel, DeslopPanel, ExportPanel, AnalysisWorkbench } from '@/components/ai'
import { BookOpen, Users, Layers, Search, Rocket, ClipboardList, Shield, Sparkles, Wrench, Play, Pause, Loader2, Download } from 'lucide-react'
import { formatDisplayDate } from '@/lib/helpers'
import { getMinimumChapterWordCount } from '@/lib/ai/chapter-quality'
import type { GenerationSpeedMode } from '@/lib/ai/speed-mode'
import type { BlueprintConsoleSnapshot } from '@/lib/engine/blueprint-console'
import { useProjectDetail, type ProjectChapter } from '@/hooks/useProjectDetail'
import { useProjectPipeline } from '@/hooks/useProjectPipeline'
import { ProjectChapterDirectory } from '@/components/project/detail/ProjectChapterDirectory'
import { ProjectSidebar } from '@/components/project/detail/ProjectSidebar'
import { ProjectModals } from '@/components/project/detail/ProjectModals'
import { PipelineControlPanel } from '@/components/project/detail/PipelineControlPanel'
import { useNextStepState } from '@/components/project/detail/useNextStepState'
import {
  projectStatusMap,
  speedModeOptions,
  speedModeLabels,
  defaultSteeringValues,
  getSpeedModeDescription,
  getPipelineStatusLabel,
  formatDuration,
  groupChaptersByArc,
} from '@/components/project/detail'

type NextStepState = {
  badgeVariant: 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
  badgeLabel: string
  title: string
  description: string
  ctaLabel: string
  ctaAction: string
  disabled?: boolean
}

export default function ProjectDetailPage({ initialProject }: { initialProject: NonNullable<ReturnType<typeof useProjectDetail>['project']> | null }) {
  const {
    projectId,
    router,
    project,
    setProject,
    loading,
    error,
    submitting,
    selectedSpeedMode,
    setSelectedSpeedMode,
    selectedChapterNumber,
    setSelectedChapterNumber,
    chapterDirectoryTouched,
    setChapterDirectoryTouched,
    modals,
    openModal,
    closeModal,
    previewChapter,
    setPreviewChapter,
    fetchProject,
    maintenanceActive,
    maintenanceFailed,
    projectInitializing,
    handleUpdate,
    handleDelete,
    openChapterPreview,
    openChapterEditor,
    openChapterGenerate,
  } = useProjectDetail(initialProject)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [maintenanceRetrying, setMaintenanceRetrying] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings' | 'analysis' | 'characters'>('dashboard')

  const {
    pipeline,
    setPipeline,
    pipelineStarting,
    handleStartPipeline,
    handleResumePipeline,
    handlePausePipeline,
    handleRecoverPipeline,
  } = useProjectPipeline({
    projectId,
    selectedSpeedMode,
    setSelectedSpeedMode,
    setChapterDirectoryTouched,
    setSelectedChapterNumber,
    onCompleted: fetchProject,
    onFailed: fetchProject,
  })

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

  const handleQuickExportTxt = async () => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view: 'data' }),
      })
      const data = await res.json()
      if (data.success) {
        let content = `${project?.title || '未命名小说'}

${'='.repeat(40)}

`
        for (const ch of data.data.chapters) {
          content += `第${ch.chapterNumber}章 ${ch.title}

${ch.content || ''}

`
        }
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${project?.title || '未命名小说'}.txt`
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

  const getReviewingReason = useCallback((chapter: ProjectChapter) => {
    const minimumWordCount = getMinimumChapterWordCount(project?.chapterWordCount || 3000, chapter.chapterNumber)
    if ((chapter.wordCount || 0) < minimumWordCount) {
      return `当前仅 ${(chapter.wordCount || 0).toLocaleString()} 字，低于最低要求 ${minimumWordCount.toLocaleString()} 字，需要补写或重写后再保存。`
    }

    return '这章已被标记为待审稿，说明 AI 结果没有被系统直接视为稳定成稿。建议打开章节检查正文后，再决定是手工修订还是重新生成。'
  }, [project?.chapterWordCount])

  const toolboxItems = [
    {
      id: 'research',
      label: '资料研究',
      description: 'AI辅助收集设定资料',
      icon: <Search className="h-4 w-4" />,
      onClick: () => openModal('research'),
    },
    {
      id: 'cover',
      label: '封面生成',
      description: 'AI生成小说封面',
      icon: <Rocket className="h-4 w-4" />,
      onClick: () => openModal('cover'),
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
        openModal('plotAnalysis')
      },
    },
    {
      id: 'review',
      label: '对抗审稿',
      description: '多模型交叉审稿',
      icon: <Shield className="h-4 w-4" />,
      onClick: () => openModal('review'),
    },
    {
      id: 'deslop',
      label: '去AI味',
      description: '润色去除AI痕迹',
      icon: <Sparkles className="h-4 w-4" />,
      onClick: () => openModal('deslop'),
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
  const activeSpeedMode = pipeline?.speedMode || pipeline?.runtime?.speedMode || selectedSpeedMode
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
  const nextStepState = useNextStepState({
    project,
    pipeline,
    maintenanceActive,
    maintenanceFailed,
  })

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.title}</h1>
            <Badge variant={projectStatusMap[project.status].variant}>
              {projectStatusMap[project.status].label}
            </Badge>
            {pipeline && (
              <Badge variant={pipeline.status === 'RUNNING' ? 'primary' : pipeline.status === 'FAILED' ? 'danger' : 'secondary'}>
                {getPipelineStatusLabel(pipeline.status)}
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {project.genre || '未设定题材'} · {project.writingStyle || '未设定风格'} · 更新于 {formatDisplayDate(project.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pipeline?.status === 'PAUSED' && (
            <Button variant="outline" size="sm" onClick={handleResumePipeline} className="gap-1.5">
              <Play className="h-4 w-4" />
              继续生成
            </Button>
          )}
          {!isAnalyzeMode && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleStartPipeline({
                  hasBoundModel,
                  maintenanceActive,
                  flowBlockedReason,
                  blueprintConfirmedAt: project.blueprintConfirmedAt,
                  arcPlanConfirmedAt: project.arcPlanConfirmedAt,
                })}
                loading={pipelineStarting}
                disabled={pipeline?.status === 'RUNNING' || pipeline?.status === 'PENDING' || pipeline?.status === 'PAUSED' || !hasBoundModel || maintenanceActive || Boolean(flowBlockedReason)}
                className="gap-1.5"
                title={flowBlockedReason || undefined}
              >
                <Rocket className="h-4 w-4" />
                {projectInitializing ? '初始化中' : '开始生成'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => openModal('toolbox')} className="gap-1.5">
                <Wrench className="h-4 w-4" />
                辅助工具
              </Button>
              <Button variant="outline" size="sm" onClick={() => openModal('export')} className="gap-1.5">
                <Download className="h-4 w-4" />
                导出
              </Button>
              <MoreActionsMenu
                onEdit={() => openModal('edit')}
                onDelete={() => openModal('delete')}
                onExport={handleQuickExportTxt}
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
                总览
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                设定中枢
              </button>
              <button
                onClick={() => setActiveTab('characters')}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'characters'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                角色档案
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-9 space-y-6">
              {nextStepState && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Badge variant={nextStepState.badgeVariant}>
                          {nextStepState.badgeLabel}
                        </Badge>
                        <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{nextStepState.title}</h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-3xl">
                          {nextStepState.description}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {nextStepState.ctaAction === 'retry' && (
                          <Button variant="primary" size="sm" onClick={handleRetryMaintenance} loading={maintenanceRetrying}>
                            {nextStepState.ctaLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'dashboard' && (
                <>
                  <Card className="border-green-200 bg-green-50/70 dark:border-green-900/40 dark:bg-green-950/20">
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div className="text-sm font-medium text-green-700 dark:text-green-300">生成控制</div>
                          <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">选择生产节奏后启动流水线</h2>
                          <div className="mt-2 rounded-lg border border-green-200 bg-white/80 px-3 py-2 text-xs text-green-800 dark:border-green-900/50 dark:bg-slate-950/30 dark:text-green-200">
                            当前模式：{speedModeLabels[selectedSpeedMode]}。{getSpeedModeDescription(selectedSpeedMode)}
                          </div>
                          {flowBlockedReason && (
                            <div className="mt-2 text-xs text-green-700/80 dark:text-green-300/80">{flowBlockedReason}</div>
                          )}
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:w-56">
                          <select
                            value={selectedSpeedMode}
                            onChange={(event) => setSelectedSpeedMode(event.target.value as GenerationSpeedMode)}
                            disabled={pipeline?.status === 'RUNNING' || pipeline?.status === 'PENDING'}
                            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm dark:border-gray-700 dark:bg-slate-950 dark:text-gray-100"
                            aria-label="生成速度模式"
                          >
                            {speedModeOptions.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <Button
                            variant="primary"
                            onClick={() => handleStartPipeline({
                              hasBoundModel,
                              maintenanceActive,
                              flowBlockedReason,
                              blueprintConfirmedAt: project.blueprintConfirmedAt,
                              arcPlanConfirmedAt: project.arcPlanConfirmedAt,
                            })}
                            loading={pipelineStarting}
                            disabled={pipeline?.status === 'RUNNING' || pipeline?.status === 'PENDING' || pipeline?.status === 'PAUSED' || !hasBoundModel || maintenanceActive || Boolean(flowBlockedReason)}
                          >
                            开始生成
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

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
                      <ProjectChapterDirectory
                        chapters={project.chapters}
                        groups={arcGroups}
                        selectedChapterNumber={selectedChapterNumber}
                        liveChapter={liveChapter}
                        completedChapters={completedChapters}
                        reviewingChapters={reviewingChapters}
                        flowBlockedReason={flowBlockedReason}
                        pipelineStarting={pipelineStarting}
                        hasBoundModel={hasBoundModel}
                        maintenanceActive={maintenanceActive}
                        projectInitializing={projectInitializing}
                        onSelectChapter={(chapterNumber) => {
                          setChapterDirectoryTouched(true)
                          setSelectedChapterNumber(prev => prev === chapterNumber ? null : chapterNumber)
                        }}
                        onStartPipeline={() => handleStartPipeline({
                          hasBoundModel,
                          maintenanceActive,
                          flowBlockedReason,
                          blueprintConfirmedAt: project.blueprintConfirmedAt,
                          arcPlanConfirmedAt: project.arcPlanConfirmedAt,
                        })}
                        onOpenPreview={openChapterPreview}
                        onOpenEditor={openChapterEditor}
                        onOpenGenerate={openChapterGenerate}
                      />
                    </CardContent>
                  </Card>


                  {pipeline && (
                    <PipelineControlPanel
                      pipeline={pipeline}
                      activeSpeedMode={activeSpeedMode}
                      handlePausePipeline={handlePausePipeline}
                      handleResumePipeline={handleResumePipeline}
                      handleRecoverPipeline={handleRecoverPipeline}
                    />
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
                    initialData={project.blueprintConsole as unknown as BlueprintConsoleSnapshot}
                    steeringValues={steeringValues}
                    aiStatus={aiConsoleStatus}
                    onRefreshed={fetchProject}
                    onEditBaseInfo={() => openModal('edit')}
                  />
                </div>
              )}
            </div>

            <ProjectSidebar
              project={project}
              progress={progress}
              effectiveTargetWordCount={effectiveTargetWordCount}
              estimatedTotalChapters={estimatedTotalChapters}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={setSidebarCollapsed}
            />
          </div>
        </>
      )}


      <ProjectModals
        projectId={projectId}
        project={project}
        modals={modals}
        closeModal={closeModal}
        previewChapter={previewChapter}
        setPreviewChapter={setPreviewChapter}
        submitting={submitting}
        handleUpdate={handleUpdate}
        handleDelete={handleDelete}
        fetchProject={fetchProject}
        openChapterEditor={openChapterEditor}
        openChapterGenerate={openChapterGenerate}
        getReviewingReason={getReviewingReason}
      />
    </>
  )
}

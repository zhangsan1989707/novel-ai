'use client'

import { Badge, Button, Progress, Card, CardContent } from '@/components/ui'
import { Target, Users, Clock, ChevronRight, ChevronDown } from 'lucide-react'
import { formatDisplayDate } from '@/lib/helpers'
import { formatLargeNumber } from '@/lib/utils'
import type { ProjectDetail } from '@/hooks/useProjectDetail'
import type { ProjectWorkflowPhase } from '@/components/project/detail/constants'
import { workflowPhaseLabels } from '@/components/project/detail/constants'
import type { ProjectRuntimeSummary } from '@/lib/engine/project-runtime'

interface ProjectSidebarProps {
  project: ProjectDetail
  progress: number | null
  effectiveTargetWordCount: number | null
  estimatedTotalChapters: number | null
  sidebarCollapsed: boolean
  onToggleSidebar: (collapsed: boolean) => void
  workflowPhase?: ProjectWorkflowPhase
  runtimeSummary?: ProjectRuntimeSummary | null
}

export function ProjectSidebar({
  project,
  progress,
  effectiveTargetWordCount,
  estimatedTotalChapters,
  sidebarCollapsed,
  onToggleSidebar,
  workflowPhase,
  runtimeSummary,
}: ProjectSidebarProps) {
  const displayedProgress = runtimeSummary?.overallProgress ?? progress
  const generationLocked = Boolean(runtimeSummary?.canPause)
  const runtimeBatchTotal = runtimeSummary
    ? Math.max(runtimeSummary.queuedChapters + (runtimeSummary.currentChapterNo ? 1 : 0), 1)
    : 1
  const runtimeBatchProgress = runtimeSummary?.currentChapterNo
    ? Math.max(8, Math.round((1 / runtimeBatchTotal) * 100))
    : runtimeSummary?.overallProgress || 0

  return (
    <>
      <div className={`space-y-4 transition-all duration-300 ${sidebarCollapsed ? 'hidden' : ''}`}>
        <div className="flex items-center justify-end">
          <button
            onClick={() => onToggleSidebar(true)}
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
                {workflowPhase && workflowPhase !== 'WRITING' ? workflowPhaseLabels[workflowPhase].sidebarTitle : '写作进度'}
              </h3>
              <span className="text-lg font-bold text-blue-600">
                {runtimeSummary ? '创作中' : workflowPhase && workflowPhase !== 'WRITING' ? workflowPhaseLabels[workflowPhase].title : displayedProgress !== null ? `${displayedProgress}%` : '-'}
              </span>
            </div>

            {runtimeSummary ? (
              <div className="rounded-xl border border-blue-200 bg-white/80 p-4 text-sm dark:border-blue-900/40 dark:bg-slate-950/40">
                <div className="text-xs text-gray-500">当前阶段</div>
                <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {runtimeSummary.currentChapterNo ? `第${runtimeSummary.currentChapterNo}章 · ` : ''}{runtimeSummary.stageLabel}
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                    <span>当前批次</span>
                    <span>{runtimeSummary.currentChapterNo ? '进行中' : '等待中'}</span>
                  </div>
                  <Progress value={runtimeBatchProgress} max={100} size="sm" />
                </div>
                <div className="mt-3 space-y-2 text-gray-700 dark:text-gray-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500">本批待生成</span>
                    <span className="font-semibold">{runtimeSummary.queuedChapters} 章</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500">待处理异常</span>
                    <span className="font-semibold">{runtimeSummary.failedChapters} 章</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-2 dark:border-gray-800">
                    <span className="text-gray-500">全书计划</span>
                    <span className="text-right">约 {runtimeSummary.totalChapters} 章，已审核 {runtimeSummary.completedChapters} 章</span>
                  </div>
                </div>
              </div>
            ) : workflowPhase && workflowPhase !== 'WRITING' ? (
              <div className="rounded-xl border border-blue-200 bg-white/80 p-4 text-sm dark:border-blue-900/40 dark:bg-slate-950/40">
                <div className="space-y-3 text-gray-700 dark:text-gray-200">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-gray-500">当前阶段</span>
                    <span className="font-medium text-gray-900 dark:text-white text-right">{workflowPhaseLabels[workflowPhase].title}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-gray-500">下一步</span>
                    <span className="text-right">{workflowPhaseLabels[workflowPhase].nextStep}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-gray-500">预计耗时</span>
                    <span className="text-right">{workflowPhaseLabels[workflowPhase].estimated}</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-500">进入正文生成后，这里会恢复为写作进度。</p>
              </div>
            ) : effectiveTargetWordCount ? (
              <Progress value={project.currentWordCount} max={effectiveTargetWordCount} showLabel size="sm" />
            ) : (
              <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                <div className="h-full w-0 bg-blue-500 rounded-full" />
              </div>
            )}

            {workflowPhase === 'WRITING' ? (
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-sm font-bold">{formatLargeNumber(project.currentWordCount)}</p>
                  <p className="text-xs text-gray-500">当前</p>
                </div>
                <div>
                  <p className="text-sm font-bold">{effectiveTargetWordCount ? formatLargeNumber(effectiveTargetWordCount) : '-'}</p>
                  <p className="text-xs text-gray-500">目标</p>
                </div>
                <div>
                  <p className="text-sm font-bold">{runtimeSummary ? runtimeBatchTotal : estimatedTotalChapters?.toLocaleString() || '-'}</p>
                  <p className="text-xs text-gray-500">{runtimeSummary ? '当前批次' : '预计章数'}</p>
                </div>
                <div>
                  <p className="text-sm font-bold">{project.chapters.length}</p>
                  <p className="text-xs text-gray-500">已建章节</p>
                </div>
              </div>
            ) : null}

            {workflowPhase === 'WRITING' && estimatedTotalChapters && project.expectedStageCount ? (
              <p className="mt-3 text-xs text-gray-500">
                {runtimeSummary
                  ? `当前优先展示批次进度；全书约 ${estimatedTotalChapters} 章、${project.expectedStageCount} 个阶段，可在设定中枢查看。`
                  : `当前按 ${project.lengthType || 'LONG'} 口径规划，全书预计约 ${estimatedTotalChapters} 章，默认拆分为 ${project.expectedStageCount} 个阶段。`}
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
              <details className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <summary className="cursor-pointer text-blue-600 dark:text-blue-400">查看完整设定</summary>
                <p className="mt-2 whitespace-pre-wrap leading-5 text-gray-600 dark:text-gray-300">{project.protagonistProfile}</p>
              </details>
              {generationLocked && (
                <p className="mt-2 text-xs text-gray-400">生成中暂不可修改，避免影响上下文一致性。</p>
              )}
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
              <details className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <summary className="cursor-pointer text-blue-600 dark:text-blue-400">查看完整设定</summary>
                <p className="mt-2 whitespace-pre-wrap leading-5 text-gray-600 dark:text-gray-300">{project.worldSetting}</p>
              </details>
              {generationLocked && (
                <p className="mt-2 text-xs text-gray-400">生成中暂不可修改，避免影响上下文一致性。</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {sidebarCollapsed && (
        <button
          onClick={() => onToggleSidebar(false)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 border border-r-0 border-gray-200 dark:border-gray-700 rounded-l-lg px-1.5 py-3 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="展开侧栏"
        >
          <ChevronDown className="h-4 w-4 text-gray-500 rotate-90" />
        </button>
      )}
    </>
  )
}

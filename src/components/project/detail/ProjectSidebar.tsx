'use client'

import { Badge, Button, Progress, Card, CardContent } from '@/components/ui'
import { Target, Users, Clock, ChevronRight, ChevronDown } from 'lucide-react'
import { formatDisplayDate } from '@/lib/helpers'
import { formatLargeNumber } from '@/lib/utils'
import type { ProjectDetail } from '@/hooks/useProjectDetail'

interface ProjectSidebarProps {
  project: ProjectDetail
  progress: number | null
  effectiveTargetWordCount: number | null
  estimatedTotalChapters: number | null
  sidebarCollapsed: boolean
  onToggleSidebar: (collapsed: boolean) => void
}

export function ProjectSidebar({
  project,
  progress,
  effectiveTargetWordCount,
  estimatedTotalChapters,
  sidebarCollapsed,
  onToggleSidebar,
}: ProjectSidebarProps) {
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
                <p className="text-sm font-bold">{formatLargeNumber(project.currentWordCount)}</p>
                <p className="text-xs text-gray-500">当前</p>
              </div>
              <div>
                <p className="text-sm font-bold">{effectiveTargetWordCount ? formatLargeNumber(effectiveTargetWordCount) : '-'}</p>
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

'use client'

import { Badge, Button, Progress, Card, CardContent } from '@/components/ui'
import { Target, Users, Clock, ChevronRight, ChevronDown, Layers, Cpu, Calendar } from 'lucide-react'
import { formatDisplayDate } from '@/lib/helpers'
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
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">项目信息</span>
          <button
            onClick={() => onToggleSidebar(true)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            title="收起侧栏"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <Card className="border-l-4 border-l-blue-500 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Target className="h-4 w-4 text-blue-500" />
                写作进度
              </h3>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {progress !== null ? `${progress}%` : '—'}
              </span>
            </div>

            {effectiveTargetWordCount ? (
              <Progress value={project.currentWordCount} max={effectiveTargetWordCount} showLabel size="sm" />
            ) : (
              <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                <div className="h-full w-0 bg-blue-500 rounded-full" />
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-blue-50/60 dark:bg-blue-950/20 px-2.5 py-2">
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                  {project.currentWordCount.toLocaleString()}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-blue-500/70 dark:text-blue-400/70">当前字数</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-2.5 py-2">
                <p className="text-lg font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                  {effectiveTargetWordCount?.toLocaleString() || '—'}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">目标字数</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-2.5 py-2">
                <p className="text-lg font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                  {estimatedTotalChapters?.toLocaleString() || '—'}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">预计章数</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-2.5 py-2">
                <p className="text-lg font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                  {project.chapters.length}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">已建章节</p>
              </div>
            </div>

            {estimatedTotalChapters && project.expectedStageCount ? (
              <p className="mt-3 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
                {project.lengthType || 'LONG'} 口径 · 约 {estimatedTotalChapters} 章 · {project.expectedStageCount} 个阶段
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Layers className="h-3.5 w-3.5" />
                创作模式
              </div>
              <Badge variant={project.projectMode === 'CREATE' ? 'primary' : 'secondary'} className="text-[11px]">
                {project.projectMode === 'CREATE' ? '创作' : '分析'}
              </Badge>
            </div>
            {project.aiModelConfig && (
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Cpu className="h-3.5 w-3.5" />
                  AI 模型
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[140px]">
                  {project.aiModelConfig.name}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Calendar className="h-3.5 w-3.5" />
                更新时间
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-300">{formatDisplayDate(project.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>

        {project.protagonistProfile && (
          <Card className="border-l-4 border-l-purple-400 overflow-hidden">
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 mb-2">
                <Users className="h-4 w-4 text-purple-500" />
                主角设定
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed">
                {project.protagonistProfile}
              </p>
            </CardContent>
          </Card>
        )}

        {project.worldSetting && (
          <Card className="border-l-4 border-l-emerald-400 overflow-hidden">
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 mb-2">
                <Clock className="h-4 w-4 text-emerald-500" />
                世界设定
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed">
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
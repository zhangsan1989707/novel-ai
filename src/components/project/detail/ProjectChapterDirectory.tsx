'use client'

import { Badge, Button, ExpandableList } from '@/components/ui'
import { BookOpen, Eye, Rocket, Sparkles, RotateCcw, Loader2 } from 'lucide-react'
import { formatLargeNumber } from '@/lib/utils'
import type { PipelineRuntimeState } from '@/lib/engine/pipeline-runtime'
import type { ProjectChapter } from '@/hooks/useProjectDetail'

const INITIAL_VISIBLE_PROJECT_CHAPTERS_PER_GROUP = 10

const chapterStatusMap: Record<ProjectChapter['status'], { label: string; variant: 'default' | 'primary' | 'success' | 'warning' }> = {
  DRAFT: { label: '未写作', variant: 'default' },
  GENERATING: { label: '生成中', variant: 'primary' },
  COMPLETED: { label: '已完成', variant: 'success' },
  REVIEWING: { label: '待审核', variant: 'warning' },
}

interface ChapterGroup {
  arcName: string
  arcNumber: number
  chapters: ProjectChapter[]
}

interface ProjectChapterDirectoryProps {
  chapters: ProjectChapter[]
  groups: ChapterGroup[]
  selectedChapterNumber: number | null
  liveChapter: PipelineRuntimeState['currentChapter']
  completedChapters: number
  reviewingChapters: number
  flowBlockedReason?: string | null
  pipelineStarting?: boolean
  hasBoundModel?: boolean
  maintenanceActive?: boolean
  projectInitializing?: boolean
  onSelectChapter: (chapterNumber: number) => void
  onStartPipeline: () => void
  onOpenDrawer: (chapterId: number) => void
  onOpenEditor: (chapterId: number) => void
  onOpenGenerate: (chapterId: number) => void
}

export function ProjectChapterDirectory({
  chapters,
  groups,
  selectedChapterNumber,
  liveChapter,
  completedChapters,
  reviewingChapters,
  flowBlockedReason,
  pipelineStarting,
  hasBoundModel,
  maintenanceActive,
  projectInitializing,
  onSelectChapter,
  onStartPipeline,
  onOpenDrawer,
  onOpenEditor,
  onOpenGenerate,
}: ProjectChapterDirectoryProps) {
  if (chapters.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          暂无章节，开始 AI 生成后会自动生成
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={onStartPipeline}
          loading={pipelineStarting}
          disabled={!hasBoundModel || maintenanceActive || Boolean(flowBlockedReason)}
          className="mt-4 gap-1.5"
          title={flowBlockedReason || undefined}
        >
          <Rocket className="h-4 w-4" />
          {projectInitializing ? '初始化中' : '开始生成'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
        点击章节可打开审核抽屉，进行阅读、审核和修改操作。
      </div>

      {groups.map((group, groupIdx) => {
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
              renderItem={(chapter) => {
                const currentLiveChapter = liveChapter?.chapterNumber === chapter.chapterNumber ? liveChapter : null
                const chapterBadgeVariant = currentLiveChapter ? 'primary' : chapterStatusMap[chapter.status].variant
                const chapterBadgeLabel = currentLiveChapter
                  ? '实时写作中'
                  : chapterStatusMap[chapter.status].label
                const isReviewing = chapter.status === 'REVIEWING'
                const isGenerating = chapter.status === 'GENERATING' || currentLiveChapter
                const isDraft = chapter.status === 'DRAFT'
                const isSelected = selectedChapterNumber === chapter.chapterNumber

                return (
                  <div
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-all group ${
                      isSelected
                        ? 'border-blue-200 bg-blue-50/70 dark:border-blue-800 dark:bg-blue-950/20'
                        : 'border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                    }`}
                  >
                    {/* 左侧：章节信息 */}
                    <div
                      className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer"
                      onClick={() => { onSelectChapter(chapter.chapterNumber); onOpenDrawer(chapter.id) }}
                    >
                      <span className="shrink-0 text-sm text-gray-400">
                        第{chapter.chapterNumber}章
                      </span>
                      <span className="truncate text-sm font-medium transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {chapter.title || '无标题'}
                      </span>
                    </div>

                    {/* 右侧：状态 + 字数 + 操作按钮 */}
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {formatLargeNumber(chapter.wordCount || 0)} 字
                      </span>

                      {isGenerating ? (
                        <Badge variant="primary" className="text-xs gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          生成中
                        </Badge>
                      ) : (
                        <Badge variant={chapterBadgeVariant} className="text-xs">
                          {chapterBadgeLabel}
                        </Badge>
                      )}

                      {/* 快捷操作按钮 */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onOpenDrawer(chapter.id) }}
                          className="rounded-full p-1.5 text-gray-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
                          title="打开文章"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {isReviewing && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenGenerate(chapter.id) }}
                            className="rounded-full p-1.5 text-gray-400 hover:bg-purple-100 hover:text-purple-600 dark:hover:bg-purple-900/30 dark:hover:text-purple-400 transition-colors"
                            title="重新生成"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {isDraft && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenGenerate(chapter.id) }}
                            className="rounded-full p-1.5 text-gray-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
                            title="开始生成"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }}
            />
          </div>
        )
      })}

      {reviewingChapters > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          当前有 {reviewingChapters} 章待审核，点击章节打开审核抽屉进行处理。
        </div>
      )}
    </div>
  )
}

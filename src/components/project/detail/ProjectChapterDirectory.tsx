'use client'

import { Badge, Button, ExpandableList } from '@/components/ui'
import { BookOpen, Eye, ChevronDown, Rocket } from 'lucide-react'
import type { PipelineRuntimeState } from '@/lib/engine/pipeline-runtime'
import type { ProjectChapter } from '@/hooks/useProjectDetail'

const INITIAL_VISIBLE_PROJECT_CHAPTERS_PER_GROUP = 10

const chapterStatusMap: Record<ProjectChapter['status'], { label: string; variant: 'default' | 'primary' | 'success' | 'warning' }> = {
  DRAFT: { label: '未写作', variant: 'default' },
  GENERATING: { label: '生成中', variant: 'primary' },
  COMPLETED: { label: '已完成', variant: 'success' },
  REVIEWING: { label: '待审稿', variant: 'warning' },
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
  onOpenPreview: (chapter: ProjectChapter) => void
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
  onOpenPreview,
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
        点击任意章节可展开实时正文，正在生成的章节会显示流式写作内容。再次点击或按“隐藏”可收起。
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
                const isSelected = selectedChapterNumber === chapter.chapterNumber
                const currentLiveChapter = liveChapter?.chapterNumber === chapter.chapterNumber ? liveChapter : null
                const chapterPreviewText = currentLiveChapter?.liveContent?.trim()
                  || chapter.content
                  || chapter.summary
                  || ''
                const chapterBadgeVariant = currentLiveChapter ? 'primary' : chapterStatusMap[chapter.status].variant
                const chapterBadgeLabel = currentLiveChapter
                  ? '实时写作中'
                  : chapterStatusMap[chapter.status].label

                return (
                  <div className="space-y-2">
                    <div
                      onClick={() => onSelectChapter(chapter.chapterNumber)}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 transition-all group ${
                        isSelected
                          ? 'border-blue-200 bg-blue-50/70 dark:border-blue-800 dark:bg-blue-950/20'
                          : 'border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                      }`}
                      aria-expanded={isSelected}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="shrink-0 text-sm text-gray-400">
                          第{chapter.chapterNumber}章
                        </span>
                        <span className="truncate text-sm font-medium transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {chapter.title || '无标题'}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {(chapter.wordCount || 0).toLocaleString()} 字
                        </span>
                        <Badge variant={chapterBadgeVariant} className="text-xs">
                          {chapterBadgeLabel}
                        </Badge>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onOpenPreview(chapter)
                          }}
                          className="rounded-full p-1 text-gray-300 transition-colors hover:bg-white hover:text-blue-500 dark:hover:bg-slate-900"
                          aria-label={`打开第${chapter.chapterNumber}章详情`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <ChevronDown
                          className={`h-4 w-4 text-gray-300 transition-transform group-hover:text-blue-400 ${isSelected ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </div>

                    {isSelected && (
                      <div className="rounded-lg border border-blue-100 bg-white p-4 text-sm leading-relaxed text-gray-700 dark:border-blue-900/40 dark:bg-slate-950/40 dark:text-gray-200">
                        {chapterPreviewText ? (
                          <div className="whitespace-pre-wrap">{chapterPreviewText}</div>
                        ) : (
                          <div className="text-gray-400">暂无正文或摘要</div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {chapter.status === 'REVIEWING' ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => onOpenGenerate(chapter.id)}>
                                重新生成
                              </Button>
                              <Button variant="primary" size="sm" onClick={() => onOpenEditor(chapter.id)}>
                                去审稿
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => onOpenEditor(chapter.id)}>
                              打开章节
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }}
            />
          </div>
        )
      })}

      {reviewingChapters > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          当前有 {reviewingChapters} 章待审稿，建议优先处理，以保证后续生成质量。
        </div>
      )}
    </div>
  )
}

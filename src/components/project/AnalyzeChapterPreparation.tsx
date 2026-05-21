'use client'

import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Combine, Scissors, Trash2, TriangleAlert } from 'lucide-react'
import type { ChapterReviewItem } from '@/lib/analysis/chapter-utils'

interface AnalyzeChapterPreparationProps {
  chapters: ChapterReviewItem[]
  onTitleChange: (index: number, title: string) => void
  onMergeNext: (index: number) => void
  onSplit: (index: number) => void
  onMove: (index: number, direction: -1 | 1) => void
  onDelete: (index: number) => void
}

export function AnalyzeChapterPreparation({
  chapters,
  onTitleChange,
  onMergeNext,
  onSplit,
  onMove,
  onDelete,
}: AnalyzeChapterPreparationProps) {
  const warningCount = chapters.reduce((sum, chapter) => sum + chapter.diagnostics.filter(item => item.severity === 'warning').length, 0)
  const totalWords = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0)

  return (
    <div className="mb-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-medium">切章校验</div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            请先确认章节标题、篇幅和异常提示。这里的调整会直接影响后续大纲、剧情、角色和阅读体验分析质量。
          </p>
        </div>
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          {chapters.length} 章 · {totalWords.toLocaleString()} 字 · {warningCount} 个告警
        </div>
      </div>

      {warningCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <TriangleAlert className="h-4 w-4" />
          建议优先处理“篇幅偏短 / 篇幅过长 / 标题重复”章节，再开始拆书分析。
        </div>
      )}

      <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
        {chapters.map((chapter, index) => (
          <div key={`${chapter.chapterNumber}-${index}`} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  第{chapter.chapterNumber}章 · {chapter.wordCount.toLocaleString()} 字
                </div>
                <input
                  value={chapter.title}
                  onChange={(e) => onTitleChange(index, e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                />
                <div className="mt-3 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-400">
                  {chapter.content.slice(0, 180) || '暂无正文'}
                  {chapter.content.length > 180 ? '...' : ''}
                </div>
                {chapter.diagnostics.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {chapter.diagnostics.map((diagnostic, diagnosticIndex) => (
                      <span
                        key={diagnosticIndex}
                        className={`rounded-full px-2 py-1 text-xs ${
                          diagnostic.severity === 'warning'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}
                      >
                        {diagnostic.message}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 xl:w-[220px] xl:justify-end">
                <ActionButton label="上移" icon={<ArrowUp className="h-3.5 w-3.5" />} onClick={() => onMove(index, -1)} disabled={index === 0} />
                <ActionButton label="下移" icon={<ArrowDown className="h-3.5 w-3.5" />} onClick={() => onMove(index, 1)} disabled={index === chapters.length - 1} />
                <ActionButton label="合并下章" icon={<Combine className="h-3.5 w-3.5" />} onClick={() => onMergeNext(index)} disabled={index === chapters.length - 1} />
                <ActionButton label="拆成两章" icon={<Scissors className="h-3.5 w-3.5" />} onClick={() => onSplit(index)} disabled={chapter.content.split(/\n{2,}/).filter(Boolean).length < 2} />
                <ActionButton label="删除" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onDelete(index)} tone="danger" disabled={chapters.length === 1} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  tone = 'default',
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === 'danger'
          ? 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/20'
          : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

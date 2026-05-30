'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui'
import { X, ChevronLeft, ChevronRight, BookOpen, FileText, Clock, Hash, AlertCircle, Zap } from 'lucide-react'
import { formatChapterStatus, formatTimeAgo, formatAgentType } from '@/lib/format-labels'
import { formatLargeNumber } from '@/lib/utils'
import { normalizeChapterDisplay, type ChapterRawData, type ChapterDisplayData } from '@/lib/chapter-display-adapter'

interface ChapterDrawerProps {
  projectId: number
  chapterId: number | null
  chapters: Array<{ id: number; chapterNumber: number; title: string }>
  onClose: () => void
  onNavigate: (chapterId: number) => void
}

export function ChapterDrawer({ projectId, chapterId, chapters, onClose, onNavigate }: ChapterDrawerProps) {
  const [chapter, setChapter] = useState<ChapterDisplayData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentIndex = chapters.findIndex(c => c.id === chapterId)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < chapters.length - 1

  const fetchChapter = useCallback(async () => {
    if (!chapterId) return
    
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}`)
      const data = await res.json()
      if (data.success) {
        // 使用适配器标准化数据
        const normalized = normalizeChapterDisplay(data.data as ChapterRawData)
        setChapter(normalized)
      } else {
        setError(data.error?.message || '加载失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }, [projectId, chapterId])

  useEffect(() => {
    fetchChapter()
  }, [fetchChapter])

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(chapters[currentIndex - 1].id)
      if (e.key === 'ArrowRight' && hasNext) onNavigate(chapters[currentIndex + 1].id)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, hasPrev, hasNext, chapters, onClose, onNavigate])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-white dark:bg-gray-900 h-full overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold">
                {chapter ? `第${chapter.chapterNo}章 ${chapter.title}` : '加载中...'}
              </h2>
              {chapter && (
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5" />
                    {formatLargeNumber(chapter.wordCount)}字
                  </span>
                  <span>{formatChapterStatus(chapter.status)}</span>
                  {chapter.lastAgentType && (
                    <span className="flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5" />
                      {formatAgentType(chapter.lastAgentType)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatTimeAgo(chapter.updatedAt)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">{error}</div>
          ) : chapter ? (
            <div className="space-y-6">
              {/* 草稿提示 */}
              {chapter.isDraft && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                    <AlertCircle className="h-4 w-4" />
                    <span>当前展示的是生成中草稿内容，尚未通过质量校验</span>
                  </div>
                </div>
              )}

              {/* 摘要区 */}
              {chapter.summary && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">章节摘要</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{chapter.summary}</p>
                </div>
              )}

              {/* 正文区 */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">正文内容</h3>
                {!chapter.isEmpty ? (
                  <div className="prose dark:prose-invert max-w-none">
                    {chapter.content.split('\n').map((paragraph, i) => (
                      paragraph.trim() ? <p key={i} className="mb-4 leading-relaxed">{paragraph}</p> : null
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>正文尚未生成或尚未同步完成</p>
                    <p className="text-sm mt-1">生成中的内容将在完成后显示</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* 底部导航 */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <Button
            variant="outline"
            size="sm"
            onClick={() => hasPrev && onNavigate(chapters[currentIndex - 1].id)}
            disabled={!hasPrev}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            上一章
          </Button>
          <span className="text-sm text-gray-500">
            {currentIndex + 1} / {chapters.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => hasNext && onNavigate(chapters[currentIndex + 1].id)}
            disabled={!hasNext}
            className="gap-1.5"
          >
            下一章
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

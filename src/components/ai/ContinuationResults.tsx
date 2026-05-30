'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { BookOpen, Play, Eye, Check, Trash2 } from 'lucide-react'
import { formatLargeNumber } from '@/lib/utils'

// ============================================
// Types
// ============================================

interface Chapter {
  id: number
  chapterNumber: number
  title: string
  wordCount: number
  status: 'DRAFT' | 'GENERATING' | 'COMPLETED' | 'REVIEWING'
}

interface ContinuationResultsProps {
  projectId: number
  onPreview?: (chapterId: number) => void
}

// ============================================
// Component
// ============================================

export function ContinuationResults({
  projectId,
  onPreview,
}: ContinuationResultsProps) {
  const [completedChapters, setCompletedChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)

  // 加载已完成的续写章节
  const loadCompletedChapters = useCallback(async () => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters`)
      const data = await res.json()
      if (data.success) {
        // 只显示非 REVIEWING 状态的章节（这些是续写生成的新章节）
        const completed = data.data
          .filter((ch: Chapter) => ch.status !== 'REVIEWING')
          .sort((a: Chapter, b: Chapter) => a.chapterNumber - b.chapterNumber)
        setCompletedChapters(completed)
      }
    } catch (err) {
      console.error('加载章节失败:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadCompletedChapters()
  }, [loadCompletedChapters])

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        加载中...
      </div>
    )
  }

  if (completedChapters.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>还没有续写章节</p>
            <p className="text-sm mt-1">完成拆书分析后可开始续写</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            续写章节
            <Badge variant="success" className="ml-2">
              {completedChapters.length} 章
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {completedChapters.map((chapter) => (
            <div
              key={chapter.id}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 group transition-all duration-150 cursor-pointer"
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-gray-400">第{chapter.chapterNumber}章</span>
                <span className="font-medium">{chapter.title || '无标题'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{formatLargeNumber(chapter.wordCount || 0)} 字</span>
                <Badge variant="success" className="text-xs">
                  已完成
                </Badge>
                {onPreview && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onPreview(chapter.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-purple-500 transition-opacity"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
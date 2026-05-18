'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Modal } from '@/components/ui'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface BatchProgressOptions {
  chapterIds?: number[]
  useContext: boolean
  contextChapterCount: number
  temperature: number
  targetWordCount: number
}

interface BatchProgressProps {
  projectId: number
  chapterIds?: number[]
  useContext?: boolean
  contextChapterCount?: number
  temperature?: number
  targetWordCount?: number
  options?: BatchProgressOptions
  open: boolean
  onClose: () => void
  onComplete?: (successCount: number, failCount: number) => void
  onStatusChange?: (isGenerating: boolean, progress: number, completedCount: number, totalCount: number) => void
}

interface ChapterState {
  id: number
  chapterNumber: number
  title: string
  content: string
  wordCount: number
  status: 'pending' | 'generating' | 'completed' | 'error'
  error?: string
}

export function BatchProgress({
  projectId,
  chapterIds,
  useContext = true,
  contextChapterCount = 3,
  temperature = 0.7,
  targetWordCount = 3000,
  options,
  open,
  onClose,
  onComplete,
  onStatusChange,
}: BatchProgressProps) {
  const effectiveChapterIds = options?.chapterIds ?? chapterIds
  const effectiveUseContext = options?.useContext ?? useContext
  const effectiveContextChapterCount = options?.contextChapterCount ?? contextChapterCount
  const effectiveTemperature = options?.temperature ?? temperature
  const effectiveTargetWordCount = options?.targetWordCount ?? targetWordCount
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0)
  const [chapters, setChapters] = useState<ChapterState[]>([])
  const [totalChapters, setTotalChapters] = useState(0)
  const [progress, setProgress] = useState(0)
  const [currentContent, setCurrentContent] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const isGeneratingRef = useRef(false)

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setChapters((prev) =>
      prev.map((ch) =>
        ch.status === 'generating' ? { ...ch, status: 'error' as const, error: '用户停止' } : ch
      )
    )
    setIsGenerating(false)
    isGeneratingRef.current = false
  }, [])

  useEffect(() => {
    if (!open) return

    setIsGenerating(true)
    isGeneratingRef.current = true
    setCurrentChapterIndex(0)
    setCurrentContent('')
    setProgress(0)
    setChapters([])

    const requestBody: Record<string, unknown> = {
      useContext: effectiveUseContext,
      contextChapterCount: effectiveContextChapterCount,
      temperature: effectiveTemperature,
      targetWordCount: effectiveTargetWordCount,
    }
    if (effectiveChapterIds && effectiveChapterIds.length > 0) {
      requestBody.chapterIds = effectiveChapterIds
    }

    abortControllerRef.current = new AbortController()

    fetch(`/api/novel/projects/${projectId}/generate/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: abortControllerRef.current.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''
        let currentEventType = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEventType = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              const data = line.slice(6)
              try {
                const parsed = JSON.parse(data)
                handleEvent(currentEventType, parsed)
              } catch (e) {
                console.error('Failed to parse SSE data:', e)
              }
            }
          }
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          console.log('Generation aborted by user')
        } else {
          console.error('SSE error:', error)
        }
        setIsGenerating(false)
      })

    function handleEvent(type: string, data: Record<string, unknown>) {
      switch (type) {
        case 'start':
          setTotalChapters(data.totalChapters as number)
          break

        case 'chapter_start':
          setCurrentChapterIndex(data.index as number)
          setCurrentContent('')
          setChapters((prev) => {
            const newChapter: ChapterState = {
              id: data.chapterId as number,
              chapterNumber: data.chapterNumber as number,
              title: data.title as string,
              content: '',
              wordCount: 0,
              status: 'generating',
            }
            return [...prev, newChapter]
          })
          break

        case 'token':
          setCurrentContent((prev) => prev + (data.content as string))
          break

        case 'wordCount':
          setChapters((prev) =>
            prev.map((ch) =>
              ch.id === data.chapterId
                ? { ...ch, wordCount: data.count as number }
                : ch
            )
          )
          break

        case 'chapter_done':
          setChapters((prev) =>
            prev.map((ch) =>
              ch.id === data.chapterId
                ? { ...ch, status: 'completed' as const, wordCount: data.wordCount as number }
                : ch
            )
          )
          break

        case 'chapter_error':
          setChapters((prev) =>
            prev.map((ch) =>
              ch.id === data.chapterId
                ? { ...ch, status: 'error' as const, error: data.error as string }
                : ch
            )
          )
          break

        case 'done':
          setIsGenerating(false)
          isGeneratingRef.current = false
          setProgress(100)
          if (onComplete) {
            onComplete(data.successCount as number, data.failCount as number)
          }
          break

        case '':
          break
      }
    }

    return () => {
    }
  }, [open, projectId, effectiveChapterIds, effectiveUseContext, effectiveContextChapterCount, effectiveTemperature, effectiveTargetWordCount, onComplete])

  useEffect(() => {
    if (totalChapters > 0) {
      const completed = chapters.filter((ch) => ch.status === 'completed').length
      const failed = chapters.filter((ch) => ch.status === 'error').length
      const p = Math.round(((completed + failed) / totalChapters) * 100)
      setProgress(p)
      onStatusChange?.(isGenerating, p, completed + failed, totalChapters)
    }
  }, [chapters, totalChapters, isGenerating, onStatusChange])

  const completedCount = chapters.filter((ch) => ch.status === 'completed').length
  const failedCount = chapters.filter((ch) => ch.status === 'error').length

  const currentChapter = chapters[currentChapterIndex]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isGenerating ? '正在生成...' : '生成完成'}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* 进度条 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>进度</span>
            <span>{completedCount + failedCount} / {totalChapters} 章</span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 当前章节 */}
        {currentChapter && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">
                第{currentChapter.chapterNumber}章 {currentChapter.title || '无标题'}
              </span>
              <span className="text-sm text-gray-500">
                {(currentChapter.wordCount || 0).toLocaleString()} 字
              </span>
            </div>
            <div className="h-32 overflow-y-auto text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap bg-white dark:bg-gray-900 p-2 rounded border">
              {currentContent || '生成中...'}
            </div>
          </div>
        )}

        {/* 章节列表 */}
        <div className="max-h-48 overflow-y-auto space-y-2">
          {chapters.map((chapter) => (
            <div
              key={chapter.id}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              {chapter.status === 'completed' && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {chapter.status === 'error' && (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              {chapter.status === 'generating' && (
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              )}
              {chapter.status === 'pending' && (
                <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
              )}

              <div className="flex-1">
                <span className="text-sm">第{chapter.chapterNumber}章 {chapter.title || '无标题'}</span>
                {chapter.error && (
                  <p className="text-xs text-red-500">{chapter.error}</p>
                )}
              </div>

              <span className="text-xs text-gray-500">
                {chapter.wordCount > 0 ? `${(chapter.wordCount || 0).toLocaleString()} 字` : ''}
              </span>
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          {isGenerating ? (
            <Button variant="danger" onClick={handleStop}>
              停止生成
            </Button>
          ) : (
            <Button onClick={onClose}>
              关闭
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

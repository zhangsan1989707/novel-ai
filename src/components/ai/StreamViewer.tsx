'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button, Progress } from '@/components/ui'
import { Sparkles, Square, RefreshCw, Wand2, Loader2 } from 'lucide-react'
import { countChineseWords } from '@/lib/utils'
import { ChapterQualityPanel } from './ChapterQualityPanel'

// ============================================
// Types
// ============================================

interface StreamViewerProps {
  projectId: number
  chapterId: number
  chapterNumber: number
  chapterTitle: string
  initialContent?: string
  onStart?: () => void
  onComplete?: (content: string, wordCount: number) => void
  onError?: (error: string) => void
  autoOptimize?: boolean
}

type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error'

interface StreamState {
  status: StreamStatus
  content: string
  wordCount: number
  progress: number
  targetWordCount: number
  error?: string
}

// ============================================
// Component
// ============================================

export function StreamViewer({
  projectId,
  chapterId,
  chapterNumber,
  chapterTitle,
  initialContent = '',
  onStart,
  onComplete,
  onError,
  autoOptimize = false,
}: StreamViewerProps) {
  const [state, setState] = useState<StreamState>({
    status: 'idle',
    content: initialContent,
    wordCount: initialContent ? countChineseWords(initialContent) : 0,
    progress: 0,
    targetWordCount: 3000,
  })
  const [settings, setSettings] = useState({
    useContext: true,
    contextChapterCount: 3,
    targetWordCount: 3000,
    temperature: 0.7,
    autoOptimizeAfterGenerate: autoOptimize,
  })
  const [showSettings, setShowSettings] = useState(true)
  const [showQualityPanel, setShowQualityPanel] = useState(false)
  const [optimizedContent, setOptimizedContent] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  // 自动滚动
  useEffect(() => {
    if (contentRef.current && state.status === 'streaming') {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [state.content, state.status])

  // 连接 SSE
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setState((prev) => ({
      ...prev,
      status: 'connecting',
      content: initialContent,
      wordCount: initialContent ? countChineseWords(initialContent) : 0,
    }))

    onStart?.()

    const params = new URLSearchParams({
      chapterId: chapterId.toString(),
      useContext: settings.useContext.toString(),
      contextChapterCount: settings.contextChapterCount.toString(),
      targetWordCount: settings.targetWordCount.toString(),
      temperature: settings.temperature.toString(),
    })

    const eventSource = new EventSource(
      `/api/novel/projects/${projectId}/generate/stream?${params}`
    )
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setState((prev) => ({ ...prev, status: 'streaming' }))
    }

    eventSource.addEventListener('start', () => {
      setState((prev) => ({
        ...prev,
        status: 'streaming',
        content: initialContent,
        wordCount: initialContent ? countChineseWords(initialContent) : 0,
      }))
    })

    eventSource.addEventListener('token', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setState((prev) => ({
        ...prev,
        content: prev.content + data.content,
        wordCount: countChineseWords(prev.content + data.content),
        progress: Math.min(100, (countChineseWords(prev.content + data.content) / settings.targetWordCount) * 100),
      }))
    })

    eventSource.addEventListener('wordCount', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setState((prev) => ({
        ...prev,
        wordCount: data.count,
        progress: Math.min(100, (data.count / settings.targetWordCount) * 100),
      }))
    })

    eventSource.addEventListener('done', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      const finalContent = state.content + ''
      setState((prev) => ({
        ...prev,
        status: 'complete',
        wordCount: data.wordCount,
        progress: 100,
      }))
      
      // 如果启用了自动优化，显示优化面板
      if (settings.autoOptimizeAfterGenerate && finalContent.length > 100) {
        setShowQualityPanel(true)
        setOptimizedContent(finalContent)
      }
      
      onComplete?.(finalContent, data.wordCount)
      eventSource.close()
    })

    eventSource.addEventListener('error', (e: MessageEvent) => {
      let errorMessage = '生成失败'
      try {
        const data = JSON.parse(e.data)
        errorMessage = data.message || errorMessage
      } catch {
        // e.data may not be JSON, use it directly if available
        if (e.data && typeof e.data === 'string') {
          errorMessage = e.data
        }
      }
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }))
      onError?.(errorMessage)
      eventSource.close()
    })

    eventSource.onerror = () => {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: '连接中断',
      }))
      eventSource.close()
    }
  }, [projectId, chapterId, settings, initialContent, onStart, onComplete, onError])

  // 停止生成
  const stopGeneration = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setState((prev) => ({
      ...prev,
      status: 'idle',
    }))
  }, [])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {state.status === 'idle' && (
            <Button onClick={connectSSE} variant="primary">
              <Sparkles className="h-4 w-4 mr-2" />
              开始生成
            </Button>
          )}
          {state.status === 'connecting' && (
            <Button disabled>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              连接中...
            </Button>
          )}
          {state.status === 'streaming' && (
            <Button onClick={stopGeneration} variant="danger">
              <Square className="h-4 w-4 mr-2" />
              停止
            </Button>
          )}
          {state.status === 'complete' && (
            <Button onClick={connectSSE} variant="secondary">
              <RefreshCw className="h-4 w-4 mr-2" />
              重新生成
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* 进度 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {state.wordCount.toLocaleString()} / {settings.targetWordCount.toLocaleString()} 字
            </span>
            <span className="text-sm font-medium">{Math.round(state.progress)}%</span>
          </div>

          {/* 设置按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            {showSettings ? '隐藏设置' : '显示设置'}
          </Button>
          
          {/* 去AI味按钮 */}
          {state.status === 'complete' && state.content.length > 100 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQualityPanel(!showQualityPanel)}
              className={showQualityPanel ? 'bg-purple-50 border-purple-500' : ''}
            >
              <Wand2 className="h-4 w-4 mr-1" />
              {showQualityPanel ? '隐藏去AI味' : '去AI味'}
            </Button>
          )}
        </div>
      </div>

      {/* 进度条 */}
      {state.status === 'streaming' && (
        <Progress value={state.progress} size="sm" />
      )}

      {/* 设置面板 */}
      {showSettings && state.status === 'idle' && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">目标字数</label>
              <input
                type="number"
                className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600"
                value={settings.targetWordCount}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, targetWordCount: parseInt(e.target.value) || 3000 }))
                }
                min={1000}
                max={10000}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">温度参数</label>
              <input
                type="range"
                className="w-full"
                min={0}
                max={2}
                step={0.1}
                value={settings.temperature}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, temperature: parseFloat(e.target.value) }))
                }
              />
              <span className="text-xs text-gray-500">{settings.temperature}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.useContext}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, useContext: e.target.checked }))
                }
              />
              <span className="text-sm">使用上下文</span>
            </label>
            {settings.useContext && (
              <div className="flex items-center gap-2">
                <span className="text-sm">参考章节数：</span>
                <select
                  className="h-8 px-2 rounded border border-gray-300 dark:border-gray-600"
                  value={settings.contextChapterCount}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, contextChapterCount: parseInt(e.target.value) }))
                  }
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.autoOptimizeAfterGenerate}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, autoOptimizeAfterGenerate: e.target.checked }))
                }
              />
              <span className="text-sm">生成后自动去AI味</span>
            </label>
          </div>
        </div>
      )}

      {/* 内容显示区 */}
      <div className="relative">
        <textarea
          ref={contentRef}
          className="w-full min-h-[400px] p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-mono text-sm leading-relaxed resize-none transition-colors"
          value={state.content || initialContent}
          readOnly
          placeholder="生成的内容将显示在这里..."
        />
        {state.status === 'error' && (
          <div className="absolute inset-0 bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-500 font-medium">{state.error}</p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={connectSSE}
              >
                重试
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* AI质量分析面板 */}
      {showQualityPanel && optimizedContent && (
        <div className="mt-4">
          <ChapterQualityPanel
            projectId={projectId}
            chapterId={chapterId}
            chapterNumber={chapterNumber}
            chapterTitle={chapterTitle}
            content={optimizedContent}
            onOptimizeComplete={(revisedContent) => {
              setOptimizedContent(revisedContent)
              setState((prev) => ({ ...prev, content: revisedContent }))
            }}
          />
        </div>
      )}

      {/* 状态信息 */}
      {state.status !== 'idle' && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            状态：
            {state.status === 'connecting' && '连接中'}
            {state.status === 'streaming' && '生成中...'}
            {state.status === 'complete' && '已完成'}
            {state.status === 'error' && '出错'}
          </span>
          <span>当前字数：{state.wordCount.toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}

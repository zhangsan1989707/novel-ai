'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, Badge, Progress, toast } from '@/components/ui'
import { ChapterQualityPanel } from '@/components/ai/ChapterQualityPanel'
import { ArrowLeft, RefreshCw, Save, Sparkles, Square, Wand2 } from 'lucide-react'
import { ChapterStatus } from '@/types'
import { countChineseWords } from '@/lib/utils'

interface Chapter {
  id: number
  projectId: number
  chapterNumber: number
  title: string
  content?: string
  summary?: string
  wordCount: number
  status: ChapterStatus
}

interface ChapterGenerateClientProps {
  projectId: number
  chapterId: number
  initialChapter: Chapter
}

export function ChapterGenerateClient({ projectId, chapterId, initialChapter }: ChapterGenerateClientProps) {
  const router = useRouter()
  const [chapter, setChapter] = useState<Chapter>(initialChapter)
  const [streamStatus, setStreamStatus] = useState<'idle' | 'connecting' | 'streaming' | 'complete' | 'error'>('idle')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [showSettings, setShowSettings] = useState(true)
  const [showQualityPanel, setShowQualityPanel] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [lastWarning, setLastWarning] = useState<string | null>(null)
  const [settings, setSettings] = useState({
    useContext: true,
    contextChapterCount: 2,
    targetWordCount: Math.max(initialChapter.wordCount || 0, 3000),
    temperature: 0.7,
  })
  const abortControllerRef = useRef<AbortController | null>(null)
  const contentRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (contentRef.current && streamStatus === 'streaming') {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [chapter.content, streamStatus])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const parseSSEMessage = (buffer: string): { events: Array<{ event: string; data: string }>; remaining: string } => {
    const events: Array<{ event: string; data: string }> = []
    let remaining = buffer
    const delimiter = '\n\n'

    while (remaining.includes(delimiter)) {
      const index = remaining.indexOf(delimiter)
      const block = remaining.slice(0, index)
      remaining = remaining.slice(index + delimiter.length)
      let event = 'message'
      let data = ''

      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) {
          event = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          data = line.slice(6)
        }
      }

      if (data) {
        events.push({ event, data })
      }
    }

    return { events, remaining }
  }

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setStreamStatus('idle')
  }, [])

  const startGeneration = useCallback(async () => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setError(null)
    setLastWarning(null)
    setProgress(0)
    setShowQualityPanel(false)
    setStreamStatus('connecting')
    setIsDirty(false)
    setChapter((prev) => ({
      ...prev,
      content: '',
      wordCount: 0,
      status: ChapterStatus.GENERATING,
    }))

    try {
      const response = await fetch(`/api/novel/projects/${projectId}/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId,
          useContext: settings.useContext,
          contextChapterCount: settings.contextChapterCount,
          targetWordCount: settings.targetWordCount,
          temperature: settings.temperature,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        let message = '生成失败'
        try {
          const data = await response.json()
          message = data.error?.message || message
        } catch {}
        setError(message)
        setStreamStatus('error')
        toast.error(message)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        setError('无法读取流式响应')
        setStreamStatus('error')
        toast.error('无法读取流式响应')
        return
      }

      setStreamStatus('streaming')
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const { events, remaining } = parseSSEMessage(buffer)
        buffer = remaining

        for (const evt of events) {
          if (evt.event === 'start') {
            setStreamStatus('streaming')
            continue
          }

          if (evt.event === 'token') {
            try {
              const data = JSON.parse(evt.data) as { content?: string }
              if (!data.content) continue
              setChapter((prev) => {
                const nextContent = `${prev.content || ''}${data.content}`
                const nextWordCount = countChineseWords(nextContent)
                setProgress(Math.min(100, (nextWordCount / settings.targetWordCount) * 100))
                return {
                  ...prev,
                  content: nextContent,
                  wordCount: nextWordCount,
                  status: ChapterStatus.GENERATING,
                }
              })
            } catch {}
            continue
          }

          if (evt.event === 'wordCount') {
            try {
              const data = JSON.parse(evt.data) as { count?: number }
              if (typeof data.count === 'number') {
                setProgress(Math.min(100, (data.count / settings.targetWordCount) * 100))
                setChapter((prev) => ({ ...prev, wordCount: data.count ?? prev.wordCount }))
              }
            } catch {}
            continue
          }

          if (evt.event === 'done') {
            const data = JSON.parse(evt.data) as {
              content?: string
              title?: string
              wordCount?: number
              status?: 'completed' | 'reviewing'
              warning?: string
            }
            const nextContent = data.content || ''
            const nextWordCount = data.wordCount || countChineseWords(nextContent)
            const nextStatus = data.status === 'reviewing' ? ChapterStatus.REVIEWING : ChapterStatus.COMPLETED

            setChapter((prev) => ({
              ...prev,
              title: data.title || prev.title,
              content: nextContent,
              wordCount: nextWordCount,
              status: nextStatus,
            }))
            setProgress(100)
            setStreamStatus('complete')
            setLastWarning(data.warning || null)
            toast.success(data.warning ? '生成完成，章节进入待审稿状态' : '生成完成，章节已自动回写')
            router.refresh()
            continue
          }

          if (evt.event === 'error') {
            const data = JSON.parse(evt.data) as { message?: string }
            const message = data.message || '生成失败'
            setError(message)
            setStreamStatus('error')
            toast.error(message)
          }
        }
      }
    } catch (streamError) {
      if (streamError instanceof DOMException && streamError.name === 'AbortError') {
        return
      }

      const message = streamError instanceof Error ? streamError.message : '连接中断'
      setError(message)
      setStreamStatus('error')
      toast.error(message)
    } finally {
      abortControllerRef.current = null
    }
  }, [chapterId, projectId, router, settings])

  const handleSave = async () => {
    const content = chapter.content || ''
    const wordCount = countChineseWords(content)
    if (!content.trim()) {
      toast.error('当前没有可保存的章节内容')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: chapter.title,
          content,
          status: chapter.status === ChapterStatus.REVIEWING ? 'REVIEWING' : 'COMPLETED',
        }),
      })
      const data = await res.json()
      if (data.success) {
        setChapter((prev) => ({ ...prev, ...data.data, content, wordCount }))
        setIsDirty(false)
        toast.success('章节内容已保存')
        router.refresh()
      } else {
        toast.error(data.error?.message || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleOptimizeComplete = useCallback((revisedContent: string) => {
    setChapter((prev) => ({
      ...prev,
      content: revisedContent,
      wordCount: countChineseWords(revisedContent),
    }))
    setIsDirty(true)
  }, [])

  const statusLabelMap: Record<ChapterStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'primary' }> = {
    [ChapterStatus.DRAFT]: { label: '草稿', variant: 'default' },
    [ChapterStatus.GENERATING]: { label: '生成中', variant: 'primary' },
    [ChapterStatus.COMPLETED]: { label: '已完成', variant: 'success' },
    [ChapterStatus.REVIEWING]: { label: '待审稿', variant: 'warning' },
  }
  const currentStatus = statusLabelMap[chapter.status] || statusLabelMap[ChapterStatus.DRAFT]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.push(`/projects/${projectId}/chapters/${chapterId}`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
              <div>
                <h1 className="text-xl font-semibold">第{chapter.chapterNumber}章 - AI 生成</h1>
                <p className="text-sm text-slate-500">{chapter.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={currentStatus.variant}>
                {currentStatus.label}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                loading={saving}
                disabled={!isDirty}
              >
                <Save className="h-4 w-4 mr-1.5" />
                保存优化稿
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
              流式生成完成后，正文会自动回写到章节。只有你在本页继续做去 AI 味或手动修改后，才需要点击“保存优化稿”。
            </div>

            {lastWarning ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                {lastWarning}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {streamStatus === 'idle' && (
                  <Button onClick={startGeneration}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    开始生成
                  </Button>
                )}
                {streamStatus === 'connecting' && (
                  <Button disabled>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    连接中...
                  </Button>
                )}
                {streamStatus === 'streaming' && (
                  <Button variant="danger" onClick={stopGeneration}>
                    <Square className="mr-2 h-4 w-4" />
                    停止生成
                  </Button>
                )}
                {streamStatus === 'complete' && (
                  <Button variant="secondary" onClick={startGeneration}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    重新生成
                  </Button>
                )}
                {streamStatus === 'error' && (
                  <Button variant="secondary" onClick={startGeneration}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    重试生成
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettings((prev) => !prev)}
                >
                  {showSettings ? '隐藏设置' : '显示设置'}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">
                  {chapter.wordCount.toLocaleString()} / {settings.targetWordCount.toLocaleString()} 字
                </span>
                {chapter.content && chapter.content.length > 100 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQualityPanel((prev) => !prev)}
                  >
                    <Wand2 className="mr-1.5 h-4 w-4" />
                    {showQualityPanel ? '隐藏去 AI 味' : '去 AI 味'}
                  </Button>
                ) : null}
              </div>
            </div>

            {streamStatus === 'streaming' ? <Progress value={progress} size="sm" /> : null}

            {showSettings && streamStatus === 'idle' ? (
              <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">目标字数</span>
                  <input
                    type="number"
                    min={1000}
                    max={10000}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
                    value={settings.targetWordCount}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value)
                      setSettings((prev) => ({
                        ...prev,
                        targetWordCount: Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 3000,
                      }))
                    }}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">温度参数</span>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      className="w-full"
                      value={settings.temperature}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value)
                        setSettings((prev) => ({ ...prev, temperature: nextValue }))
                      }}
                    />
                    <div className="text-xs text-slate-500">{settings.temperature.toFixed(1)}</div>
                  </div>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={settings.useContext}
                    onChange={(event) => setSettings((prev) => ({ ...prev, useContext: event.target.checked }))}
                  />
                  使用最近章节上下文
                </label>
                {settings.useContext ? (
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">参考章节数</span>
                    <select
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
                      value={settings.contextChapterCount}
                      onChange={(event) => setSettings((prev) => ({ ...prev, contextChapterCount: Number(event.target.value) }))}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option key={value} value={value}>
                          最近 {value} 章
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}

            <textarea
              ref={contentRef}
              readOnly
              className="min-h-[420px] w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="生成内容会实时显示在这里"
              value={chapter.content || ''}
            />

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
              <span>
                状态：
                {streamStatus === 'idle' && '待生成'}
                {streamStatus === 'connecting' && '连接中'}
                {streamStatus === 'streaming' && '生成中'}
                {streamStatus === 'complete' && '已完成并自动回写'}
                {streamStatus === 'error' && '生成失败'}
              </span>
              <span>{isDirty ? '当前有未保存的优化内容' : '当前页面与章节存档已同步'}</span>
            </div>
          </CardContent>
        </Card>

        {showQualityPanel && (chapter.content || '').length > 100 ? (
          <Card>
            <CardContent className="p-6">
              <ChapterQualityPanel
                projectId={projectId}
                chapterId={chapterId}
                chapterNumber={chapter.chapterNumber}
                chapterTitle={chapter.title}
                content={chapter.content || ''}
                onOptimizeComplete={handleOptimizeComplete}
              />
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  )
}

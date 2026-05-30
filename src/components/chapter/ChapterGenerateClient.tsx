'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, Badge, Progress, toast, ErrorBoundary } from '@/components/ui'
import { ChapterQualityPanel } from '@/components/ai/ChapterQualityPanel'
import { ArrowLeft, RefreshCw, Save, Sparkles, Square, Wand2 } from 'lucide-react'
import { ChapterStatus } from '@/types'
import { countChineseWords, formatLargeNumber } from '@/lib/utils'
import { useChapterGeneration } from '@/hooks/use-chapter-generation'

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
  const [saving, setSaving] = useState(false)
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
  const contentRef = useRef<HTMLTextAreaElement | null>(null)
  const { state: generationState, start, stop } = useChapterGeneration({
    projectId,
    chapterId,
    onStart: () => {
      setLastWarning(null)
      setShowQualityPanel(false)
      setIsDirty(false)
      setChapter((prev) => ({
        ...prev,
        content: '',
        wordCount: 0,
        status: ChapterStatus.GENERATING,
      }))
    },
    onToken: (_token, nextContent, nextWordCount) => {
      setChapter((prev) => ({
        ...prev,
        content: nextContent,
        wordCount: nextWordCount,
        status: ChapterStatus.GENERATING,
      }))
    },
    onComplete: (result) => {
      const nextStatus =
        result.status === 'reviewing' ? ChapterStatus.REVIEWING : ChapterStatus.COMPLETED

      setChapter((prev) => ({
        ...prev,
        title: result.title || prev.title,
        content: result.content,
        wordCount: result.wordCount,
        status: nextStatus,
      }))
      setLastWarning(result.warning || null)
      toast.success(result.warning ? '生成完成，章节进入待审稿状态' : '生成完成，章节已自动回写')
      router.refresh()
    },
    onError: (message) => {
      setChapter((prev) => ({
        ...prev,
        status: ChapterStatus.DRAFT,
      }))
      toast.error(message)
    },
  })

  useEffect(() => {
    if (contentRef.current && generationState.status === 'streaming') {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [chapter.content, generationState.status])

  const stopGeneration = useCallback(() => {
    stop()
    setChapter((prev) => ({
      ...prev,
      status: ChapterStatus.DRAFT,
    }))
  }, [stop])

  const startGeneration = useCallback(async () => {
    await start({
      useContext: settings.useContext,
      contextChapterCount: settings.contextChapterCount,
      targetWordCount: settings.targetWordCount,
      temperature: settings.temperature,
    })
  }, [settings, start])

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
          wordCount,
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
                {generationState.status === 'idle' && (
                  <Button onClick={startGeneration}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    开始生成
                  </Button>
                )}
                {generationState.status === 'connecting' && (
                  <Button disabled>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    连接中...
                  </Button>
                )}
                {generationState.status === 'streaming' && (
                  <Button variant="danger" onClick={stopGeneration}>
                    <Square className="mr-2 h-4 w-4" />
                    停止生成
                  </Button>
                )}
                {generationState.status === 'complete' && (
                  <Button variant="secondary" onClick={startGeneration}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    重新生成
                  </Button>
                )}
                {generationState.status === 'error' && (
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
                  {formatLargeNumber(chapter.wordCount)} / {formatLargeNumber(settings.targetWordCount)} 字
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

            {generationState.status === 'streaming' ? <Progress value={generationState.progress} size="sm" /> : null}

            {showSettings && generationState.status === 'idle' ? (
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

            {generationState.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                {generationState.error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
              <span>
                状态：
                {generationState.status === 'idle' && '待生成'}
                {generationState.status === 'connecting' && '连接中'}
                {generationState.status === 'streaming' && '生成中'}
                {generationState.status === 'complete' && '已完成并自动回写'}
                {generationState.status === 'error' && '生成失败'}
              </span>
              <span>{isDirty ? '当前有未保存的优化内容' : '当前页面与章节存档已同步'}</span>
            </div>
          </CardContent>
        </Card>

        {showQualityPanel && (chapter.content || '').length > 100 ? (
          <Card>
            <CardContent className="p-6">
              <ErrorBoundary>
              <ChapterQualityPanel
                projectId={projectId}
                chapterId={chapterId}
                chapterNumber={chapter.chapterNumber}
                chapterTitle={chapter.title}
                content={chapter.content || ''}
                onOptimizeComplete={handleOptimizeComplete}
              />
              </ErrorBoundary>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Input, Textarea, Modal } from '@/components/ui'
import { ArrowLeft, Save, Sparkles, Trash2, Maximize, Minimize, FileText, Settings, Wand2, Square, RefreshCw, Loader2 } from 'lucide-react'
import { ChapterStatus } from '@/types'
import { ChapterQualityPanel } from '@/components/ai/ChapterQualityPanel'
import { countChineseWords } from '@/lib/utils'

interface ChapterEditorProps {
  projectId: number
  chapterId?: number
  initialChapter?: Record<string, any>
  onSave?: (chapter: Record<string, any>) => void
}

type GenerateStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error'

export function ChapterEditor({ projectId, chapterId, initialChapter, onSave }: ChapterEditorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [chapter, setChapter] = useState<Record<string, any>>(initialChapter || {
    title: '',
    summary: '',
    content: '',
    status: 'DRAFT' as ChapterStatus,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showQualityPanel, setShowQualityPanel] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [nextChapterNumber, setNextChapterNumber] = useState(1)
  const [status, setStatus] = useState<ChapterStatus>(ChapterStatus.DRAFT)
  const [showEmptyHint, setShowEmptyHint] = useState(true)
  const [generateStatus, setGenerateStatus] = useState<GenerateStatus>('idle')
  const [generateError, setGenerateError] = useState('')
  const [generateSettings, setGenerateSettings] = useState({
    targetWordCount: 3000,
    temperature: 0.7,
    useContext: true,
    contextChapterCount: 3,
  })
  const [showGenerateSettings, setShowGenerateSettings] = useState(false)

  useEffect(() => {
    if (chapter.content) {
      setWordCount(countChineseWords(chapter.content))
    } else {
      setWordCount(0)
    }
  }, [chapter.content])

  const fetchChapter = useCallback(async () => {
    if (!chapterId) {
      try {
        const res = await fetch(`/api/novel/projects/${projectId}/chapters`)
        const data = await res.json()
        if (data.success && data.data.length > 0) {
          const chapterNumbers = data.data
            .map((c: Record<string, any>) => Number(c.chapterNumber))
            .filter((num: number) => !isNaN(num) && num > 0)
          if (chapterNumbers.length > 0) {
            const maxNum = Math.max(...chapterNumbers, 0)
            setNextChapterNumber(maxNum + 1)
          } else {
            setNextChapterNumber(1)
          }
        } else {
          setNextChapterNumber(1)
        }
      } catch (error) {
        console.error('获取章节列表失败:', error)
        setNextChapterNumber(1)
      }
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}`)
      const data = await res.json()
      if (data.success) {
        setChapter(data.data)
      }
    } catch (error) {
      console.error('获取章节失败:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId, chapterId])

  useEffect(() => {
    fetchChapter()
  }, [fetchChapter])

  useEffect(() => {
    if (contentRef.current && generateStatus === 'streaming') {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [chapter.content, generateStatus])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleSave = async () => {
    if (!chapter.title?.trim()) {
      alert('请输入章节标题')
      return
    }

    setSaving(true)
    try {
      const url = chapterId
        ? `/api/novel/projects/${projectId}/chapters/${chapterId}`
        : `/api/novel/projects/${projectId}/chapters`

      const saveData = chapterId ? chapter : { ...chapter, chapterNumber: nextChapterNumber }

      const res = await fetch(url, {
        method: chapterId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveData),
      })
      const data = await res.json()
      if (data.success) {
        if (!chapterId && data.data.id) {
          router.replace(`/projects/${projectId}/chapters/${data.data.id}`)
        }
        onSave?.(data.data)
      }
    } catch (error) {
      console.error('保存章节失败:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!chapterId) return
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/projects/${projectId}`)
      }
    } catch (error) {
      console.error('删除章节失败:', error)
    }
  }

  const parseSSEMessage = (buffer: string) => {
    const events: Array<{ event: string; data: string }> = []
    let remaining = buffer
    const doubleNewline = '\n\n'
    while (remaining.includes(doubleNewline)) {
      const idx = remaining.indexOf(doubleNewline)
      const block = remaining.substring(0, idx)
      remaining = remaining.substring(idx + doubleNewline.length)
      let event = 'message'
      let data = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) {
          event = line.substring(7).trim()
        } else if (line.startsWith('data: ')) {
          data = line.substring(6)
        }
      }
      if (data) {
        events.push({ event, data })
      }
    }
    return { events, remaining }
  }

  const handleStartGenerate = useCallback(() => {
    if (!chapterId) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    setGenerateStatus('connecting')
    setGenerateError('')
    setShowEmptyHint(false)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const body = {
      chapterId,
      useContext: generateSettings.useContext,
      contextChapterCount: generateSettings.contextChapterCount,
      targetWordCount: generateSettings.targetWordCount,
      temperature: generateSettings.temperature,
    }

    fetch(`/api/novel/projects/${projectId}/generate/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          let errorMsg = '生成失败'
          try {
            const errData = await response.json()
            errorMsg = errData.error?.message || errorMsg
          } catch {}
          setGenerateStatus('error')
          setGenerateError(errorMsg)
          return
        }

        setGenerateStatus('streaming')
        setChapter(prev => ({ ...prev, status: 'GENERATING' }))

        const reader = response.body?.getReader()
        if (!reader) {
          setGenerateStatus('error')
          setGenerateError('无法读取流')
          return
        }

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
              setGenerateStatus('streaming')
            } else if (evt.event === 'token') {
              try {
                const data = JSON.parse(evt.data)
                setChapter(prev => {
                  const newContent = (prev.content || '') + data.content
                  return { ...prev, content: newContent }
                })
              } catch {}
            } else if (evt.event === 'wordCount') {
              try {
                const data = JSON.parse(evt.data)
                setWordCount(data.count)
              } catch {}
            } else if (evt.event === 'done') {
              try {
                const data = JSON.parse(evt.data)
                const cleanedContent = data.content || ''
                setChapter(prev => ({
                  ...prev,
                  content: cleanedContent || prev.content,
                  title: data.title || prev.title,
                  status: 'COMPLETED',
                  wordCount: data.wordCount,
                }))
                setWordCount(data.wordCount || countChineseWords(cleanedContent))
                setGenerateStatus('complete')
              } catch {}
            } else if (evt.event === 'error') {
              let errorMessage = '生成失败'
              try {
                const data = JSON.parse(evt.data)
                errorMessage = data.message || errorMessage
              } catch {}
              setGenerateStatus('error')
              setGenerateError(errorMessage)
              setChapter(prev => ({ ...prev, status: 'DRAFT' }))
            }
          }
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          setGenerateStatus('idle')
          setChapter(prev => ({ ...prev, status: 'DRAFT' }))
          return
        }
        setGenerateStatus('error')
        setGenerateError('连接中断')
        setChapter(prev => ({ ...prev, status: 'DRAFT' }))
      })
  }, [projectId, chapterId, generateSettings])

  const handleStopGenerate = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setGenerateStatus('idle')
    setChapter(prev => ({ ...prev, status: 'DRAFT' }))
  }, [])

  const handleOptimizeComplete = useCallback((revisedContent: string) => {
    setChapter(prev => ({ ...prev, content: revisedContent }))
    setWordCount(countChineseWords(revisedContent))
  }, [])

  const handleContentChange = useCallback((content: string) => {
    setChapter(prev => ({ ...prev, content }))
    setWordCount(countChineseWords(content))
  }, [])

  const handleStatusChange = (newStatus: ChapterStatus) => {
    setStatus(newStatus)
    setChapter({ ...chapter, status: newStatus })
  }

  const statusMap = [
    { value: 'DRAFT', label: '草稿', variant: 'secondary' as const },
    { value: 'GENERATING', label: '生成中', variant: 'primary' as const },
    { value: 'COMPLETED', label: '已完成', variant: 'success' as const },
    { value: 'REVIEWING', label: '审核中', variant: 'warning' as const },
  ]

  const currentStatus = chapter.status || status
  const currentStatusLabel = statusMap.find((s) => s.value === currentStatus)?.label || '草稿'
  const isGenerating = generateStatus === 'connecting' || generateStatus === 'streaming'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-gray-950 ${isFullscreen ? 'fixed inset-0 z-50 overflow-auto' : ''}`}>
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        <div className="mx-auto max-w-[1440px] px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => {
                const tab = searchParams.get('tab') || 'outline'
                router.push(`/projects/${projectId}?tab=${tab}`)
              }} className="shrink-0 gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                返回
              </Button>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm">
                {chapterId ? (chapter.chapterNumber || '?') : nextChapterNumber}
              </div>
              <div className="min-w-0">
                <Input
                  className="h-9 w-[min(52vw,520px)] border-0 bg-transparent px-0 text-lg font-semibold text-gray-950 shadow-none focus:bg-transparent dark:text-white"
                  placeholder="输入章节标题"
                  value={chapter.title || ''}
                  onChange={(e) => setChapter({ ...chapter, title: e.target.value })}
                />
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>第 {chapterId ? (chapter.chapterNumber || '?') : nextChapterNumber} 章</span>
                  <span>/</span>
                  <span>{currentStatusLabel}</span>
                  <span>/</span>
                  <span>{wordCount.toLocaleString()} 字</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex items-center rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                {statusMap.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleStatusChange(s.value as ChapterStatus)}
                    disabled={isGenerating}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      currentStatus === s.value
                        ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-700 dark:text-white'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)} className="h-9 w-9 p-0" title={isFullscreen ? '退出全屏' : '全屏'}>
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              {chapterId && !isGenerating && (
                <Button variant="outline" size="sm" onClick={handleStartGenerate} className="gap-1.5 whitespace-nowrap">
                  <Sparkles className="h-4 w-4" />
                  AI起草
                </Button>
              )}
              {isGenerating && (
                <Button variant="danger" size="sm" onClick={handleStopGenerate} className="gap-1.5 whitespace-nowrap">
                  <Square className="h-4 w-4" />
                  停止
                </Button>
              )}
              {generateStatus === 'complete' && chapterId && (
                <Button variant="outline" size="sm" onClick={handleStartGenerate} className="gap-1.5 whitespace-nowrap">
                  <RefreshCw className="h-4 w-4" />
                  重新生成
                </Button>
              )}
              {chapterId && chapter.content && !isGenerating && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQualityPanel(!showQualityPanel)}
                  className={`gap-1.5 whitespace-nowrap ${showQualityPanel ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300' : ''}`}
                >
                  <Wand2 className="h-4 w-4" />
                  {showQualityPanel ? '隐藏优化' : '去AI味'}
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={isGenerating} className="gap-1.5 whitespace-nowrap">
                <Save className="h-4 w-4" />
                保存草稿
              </Button>
              {chapterId && !isGenerating && (
                <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)} className="w-9 h-9 p-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-5">
        {showQualityPanel && chapterId && chapter.content && (
          <div className="mb-5">
            <ChapterQualityPanel
              projectId={projectId}
              chapterId={chapterId}
              chapterNumber={chapter.chapterNumber || nextChapterNumber}
              chapterTitle={chapter.title || '无标题'}
              content={chapter.content || ''}
              onOptimizeComplete={handleOptimizeComplete}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <section className="min-w-0 space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">章节概要</h2>
                </div>
                <span className="text-xs text-gray-400">用于 AI 起草和后续审稿上下文</span>
              </div>
              <Textarea
                placeholder="写清本章核心事件、人物目标、冲突和结尾钩子..."
                rows={4}
                className="min-h-[112px] resize-none rounded-md border-gray-200 bg-gray-50 text-[15px] leading-7 text-gray-800 focus-visible:ring-1 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                value={chapter.summary || ''}
                onChange={(e) => setChapter({ ...chapter, summary: e.target.value })}
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                <FileText className="h-4 w-4 text-gray-400" />
                <h2 className="font-medium text-gray-900 dark:text-white">正文内容</h2>
                {isGenerating && (
                  <span className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    AI 生成中...
                  </span>
                )}
                {generateStatus === 'complete' && (
                  <span className="text-xs text-green-600 dark:text-green-400">✓ 生成完成</span>
                )}
                {generateStatus === 'error' && (
                  <span className="text-xs text-red-500">生成失败: {generateError}</span>
                )}
                <span className="ml-auto text-xs text-gray-400">{wordCount.toLocaleString()} 字</span>
              </div>
              {!chapter.content && showEmptyHint && !isGenerating && (
                <div className="mx-5 mt-4 flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/30">
                  <Sparkles className="h-4 w-4 shrink-0 text-blue-500" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">还没有正文，可以直接写，也可以点击「AI起草」。</span>
                  <button
                    onClick={() => setShowEmptyHint(false)}
                    className="ml-auto text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              )}
              <Textarea
                ref={contentRef}
                className="min-h-[620px] rounded-none border-0 bg-transparent px-9 py-8 text-[18px] leading-[2.05] text-gray-900 focus-visible:ring-0 dark:text-gray-100"
                placeholder="开始创作..."
                value={chapter.content || ''}
                onChange={(e) => handleContentChange(e.target.value)}
                readOnly={isGenerating}
              />
            </div>

            <div className="flex items-center justify-between px-1 text-sm text-gray-500">
              <span>字数: {wordCount.toLocaleString()}</span>
              <span>最后更新: {chapter.updatedAt ? new Date(chapter.updatedAt).toLocaleString() : '-'}</span>
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Settings className="h-4 w-4 text-gray-400" />
                章节状态
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-950">
                  <p className="mb-1 text-xs text-gray-400">生成次数</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{chapter.generationCount ?? 0}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-950">
                  <p className="mb-1 text-xs text-gray-400">章节字数</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{wordCount.toLocaleString()}</p>
                </div>
              </div>
              {chapter.lastGeneratedTime && (
                <p className="mt-3 text-xs text-gray-500">
                  最后生成: {new Date(chapter.lastGeneratedTime).toLocaleString()}
                </p>
              )}
            </div>

            {chapterId && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">AI 起草设置</span>
                  <button
                    onClick={() => setShowGenerateSettings(!showGenerateSettings)}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    {showGenerateSettings ? '收起' : '展开'}
                  </button>
                </div>
                <div className={showGenerateSettings ? 'space-y-4' : 'space-y-2 text-sm text-gray-500'}>
                  {showGenerateSettings ? (
                    <>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">目标字数</label>
                        <input
                          type="number"
                          className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
                          value={generateSettings.targetWordCount}
                          onChange={(e) => setGenerateSettings(s => ({ ...s, targetWordCount: parseInt(e.target.value) || 3000 }))}
                          min={1000}
                          max={10000}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">温度: {generateSettings.temperature}</label>
                        <input
                          type="range"
                          className="w-full"
                          min={0}
                          max={2}
                          step={0.1}
                          value={generateSettings.temperature}
                          onChange={(e) => setGenerateSettings(s => ({ ...s, temperature: parseFloat(e.target.value) }))}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={generateSettings.useContext}
                          onChange={(e) => setGenerateSettings(s => ({ ...s, useContext: e.target.checked }))}
                        />
                        使用上下文
                      </label>
                    </>
                  ) : (
                    <>
                      <p>目标 {generateSettings.targetWordCount.toLocaleString()} 字</p>
                      <p>温度 {generateSettings.temperature} / {generateSettings.useContext ? `参考前 ${generateSettings.contextChapterCount} 章` : '不使用上下文'}</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="删除章节"
        description="确定要删除这个章节吗？此操作不可撤销。"
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
            取消
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            删除
          </Button>
        </div>
      </Modal>
    </div>
  )
}

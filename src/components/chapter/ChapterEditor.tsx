'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Textarea, Modal } from '@/components/ui'
import { ArrowLeft, Save, Sparkles, Trash2, Maximize, Minimize, FileText, Settings, Wand2, BookOpen, Square, RefreshCw, Loader2 } from 'lucide-react'
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
  const isGenerating = generateStatus === 'connecting' || generateStatus === 'streaming'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push(`/projects/${projectId}`)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                返回项目
              </Button>
              <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-sm shadow-lg">
                  {chapterId ? (chapter.chapterNumber || '?') : nextChapterNumber}
                </div>
                <Input
                  className="text-lg font-semibold w-72 border-0 bg-transparent focus:bg-white dark:focus:bg-gray-700 px-3 py-2 rounded-lg"
                  placeholder="输入章节标题"
                  value={chapter.title || ''}
                  onChange={(e) => setChapter({ ...chapter, title: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
                {statusMap.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleStatusChange(s.value as ChapterStatus)}
                    disabled={isGenerating}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      currentStatus === s.value
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)} className="w-9 h-9 p-0">
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              {chapterId && !isGenerating && (
                <Button variant="outline" size="sm" onClick={handleStartGenerate} className="gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  AI起草
                </Button>
              )}
              {isGenerating && (
                <Button variant="danger" size="sm" onClick={handleStopGenerate} className="gap-1.5">
                  <Square className="h-4 w-4" />
                  停止
                </Button>
              )}
              {generateStatus === 'complete' && chapterId && (
                <Button variant="outline" size="sm" onClick={handleStartGenerate} className="gap-1.5">
                  <RefreshCw className="h-4 w-4" />
                  重新生成
                </Button>
              )}
              {chapterId && chapter.content && !isGenerating && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQualityPanel(!showQualityPanel)}
                  className={`gap-1.5 ${showQualityPanel ? 'bg-purple-50 border-purple-500 text-purple-700' : ''}`}
                >
                  <Wand2 className="h-4 w-4" />
                  {showQualityPanel ? '隐藏优化' : '去AI味'}
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={isGenerating} className="gap-1.5">
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

      <main className="max-w-7xl mx-auto px-4 py-6">
        {showQualityPanel && chapterId && chapter.content && (
          <div className="mb-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-5 space-y-5 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500">
                <Settings className="h-4 w-4" />
                <span className="text-sm font-medium">章节设置</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wider">
                    章节概要
                  </label>
                  <Textarea
                    placeholder="描述本章主要内容..."
                    rows={5}
                    className="text-sm resize-none border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500"
                    value={chapter.summary || ''}
                    onChange={(e) => setChapter({ ...chapter, summary: e.target.value })}
                  />
                </div>
              </div>

              {chapterId && (
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                      <p className="text-gray-400 mb-1">生成次数</p>
                      <p className="font-semibold text-gray-700 dark:text-gray-200">{chapter.generationCount ?? 0}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                      <p className="text-gray-400 mb-1">章节字数</p>
                      <p className="font-semibold text-gray-700 dark:text-gray-200">{wordCount.toLocaleString()}</p>
                    </div>
                  </div>
                  {chapter.lastGeneratedTime && (
                    <p className="text-xs text-gray-400 mt-3">
                      最后生成: {new Date(chapter.lastGeneratedTime).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {chapterId && (
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">AI 生成设置</span>
                    <button
                      onClick={() => setShowGenerateSettings(!showGenerateSettings)}
                      className="text-xs text-blue-500 hover:text-blue-600"
                    >
                      {showGenerateSettings ? '收起' : '展开'}
                    </button>
                  </div>
                  {showGenerateSettings && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">目标字数</label>
                        <input
                          type="number"
                          className="w-full h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800"
                          value={generateSettings.targetWordCount}
                          onChange={(e) => setGenerateSettings(s => ({ ...s, targetWordCount: parseInt(e.target.value) || 3000 }))}
                          min={1000}
                          max={10000}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">温度: {generateSettings.temperature}</label>
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
                      <label className="flex items-center gap-2 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={generateSettings.useContext}
                          onChange={(e) => setGenerateSettings(s => ({ ...s, useContext: e.target.checked }))}
                        />
                        使用上下文
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-3">
                <FileText className="h-4 w-4 text-gray-400" />
                <h3 className="font-medium text-gray-700 dark:text-gray-200">正文内容</h3>
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
                <div className="mx-5 mt-4 flex items-center gap-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
                  <BookOpen className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">还没有正文内容，可以直接在下方编辑器中手动创作，或点击「AI起草」生成正文</span>
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
                className="min-h-[550px] border-0 rounded-none focus:ring-0 resize-none bg-transparent text-base leading-relaxed p-6"
                placeholder="开始创作..."
                value={chapter.content || ''}
                onChange={(e) => handleContentChange(e.target.value)}
                readOnly={isGenerating}
              />
            </div>

            <div className="flex items-center justify-between text-sm text-gray-500 px-1">
              <span>字数: {wordCount.toLocaleString()}</span>
              <span>最后更新: {chapter.updatedAt ? new Date(chapter.updatedAt).toLocaleString() : '-'}</span>
            </div>
          </div>
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

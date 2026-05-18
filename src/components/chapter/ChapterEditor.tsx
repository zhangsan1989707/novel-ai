'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Textarea, Modal } from '@/components/ui'
import { ArrowLeft, Save, Sparkles, Trash2, Maximize, Minimize, FileText, Settings, Wand2 } from 'lucide-react'
import { ChapterStatus } from '@/types'
import { ChapterQualityPanel } from '@/components/ai/ChapterQualityPanel'

interface ChapterEditorProps {
  projectId: number
  chapterId?: number
  initialChapter?: Record<string, any>
  onSave?: (chapter: Record<string, any>) => void
}

const statusOptions = [
  { label: '草稿', value: 'DRAFT' },
  { label: '生成中', value: 'GENERATING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '审核中', value: 'REVIEWING' },
]

const statusVariantMap: Record<ChapterStatus, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'default',
  GENERATING: 'primary',
  COMPLETED: 'success',
  REVIEWING: 'warning',
}

export function ChapterEditor({ projectId, chapterId, initialChapter, onSave }: ChapterEditorProps) {
  const router = useRouter()
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

  // 计算字数
  useEffect(() => {
    if (chapter.content) {
      const chars = chapter.content.replace(/\s/g, '').length
      setWordCount(chars)
    } else {
      setWordCount(0)
    }
  }, [chapter.content])

  // 获取章节详情
  const fetchChapter = useCallback(async () => {
    if (!chapterId) {
      // 获取下一个章节号
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

  // 保存章节
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

  // 删除章节
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

  // AI 生成
  const handleGenerate = () => {
    router.push(`/projects/${projectId}/chapters/${chapterId}/generate`)
  }

  // 去AI味优化
  const handleOptimizeComplete = useCallback((revisedContent: string) => {
    setChapter(prev => ({ ...prev, content: revisedContent }))
    const chars = revisedContent.replace(/\s/g, '').length
    setWordCount(chars)
  }, [])

  // 处理章节内容更新
  const handleContentChange = useCallback((content: string) => {
    setChapter(prev => ({ ...prev, content }))
    const chars = content.replace(/\s/g, '').length
    setWordCount(chars)
  }, [])

  // 状态切换处理
  const handleStatusChange = (newStatus: ChapterStatus) => {
    setStatus(newStatus)
    setChapter({ ...chapter, status: newStatus })
  }

  // 状态映射
  const statusMap = [
    { value: 'DRAFT', label: '草稿', variant: 'secondary' as const },
    { value: 'GENERATING', label: '生成中', variant: 'primary' as const },
    { value: 'COMPLETED', label: '已完成', variant: 'success' as const },
    { value: 'REVIEWING', label: '审核中', variant: 'warning' as const },
  ]

  // 计算当前状态（优先使用 chapter.status，否则使用 status state）
  const currentStatus = chapter.status || status
  const currentStatusMap = statusMap.find(s => s.value === currentStatus) || statusMap[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
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
              {/* 状态切换 */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
                {statusMap.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleStatusChange(s.value as ChapterStatus)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      currentStatus === s.value
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)} className="w-9 h-9 p-0">
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              {chapterId && (
                <Button variant="outline" size="sm" onClick={handleGenerate} className="gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  AI生成
                </Button>
              )}
              {chapterId && chapter.content && (
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
              <Button variant="primary" size="sm" onClick={handleSave} loading={saving} className="gap-1.5">
                <Save className="h-4 w-4" />
                {chapterId ? '保存' : '创建'}
              </Button>
              {chapterId && (
                <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)} className="w-9 h-9 p-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* AI质量分析面板 */}
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
          {/* 左侧：章节信息 */}
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
                      <p className="font-semibold text-gray-700 dark:text-gray-200">{(chapter.wordCount || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  {chapter.lastGeneratedTime && (
                    <p className="text-xs text-gray-400 mt-3">
                      最后生成: {new Date(chapter.lastGeneratedTime).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 右侧：内容编辑器 */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-3">
                <FileText className="h-4 w-4 text-gray-400" />
                <h3 className="font-medium text-gray-700 dark:text-gray-200">正文内容</h3>
                <span className="ml-auto text-xs text-gray-400">{wordCount.toLocaleString()} 字</span>
              </div>
              <Textarea
                className="min-h-[550px] border-0 rounded-none focus:ring-0 resize-none bg-transparent text-base leading-relaxed p-6"
                placeholder="开始创作..."
                value={chapter.content || ''}
                onChange={(e) => handleContentChange(e.target.value)}
              />
            </div>

            {/* 字数统计 */}
            <div className="flex items-center justify-between text-sm text-gray-500 px-1">
              <span>字数: {wordCount.toLocaleString()}</span>
              <span>最后更新: {chapter.updatedAt ? new Date(chapter.updatedAt).toLocaleString() : '-'}</span>
            </div>
          </div>
        </div>
      </main>

      {/* 删除确认 Modal */}
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

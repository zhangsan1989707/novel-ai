'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Input, Textarea, Modal } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { ArrowLeft, Save, Trash2, FileText, Wand2, Edit3, X, BookOpen, RefreshCw } from 'lucide-react'
import { ChapterStatus } from '@/types'
import { ChapterQualityPanel } from '@/components/ai/ChapterQualityPanel'
import { countChineseWords } from '@/lib/utils'

interface ChapterEditorProps {
  projectId: number
  chapterId?: number
  initialChapter?: Record<string, any>
  onSave?: (chapter: Record<string, any>) => void
}

export function ChapterEditor({ projectId, chapterId, initialChapter, onSave }: ChapterEditorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [chapter, setChapter] = useState<Record<string, any>>(initialChapter || {
    title: '',
    summary: '',
    content: '',
    status: 'DRAFT' as ChapterStatus,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showQualityPanel, setShowQualityPanel] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [nextChapterNumber, setNextChapterNumber] = useState(1)

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

  const handleSave = async () => {
    if (!chapter.title?.trim()) {
      toast.error('请输入章节标题')
      return
    }

    const contentToSave = isEditing ? editContent : chapter.content

    setSaving(true)
    try {
      const url = chapterId
        ? `/api/novel/projects/${projectId}/chapters/${chapterId}`
        : `/api/novel/projects/${projectId}/chapters`

      const saveData = {
        ...chapter,
        content: contentToSave,
        ...(!chapterId ? { chapterNumber: nextChapterNumber } : {}),
      }

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
        setChapter(prev => ({ ...prev, content: contentToSave }))
        setIsEditing(false)
        toast.success('保存成功')
        onSave?.(data.data)
      } else {
        toast.error(data.error?.message || '保存失败')
      }
    } catch (error) {
      console.error('保存章节失败:', error)
      toast.error('保存失败')
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
        toast.success('删除成功')
        router.push(`/projects/${projectId}`)
      } else {
        toast.error(data.error?.message || '删除失败')
      }
    } catch (error) {
      console.error('删除章节失败:', error)
      toast.error('删除失败')
    }
  }

  const handleEnterEdit = () => {
    setEditContent(chapter.content || '')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent('')
  }

  const handleOptimizeComplete = useCallback((revisedContent: string) => {
    setChapter(prev => ({ ...prev, content: revisedContent }))
    setWordCount(countChineseWords(revisedContent))
  }, [])

  const statusLabelMap: Record<string, { label: string; className: string }> = {
    DRAFT: { label: '草稿', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    GENERATING: { label: '生成中', className: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    COMPLETED: { label: '已完成', className: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
    REVIEWING: { label: '审核中', className: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' },
  }

  const currentStatus = chapter.status || 'DRAFT'
  const statusInfo = statusLabelMap[currentStatus] || statusLabelMap.DRAFT

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
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
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusInfo.className}`}>
                    {statusInfo.label}
                  </span>
                  <span>/</span>
                  <span>{wordCount.toLocaleString()} 字</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {chapterId && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="gap-1.5 whitespace-nowrap"
                    title="AI续写功能即将上线"
                  >
                    <BookOpen className="h-4 w-4" />
                    AI 续写
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="gap-1.5 whitespace-nowrap"
                    title="AI重写功能即将上线"
                  >
                    <RefreshCw className="h-4 w-4" />
                    AI 重写
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!chapter.content}
                    onClick={() => setShowQualityPanel(!showQualityPanel)}
                    className={`gap-1.5 whitespace-nowrap ${showQualityPanel ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300' : ''}`}
                  >
                    <Wand2 className="h-4 w-4" />
                    AI 去AI味
                  </Button>
                </>
              )}
              {chapterId && !isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEnterEdit}
                  className="gap-1.5 whitespace-nowrap"
                >
                  <Edit3 className="h-4 w-4" />
                  编辑正文
                </Button>
              )}
              {chapterId && !isEditing && (
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
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">章节概要</h2>
              </div>
              <Textarea
                placeholder="写清本章核心事件、人物目标、冲突和结尾钩子..."
                rows={4}
                className="min-h-[112px] resize-none rounded-md border-gray-200 bg-gray-50 text-[15px] leading-7 text-gray-800 focus-visible:ring-1 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                value={chapter.summary || ''}
                onChange={(e) => setChapter({ ...chapter, summary: e.target.value })}
                readOnly={isEditing}
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                <FileText className="h-4 w-4 text-gray-400" />
                <h2 className="font-medium text-gray-900 dark:text-white">正文内容</h2>
                <span className="ml-auto text-xs text-gray-400">{wordCount.toLocaleString()} 字</span>
              </div>

              {isEditing ? (
                <div className="flex flex-col">
                  <Textarea
                    className="min-h-[620px] rounded-none border-0 bg-transparent px-9 py-8 text-[18px] leading-[2.05] text-gray-900 focus-visible:ring-0 dark:text-gray-100"
                    placeholder="开始创作..."
                    value={editContent}
                    onChange={(e) => {
                      setEditContent(e.target.value)
                      setWordCount(countChineseWords(e.target.value))
                    }}
                  />
                  <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-gray-800">
                    <span className="text-sm text-gray-500">
                      字数: {wordCount.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleCancelEdit} className="gap-1.5">
                        <X className="h-4 w-4" />
                        取消编辑
                      </Button>
                      <Button variant="primary" size="sm" onClick={handleSave} loading={saving} className="gap-1.5">
                        <Save className="h-4 w-4" />
                        保存草稿
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {chapter.content ? (
                    <div className="min-h-[620px] whitespace-pre-line px-9 py-8 text-[18px] leading-[2.05] text-gray-900 dark:text-gray-100">
                      {chapter.content}
                    </div>
                  ) : (
                    <div className="flex min-h-[620px] items-center justify-center px-9 py-8">
                      <div className="text-center">
                        <BookOpen className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                        <p className="mt-3 text-sm text-gray-400">暂无正文内容</p>
                        {chapterId && (
                          <p className="mt-1 text-xs text-gray-400">点击「AI 续写」或「编辑正文」开始创作</p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-gray-800">
                    <span className="text-sm text-gray-500">
                      字数: {wordCount.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-400">
                      最后更新: {chapter.updatedAt ? new Date(chapter.updatedAt).toLocaleString() : '-'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <FileText className="h-4 w-4 text-gray-400" />
                章节信息
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
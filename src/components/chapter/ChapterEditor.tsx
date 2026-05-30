'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Input, Textarea, Modal } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { ArrowLeft, Save, Trash2, FileText, Wand2, Edit3, X, BookOpen, RefreshCw, Shield, Clock, Hash, Zap, AlertCircle } from 'lucide-react'
import { ChapterStatus } from '@/types'
import { ChapterQualityPanel } from '@/components/ai/ChapterQualityPanel'
import { AntiDetectPanel } from '@/components/ai/AntiDetectPanel'
import { RevisionPanel, type RevisionType } from '@/components/ai'
import { formatDisplayDateTime } from '@/lib/helpers'
import { formatLargeNumber } from '@/lib/utils'
import { formatChapterStatus, formatTimeAgo, formatAgentType } from '@/lib/format-labels'
import { normalizeChapterDisplay, type ChapterRawData, type ChapterDisplayData } from '@/lib/chapter-display-adapter'

interface ChapterEditorProps {
  projectId: number
  chapterId?: number
  initialChapter?: Record<string, any>
  onSave?: (chapter: Record<string, any>) => void
}

export function ChapterEditor({ projectId, chapterId, initialChapter, onSave }: ChapterEditorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [rawChapter, setRawChapter] = useState<ChapterRawData>(initialChapter || {
    id: 0,
    chapterNumber: 0,
    title: '',
    summary: '',
    content: '',
    status: 'DRAFT',
  })
  const [displayChapter, setDisplayChapter] = useState<ChapterDisplayData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showQualityPanel, setShowQualityPanel] = useState(false)
  const [showAntiDetectPanel, setShowAntiDetectPanel] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [revisionMode, setRevisionMode] = useState<RevisionType>('rewrite')

  // 使用适配器标准化数据
  useEffect(() => {
    const normalized = normalizeChapterDisplay(rawChapter)
    setDisplayChapter(normalized)
  }, [rawChapter])

  const fetchChapter = useCallback(async () => {
    if (!chapterId) {
      try {
        const res = await fetch(`/api/novel/projects/${projectId}/chapters`)
        const data = await res.json()
        if (data.success && data.data.length > 0) {
          // 获取最大章节号用于新建
        }
      } catch (error) {
        console.error('获取章节列表失败:', error)
      }
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}`)
      const data = await res.json()
      if (data.success) {
        setRawChapter(data.data)
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
    if (!rawChapter.title?.trim()) {
      toast.error('请输入章节标题')
      return
    }

    const contentToSave = isEditing ? editContent : (displayChapter?.content || '')

    setSaving(true)
    try {
      const url = chapterId
        ? `/api/novel/projects/${projectId}/chapters/${chapterId}`
        : `/api/novel/projects/${projectId}/chapters`

      const saveData = {
        ...rawChapter,
        content: contentToSave,
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
        setRawChapter(prev => ({ ...prev, content: contentToSave }))
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
    setEditContent(displayChapter?.content || '')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent('')
  }

  const handleOptimizeComplete = useCallback((revisedContent: string) => {
    setRawChapter(prev => ({ ...prev, content: revisedContent }))
  }, [])

  const openRevisionModal = useCallback((mode: RevisionType) => {
    const content = displayChapter?.content || ''
    if (mode === 'continue' && !content.trim() && chapterId) {
      router.push(`/projects/${projectId}/chapters/${chapterId}/generate`)
      return
    }

    if (mode === 'rewrite' && !content.trim()) {
      toast.error('当前没有可重写的正文内容')
      return
    }

    setRevisionMode(mode)
    setShowRevisionModal(true)
  }, [displayChapter?.content, chapterId, projectId, router])

  const closeRevisionModal = useCallback(() => {
    setShowRevisionModal(false)
  }, [])

  const handleRevisionApply = useCallback((newContent: string) => {
    const currentContent = displayChapter?.content || ''
    const mergedContent =
      revisionMode === 'continue' && currentContent
        ? `${currentContent.trimEnd()}\n\n${newContent.trimStart()}`
        : newContent

    setRawChapter(prev => ({ ...prev, content: mergedContent }))
    setShowRevisionModal(false)
    setIsEditing(false)
  }, [revisionMode, displayChapter?.content])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  if (!displayChapter) {
    return <div className="text-center py-12 text-gray-500">加载中...</div>
  }

  return (
    <div className="space-y-6">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/projects/${projectId}`)}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-xl font-semibold">
              第{displayChapter.chapterNo}章 {displayChapter.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
              <span className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" />
                {formatLargeNumber(displayChapter.wordCount)}字
              </span>
              <span>{formatChapterStatus(displayChapter.status)}</span>
              {displayChapter.lastAgentType && (
                <span className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  {formatAgentType(displayChapter.lastAgentType)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatTimeAgo(displayChapter.updatedAt)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openRevisionModal('continue')}
            className="gap-1.5"
          >
            <Wand2 className="h-4 w-4" />
            AI续写
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openRevisionModal('rewrite')}
            className="gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            AI重写
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAntiDetectPanel(true)}
            className="gap-1.5"
          >
            <Shield className="h-4 w-4" />
            AI去AI味
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowQualityPanel(true)}
            className="gap-1.5"
          >
            <FileText className="h-4 w-4" />
            AI检测
          </Button>
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnterEdit}
              className="gap-1.5"
            >
              <Edit3 className="h-4 w-4" />
              编辑正文
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="gap-1.5"
              >
                <Save className="h-4 w-4" />
                {saving ? '保存中...' : '保存'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
              >
                取消
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 主内容区 - 左右布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：摘要 + 正文 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 草稿提示 */}
          {displayChapter.isDraft && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                <AlertCircle className="h-4 w-4" />
                <span>当前展示的是生成中草稿内容，尚未通过质量校验</span>
              </div>
            </div>
          )}

          {/* 摘要区 */}
          {displayChapter.summary && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">章节摘要</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{displayChapter.summary}</p>
            </div>
          )}

          {/* 正文区 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">正文内容</h3>
            {isEditing ? (
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[500px] font-mono text-sm leading-relaxed"
                placeholder="输入正文内容..."
              />
            ) : !displayChapter.isEmpty ? (
              <div className="prose dark:prose-invert max-w-none">
                {displayChapter.content.split('\n').map((paragraph, i) => (
                  paragraph.trim() ? <p key={i} className="mb-4 leading-relaxed">{paragraph}</p> : null
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">正文尚未生成或尚未同步完成</p>
                <p className="text-sm mt-2">生成中的内容将在完成后显示</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/projects/${projectId}/chapters/${chapterId}/generate`)}
                  className="mt-4 gap-1.5"
                >
                  <Wand2 className="h-4 w-4" />
                  前往生成
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：状态信息 */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">章节信息</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">状态</dt>
                <dd className="text-sm font-medium">{formatChapterStatus(displayChapter.status)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">字数</dt>
                <dd className="text-sm font-medium">{formatLargeNumber(displayChapter.wordCount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">生成次数</dt>
                <dd className="text-sm font-medium">{displayChapter.generationCount}</dd>
              </div>
              {displayChapter.lastAgentType && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">最后操作</dt>
                  <dd className="text-sm font-medium">{formatAgentType(displayChapter.lastAgentType)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">更新时间</dt>
                <dd className="text-sm font-medium">{formatDisplayDateTime(displayChapter.updatedAt)}</dd>
              </div>
            </dl>
          </div>

          {/* 快捷操作 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">快捷操作</h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => router.push(`/projects/${projectId}/chapters/${chapterId}/generate`)}
              >
                <Wand2 className="h-4 w-4" />
                AI生成
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => openRevisionModal('continue')}
              >
                <RefreshCw className="h-4 w-4" />
                AI续写
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => openRevisionModal('rewrite')}
              >
                <FileText className="h-4 w-4" />
                AI重写
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="确认删除"
      >
        <div className="space-y-4">
          <p>确定要删除第{displayChapter.chapterNo}章《{displayChapter.title}》吗？此操作不可撤销。</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              删除
            </Button>
          </div>
        </div>
      </Modal>

      {/* 质量检测面板 */}
      {showQualityPanel && chapterId && (
        <ChapterQualityPanel
          projectId={projectId}
          chapterId={chapterId}
          content={displayChapter.content}
          onClose={() => setShowQualityPanel(false)}
        />
      )}

      {/* 去AI味面板 */}
      {showAntiDetectPanel && chapterId && (
        <AntiDetectPanel
          projectId={projectId}
          chapterId={chapterId}
          content={displayChapter.content}
          onClose={() => setShowAntiDetectPanel(false)}
          onComplete={handleOptimizeComplete}
        />
      )}

      {/* 修订面板 */}
      {showRevisionModal && chapterId && (
        <RevisionPanel
          projectId={projectId}
          chapterId={chapterId}
          mode={revisionMode}
          currentContent={displayChapter.content}
          onClose={closeRevisionModal}
          onApply={handleRevisionApply}
        />
      )}
    </div>
  )
}

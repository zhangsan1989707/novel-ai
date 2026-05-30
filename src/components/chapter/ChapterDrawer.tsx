'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button, Badge, Modal } from '@/components/ui'
import {
  X, ChevronLeft, ChevronRight, BookOpen, FileText, Clock, Hash,
  AlertCircle, Zap, CheckCircle2, RotateCcw, Wand2, ChevronDown,
  ChevronUp, Sparkles, Loader2, Lock, PenLine,
} from 'lucide-react'
import { formatChapterStatus, formatTimeAgo, formatAgentType } from '@/lib/format-labels'
import { formatLargeNumber } from '@/lib/utils'
import { normalizeChapterDisplay, type ChapterRawData, type ChapterDisplayData } from '@/lib/chapter-display-adapter'
import { ChapterQualityPanel } from '@/components/ai/ChapterQualityPanel'
import { RevisionPanel } from '@/components/ai/RevisionPanel'
import { toast } from '@/components/ui'
import type { ChapterQualityReport } from '@/lib/knowledge/chapter-quality'

interface ChapterDrawerProps {
  projectId: number
  chapterId: number | null
  chapters: Array<{ id: number; chapterNumber: number; title: string }>
  onClose: () => void
  onNavigate: (chapterId: number) => void
  onStatusChange?: (chapterId: number, newStatus: string) => void
}

interface ReviewData {
  validationReport: Record<string, unknown> | null
  qualityReport: ChapterQualityReport | null
  targetWordCount: number
  currentWordCount: number
  wordCountStatus: 'ok' | 'short' | 'long'
}

const REJECT_REASONS = [
  '剧情节奏太慢',
  '字数不足',
  '文笔不满意',
  '人设不一致',
  '结尾没有钩子',
]

export function ChapterDrawer({ projectId, chapterId, chapters, onClose, onNavigate, onStatusChange }: ChapterDrawerProps) {
  const [chapter, setChapter] = useState<ChapterDisplayData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [qualityPanelOpen, setQualityPanelOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // 退回重写 Modal
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReasons, setRejectReasons] = useState<string[]>([])
  const [rejectCustomReason, setRejectCustomReason] = useState('')

  // 润色/补全面板
  const [showRevisionPanel, setShowRevisionPanel] = useState(false)
  const [revisionMode, setRevisionMode] = useState<'polish' | 'expand'>('polish')

  // 解锁编辑
  const [unlocked, setUnlocked] = useState(false)

  const currentIndex = chapters.findIndex(c => c.id === chapterId)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < chapters.length - 1

  const fetchChapter = useCallback(async () => {
    if (!chapterId) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}`)
      const data = await res.json()
      if (data.success) {
        const normalized = normalizeChapterDisplay(data.data as ChapterRawData)
        setChapter(normalized)
      } else {
        setError(data.error?.message || '加载失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }, [projectId, chapterId])

  const fetchReviewData = useCallback(async () => {
    if (!chapterId) return
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}/review`)
      const data = await res.json()
      if (data.success) {
        setReviewData(data.data)
      }
    } catch {
      // 质检数据加载失败不影响主流程
    }
  }, [projectId, chapterId])

  useEffect(() => {
    fetchChapter()
    fetchReviewData()
    setShowRevisionPanel(false)
    setUnlocked(false)
  }, [fetchChapter, fetchReviewData])

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showRejectModal || showRevisionPanel) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(chapters[currentIndex - 1].id)
      if (e.key === 'ArrowRight' && hasNext) onNavigate(chapters[currentIndex + 1].id)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, hasPrev, hasNext, chapters, onClose, onNavigate, showRejectModal, showRevisionPanel])

  // 通过审核并锁定
  const handleApprove = async () => {
    if (!chapterId) return
    setActionLoading('approve')
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('第' + chapter?.chapterNo + '章已审核通过')
        setChapter(prev => prev ? { ...prev, status: 'COMPLETED' } : prev)
        onStatusChange?.(chapterId, 'COMPLETED')
      } else {
        toast.error(data.error?.message || '操作失败')
      }
    } catch {
      toast.error('网络错误')
    } finally {
      setActionLoading(null)
    }
  }

  // 退回重写
  const handleReject = async () => {
    if (!chapterId) return
    setActionLoading('reject')
    try {
      const reason = [
        ...rejectReasons,
        rejectCustomReason.trim(),
      ].filter(Boolean).join('；')

      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'DRAFT',
          summary: reason ? `[退回原因：${reason}] ${(chapter?.summary || '')}` : undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('已退回重写')
        setChapter(prev => prev ? { ...prev, status: 'DRAFT' } : prev)
        onStatusChange?.(chapterId, 'DRAFT')
        setShowRejectModal(false)
        setRejectReasons([])
        setRejectCustomReason('')
      } else {
        toast.error(data.error?.message || '操作失败')
      }
    } catch {
      toast.error('网络错误')
    } finally {
      setActionLoading(null)
    }
  }

  // 打开润色/补全面板
  const openRevision = (mode: 'polish' | 'expand') => {
    setRevisionMode(mode)
    setShowRevisionPanel(true)
  }

  // 润色/补全完成
  const handleRevisionApply = (newContent: string) => {
    setChapter(prev => prev ? { ...prev, content: newContent, wordCount: newContent.length } : prev)
    setShowRevisionPanel(false)
    toast.success('已应用修改')
    if (chapterId) onStatusChange?.(chapterId, chapter?.status || 'REVIEWING')
  }

  // 状态标签 variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'success'
      case 'GENERATING': return 'primary'
      case 'REVIEWING': return 'warning'
      default: return 'default'
    }
  }

  // 字数提示
  const getWordCountHint = () => {
    if (!reviewData) return null
    const { currentWordCount, targetWordCount, wordCountStatus } = reviewData
    if (wordCountStatus === 'short') {
      const diff = targetWordCount - currentWordCount
      return { type: 'warning', text: `字数不足：目标 ${formatLargeNumber(targetWordCount)}，当前 ${formatLargeNumber(currentWordCount)}，差 ${formatLargeNumber(diff)} 字` }
    }
    if (wordCountStatus === 'long') {
      return { type: 'info', text: `字数偏多：目标 ${formatLargeNumber(targetWordCount)}，当前 ${formatLargeNumber(currentWordCount)}` }
    }
    return { type: 'success', text: `字数达标：${formatLargeNumber(currentWordCount)} / ${formatLargeNumber(targetWordCount)}` }
  }

  const wordCountHint = getWordCountHint()
  const isReviewing = chapter?.status === 'REVIEWING'
  const isCompleted = chapter?.status === 'COMPLETED'
  const isGenerating = chapter?.status === 'GENERATING'
  const isDraft = chapter?.status === 'DRAFT'
  const showReviewActions = (isReviewing || unlocked) && !showRevisionPanel

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
        <div
          className="w-full max-w-3xl bg-white dark:bg-gray-900 h-full overflow-hidden flex flex-col shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 min-w-0">
              <BookOpen className="h-5 w-5 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold truncate">
                  {chapter ? `第${chapter.chapterNo}章 ${chapter.title}` : '加载中...'}
                </h2>
                {chapter && (
                  <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                    <Badge variant={getStatusVariant(chapter.status)} className="text-xs">
                      {formatChapterStatus(chapter.status)}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5" />
                      {formatLargeNumber(chapter.wordCount)}字
                    </span>
                    {chapter.lastAgentType && (
                      <span className="flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5" />
                        {formatAgentType(chapter.lastAgentType)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTimeAgo(chapter.updatedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-6 py-4 space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-500">{error}</div>
            ) : chapter ? (
              <div>
                {/* 润色/补全面板 */}
                {showRevisionPanel ? (
                  <div className="px-6 py-4">
                    <RevisionPanel
                      projectId={projectId}
                      chapterId={chapter.id}
                      currentContent={chapter.content}
                      onApply={handleRevisionApply}
                      onCancel={() => setShowRevisionPanel(false)}
                      initialRevisionType={revisionMode === 'expand' ? 'expand' : 'polish'}
                    />
                  </div>
                ) : (
                  <div className="px-6 py-4 space-y-5">
                    {/* 草稿提示 */}
                    {chapter.isDraft && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                          <AlertCircle className="h-4 w-4" />
                          <span>当前展示的是生成中草稿内容，尚未通过质量校验</span>
                        </div>
                      </div>
                    )}

                    {/* AI 质检区（可折叠） */}
                    {(reviewData || isReviewing) && (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                          onClick={() => setQualityPanelOpen(!qualityPanelOpen)}
                        >
                          <div className="flex items-center gap-3">
                            <Sparkles className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">AI 质检报告</span>
                            {reviewData?.qualityReport && (
                              <Badge
                                variant={
                                  reviewData.qualityReport.overallScore >= 70 ? 'success'
                                    : reviewData.qualityReport.overallScore >= 40 ? 'warning'
                                    : 'danger'
                                }
                                className="text-xs"
                              >
                                {reviewData.qualityReport.overallScore}分
                              </Badge>
                            )}
                            {wordCountHint && (
                              <Badge
                                variant={wordCountHint.type === 'success' ? 'success' : wordCountHint.type === 'warning' ? 'warning' : 'default'}
                                className="text-xs"
                              >
                                {wordCountHint.type === 'success' ? '字数达标' : wordCountHint.type === 'warning' ? '字数不足' : '字数偏多'}
                              </Badge>
                            )}
                          </div>
                          {qualityPanelOpen ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </button>

                        {qualityPanelOpen && (
                          <div className="px-4 py-3 space-y-3 border-t border-gray-200 dark:border-gray-700">
                            {/* 字数状态 */}
                            {wordCountHint && (
                              <div className={`text-sm px-3 py-2 rounded-lg ${
                                wordCountHint.type === 'success'
                                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                  : wordCountHint.type === 'warning'
                                    ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              }`}>
                                {wordCountHint.text}
                              </div>
                            )}

                            {/* 质量维度 */}
                            {reviewData?.qualityReport && (
                              <>
                                {reviewData.qualityReport.issues.length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-medium text-gray-500 mb-2">问题 ({reviewData.qualityReport.issues.length})</h4>
                                    <div className="space-y-1">
                                      {reviewData.qualityReport.issues.slice(0, 5).map((issue, i) => (
                                        <div key={i} className="flex items-start gap-2 text-sm">
                                          <Badge
                                            variant={issue.severity === 'critical' ? 'danger' : issue.severity === 'warning' ? 'warning' : 'default'}
                                            className="text-xs shrink-0 mt-0.5"
                                          >
                                            {issue.severity === 'critical' ? '严重' : issue.severity === 'warning' ? '警告' : '提示'}
                                          </Badge>
                                          <span className="text-gray-600 dark:text-gray-300">{issue.description}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {reviewData.qualityReport.suggestions.length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-medium text-gray-500 mb-2">建议</h4>
                                    <ul className="space-y-1">
                                      {reviewData.qualityReport.suggestions.slice(0, 3).map((s, i) => (
                                        <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                                          <span className="text-blue-500 mt-0.5">·</span>
                                          {s}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </>
                            )}

                            {/* AI 去味面板入口 */}
                            {chapter.content && (
                              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                                <ChapterQualityPanel
                                  projectId={projectId}
                                  chapterId={chapter.id}
                                  chapterNumber={chapter.chapterNo}
                                  chapterTitle={chapter.title}
                                  content={chapter.content}
                                  onOptimizeComplete={(revised) => {
                                    setChapter(prev => prev ? { ...prev, content: revised } : prev)
                                    toast.success('已应用优化')
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 摘要区 */}
                    {chapter.summary && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">章节摘要</h3>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{chapter.summary}</p>
                      </div>
                    )}

                    {/* 正文区 */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">正文内容</h3>
                      {!chapter.isEmpty ? (
                        <div
                          className="text-gray-800 dark:text-gray-200"
                          style={{ fontSize: '16px', lineHeight: 1.9 }}
                        >
                          {chapter.content.split('\n').map((paragraph, i) => (
                            paragraph.trim() ? (
                              <p key={i} className="mb-4">{paragraph}</p>
                            ) : null
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-400">
                          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>正文尚未生成或尚未同步完成</p>
                          <p className="text-sm mt-1">生成中的内容将在完成后显示</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* 底部操作栏 */}
          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-6 py-3">
            {/* 导航 + 操作按钮 */}
            <div className="flex items-center justify-between gap-3">
              {/* 左侧导航 */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => hasPrev && onNavigate(chapters[currentIndex - 1].id)}
                  disabled={!hasPrev}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一章
                </Button>
                <span className="text-xs text-gray-400 tabular-nums">
                  {currentIndex + 1}/{chapters.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => hasNext && onNavigate(chapters[currentIndex + 1].id)}
                  disabled={!hasNext}
                  className="gap-1"
                >
                  下一章
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* 右侧操作按钮 */}
              <div className="flex items-center gap-2">
                {isGenerating && (
                  <span className="text-sm text-gray-400 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    生成中...
                  </span>
                )}

                {isDraft && !showRevisionPanel && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => chapterId && onNavigate(chapterId)}
                    className="gap-1.5"
                  >
                    <Sparkles className="h-4 w-4" />
                    前往生成
                  </Button>
                )}

                {showReviewActions && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRejectModal(true)}
                      className="gap-1.5"
                    >
                      <RotateCcw className="h-4 w-4" />
                      退回重写
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRevision('polish')}
                      className="gap-1.5"
                    >
                      <PenLine className="h-4 w-4" />
                      局部润色
                    </Button>
                    {reviewData?.wordCountStatus === 'short' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRevision('expand')}
                        className="gap-1.5"
                      >
                        <Wand2 className="h-4 w-4" />
                        补全文
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleApprove}
                      loading={actionLoading === 'approve'}
                      className="gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      通过审核并锁定
                    </Button>
                  </>
                )}

                {isCompleted && !unlocked && !showRevisionPanel && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUnlocked(true)}
                    className="gap-1.5"
                  >
                    <Lock className="h-4 w-4" />
                    解锁修改
                  </Button>
                )}

                {unlocked && !showRevisionPanel && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRejectModal(true)}
                      className="gap-1.5"
                    >
                      <RotateCcw className="h-4 w-4" />
                      退回重写
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRevision('polish')}
                      className="gap-1.5"
                    >
                      <PenLine className="h-4 w-4" />
                      局部润色
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUnlocked(false)}
                      className="gap-1.5"
                    >
                      <Lock className="h-4 w-4" />
                      重新锁定
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 退回重写原因选择 Modal */}
      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="退回重写"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            请选择退回原因（可多选），AI 将根据原因重新生成本章。
          </p>
          <div className="grid grid-cols-2 gap-2">
            {REJECT_REASONS.map(reason => (
              <button
                key={reason}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
                  rejectReasons.includes(reason)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                }`}
                onClick={() => {
                  setRejectReasons(prev =>
                    prev.includes(reason)
                      ? prev.filter(r => r !== reason)
                      : [...prev, reason]
                  )
                }}
              >
                {rejectReasons.includes(reason) && <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5" />}
                {reason}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">自定义原因</label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="输入自定义退回原因..."
              value={rejectCustomReason}
              onChange={e => setRejectCustomReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              loading={actionLoading === 'reject'}
            >
              确认退回重写
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

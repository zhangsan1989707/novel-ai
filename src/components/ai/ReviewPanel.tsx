'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button, Textarea, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import {
  Eye, Trash2, ChevronDown, ChevronUp, Loader2,
  Swords, AlertTriangle, ThumbsUp, ThumbsDown,
  Lightbulb, BarChart3, FileText, AlertCircle, ListOrdered,
} from 'lucide-react'
import { toast } from '@/components/ui/Toast'

interface ReviewScore {
  dimension: string
  score: number
  comment: string
}

interface ReviewResult {
  reviewer: string
  scores: ReviewScore[]
  overallScore: number
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
}

interface ReviewReport {
  id: string
  projectId: number
  chapterNo: number | null
  content: string
  reviews: ReviewResult[]
  overallScore: number
  consensus: string | null
  criticalIssues: string[]
  improvementPriority: string[]
  createdAt: string
}

interface ReviewPanelProps {
  projectId: number
  chapters?: Array<{ id?: number; chapterNumber: number; title: string; content?: string | null }>
}

const REVIEWER_CONFIG: Record<string, { icon: typeof Swords; color: string; bgColor: string }> = {
  '男频审稿人': { icon: Swords, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
  '女频审稿人': { icon: Eye, color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-50 dark:bg-pink-900/20' },
  '毒点检测器': { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20' },
  '结构分析师': { icon: BarChart3, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-900/20' },
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
  if (score >= 40) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

function getOverallLabel(score: number): string {
  if (score >= 80) return '优秀'
  if (score >= 60) return '良好'
  if (score >= 40) return '待改进'
  return '较差'
}

export function ReviewPanel({ projectId, chapters = [] }: ReviewPanelProps) {
  const [content, setContent] = useState('')
  const [chapterNo, setChapterNo] = useState<number | undefined>(undefined)
  const [reviewing, setReviewing] = useState(false)
  const [reports, setReports] = useState<ReviewReport[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const initializedRef = useRef(false)

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/novel/review?projectId=${projectId}`)
      const data = await res.json()
      if (data.success) {
        setReports(data.data)
      }
    } catch {
      toast.error('加载审稿报告失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      loadReports()
    }
  }, [loadReports])

  const handleChapterSelect = useCallback(async (chapterNumber: number) => {
    const chapter = chapters.find(c => c.chapterNumber === chapterNumber)
    if (chapter?.content) {
      setContent(chapter.content)
      setChapterNo(chapterNumber)
    } else if (chapter) {
      try {
        const res = await fetch(`/api/novel/projects/${projectId}/chapters/${chapter.id || chapterNumber}`)
        const data = await res.json()
        if (data.success && data.data?.content) {
          setContent(data.data.content)
          setChapterNo(chapterNumber)
        } else {
          toast.error('该章节暂无内容')
        }
      } catch {
        toast.error('获取章节内容失败')
      }
    } else {
      toast.error('该章节暂无内容')
    }
  }, [chapters, projectId])

  const handleReview = useCallback(async () => {
    if (!content.trim()) {
      toast.error('请输入审稿内容')
      return
    }

    setReviewing(true)
    try {
      const res = await fetch('/api/novel/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          content: content.trim(),
          chapterNo,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success('审稿完成')
        loadReports()
      } else {
        toast.error(data.error?.message || '审稿失败')
      }
    } catch {
      toast.error('审稿请求失败')
    } finally {
      setReviewing(false)
    }
  }, [projectId, content, chapterNo, loadReports])

  const handleDelete = useCallback(async (reportId: string) => {
    try {
      const res = await fetch(`/api/novel/review/${reportId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('已删除')
        setReports(prev => prev.filter(r => r.id !== reportId))
        if (expandedId === reportId) {
          setExpandedId(null)
        }
      } else {
        toast.error(data.error?.message || '删除失败')
      }
    } catch {
      toast.error('删除请求失败')
    }
  }, [expandedId])

  const toggleExpand = useCallback((reportId: string) => {
    setExpandedId(prev => prev === reportId ? null : reportId)
  }, [])

  return (
    <div className="space-y-6">
      <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-medium">对抗式审稿</span>
        </div>

        {chapters.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs text-gray-500">选择章节</label>
            <select
              value={chapterNo ?? ''}
              onChange={e => {
                const val = e.target.value
                if (val) {
                  handleChapterSelect(Number(val))
                }
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">手动输入内容</option>
              {chapters.map(ch => (
                <option key={ch.chapterNumber} value={ch.chapterNumber}>
                  第{ch.chapterNumber}章 {ch.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs text-gray-500">审稿内容</label>
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="粘贴需要审稿的小说内容，或从上方选择章节..."
            rows={6}
            className="text-sm"
          />
        </div>

        <Button
          variant="primary"
          onClick={handleReview}
          disabled={reviewing || !content.trim()}
        >
          {reviewing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              审稿中（4个视角并行分析）...
            </>
          ) : (
            <>
              <Swords className="h-4 w-4 mr-2" />
              开始审稿
            </>
          )}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">审稿报告</span>
          </div>
          <span className="text-xs text-gray-500">{reports.length} 份</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-500">
            暂无审稿报告，输入内容开始审稿
          </div>
        )}

        {reports.map(report => (
          <Card key={report.id} className="overflow-hidden">
            <CardHeader
              className="cursor-pointer py-3 px-4"
              onClick={() => toggleExpand(report.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`text-2xl font-bold ${getScoreColor(report.overallScore)}`}>
                    {Math.round(report.overallScore)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm">
                      {report.chapterNo ? `第${report.chapterNo}章审稿` : '自定义内容审稿'}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={getScoreColor(report.overallScore)}>
                        {getOverallLabel(report.overallScore)}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(report.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {report.criticalIssues.length > 0 && (
                    <Badge variant="danger">
                      {report.criticalIssues.length} 个关键问题
                    </Badge>
                  )}
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleDelete(report.id)
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {expandedId === report.id ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
            </CardHeader>

            {expandedId === report.id && (
              <CardContent className="px-4 pb-4 space-y-5">
                {report.consensus && (
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">
                      <FileText className="h-3.5 w-3.5" />
                      共识意见
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {report.consensus}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-500">审稿人评分对比</div>
                  <div className="space-y-2">
                    {(report.reviews as ReviewResult[]).map((review, idx) => {
                      const config = REVIEWER_CONFIG[review.reviewer]
                      const Icon = config?.icon || BarChart3
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1.5">
                              <Icon className={`h-3.5 w-3.5 ${config?.color || ''}`} />
                              <span>{review.reviewer}</span>
                            </div>
                            <span className={`font-medium ${getScoreColor(review.overallScore)}`}>
                              {review.overallScore}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${getScoreBarColor(review.overallScore)}`}
                              style={{ width: `${review.overallScore}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {(report.reviews as ReviewResult[]).map((review, idx) => {
                  const config = REVIEWER_CONFIG[review.reviewer]
                  const Icon = config?.icon || BarChart3
                  return (
                    <div key={idx} className={`p-3 rounded-lg ${config?.bgColor || 'bg-gray-50 dark:bg-gray-800/50'}`}>
                      <div className="flex items-center gap-1.5 text-sm font-medium mb-3">
                        <Icon className={`h-4 w-4 ${config?.color || ''}`} />
                        {review.reviewer}
                      </div>

                      {review.scores.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {review.scores.map((score, si) => (
                            <div key={si} className="flex items-start gap-2">
                              <div className="w-20 text-xs text-gray-500 flex-shrink-0 pt-0.5">
                                {score.dimension}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${getScoreBarColor(score.score)}`}
                                      style={{ width: `${score.score}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-medium flex-shrink-0 ${getScoreColor(score.score)}`}>
                                    {score.score}
                                  </span>
                                </div>
                                {score.comment && (
                                  <p className="text-xs text-gray-500">{score.comment}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {review.strengths.length > 0 && (
                        <div className="space-y-1 mb-2">
                          <div className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                            <ThumbsUp className="h-3 w-3" />
                            优点
                          </div>
                          <ul className="space-y-0.5">
                            {review.strengths.map((s, si) => (
                              <li key={si} className="text-xs text-gray-700 dark:text-gray-300 pl-4 border-l-2 border-green-200 dark:border-green-800">
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {review.weaknesses.length > 0 && (
                        <div className="space-y-1 mb-2">
                          <div className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                            <ThumbsDown className="h-3 w-3" />
                            缺点
                          </div>
                          <ul className="space-y-0.5">
                            {review.weaknesses.map((w, wi) => (
                              <li key={wi} className="text-xs text-gray-700 dark:text-gray-300 pl-4 border-l-2 border-red-200 dark:border-red-800">
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {review.suggestions.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                            <Lightbulb className="h-3 w-3" />
                            建议
                          </div>
                          <ul className="space-y-0.5">
                            {review.suggestions.map((s, si) => (
                              <li key={si} className="text-xs text-gray-700 dark:text-gray-300 pl-4 border-l-2 border-amber-200 dark:border-amber-800">
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })}

                {report.criticalIssues.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 mb-2">
                      <AlertCircle className="h-3.5 w-3.5" />
                      关键问题
                    </div>
                    <ul className="space-y-1">
                      {report.criticalIssues.map((issue, i) => (
                        <li key={i} className="text-sm text-red-700 dark:text-red-300 pl-3 border-l-2 border-red-300 dark:border-red-700">
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.improvementPriority.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">
                      <ListOrdered className="h-3.5 w-3.5" />
                      改进优先级
                    </div>
                    <ol className="space-y-1">
                      {report.improvementPriority.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700 dark:text-gray-300 pl-3 border-l-2 border-amber-300 dark:border-amber-700">
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400 mr-1">
                            {i + 1}.
                          </span>
                          {item}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { Button, Badge, Progress, toast } from '@/components/ui'
import { Wand2, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { ProjectChapter } from '@/hooks/useProjectDetail'
import { formatLargeNumber } from '@/lib/utils'

type Strictness = 'light' | 'medium' | 'heavy'

interface ChapterResult {
  chapterId: number
  success: boolean
  originalScore: number
  revisedScore: number
  improvement: number
  changes: number
  error?: string
}

interface BatchDeslopPanelProps {
  projectId: number
  chapters: ProjectChapter[]
  onCompleted: () => void
}

const strictnessConfig: Record<Strictness, { label: string; desc: string }> = {
  light: { label: '轻度', desc: '只替换一级禁用词，保持原文结构' },
  medium: { label: '中度', desc: '替换所有禁用词，修正禁止模式' },
  heavy: { label: '重度', desc: '三遍去AI法：去词汇→改结构→加人味' },
}

export function BatchDeslopPanel({ projectId, chapters, onCompleted }: BatchDeslopPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [strictness, setStrictness] = useState<Strictness>('medium')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<ChapterResult[] | null>(null)
  const [expandedResults, setExpandedResults] = useState(false)

  const completableChapters = chapters.filter(c => c.status === 'COMPLETED' && c.content)

  const toggleChapter = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(completableChapters.map(c => c.id)))
  }, [completableChapters])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleBatchDeslop = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('请至少选择一章')
      return
    }

    setProcessing(true)
    setResults(null)
    setProgress(0)

    try {
      const res = await fetch('/api/novel/deslop/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          chapterIds: Array.from(selectedIds),
          strictness,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setResults(data.data.chapters)
        toast.success(`批量去AI味完成：${data.data.success} 成功 / ${data.data.failed} 失败`)
        onCompleted()
      } else {
        toast.error(data.error?.message || '批量处理失败')
      }
    } catch {
      toast.error('批量处理请求失败')
    } finally {
      setProcessing(false)
      setProgress(100)
    }
  }, [selectedIds, projectId, strictness, onCompleted])

  const successCount = results?.filter(r => r.success).length || 0
  const failCount = results?.filter(r => !r.success).length || 0

  return (
    <div className="space-y-6">
      {!results && (
        <>
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">选择需要处理的章节</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll} disabled={processing}>
                  全选
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll} disabled={processing}>
                  取消全选
                </Button>
              </div>
            </div>

            {completableChapters.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                没有已完成且有内容的章节可供处理
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg bg-white dark:bg-gray-900 p-2">
                {completableChapters.map(chapter => (
                  <label
                    key={chapter.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                      selectedIds.has(chapter.id)
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(chapter.id)}
                      onChange={() => toggleChapter(chapter.id)}
                      disabled={processing}
                      className="rounded border-gray-300"
                    />
                    <span className="flex-1 text-sm">第{chapter.chapterNumber}章 {chapter.title}</span>
                    <Badge variant="secondary" className="text-xs">
                      {formatLargeNumber(chapter.wordCount || 0)}字
                    </Badge>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-500">处理强度</label>
            <div className="flex gap-2">
              {(Object.keys(strictnessConfig) as Strictness[]).map(key => (
                <button
                  key={key}
                  onClick={() => setStrictness(key)}
                  disabled={processing}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
                    strictness === key
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">{strictnessConfig[key].label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{strictnessConfig[key].desc}</div>
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="primary"
            className="w-full"
            onClick={handleBatchDeslop}
            disabled={processing || selectedIds.size === 0}
          >
            {processing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />批量处理中...</>
            ) : (
              <><Wand2 className="h-4 w-4 mr-2" />开始批量去AI味（{selectedIds.size} 章）</>
            )}
          </Button>
        </>
      )}

      {processing && (
        <div className="space-y-3">
          <Progress value={50} max={100} size="sm" />
          <p className="text-sm text-gray-500 text-center">正在处理，请稍候...</p>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {successCount} 成功
              </div>
              {failCount > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-red-500">
                  <XCircle className="h-4 w-4" />
                  {failCount} 失败
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedResults(!expandedResults)}
            >
              {expandedResults ? '收起' : '展开'}明细
              {expandedResults ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </Button>
          </div>

          {expandedResults && (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {results.map((r, i) => {
                const chapter = chapters.find(c => c.id === r.chapterId)
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
                      r.success
                        ? 'border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20'
                        : 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {r.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span>
                        第{chapter?.chapterNumber || '?'}章
                        {chapter?.title ? ` ${chapter.title}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {r.success ? (
                        <>
                          <span className="text-gray-500">评分 {r.originalScore} → {r.revisedScore}</span>
                          <Badge variant="success">+{r.improvement}</Badge>
                          <span className="text-gray-400">{r.changes} 处变更</span>
                        </>
                      ) : (
                        <span className="text-red-500">{r.error || '处理失败'}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setResults(null)
              setSelectedIds(new Set())
            }}
          >
            重新选择
          </Button>
        </div>
      )}
    </div>
  )
}
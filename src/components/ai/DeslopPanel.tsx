'use client'

import { useState, useCallback } from 'react'
import { Button, Textarea, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { ScanSearch, Wand2, Loader2, AlertTriangle, CheckCircle2, ArrowRightLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

interface DeslopPanelProps {
  projectId: number
}

interface DetectResult {
  score: number
  forbiddenWords: { word: string; count: number; level: string }[]
  forbiddenPatterns: { pattern: string; description: string; matches: string[]; level: string }[]
}

interface DeslopChange {
  type: 'word' | 'pattern' | 'structure' | 'rhythm' | 'immersive'
  original: string
  revised: string
  reason: string
}

interface RewriteResult {
  originalContent: string
  revisedContent: string
  changes: DeslopChange[]
  aiScore: number
  tokens?: number
}

type Strictness = 'light' | 'medium' | 'heavy'

const strictnessConfig: Record<Strictness, { label: string; desc: string }> = {
  light: { label: '轻度', desc: '只替换一级禁用词，保持原文结构' },
  medium: { label: '中度', desc: '替换所有禁用词，修正禁止模式，增加口语化' },
  heavy: { label: '重度', desc: '三遍去AI法：去词汇→改结构→加人味' },
}

function ScoreRing({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 70) return 'text-green-500'
    if (s >= 40) return 'text-yellow-500'
    return 'text-red-500'
  }
  const getBgColor = (s: number) => {
    if (s >= 70) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    if (s >= 40) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
    return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
  }
  const getLabel = (s: number) => {
    if (s >= 70) return '人味足'
    if (s >= 40) return '有AI味'
    return 'AI味重'
  }

  return (
    <div className={`flex flex-col items-center gap-1 p-4 rounded-lg border ${getBgColor(score)}`}>
      <span className={`text-3xl font-bold ${getColor(score)}`}>{score}</span>
      <span className={`text-xs ${getColor(score)}`}>{getLabel(score)}</span>
    </div>
  )
}

export function DeslopPanel({ projectId }: DeslopPanelProps) {
  const [content, setContent] = useState('')
  const [strictness, setStrictness] = useState<Strictness>('medium')
  const [detecting, setDetecting] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null)
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null)
  const [expandedChanges, setExpandedChanges] = useState<Set<number>>(new Set())

  const handleDetect = useCallback(async () => {
    if (!content.trim()) {
      toast.error('请输入内容')
      return
    }

    setDetecting(true)
    setRewriteResult(null)
    try {
      const res = await fetch('/api/novel/deslop/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setDetectResult(data.data)
        toast.success('检测完成')
      } else {
        toast.error(data.error?.message || '检测失败')
      }
    } catch {
      toast.error('检测请求失败')
    } finally {
      setDetecting(false)
    }
  }, [content])

  const handleRewrite = useCallback(async () => {
    if (!content.trim()) {
      toast.error('请输入内容')
      return
    }

    setRewriting(true)
    try {
      const res = await fetch('/api/novel/deslop/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          content: content.trim(),
          strictness,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setRewriteResult(data.data)
        if (!detectResult) {
          try {
            const detectRes = await fetch('/api/novel/deslop/detect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: content.trim() }),
            })
            const detectData = await detectRes.json()
            if (detectData.success) {
              setDetectResult(detectData.data)
            }
          } catch {
            // detection is best-effort
          }
        }
        toast.success('改写完成')
      } else {
        toast.error(data.error?.message || '改写失败')
      }
    } catch {
      toast.error('改写请求失败')
    } finally {
      setRewriting(false)
    }
  }, [content, projectId, strictness, detectResult])

  const toggleChange = useCallback((index: number) => {
    setExpandedChanges(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const changeTypeConfig: Record<string, { label: string; color: string }> = {
    word: { label: '词汇', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    pattern: { label: '模式', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    structure: { label: '结构', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">去AI味工具</span>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-500">待检测内容</label>
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="粘贴需要去AI味的文本内容..."
            rows={6}
            className="text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-500">严格度</label>
          <div className="flex gap-2">
            {(Object.keys(strictnessConfig) as Strictness[]).map(key => (
              <button
                key={key}
                onClick={() => setStrictness(key)}
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

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleDetect}
            disabled={detecting || rewriting || !content.trim()}
          >
            {detecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                检测中...
              </>
            ) : (
              <>
                <ScanSearch className="h-4 w-4 mr-2" />
                检测AI味
              </>
            )}
          </Button>

          <Button
            variant="primary"
            onClick={handleRewrite}
            disabled={detecting || rewriting || !content.trim()}
          >
            {rewriting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                改写中...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                去AI味改写
              </>
            )}
          </Button>
        </div>
      </div>

      {detectResult && !rewriteResult && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">检测结果</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              <div className="flex justify-center">
                <ScoreRing score={detectResult.score} />
              </div>

              {detectResult.forbiddenWords.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    禁用词命中
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detectResult.forbiddenWords.map((fw, i) => (
                      <Badge
                        key={i}
                        className={
                          fw.level === 'critical'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }
                      >
                        {fw.word} ×{fw.count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {detectResult.forbiddenPatterns.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    禁止模式命中
                  </div>
                  <div className="space-y-2">
                    {detectResult.forbiddenPatterns.map((fp, i) => (
                      <div
                        key={i}
                        className={`text-sm p-2 rounded border ${
                          fp.level === 'critical'
                            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
                            : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/10'
                        }`}
                      >
                        <div className="font-medium">{fp.pattern}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{fp.description}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          命中：{fp.matches.join('；')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detectResult.forbiddenWords.length === 0 && detectResult.forbiddenPatterns.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 justify-center py-2">
                  <CheckCircle2 className="h-4 w-4" />
                  未检测到明显AI味问题
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {rewriteResult && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">改写结果</CardTitle>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span>改写前</span>
                    <ScoreRing score={detectResult?.score ?? 0} />
                  </div>
                  <ArrowRightLeft className="h-4 w-4 text-gray-400" />
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span>改写后</span>
                    <ScoreRing score={rewriteResult.aiScore} />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-500">原文</div>
                  <div className="text-sm p-3 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-80 overflow-y-auto whitespace-pre-wrap">
                    {rewriteResult.originalContent}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-500">改写文</div>
                  <div className="text-sm p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg max-h-80 overflow-y-auto whitespace-pre-wrap">
                    {rewriteResult.revisedContent}
                  </div>
                </div>
              </div>

              {rewriteResult.changes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    变更列表（{rewriteResult.changes.length} 处）
                  </div>
                  <div className="space-y-2">
                    {rewriteResult.changes.map((change, i) => (
                      <div
                        key={i}
                        className="border rounded-lg overflow-hidden"
                      >
                        <button
                          onClick={() => toggleChange(i)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Badge className={changeTypeConfig[change.type]?.color || changeTypeConfig.word.color}>
                              {changeTypeConfig[change.type]?.label || '词汇'}
                            </Badge>
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-xs">
                              {change.original}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="text-sm text-blue-600 dark:text-blue-400 truncate max-w-xs">
                              {change.revised}
                            </span>
                          </div>
                          {expandedChanges.has(i) ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                        {expandedChanges.has(i) && (
                          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-600 dark:text-gray-400 border-t">
                            {change.reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setContent(rewriteResult.revisedContent)
                    setRewriteResult(null)
                    setDetectResult(null)
                    toast.success('已将改写结果填入输入区')
                  }}
                >
                  使用改写结果
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

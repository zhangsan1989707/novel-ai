'use client'

import { useState, useCallback } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import {
  Shield,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ScanEye,
  Search,
} from 'lucide-react'

interface SuspiciousWord {
  word: string
  count: number
  level: string
}

interface SuspiciousPattern {
  pattern: string
  matches: string[]
}

interface DetectResult {
  score: number
  verdict: string
  layers: {
    rule: {
      score: number
      verdict: string
      suspiciousWords: SuspiciousWord[]
      suspiciousPatterns: SuspiciousPattern[]
      totalForbiddenCount: number
      criticalCount: number
      warningCount: number
    }
    statistical: {
      score: number
      perplexity: Record<string, any>
    }
  }
  details: {
    suspiciousWords: SuspiciousWord[]
    suspiciousPatterns: SuspiciousPattern[]
    uniformSegments: any[]
  }
  suggestions: string[]
}

interface RewriteChange {
  type: string
  original: string
  revised: string
  strategy: string
}

interface RewriteResult {
  originalText: string
  rewrittenText: string
  strategies: string[]
  changes: RewriteChange[]
  scores: {
    before: number
    after: number
    reduced: number
  }
  verdicts: {
    before: string
    after: string
  }
}

interface AntiDetectPanelProps {
  content: string
  chapterId?: number
  onRewriteComplete?: (rewrittenContent: string) => void
}

const verdictLabels: Record<string, { label: string; color: string }> = {
  human: { label: '人类写作', color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30' },
  likely_human: { label: '可能人类', color: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20' },
  uncertain: { label: '不确定', color: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30' },
  likely_ai: { label: '疑似AI', color: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30' },
  ai: { label: 'AI生成', color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30' },
}

function ScoreRing({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const getColor = (s: number) => {
    const reverseScore = 100 - s
    if (reverseScore >= 70) return { bg: 'bg-green-500', text: 'text-green-500', ring: 'rgba(34, 197, 94, 0.2)' }
    if (reverseScore >= 40) return { bg: 'bg-yellow-500', text: 'text-yellow-500', ring: 'rgba(234, 179, 8, 0.2)' }
    return { bg: 'bg-red-500', text: 'text-red-500', ring: 'rgba(239, 68, 68, 0.2)' }
  }

  const colors = getColor(score)
  const sizeClasses = size === 'sm' ? 'w-12 h-12' : size === 'lg' ? 'w-20 h-20' : 'w-16 h-16'
  const textSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-2xl'

  return (
    <div className={`relative ${sizeClasses}`}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke={colors.ring}
          strokeWidth="3"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke={colors.bg}
          strokeWidth="3"
          strokeDasharray={`${score}, 100`}
          strokeLinecap="round"
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center ${colors.text} font-bold ${textSize}`}>
        {score}
      </div>
    </div>
  )
}

export function AntiDetectPanel({ content, chapterId, onRewriteComplete }: AntiDetectPanelProps) {
  const [loading, setLoading] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null)
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null)
  const [intensity, setIntensity] = useState<'light' | 'medium' | 'heavy'>('medium')
  const [showDiff, setShowDiff] = useState(false)
  const [expandedWarnings, setExpandedWarnings] = useState<Set<string>>(new Set())

  const analyze = useCallback(async () => {
    if (!content.trim()) return

    setLoading(true)
    setDetectResult(null)
    setRewriteResult(null)
    try {
      const res = await fetch('/api/novel/anti-detect/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (data.success) {
        setDetectResult(data.data)
      } else {
        toast.error(data.error?.message || '检测失败')
      }
    } catch (error) {
      console.error('AI检测失败:', error)
      toast.error('AI检测请求失败')
    } finally {
      setLoading(false)
    }
  }, [content])

  const rewrite = useCallback(async () => {
    if (!content.trim()) return

    setRewriting(true)
    setRewriteResult(null)
    try {
      const res = await fetch('/api/novel/anti-detect/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, intensity }),
      })
      const data = await res.json()
      if (data.success) {
        setRewriteResult(data.data)
        toast.success('改写完成')
      } else {
        toast.error(data.error?.message || '改写失败')
      }
    } catch (error) {
      console.error('改写失败:', error)
      toast.error('改写请求失败')
    } finally {
      setRewriting(false)
    }
  }, [content, intensity])

  const applyRewrite = useCallback(() => {
    if (!rewriteResult) return
    onRewriteComplete?.(rewriteResult.rewrittenText)
    toast.success('已应用改写结果')
  }, [rewriteResult, onRewriteComplete])

  const toggleWarning = (key: string) => {
    setExpandedWarnings(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const intensityConfig = {
    light: { label: '轻度', desc: '俚改', color: 'border-green-500 bg-green-50 dark:bg-green-900/20' },
    medium: { label: '中度', desc: '改写', color: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' },
    heavy: { label: '重度', desc: '重写', color: 'border-red-500 bg-red-50 dark:bg-red-900/20' },
  }

  const verdict = detectResult ? (verdictLabels[detectResult.verdict] || verdictLabels.uncertain) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold">AI 反检测分析</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={analyze}
          disabled={loading || !content.trim()}
        >
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          {loading ? '检测中...' : detectResult ? '重新检测' : '开始检测'}
        </Button>
      </div>

      {detectResult ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">AI 检测评分</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <ScoreRing score={detectResult.score} size="lg" />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">裁决结果：</span>
                    <Badge className={verdict?.color}>{verdict?.label}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">规则层评分</p>
                      <p className="text-lg font-bold">{detectResult.layers.rule.score}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">统计层评分</p>
                      <p className="text-lg font-bold">{detectResult.layers.statistical.score}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">禁用词</p>
                      <p className="text-lg font-bold">{detectResult.layers.rule.totalForbiddenCount}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">警示词</p>
                      <p className="text-lg font-bold">{detectResult.layers.rule.warningCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {detectResult.details.suspiciousWords.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  可疑词汇 ({detectResult.details.suspiciousWords.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {detectResult.details.suspiciousWords.map((word, index) => {
                    const isCritical = word.level === 'critical'
                    return (
                      <Badge
                        key={index}
                        className={
                          isCritical
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }
                      >
                        {word.word} ×{word.count}
                      </Badge>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {detectResult.details.suspiciousPatterns.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Search className="h-4 w-4 text-purple-500" />
                  可疑模式 ({detectResult.details.suspiciousPatterns.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {detectResult.details.suspiciousPatterns.map((pattern, index) => {
                  const key = `pattern-${index}`
                  return (
                    <div key={key} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleWarning(key)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <span className="text-sm font-medium">{pattern.pattern}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{pattern.matches.length} 处匹配</span>
                          {expandedWarnings.has(key) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </button>
                      {expandedWarnings.has(key) && (
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-600 dark:text-gray-400 border-t">
                          {pattern.matches.slice(0, 5).map((match, mi) => (
                            <span key={mi} className="inline-block mr-2 mb-1 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                              {match}
                            </span>
                          ))}
                          {pattern.matches.length > 5 && (
                            <span className="text-gray-400">...等 {pattern.matches.length - 5} 处</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {detectResult.suggestions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ScanEye className="h-4 w-4 text-blue-500" />
                  优化建议
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {detectResult.suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {detectResult.score >= 15 && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  一键降AI检测
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-500">改写强度</label>
                  <div className="flex gap-2">
                    {(['light', 'medium', 'heavy'] as const).map(level => (
                      <button
                        key={level}
                        onClick={() => setIntensity(level)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-all ${
                          intensity === level
                            ? `${intensityConfig[level].color} border-2`
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-medium">{intensityConfig[level].label}</div>
                        <div className="text-xs opacity-70">{intensityConfig[level].desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={rewrite}
                  disabled={rewriting}
                >
                  {rewriting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />改写中...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" />去AI味改写</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>点击"开始检测"分析AI生成特征</p>
          </CardContent>
        </Card>
      )}

      {rewriteResult && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                改写完成
              </CardTitle>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">AI评分：</span>
                <span className="font-bold text-red-500">{rewriteResult.scores.before}</span>
                <ArrowRight className="h-4 w-4" />
                <span className="font-bold text-green-600">{rewriteResult.scores.after}</span>
                <Badge variant="success">-{rewriteResult.scores.reduced}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">裁决：</span>
              <Badge className={(verdictLabels[rewriteResult.verdicts.before] || verdictLabels.uncertain).color}>
                {verdictLabels[rewriteResult.verdicts.before]?.label || rewriteResult.verdicts.before}
              </Badge>
              <ArrowRight className="h-4 w-4" />
              <Badge className={(verdictLabels[rewriteResult.verdicts.after] || verdictLabels.uncertain).color}>
                {verdictLabels[rewriteResult.verdicts.after]?.label || rewriteResult.verdicts.after}
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline">策略 {rewriteResult.strategies.length}</Badge>
              <Badge variant="outline">变更 {rewriteResult.changes.length}</Badge>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDiff(!showDiff)}
              >
                {showDiff ? '隐藏' : '查看'}对比
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={applyRewrite}
              >
                应用改写结果
              </Button>
            </div>

            {showDiff && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-500">原文</div>
                  <div className="text-sm p-3 bg-red-50 dark:bg-red-900/10 rounded-lg max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {rewriteResult.originalText}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-500">改写后</div>
                  <div className="text-sm p-3 bg-green-50 dark:bg-green-900/10 rounded-lg max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {rewriteResult.rewrittenText}
                  </div>
                </div>
              </div>
            )}

            {showDiff && rewriteResult.changes.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500">变更明细</div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {rewriteResult.changes.map((change, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <Badge className="text-xs shrink-0">{change.strategy}</Badge>
                      <span className="text-red-500 line-through">{change.original}</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                      <span className="text-green-600">{change.revised}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
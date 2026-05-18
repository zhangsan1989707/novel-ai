'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { 
  Sparkles, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp,
  Zap,
  RefreshCw,
  FileText,
  TrendingUp,
  Music,
  Eye,
} from 'lucide-react'

// ============================================
// 类型定义
// ============================================

interface ChapterQualityReport {
  overallScore: number
  dimensions: DimensionScore[]
  aiIndicators: {
    wordScore: number
    patternScore: number
    structureScore: number
    rhythmScore: number
    immersiveScore: number
  }
  issues: Issue[]
  suggestions: string[]
  statistics: {
    totalWords: number
    totalParagraphs: number
    totalSentences: number
    avgParagraphLength: number
    avgSentenceLength: number
    dialogueRatio: number
    descriptionRatio: number
    adverbDensity: number
  }
}

interface DimensionScore {
  name: string
  score: number
  weight: number
  issues: Issue[]
  suggestions: string[]
}

interface Issue {
  type: 'word' | 'pattern' | 'structure' | 'rhythm' | 'dialogue' | 'immersive'
  severity: 'critical' | 'warning' | 'info'
  description: string
  location?: string
  suggestion?: string
}

interface OptimizeResult {
  chapterId: number
  originalContent: string
  revisedContent: string
  changes: DeslopChange[]
  originalScore: number
  revisedScore: number
  improvement: number
  qualityReport: ChapterQualityReport
  autoApplied: boolean
}

interface DeslopChange {
  type: 'word' | 'pattern' | 'structure' | 'rhythm' | 'immersive'
  original: string
  revised: string
  reason: string
}

interface ChapterQualityPanelProps {
  projectId: number
  chapterId: number
  chapterNumber: number
  chapterTitle: string
  content: string
  onOptimizeComplete?: (revisedContent: string) => void
  autoAnalyze?: boolean
}

// ============================================
// 组件
// ============================================

const dimensionIcons: Record<string, React.ReactNode> = {
  '词汇自然度': <FileText className="h-4 w-4" />,
  '模式多样性': <TrendingUp className="h-4 w-4" />,
  '结构变化': <TrendingUp className="h-4 w-4" />,
  '节奏韵律': <Music className="h-4 w-4" />,
  '沉浸体验': <Eye className="h-4 w-4" />,
}

const issueTypeColors: Record<string, string> = {
  word: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pattern: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  structure: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  rhythm: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  immersive: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  dialogue: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
}

function ScoreRing({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const getColor = (s: number) => {
    if (s >= 70) return { bg: 'bg-green-500', text: 'text-green-500', ring: 'rgba(34, 197, 94, 0.2)' }
    if (s >= 40) return { bg: 'bg-yellow-500', text: 'text-yellow-500', ring: 'rgba(234, 179, 8, 0.2)' }
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

function DimensionBar({ name, score, icon }: { name: string; score: number; icon: React.ReactNode }) {
  const getColor = (s: number) => {
    if (s >= 70) return 'bg-green-500'
    if (s >= 40) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 flex items-center justify-center text-gray-500">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-700 dark:text-gray-300">{name}</span>
          <span className="text-sm font-medium">{score}</span>
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full ${getColor(score)} rounded-full transition-all duration-500`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function ChapterQualityPanel({ 
  projectId, 
  chapterId, 
  chapterNumber,
  chapterTitle,
  content,
  onOptimizeComplete,
  autoAnalyze = false 
}: ChapterQualityPanelProps) {
  const [loading, setLoading] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [report, setReport] = useState<ChapterQualityReport | null>(null)
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null)
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set())
  const [showDiff, setShowDiff] = useState(false)
  const [strictness, setStrictness] = useState<'light' | 'medium' | 'heavy'>('medium')

  // 分析章节质量
  const analyzeChapter = useCallback(async () => {
    if (!content.trim()) return

    setLoading(true)
    try {
      const res = await fetch('/api/novel/ai/chapter-quality/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, content }),
      })
      const data = await res.json()
      if (data.success) {
        setReport(data.data)
      }
    } catch (error) {
      console.error('分析失败:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId, content])

  // 自动分析
  useEffect(() => {
    if (autoAnalyze && content.length > 100 && !report) {
      analyzeChapter()
    }
  }, [autoAnalyze, content, analyzeChapter, report])

  // 优化章节
  const optimizeChapter = useCallback(async () => {
    if (!content.trim()) return

    setOptimizing(true)
    try {
      const res = await fetch('/api/novel/ai/chapter-quality/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          chapterId,
          strictness,
          autoSave: false,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setOptimizeResult(data.data)
      }
    } catch (error) {
      console.error('优化失败:', error)
    } finally {
      setOptimizing(false)
    }
  }, [projectId, chapterId, strictness, content])

  // 应用优化结果
  const applyOptimize = useCallback(async () => {
    if (!optimizeResult) return

    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: optimizeResult.revisedContent,
        }),
      })
      const data = await res.json()
      if (data.success) {
        onOptimizeComplete?.(optimizeResult.revisedContent)
        setOptimizeResult(null)
        setReport(optimizeResult.qualityReport)
      } else {
        console.error('保存失败:', data.error?.message)
      }
    } catch (err) {
      console.error('保存失败:', err)
    }
  }, [projectId, chapterId, optimizeResult, onOptimizeComplete])

  const toggleIssue = (index: number) => {
    setExpandedIssues(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const strictnessConfig = {
    light: { label: '轻度', desc: '仅替换AI词', color: 'border-green-500 bg-green-50 dark:bg-green-900/20' },
    medium: { label: '中度', desc: '替换+调结构', color: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' },
    heavy: { label: '重度', desc: '全面改写', color: 'border-red-500 bg-red-50 dark:bg-red-900/20' },
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold">章节AI质量分析</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={analyzeChapter}
          disabled={loading || !content.trim()}
        >
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          {loading ? '分析中...' : '重新分析'}
        </Button>
      </div>

      {/* 分析结果 */}
      {report ? (
        <div className="space-y-4">
          {/* 总体评分 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">总体评分</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <ScoreRing score={report.overallScore} size="lg" />
                <div className="flex-1 space-y-2">
                  {report.dimensions.map((dim) => (
                    <DimensionBar 
                      key={dim.name}
                      name={dim.name} 
                      score={dim.score} 
                      icon={dimensionIcons[dim.name]} 
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 统计数据 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">章节统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                  <p className="text-lg font-bold">{report.statistics.totalWords.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">总字数</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                  <p className="text-lg font-bold">{report.statistics.totalParagraphs}</p>
                  <p className="text-xs text-gray-500">段落数</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                  <p className="text-lg font-bold">{report.statistics.dialogueRatio}%</p>
                  <p className="text-xs text-gray-500">对话占比</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                  <p className="text-lg font-bold">{report.statistics.adverbDensity.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">副词密度</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 问题列表 */}
          {report.issues.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  发现问题 ({report.issues.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.issues.slice(0, 5).map((issue, index) => (
                  <div key={index} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleIssue(index)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${issueTypeColors[issue.type] || issueTypeColors.word}`}>
                          {issue.type}
                        </Badge>
                        <span className="text-sm">{issue.description}</span>
                      </div>
                      {expandedIssues.has(index) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expandedIssues.has(index) && issue.suggestion && (
                      <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/10 text-xs text-blue-700 dark:text-blue-400 border-t">
                        💡 {issue.suggestion}
                      </div>
                    )}
                  </div>
                ))}
                {report.issues.length > 5 && (
                  <p className="text-xs text-gray-500 text-center">还有 {report.issues.length - 5} 个问题...</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* 优化建议 */}
          {report.suggestions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  优化建议
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {report.suggestions.slice(0, 5).map((suggestion, index) => (
                    <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* 优化操作 */}
          {report.overallScore < 70 && (
            <Card className="border-purple-200 dark:border-purple-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  一键优化
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 严格度选择 */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-500">优化强度</label>
                  <div className="flex gap-2">
                    {(['light', 'medium', 'heavy'] as const).map(level => (
                      <button
                        key={level}
                        onClick={() => setStrictness(level)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-all ${
                          strictness === level
                            ? `${strictnessConfig[level].color} border-2`
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-medium">{strictnessConfig[level].label}</div>
                        <div className="text-xs opacity-70">{strictnessConfig[level].desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={optimizeChapter}
                  disabled={optimizing}
                >
                  {optimizing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />优化中...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" />去AI味优化</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>点击"重新分析"开始检测章节AI质量</p>
          </CardContent>
        </Card>
      )}

      {/* 优化结果 */}
      {optimizeResult && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                优化完成
              </CardTitle>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">评分：</span>
                <span className="font-bold">{optimizeResult.originalScore}</span>
                <ArrowRight className="h-4 w-4" />
                <span className="font-bold text-green-600">{optimizeResult.revisedScore}</span>
                <Badge variant="success">+{optimizeResult.improvement}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline">词汇 {optimizeResult.changes.filter(c => c.type === 'word').length}</Badge>
              <Badge variant="outline">模式 {optimizeResult.changes.filter(c => c.type === 'pattern').length}</Badge>
              <Badge variant="outline">结构 {optimizeResult.changes.filter(c => c.type === 'structure').length}</Badge>
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
                onClick={applyOptimize}
              >
                应用优化结果
              </Button>
            </div>

            {showDiff && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-500">原文</div>
                  <div className="text-sm p-3 bg-red-50 dark:bg-red-900/10 rounded-lg max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {optimizeResult.originalContent}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-500">优化后</div>
                  <div className="text-sm p-3 bg-green-50 dark:bg-green-900/10 rounded-lg max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {optimizeResult.revisedContent}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

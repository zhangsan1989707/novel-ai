'use client'

import { useState, useRef, useCallback } from 'react'
import { Button, Select, Badge } from '@/components/ui'
import { Sparkles, BookOpen, AlertCircle, X, Loader2 } from 'lucide-react'
import { AnalysisDimension } from '@/types'
import { ANALYSIS_DIMENSION_DESCRIPTIONS, DEFAULT_ANALYSIS_DIMENSIONS, ANALYSIS_DIMENSION_LABELS } from '@/lib/analysis/config'

interface PlotAnalyzerProps {
  projectId: number
  projectTitle: string
  totalVolumes?: number
  onAnalysisComplete?: (results: AnalysisResult[]) => void
}

interface AnalysisResult {
  dimension: AnalysisDimension
  analysisData: Record<string, unknown>
  rawContent: string
}

const dimensionOptions = DEFAULT_ANALYSIS_DIMENSIONS.map((value) => ({
  value,
  label: ANALYSIS_DIMENSION_LABELS[value],
}))

export function PlotAnalyzer({
  projectId,
  projectTitle,
  totalVolumes = 4,
  onAnalysisComplete,
}: PlotAnalyzerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentProgress, setCurrentProgress] = useState<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)

  // 粒度选择
  const [volumeNumber, setVolumeNumber] = useState<string>('-1') // -1=整书
  const [selectedDimensions, setSelectedDimensions] = useState<AnalysisDimension[]>(DEFAULT_ANALYSIS_DIMENSIONS)
  const [contextChapterCount, setContextChapterCount] = useState<string>('3')

  // 切换维度选择
  const toggleDimension = (dim: AnalysisDimension) => {
    setSelectedDimensions(prev =>
      prev.includes(dim)
        ? prev.filter(d => d !== dim)
        : [...prev, dim]
    )
  }

  // 全选/取消全选
  const selectAll = () => {
    if (selectedDimensions.length === dimensionOptions.length) {
      setSelectedDimensions([])
    } else {
      setSelectedDimensions(dimensionOptions.map(d => d.value))
    }
  }

  // 取消分析
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setLoading(false)
    setCurrentProgress('')
  }, [])

  // 执行分析
  const handleAnalyze = async () => {
    if (selectedDimensions.length === 0) {
      setError('请至少选择一个分析维度')
      return
    }

    setLoading(true)
    setError('')
    setResults([])
    setCurrentProgress('正在准备分析...')

    // 创建 abort controller
    abortControllerRef.current = new AbortController()

    try {
      setCurrentProgress(`正在分析 ${selectedDimensions.length} 个维度...`)

      const res = await fetch('/api/novel/ai/analyze-plot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          volumeNumber: parseInt(volumeNumber, 10),
          dimensions: selectedDimensions,
          contextChapterCount: parseInt(contextChapterCount, 10),
        }),
        signal: abortControllerRef.current.signal,
      })

      const data = await res.json()

      if (data.success) {
        setResults(data.data.results)
        setCurrentProgress('分析完成！')
        setTimeout(() => setCurrentProgress(''), 2000)
        onAnalysisComplete?.(data.data.results)
      } else {
        setError(data.error?.message || '分析失败')
        setCurrentProgress('')
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setCurrentProgress('分析已取消')
        setTimeout(() => setCurrentProgress(''), 2000)
      } else {
        setError('网络错误，请重试')
        setCurrentProgress('')
      }
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  // 粒度选项
  const volumeOptions = [
    { value: '-1', label: '整书分析' },
    { value: '0', label: '全卷分析' },
    ...Array.from({ length: totalVolumes }, (_, i) => ({
      value: String(i + 1),
      label: `第${i + 1}卷`,
    })),
  ]

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-secondary" />
        <span className="font-medium text-lg">小说拆书分析</span>
      </div>

      {/* 分析范围 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">分析范围</label>
        <Select
          value={volumeNumber}
          onChange={(e) => setVolumeNumber(e.target.value)}
          options={volumeOptions}
        />
        <p className="text-xs text-muted-foreground">
          {volumeNumber === '-1'
            ? '将对整本书进行综合分析'
            : volumeNumber === '0'
            ? '将对所有卷进行综合分析'
            : `将只分析第${volumeNumber}卷的内容`}
        </p>
      </div>

      {/* 分析维度 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">分析维度</label>
          <Button variant="ghost" size="sm" onClick={selectAll}>
            {selectedDimensions.length === dimensionOptions.length ? '取消全选' : '全选'}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {dimensionOptions.map(option => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all duration-150 ${
                selectedDimensions.includes(option.value)
                  ? 'border-secondary bg-secondary/5 dark:bg-secondary/10'
                  : 'border-border hover:border-secondary/50'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedDimensions.includes(option.value)}
                onChange={() => toggleDimension(option.value)}
                className="mt-1 w-4 h-4 accent-secondary"
              />
              <div>
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs text-muted-foreground">
                  {ANALYSIS_DIMENSION_DESCRIPTIONS[option.value]}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 上下文设置 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">上下文范围</label>
        <Select
          value={contextChapterCount}
          onChange={(e) => setContextChapterCount(e.target.value)}
          options={[
            { value: '1', label: '最近 1 章' },
            { value: '3', label: '最近 3 章' },
            { value: '5', label: '最近 5 章' },
            { value: '10', label: '最近 10 章' },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          AI 将参考最近 N 章内容进行分析
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-danger/10 text-danger rounded-lg" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* 进度指示 */}
      {loading && currentProgress && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 text-primary rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{currentProgress}</span>
          <Button variant="ghost" size="sm" onClick={handleCancel} className="ml-auto">
            <X className="h-4 w-4 mr-1" />
            取消
          </Button>
        </div>
      )}

      {/* 分析结果预览 */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">分析结果</span>
            <Badge variant="secondary">
              {results.length} 个维度
            </Badge>
          </div>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={index}
                className="p-3 border border-border rounded-lg"
              >
                <div className="font-medium text-sm mb-1">
                  {dimensionOptions.find(d => d.value === result.dimension)?.label}
                </div>
                <pre className="text-xs text-muted-foreground overflow-auto max-h-40">
                  {JSON.stringify(result.analysisData, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 执行按钮 */}
      <div className="flex justify-end">
        {loading ? (
          <Button variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            取消分析
          </Button>
        ) : (
          <Button
            onClick={handleAnalyze}
            disabled={selectedDimensions.length === 0}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            开始分析
          </Button>
        )}
      </div>
    </div>
  )
}

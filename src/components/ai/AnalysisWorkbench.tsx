'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui'
import { AnalysisDimension } from '@/types'
import { ANALYSIS_DIMENSION_DESCRIPTIONS, ANALYSIS_DIMENSION_LABELS, DEFAULT_ANALYSIS_DIMENSIONS } from '@/lib/analysis/config'
import { AnalysisTaskPanel } from './AnalysisTaskPanel'
import { BookAnalysisPanel } from './BookAnalysisPanel'

interface AnalysisWorkbenchProps {
  projectId: number
  totalVolumes?: number
}

export function AnalysisWorkbench({ projectId, totalVolumes = 4 }: AnalysisWorkbenchProps) {
  const [volumeNumber, setVolumeNumber] = useState('-1')
  const [contextChapterCount, setContextChapterCount] = useState('3')
  const [selectedDimensions, setSelectedDimensions] = useState<AnalysisDimension[]>(DEFAULT_ANALYSIS_DIMENSIONS)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [refreshSeed, setRefreshSeed] = useState(0)

  const toggleDimension = (dimension: AnalysisDimension) => {
    setSelectedDimensions(prev =>
      prev.includes(dimension)
        ? prev.filter(item => item !== dimension)
        : [...prev, dimension]
    )
  }

  const handleStart = async () => {
    if (selectedDimensions.length === 0) {
      setError('请至少选择一个分析模块')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/analysis-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volumeNumber: parseInt(volumeNumber, 10),
          contextChapterCount: parseInt(contextChapterCount, 10),
          dimensions: selectedDimensions,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error?.message || '启动分析失败')
        return
      }
      setRefreshSeed(prev => prev + 1)
    } catch {
      setError('启动分析失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-600" />
          <div>
            <div className="font-medium">拆书分析配置</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">统一从这里发起整书或分卷分析，结果会进入下方工作台。</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">分析范围</label>
            <select
              value={volumeNumber}
              onChange={(e) => setVolumeNumber(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="-1">整书分析</option>
              <option value="0">全卷综合</option>
              {Array.from({ length: totalVolumes }, (_, index) => (
                <option key={index} value={String(index + 1)}>
                  第{index + 1}卷
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">补充上下文</label>
            <select
              value={contextChapterCount}
              onChange={(e) => setContextChapterCount(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="1">最近 1 章</option>
              <option value="3">最近 3 章</option>
              <option value="5">最近 5 章</option>
              <option value="10">最近 10 章</option>
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">分析模块</label>
            <button
              type="button"
              onClick={() => setSelectedDimensions(
                selectedDimensions.length === DEFAULT_ANALYSIS_DIMENSIONS.length
                  ? []
                  : DEFAULT_ANALYSIS_DIMENSIONS
              )}
              className="text-xs text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400"
            >
              {selectedDimensions.length === DEFAULT_ANALYSIS_DIMENSIONS.length ? '取消全选' : '全选'}
            </button>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {DEFAULT_ANALYSIS_DIMENSIONS.map((dimension) => (
              <label
                key={dimension}
                className={`cursor-pointer rounded-xl border px-3 py-3 transition-colors ${
                  selectedDimensions.includes(dimension)
                    ? 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20'
                    : 'border-gray-200 dark:border-gray-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedDimensions.includes(dimension)}
                    onChange={() => toggleDimension(dimension)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">{ANALYSIS_DIMENSION_LABELS[dimension]}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{ANALYSIS_DIMENSION_DESCRIPTIONS[dimension]}</div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button onClick={handleStart} loading={submitting}>
            <Sparkles className="mr-2 h-4 w-4" />
            开始拆书分析
          </Button>
        </div>
      </div>

      <AnalysisTaskPanel projectId={projectId} onTaskComplete={() => setRefreshSeed(prev => prev + 1)} />
      <BookAnalysisPanel projectId={projectId} refreshSeed={refreshSeed} />
    </div>
  )
}

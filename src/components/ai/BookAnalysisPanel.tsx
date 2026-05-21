'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Gauge,
  Layers3,
  MoveHorizontal,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import { AnalysisDimension, BookAnalysis } from '@/types'
import { ChapterRhythmHeatmap } from '@/components/ai/ChapterRhythmHeatmap'
import { ANALYSIS_DIMENSION_LABELS } from '@/lib/analysis/config'
import { buildChapterGraph, type ChapterGraph } from '@/lib/analysis/chapter-graph'

interface BookAnalysisPanelProps {
  projectId: number
  refreshSeed?: number
  navigationRequest?: {
    id: number
    sectionId?: string
    dimension?: AnalysisDimension
    chapterNo?: number
    anchorId?: string
  } | null
}

interface ReadingExperienceData {
  scores?: Record<string, number>
  readingFeel?: {
    hookSummary?: string
    wowPointSummary?: string
    fatigueSummary?: string
    chapterEndingSummary?: string
  }
  highlightChapters?: Array<{ chapter?: number; reason?: string }>
  fatigueChapters?: Array<{ chapterRange?: string; reason?: string }>
  readerTakeaway?: string
}

const scoreLabels: Record<string, string> = {
  openingHook: '开篇抓力',
  pacing: '节奏推进',
  immersion: '沉浸感',
  chapterEndingHook: '章尾钩子',
  readerRetention: '追读驱动',
}

export function BookAnalysisPanel({ projectId, refreshSeed = 0, navigationRequest = null }: BookAnalysisPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analyses, setAnalyses] = useState<BookAnalysis[]>([])
  const [expandedVolumes, setExpandedVolumes] = useState<Set<number>>(new Set([-1]))
  const [filterDimension, setFilterDimension] = useState<AnalysisDimension | 'all'>('all')
  const [focusedAnchor, setFocusedAnchor] = useState<string | null>(null)
  const [selectedChapterNo, setSelectedChapterNo] = useState<number | null>(null)
  const [chapterGraph, setChapterGraph] = useState<ChapterGraph>({ nodes: [], highConfidenceCount: 0, lowConfidenceCount: 0 })
  const volumeNumbers = useMemo(
    () => Array.from(new Set(analyses.map(item => item.volumeNumber))).sort((a, b) => a - b),
    [analyses]
  )

  const loadAnalyses = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('dimension', filterDimension)
      const res = await fetch(`/api/novel/projects/${projectId}/book-analysis?${params}`)
      const data = await res.json()
      if (data.success) {
        setAnalyses(data.data)
      } else {
        setError(data.error?.message || '加载失败')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }, [filterDimension, projectId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAnalyses()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadAnalyses, refreshSeed])

  const groupedByVolume = useMemo(() => {
    return analyses.reduce((acc, analysis) => {
      const vol = analysis.volumeNumber
      if (!acc[vol]) acc[vol] = []
      acc[vol].push(analysis)
      return acc
    }, {} as Record<number, BookAnalysis[]>)
  }, [analyses])

  const analysisMap = useMemo(() => {
    const map = new Map<string, BookAnalysis>()
    analyses.forEach(item => {
      map.set(`${item.volumeNumber}:${item.dimension}`, item)
    })
    return map
  }, [analyses])

  const storyOverview = useMemo(
    () => (analysisMap.get(`-1:${AnalysisDimension.STORY_OVERVIEW}`)?.analysisData || {}) as Record<string, unknown>,
    [analysisMap]
  )
  const readingExperience = useMemo(
    () => (analysisMap.get(`-1:${AnalysisDimension.READING_EXPERIENCE}`)?.analysisData || {}) as ReadingExperienceData,
    [analysisMap]
  )
  const characterRelation = useMemo(
    () => (analysisMap.get(`-1:${AnalysisDimension.CHARACTER_RELATION}`)?.analysisData || {}) as Record<string, unknown>,
    [analysisMap]
  )
  const plotLine = useMemo(
    () => (analysisMap.get(`-1:${AnalysisDimension.PLOT_LINE}`)?.analysisData || {}) as Record<string, unknown>,
    [analysisMap]
  )
  const foreshadowing = useMemo(
    () => (analysisMap.get(`-1:${AnalysisDimension.FORESHADOWING}`)?.analysisData || {}) as Record<string, unknown>,
    [analysisMap]
  )
  const chapterStructure = useMemo(
    () => (analysisMap.get(`-1:${AnalysisDimension.CHAPTER_STRUCTURE}`)?.analysisData || {}) as Record<string, unknown>,
    [analysisMap]
  )
  const worldSetting = useMemo(
    () => (analysisMap.get(`-1:${AnalysisDimension.WORLD_SETTING}`)?.analysisData || {}) as Record<string, unknown>,
    [analysisMap]
  )
  
  useEffect(() => {
    let cancelled = false
    async function loadChapterGraph() {
      try {
        const res = await fetch(`/api/novel/projects/${projectId}/chapter-graph`)
        const data = await res.json()
        if (!cancelled && data.success) {
          setChapterGraph(data.data.graph)
          return
        }
      } catch {
        // 失败时回退到前端拼装
      }

      if (!cancelled) {
        setChapterGraph(buildChapterGraph({
          storyOverview,
          chapterStructure,
          plotLine,
          foreshadowing,
          readingExperience,
          worldSetting,
        }))
      }
    }

    loadChapterGraph()
    return () => {
      cancelled = true
    }
  }, [chapterStructure, foreshadowing, plotLine, projectId, readingExperience, storyOverview, worldSetting])

  const missingModules = analyses.length > 0
    ? Object.values(AnalysisDimension).filter((dimension) => !analysisMap.has(`-1:${dimension}`))
    : []
  const emptyModules = analyses
    .filter(item => item.volumeNumber === -1)
    .filter(item => {
      const value = item.analysisData as Record<string, unknown>
      return Object.keys(value || {}).length === 0
    })
    .map(item => item.dimension as AnalysisDimension)

  const topCharacters = Array.isArray(characterRelation.characters)
    ? [...(characterRelation.characters as Array<Record<string, unknown>>)]
      .sort((a, b) => Number(a.importance || 999) - Number(b.importance || 999))
      .slice(0, 5)
    : []

  const toggleVolume = (vol: number) => {
    setExpandedVolumes(prev => {
      const next = new Set(prev)
      if (next.has(vol)) next.delete(vol)
      else next.add(vol)
      return next
    })
  }

  const expandAllVolumes = () => {
    setExpandedVolumes(new Set(volumeNumbers))
  }

  const collapseAllVolumes = () => {
    setExpandedVolumes(new Set())
  }

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const focusAnchor = useCallback((anchorId: string) => {
    setFocusedAnchor(anchorId)
    const chapterNo = extractChapterNo(anchorId)
    if (chapterNo !== null) {
      setSelectedChapterNo(chapterNo)
    }
    requestAnimationFrame(() => {
      document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  const clearChapterFocus = useCallback(() => {
    setSelectedChapterNo(null)
    setFocusedAnchor(null)
  }, [])

  const focusDimension = useCallback((dimension: AnalysisDimension, volumeNumber = -1) => {
    setExpandedVolumes(prev => new Set(prev).add(volumeNumber))
    requestAnimationFrame(() => {
      const el = document.querySelector(
        `[data-analysis-volume="${volumeNumber}"][data-analysis-dimension="${dimension}"]`
      ) as HTMLElement | null
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  useEffect(() => {
    if (!navigationRequest) {
      return
    }

    const frameId = requestAnimationFrame(() => {
      if (navigationRequest.chapterNo !== undefined) {
        setSelectedChapterNo(navigationRequest.chapterNo)
      }

      if (navigationRequest.anchorId) {
        setFocusedAnchor(navigationRequest.anchorId)
        document.getElementById(navigationRequest.anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }

      if (navigationRequest.dimension) {
        setExpandedVolumes(prev => new Set(prev).add(-1))
        const el = document.querySelector(
          `[data-analysis-volume="-1"][data-analysis-dimension="${navigationRequest.dimension}"]`
        ) as HTMLElement | null
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }

      if (navigationRequest.sectionId) {
        document.getElementById(navigationRequest.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })

    return () => cancelAnimationFrame(frameId)
  }, [navigationRequest])

  if (loading && analyses.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        正在加载拆书分析结果...
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-amber-600" />
          <span className="font-medium">分析明细</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterDimension}
            onChange={(e) => setFilterDimension(e.target.value as AnalysisDimension | 'all')}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="all">全部模块</option>
            {Object.entries(ANALYSIS_DIMENSION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button
            onClick={loadAnalyses}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="sticky top-0 z-10 -mx-1 rounded-2xl border border-gray-200 bg-white/90 px-2 py-2 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => scrollToSection('overview-panel')} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-gray-800 dark:text-gray-300">
            总览
          </button>
          <button onClick={() => scrollToSection('timeline-panel')} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-gray-800 dark:text-gray-300">
            时间轴
          </button>
          <button onClick={() => scrollToSection('evidence-panel')} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-gray-800 dark:text-gray-300">
            证据层
          </button>
          <button onClick={() => scrollToSection('heatmap-panel')} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-gray-800 dark:text-gray-300">
            节奏图
          </button>
          <button onClick={() => scrollToSection('details-panel')} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-gray-800 dark:text-gray-300">
            明细
          </button>
          <button onClick={() => focusDimension(AnalysisDimension.STORY_OVERVIEW)} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-gray-800 dark:text-gray-300">
            结论摘要
          </button>
          <span className="rounded-full border border-dashed border-gray-200 px-3 py-1.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            点击总览卡片、时间轴或章节图谱可联动筛选
          </span>
          {selectedChapterNo !== null && (
            <button
              onClick={clearChapterFocus}
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 transition-colors hover:border-blue-300 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300"
            >
              取消章节筛选
            </button>
          )}
          {selectedChapterNo !== null && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
              当前章节：第{selectedChapterNo}章
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={expandAllVolumes}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-gray-800 dark:text-gray-300"
            >
              展开全部
            </button>
            <button
              onClick={collapseAllVolumes}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-gray-800 dark:text-gray-300"
            >
              收起全部
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {analyses.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p>暂无分析结果</p>
          <p className="mt-1 text-sm">请先在上方发起拆书分析，系统会生成故事总览、角色、剧情和阅读体验结论。</p>
        </div>
      )}

      {analyses.length > 0 && (
        <>
          <div id="overview-panel">
          <UnifiedOverviewCard
            storyOverview={storyOverview}
            characterRelation={characterRelation}
            foreshadowing={foreshadowing}
            plotLine={plotLine}
            chapterStructure={chapterStructure}
            worldSetting={worldSetting}
            onFocusDimension={focusDimension}
            onFocusAnchor={focusAnchor}
          />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <OverviewCard storyOverview={storyOverview} readingExperience={readingExperience} />
            <div className="space-y-4">
              <ScoreCard readingExperience={readingExperience} />
              <CharacterFocusCard characters={topCharacters} />
            </div>
          </div>

          <SummaryStrip
            storyOverview={storyOverview}
            readingExperience={readingExperience}
            characterRelation={characterRelation}
            foreshadowing={foreshadowing}
            onFocusDimension={focusDimension}
          />

          <ChapterGraphCard
            graph={chapterGraph}
            selectedChapterNo={selectedChapterNo}
            onSelectChapter={focusAnchor}
          />

          <div id="timeline-panel">
          <TimelineCard
            storyOverview={storyOverview}
            plotLine={plotLine}
            chapterStructure={chapterStructure}
            readingExperience={readingExperience}
            onFocusDimension={focusDimension}
            onFocusAnchor={focusAnchor}
            focusedAnchor={focusedAnchor}
            selectedChapterNo={selectedChapterNo}
          />
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <WorldSettingCard worldSetting={worldSetting} />
            <CharacterRelationCard data={characterRelation} />
          </div>

          {(missingModules.length > 0 || emptyModules.length > 0) && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              <div className="font-medium">分析质量提示</div>
              {missingModules.length > 0 && (
                <div className="mt-2">
                  缺失模块：{missingModules.map(item => ANALYSIS_DIMENSION_LABELS[item]).join('、')}。通常表示该轮分析未覆盖这些模块。
                </div>
              )}
              {emptyModules.length > 0 && (
                <div className="mt-2">
                  空结果模块：{emptyModules.map(item => ANALYSIS_DIMENSION_LABELS[item]).join('、')}。这通常意味着切章不准、原文结构异常或模型输出未命中格式。
                </div>
              )}
            </div>
          )}

          <div id="evidence-panel" className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <EvidenceCard chapterStructure={chapterStructure} readingExperience={readingExperience} selectedChapterNo={selectedChapterNo} />
            <div id="heatmap-panel" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-blue-600" />
                <div className="font-medium">章节节奏热力图</div>
              </div>
              <ChapterRhythmHeatmap projectId={projectId} selectedChapterNo={selectedChapterNo} />
            </div>
          </div>

          <div id="details-panel" className="space-y-3">
            {Object.entries(groupedByVolume)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([vol, volAnalyses]) => (
                <div key={vol} className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                  <button
                    onClick={() => toggleVolume(Number(vol))}
                    className="flex w-full items-center gap-2 bg-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-100 dark:bg-gray-900/60 dark:hover:bg-gray-900"
                  >
                    {expandedVolumes.has(Number(vol)) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-medium">{volumeLabel(Number(vol))}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {volAnalyses.length} 个模块
                    </span>
                  </button>

                  {expandedVolumes.has(Number(vol)) && (
                    <div className="space-y-3 bg-white p-4 dark:bg-gray-950">
                      {volAnalyses
                        .filter(analysis => {
                          if (selectedChapterNo === null) return true
                          if (analysis.volumeNumber === -1) return true
                          return chapterMatchesAnalysis(selectedChapterNo, analysis.dimension as AnalysisDimension, analysis.analysisData as Record<string, unknown>)
                        })
                        .map(analysis => (
                        <div
                          key={analysis.id}
                          data-analysis-volume={analysis.volumeNumber}
                          data-analysis-dimension={analysis.dimension}
                          data-analysis-selected={selectedChapterNo !== null ? 'true' : 'false'}
                          className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                        >
                          <div className="mb-3 flex items-center gap-2">
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              {ANALYSIS_DIMENSION_LABELS[analysis.dimension as AnalysisDimension]}
                            </span>
                          </div>
                          {renderDimensionContent(
                            analysis.dimension as AnalysisDimension,
                            analysis.analysisData as Record<string, unknown>,
                            focusedAnchor,
                            focusAnchor,
                            focusDimension,
                            selectedChapterNo,
                            {
                              plotLine,
                              foreshadowing,
                            }
                          )}
                        </div>
                      ))}
                      {selectedChapterNo !== null && volAnalyses.filter(analysis => {
                        if (analysis.volumeNumber === -1) return false
                        return chapterMatchesAnalysis(selectedChapterNo, analysis.dimension as AnalysisDimension, analysis.analysisData as Record<string, unknown>)
                      }).length === 0 && (
                        <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                          当前章节暂无匹配的分析内容
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  )
}

function OverviewCard({
  storyOverview,
  readingExperience,
}: {
  storyOverview: Record<string, unknown>
  readingExperience: ReadingExperienceData
}) {
  const positioning = (storyOverview.positioning || {}) as Record<string, unknown>
  const outline = (storyOverview.outline || {}) as Record<string, unknown>
  const strengths = Array.isArray(storyOverview.strengths) ? storyOverview.strengths as string[] : []
  const risks = Array.isArray(storyOverview.risks) ? storyOverview.risks as string[] : []
  const stageBreakdown = Array.isArray(outline.stageBreakdown)
    ? outline.stageBreakdown as Array<Record<string, unknown>>
    : []

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-600" />
        <div className="font-medium">整书结论</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Metric label="题材定位" value={stringValue(positioning.genreLabel)} />
        <Metric label="目标读者" value={stringValue(positioning.targetReader)} />
        <Metric label="核心钩子" value={stringValue(positioning.coreHook)} />
        <Metric label="核心冲突" value={stringValue(outline.coreConflict)} />
      </div>
      {stringValue(outline.premise) && (
        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {stringValue(outline.premise)}
        </div>
      )}
      {stageBreakdown.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">阶段大纲骨架</div>
          {stageBreakdown.map((stage, index) => (
            <div key={index} className="rounded-xl border border-gray-200 px-3 py-3 text-sm dark:border-gray-800">
              <div className="font-medium">{stringValue(stage.stage) || `阶段 ${index + 1}`}</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{stringValue(stage.chapterRange)}</div>
              <div className="mt-2 text-gray-700 dark:text-gray-300">{stringValue(stage.summary)}</div>
            </div>
          ))}
        </div>
      )}
      {(strengths.length > 0 || risks.length > 0 || readingExperience.readerTakeaway) && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <TagBlock title="强项" items={strengths} tone="green" />
          <TagBlock title="风险" items={risks} tone="red" />
          <TagBlock title="读者感受" items={readingExperience.readerTakeaway ? [readingExperience.readerTakeaway] : []} tone="blue" />
        </div>
      )}
    </div>
  )
}

function ScoreCard({ readingExperience }: { readingExperience: ReadingExperienceData }) {
  const scores = readingExperience.scores || {}
  const entries = Object.entries(scores)
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-blue-600" />
        <div className="font-medium">阅读体验评分</div>
      </div>
      {entries.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">暂无阅读体验评分</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {entries.map(([key, value]) => (
            <div key={key} className="rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-800">
              <div className="text-xs text-gray-500 dark:text-gray-400">{scoreLabels[key] || key}</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{Math.round(Number(value))}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CharacterFocusCard({ characters }: { characters: Array<Record<string, unknown>> }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <UserRound className="h-4 w-4 text-purple-600" />
        <div className="font-medium">关键角色</div>
      </div>
      {characters.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">暂无角色重点分析</div>
      ) : (
        <div className="space-y-3">
          {characters.map((item, index) => (
            <div key={index} className="rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-800">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{stringValue(item.name)}</div>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  {stringValue(item.role)}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">{stringValue(item.description)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryStrip({
  storyOverview,
  readingExperience,
  characterRelation,
  foreshadowing,
  onFocusDimension,
}: {
  storyOverview: Record<string, unknown>
  readingExperience: ReadingExperienceData
  characterRelation: Record<string, unknown>
  foreshadowing: Record<string, unknown>
  onFocusDimension?: (dimension: AnalysisDimension, volumeNumber?: number) => void
}) {
  const summary = useMemo(() => {
    const outline = (storyOverview.outline || {}) as Record<string, unknown>
    const characters = Array.isArray(characterRelation.characters) ? (characterRelation.characters as Array<Record<string, unknown>>) : []
    const items = Array.isArray(foreshadowing.items) ? (foreshadowing.items as Array<Record<string, unknown>>) : []
    const unresolved = items.filter(item => !(item.payoff && String(item.payoff).trim() && String(item.payoff).trim() !== '待回收')).length

    const bestHook = stringValue((readingExperience.readingFeel || {}).hookSummary)
    const pacing = stringValue((readingExperience.readingFeel || {}).fatigueSummary)
    const core = stringValue(outline.coreConflict)

    return {
      core: core || '暂无核心冲突摘要',
      hook: bestHook || '暂无开篇抓力摘要',
      pacing: pacing || '暂无节奏风险摘要',
      characters: characters.length,
      foreshadowing: unresolved,
    }
  }, [characterRelation, foreshadowing, readingExperience, storyOverview])

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/20">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-amber-600" />
        结论摘要
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryPill label="核心冲突" value={summary.core} onClick={() => onFocusDimension?.(AnalysisDimension.STORY_OVERVIEW)} />
        <SummaryPill label="开篇抓力" value={summary.hook} onClick={() => onFocusDimension?.(AnalysisDimension.READING_EXPERIENCE)} />
        <SummaryPill label="节奏判断" value={summary.pacing} onClick={() => onFocusDimension?.(AnalysisDimension.CHAPTER_STRUCTURE)} />
        <SummaryPill label="角色 / 伏笔" value={`${summary.characters} 个角色 · ${summary.foreshadowing} 条待回收伏笔`} onClick={() => onFocusDimension?.(AnalysisDimension.FORESHADOWING)} />
      </div>
    </div>
  )
}

function ChapterGraphCard({
  graph,
  selectedChapterNo,
  onSelectChapter,
}: {
  graph: ChapterGraph
  selectedChapterNo?: number | null
  onSelectChapter?: (anchorId: string) => void
}) {
  const selectedNode = useMemo(
    () => (selectedChapterNo !== null && selectedChapterNo !== undefined
      ? graph.nodes.find(node => node.chapterNo === selectedChapterNo) || null
      : null),
    [graph.nodes, selectedChapterNo]
  )

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium">章节图谱</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">统一章节、角色、伏笔、转折、节奏的中间层</div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="rounded-full bg-gray-50 px-2.5 py-1 dark:bg-gray-950/20">章节 {graph.nodes.length}</span>
          <span className="rounded-full bg-gray-50 px-2.5 py-1 dark:bg-gray-950/20">高置信 {graph.highConfidenceCount}</span>
          <span className="rounded-full bg-gray-50 px-2.5 py-1 dark:bg-gray-950/20">待复核 {graph.lowConfidenceCount}</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {graph.nodes.map(node => (
            <button
              key={node.chapterNo}
              type="button"
              onClick={() => onSelectChapter?.(`chapter-no-${node.chapterNo}`)}
              className={`w-[220px] shrink-0 rounded-2xl border px-4 py-3 text-left transition-colors ${
                selectedChapterNo === node.chapterNo
                  ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-400 ring-offset-2 ring-offset-white dark:border-blue-700 dark:bg-blue-950/20 dark:ring-offset-gray-900'
                  : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-800 dark:bg-gray-950/20 dark:hover:bg-blue-950/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-black/20 dark:text-gray-200">
                  第{node.chapterNo}章
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                  node.confidenceLevel === '高'
                    ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300'
                    : node.confidenceLevel === '中'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                }`}>
                  {node.confidenceLevel}
                </span>
              </div>
              <div className="mt-3 font-medium text-gray-900 dark:text-gray-100">{node.title}</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{node.stageLabel || '未识别阶段'}</div>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                {node.summary || '暂无章节摘要'}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {node.tags.slice(0, 4).map(tag => (
                  <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-700 dark:bg-black/20 dark:text-gray-300">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedNode && (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/20">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="font-medium">第{selectedNode.chapterNo}章证据链</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">证据来源 {selectedNode.sources.length} 项</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedNode.sources.map(source => (
              <span key={source.label} className={`rounded-full px-2.5 py-1 text-xs ${
                source.tone === 'blue'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                  : source.tone === 'green'
                    ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300'
                    : source.tone === 'amber'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                      : source.tone === 'red'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300'
              }`}>
                {source.label}
              </span>
            ))}
          </div>
          {selectedNode.supportingNote && (
            <div className="mt-3 rounded-xl bg-white px-3 py-3 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
              {selectedNode.supportingNote}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function UnifiedOverviewCard({
  storyOverview,
  characterRelation,
  foreshadowing,
  plotLine,
  chapterStructure,
  worldSetting,
  onFocusDimension,
  onFocusAnchor,
}: {
  storyOverview: Record<string, unknown>
  characterRelation: Record<string, unknown>
  foreshadowing: Record<string, unknown>
  plotLine: Record<string, unknown>
  chapterStructure: Record<string, unknown>
  worldSetting: Record<string, unknown>
  onFocusDimension?: (dimension: AnalysisDimension, volumeNumber?: number) => void
  onFocusAnchor?: (anchorId: string) => void
}) {
  const overview = useMemo(() => {
    const outline = (storyOverview.outline || {}) as Record<string, unknown>
    const stageBreakdown = Array.isArray(outline.stageBreakdown)
      ? outline.stageBreakdown as Array<Record<string, unknown>>
      : []
    const worldNodes = Array.isArray(worldSetting.settings)
      ? (worldSetting.settings as Array<Record<string, unknown>>)
          .map((item, index) => ({
            kind: '世界设定',
            title: stringValue(item.name) || `设定 ${index + 1}`,
            chapter: parseChapterMark(stringValue(item.firstAppear)),
            summary: stringValue(item.description),
            anchorId: `world-setting-${index}`,
          }))
      : []
    const turningPoints = Array.isArray(plotLine.turningPoints)
      ? (plotLine.turningPoints as Array<Record<string, unknown>>).map((item, index) => ({
          kind: '剧情转折',
          title: stringValue(item.event) || `转折 ${index + 1}`,
          chapter: Number(item.chapter || index + 1),
          summary: stringValue(item.impact),
          anchorId: `plot-turning-${index}`,
        }))
      : []
    const timeline = [
      ...stageBreakdown.map((stage, index) => ({
        kind: '阶段推进',
        title: stringValue(stage.stage) || `阶段 ${index + 1}`,
        chapter: rangeStart(stringValue(stage.chapterRange), index + 1),
        summary: stringValue(stage.summary),
        anchorId: `timeline-stage-${index}`,
      })),
      ...worldNodes,
      ...turningPoints,
    ].sort((a, b) => a.chapter - b.chapter)

    const characters = Array.isArray(characterRelation.characters)
      ? (characterRelation.characters as Array<Record<string, unknown>>)
          .map((item) => ({
            name: stringValue(item.name),
            role: stringValue(item.role),
            importance: Number(item.importance || 999),
            relationCount: Array.isArray(item.relationships) ? item.relationships.length : 0,
            links: Array.isArray(item.relationships)
              ? (item.relationships as Array<Record<string, unknown>>)
                  .slice(0, 3)
                  .map(rel => `${stringValue(rel.target)}·${stringValue(rel.type)}`)
              : [],
            description: stringValue(item.description),
          }))
          .sort((a, b) => a.importance - b.importance)
      : []

    const foreshadowItems = Array.isArray(foreshadowing.items)
      ? (foreshadowing.items as Array<Record<string, unknown>>)
          .map((item, index) => ({
            status: item.payoff && String(item.payoff).trim() && String(item.payoff).trim() !== '待回收' ? '已回收' : '待回收',
            title: stringValue(item.setup) || `伏笔 ${index + 1}`,
            payoff: stringValue(item.payoff),
            chapter: Number(item.chapter || index + 1),
            importance: stringValue(item.importance),
          }))
          .sort((a, b) => a.chapter - b.chapter)
      : []

    const chapterStats = {
      peaks: Array.isArray(chapterStructure.peakSections) ? chapterStructure.peakSections.length : 0,
      lows: Array.isArray(chapterStructure.slowSections) ? chapterStructure.slowSections.length : 0,
      unresolved: foreshadowItems.filter(item => item.status === '待回收').length,
      relations: characters.length,
    }

    return { timeline, characters, foreshadowItems, chapterStats }
  }, [characterRelation, chapterStructure, foreshadowing, plotLine, storyOverview, worldSetting])

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">拆书总览带</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">世界观时间轴、角色关系网、伏笔回收链</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-4">
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-950/20">关系 {overview.chapterStats.relations}</div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-950/20">伏笔 {overview.chapterStats.unresolved}</div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-950/20">高点 {overview.chapterStats.peaks}</div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-950/20">低谷 {overview.chapterStats.lows}</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.95fr_0.95fr]">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onFocusDimension?.(AnalysisDimension.STORY_OVERVIEW)}
          className="rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-blue-300 dark:border-gray-800"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <MoveHorizontal className="h-4 w-4 text-indigo-600" />
            世界观时间轴
          </div>
          <div className="space-y-2">
            {overview.timeline.length > 0 ? overview.timeline.slice(0, 8).map((item, index) => (
              <button
                key={`${item.kind}-${index}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onFocusAnchor?.(item.anchorId)
                }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-800 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.title}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">第{item.chapter}章</span>
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.kind}</div>
                <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">{item.summary || '暂无说明'}</div>
              </button>
            )) : <EmptyHint text="暂无时间轴数据" />}
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onFocusDimension?.(AnalysisDimension.CHARACTER_RELATION)}
          className="rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-blue-300 dark:border-gray-800"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <UserRound className="h-4 w-4 text-purple-600" />
            角色关系网
          </div>
          <div className="space-y-2">
            {overview.characters.length > 0 ? overview.characters.slice(0, 5).map((char, index) => (
              <div key={`${char.name}-${index}`} className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{char.name || '未知角色'}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">关联 {char.relationCount}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{char.role || '未知定位'}</div>
                {char.links.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {char.links.map((link: string, linkIndex: number) => (
                      <span key={linkIndex} className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-950/30 dark:text-purple-300">
                        {link}
                      </span>
                    ))}
                  </div>
                )}
                {char.description && (
                  <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">{char.description}</div>
                )}
              </div>
            )) : <EmptyHint text="暂无角色关系数据" />}
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onFocusDimension?.(AnalysisDimension.FORESHADOWING)}
          className="rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-blue-300 dark:border-gray-800"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-amber-600" />
            伏笔回收链
          </div>
          <div className="space-y-2">
            {overview.foreshadowItems.length > 0 ? overview.foreshadowItems.slice(0, 6).map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    item.status === '已回收'
                      ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">第{item.chapter}章 · {item.importance || '未标注'}</div>
                <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">{item.payoff || '尚未回收'}</div>
              </div>
            )) : <EmptyHint text="暂无伏笔数据" />}
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineCard({
  storyOverview,
  plotLine,
  chapterStructure,
  readingExperience,
  onFocusDimension,
  onFocusAnchor,
  focusedAnchor,
  selectedChapterNo,
}: {
  storyOverview: Record<string, unknown>
  plotLine: Record<string, unknown>
  chapterStructure: Record<string, unknown>
  readingExperience: ReadingExperienceData
  onFocusDimension?: (dimension: AnalysisDimension, volumeNumber?: number) => void
  onFocusAnchor?: (anchorId: string) => void
  focusedAnchor?: string | null
  selectedChapterNo?: number | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ startX: number; scrollLeft: number } | null>(null)
  const focusedChapterNumber = useMemo(() => {
    if (selectedChapterNo !== null && selectedChapterNo !== undefined) {
      return selectedChapterNo
    }
    if (!focusedAnchor) return null
    const chapterMatch = focusedAnchor.match(/^chapter-no-(\d+)$/)
    if (chapterMatch) return Number(chapterMatch[1])
    const foreshadowMatch = focusedAnchor.match(/^foreshadow-chapter-(\d+)$/)
    if (foreshadowMatch) return Number(foreshadowMatch[1])
    const plotMatch = focusedAnchor.match(/^plot-turning-(\d+)$/)
    if (plotMatch) return Number(plotMatch[1])
    const stageMatch = focusedAnchor.match(/^timeline-stage-(\d+)$/)
    if (stageMatch) return Number(stageMatch[1])
    return null
  }, [focusedAnchor, selectedChapterNo])

  const items = useMemo(() => {
    const outline = (storyOverview.outline || {}) as Record<string, unknown>
    const stageBreakdown = Array.isArray(outline.stageBreakdown)
      ? outline.stageBreakdown as Array<Record<string, unknown>>
      : []
    const turningPoints = Array.isArray(plotLine.turningPoints) ? plotLine.turningPoints as Array<Record<string, unknown>> : []
    const peaks = Array.isArray(chapterStructure.peakSections) ? chapterStructure.peakSections as Array<Record<string, unknown>> : []
    const slows = Array.isArray(chapterStructure.slowSections) ? chapterStructure.slowSections as Array<Record<string, unknown>> : []
    const highlights = readingExperience.highlightChapters || []
    const fatigue = readingExperience.fatigueChapters || []

    const nextItems: Array<{
      kind: string
      title: string
      range: string
      summary: string
      tone: 'blue' | 'amber' | 'green' | 'red' | 'purple'
      sortKey: number
      anchorId?: string
      chapterNo?: number
    }> = []

    stageBreakdown.forEach((stage, index) => {
      nextItems.push({
        kind: '阶段',
        title: stringValue(stage.stage) || `阶段 ${index + 1}`,
        range: stringValue(stage.chapterRange) || '',
        summary: stringValue(stage.summary),
        tone: 'blue',
        sortKey: rangeStart(stringValue(stage.chapterRange), index + 1),
        anchorId: `timeline-stage-${index}`,
        chapterNo: rangeStart(stringValue(stage.chapterRange), index + 1),
      })
    })

    turningPoints.forEach((point, index) => {
      nextItems.push({
        kind: '转折',
        title: stringValue(point.event) || `转折 ${index + 1}`,
        range: `第${String(point.chapter || '?')}章`,
        summary: stringValue(point.impact),
        tone: 'purple',
        sortKey: Number(point.chapter || index + 1),
        anchorId: `plot-turning-${index}`,
        chapterNo: Number(point.chapter || index + 1),
      })
    })

    peaks.forEach((item, index) => {
      nextItems.push({
        kind: '高点',
        title: stringValue(item.chapterRange) || `高点 ${index + 1}`,
        range: stringValue(item.chapterRange),
        summary: stringValue(item.reason),
        tone: 'green',
        sortKey: rangeStart(stringValue(item.chapterRange), index + 1),
        chapterNo: rangeStart(stringValue(item.chapterRange), index + 1),
      })
    })

    slows.forEach((item, index) => {
      nextItems.push({
        kind: '低谷',
        title: stringValue(item.chapterRange) || `低谷 ${index + 1}`,
        range: stringValue(item.chapterRange),
        summary: stringValue(item.reason),
        tone: 'red',
        sortKey: rangeStart(stringValue(item.chapterRange), index + 1),
        chapterNo: rangeStart(stringValue(item.chapterRange), index + 1),
      })
    })

    highlights.forEach((item, index) => {
      nextItems.push({
        kind: '高光',
        title: `第${item.chapter ?? '?'}章`,
        range: item.reason || '',
        summary: item.reason || '',
        tone: 'green',
        sortKey: Number(item.chapter || index + 1),
        chapterNo: Number(item.chapter || index + 1),
      })
    })

    fatigue.forEach((item, index) => {
      nextItems.push({
        kind: '疲劳',
        title: item.chapterRange || `疲劳 ${index + 1}`,
        range: item.chapterRange || '',
        summary: item.reason || '',
        tone: 'amber',
        sortKey: rangeStart(item.chapterRange || '', index + 1),
        chapterNo: rangeStart(item.chapterRange || '', index + 1),
      })
    })

    return nextItems.sort((a, b) => a.sortKey - b.sortKey)
  }, [chapterStructure, plotLine, readingExperience, storyOverview])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return
    dragState.current = {
      startX: event.clientX,
      scrollLeft: scrollRef.current.scrollLeft,
    }
    scrollRef.current.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!scrollRef.current || !dragState.current) return
    const delta = event.clientX - dragState.current.startX
    scrollRef.current.scrollLeft = dragState.current.scrollLeft - delta
  }

  const handlePointerUp = () => {
    dragState.current = null
  }

  if (items.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center gap-2">
        <MoveHorizontal className="h-4 w-4 text-indigo-600" />
        <div className="font-medium">故事时间轴</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">按章节顺序拖动查看</div>
      </div>
      <div
        ref={scrollRef}
        className="cursor-grab overflow-x-auto pb-2 active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div className="flex min-w-max gap-3">
          {items.map((item, index) => (
            <button
              key={`${item.kind}-${item.sortKey}-${index}`}
              onClick={() => {
                if (item.kind === '阶段') onFocusDimension?.(AnalysisDimension.STORY_OVERVIEW)
                if (item.kind === '转折') onFocusDimension?.(AnalysisDimension.PLOT_LINE)
                if (item.kind === '高点' || item.kind === '低谷' || item.kind === '高光' || item.kind === '疲劳') {
                  onFocusDimension?.(AnalysisDimension.CHAPTER_STRUCTURE)
                }
                if (item.anchorId) {
                  onFocusAnchor?.(item.anchorId)
                }
              }}
              className={`w-[240px] shrink-0 rounded-2xl border px-4 py-3 text-left transition-colors hover:shadow-sm ${
                focusedChapterNumber !== null && item.chapterNo === focusedChapterNumber ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-900' : ''
              } ${
                item.tone === 'blue'
                  ? 'border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20'
                  : item.tone === 'purple'
                    ? 'border-purple-200 bg-purple-50 dark:border-purple-900/40 dark:bg-purple-950/20'
                    : item.tone === 'green'
                      ? 'border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20'
                      : item.tone === 'red'
                        ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
                        : 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-black/20 dark:text-gray-200">
                  {item.kind}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">{item.range}</span>
              </div>
              <div className="mt-3 font-medium text-gray-900 dark:text-gray-100">{item.title}</div>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">{item.summary || '暂无说明'}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function WorldSettingCard({ worldSetting }: { worldSetting: Record<string, unknown> }) {
  const settings = Array.isArray(worldSetting.settings) ? worldSetting.settings as Array<Record<string, unknown>> : []
  const powerSystem = (worldSetting.powerSystem || {}) as Record<string, unknown>
  const consistency = stringValue(worldSetting.consistency)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-sky-600" />
        <div className="font-medium">世界观设定</div>
      </div>
      {stringValue(powerSystem.name) && (
        <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm dark:border-sky-900/40 dark:bg-sky-950/20">
          <div className="font-medium">{stringValue(powerSystem.name)}</div>
          {Array.isArray(powerSystem.levels) && (powerSystem.levels as string[]).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(powerSystem.levels as string[]).map((level, index) => (
                <span key={index} className="rounded bg-white px-2 py-0.5 text-xs text-sky-700 dark:bg-black/20 dark:text-sky-300">
                  {level}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="space-y-2 text-sm">
        {settings.slice(0, 4).map((setting, index) => (
          <div key={index} className="rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-800">
            <div className="font-medium">{stringValue(setting.name)}</div>
            <div className="mt-1 text-gray-600 dark:text-gray-400">{stringValue(setting.description) || '暂无描述'}</div>
          </div>
        ))}
      </div>
      {consistency && (
        <div className="mt-3 rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-700 dark:bg-gray-950/20 dark:text-gray-300">
          {consistency}
        </div>
      )}
      {settings.length === 0 && !stringValue(powerSystem.name) && !consistency && (
        <EmptyHint text="暂无世界观数据" />
      )}
    </div>
  )
}

function CharacterRelationCard({ data }: { data: Record<string, unknown> }) {
  const characters = Array.isArray(data.characters) ? data.characters as Array<Record<string, unknown>> : []

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <UserRound className="h-4 w-4 text-purple-600" />
        <div className="font-medium">人物关系摘要</div>
      </div>
      {characters.length === 0 ? (
        <EmptyHint text="暂无人物关系数据" />
      ) : (
        <div className="space-y-3">
          {characters.slice(0, 6).map((char, index) => (
            <div key={index} className="rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-800">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{stringValue(char.name)}</div>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  {stringValue(char.role)}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">{stringValue(char.description)}</div>
              {Array.isArray(char.relationships) && (char.relationships as Array<Record<string, unknown>>).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(char.relationships as Array<Record<string, unknown>>).slice(0, 4).map((rel, relIndex) => (
                    <span key={relIndex} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {stringValue(rel.target)} · {stringValue(rel.type)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EvidenceCard({
  chapterStructure,
  readingExperience,
  selectedChapterNo,
}: {
  chapterStructure: Record<string, unknown>
  readingExperience: ReadingExperienceData
  selectedChapterNo?: number | null
}) {
  const peaks = Array.isArray(chapterStructure.peakSections) ? chapterStructure.peakSections as Array<Record<string, unknown>> : []
  const slows = Array.isArray(chapterStructure.slowSections) ? chapterStructure.slowSections as Array<Record<string, unknown>> : []
  const highlights = readingExperience.highlightChapters || []
  const fatigue = readingExperience.fatigueChapters || []
  const isChapterMatched = useCallback((value?: unknown) => {
    if (selectedChapterNo === null || selectedChapterNo === undefined) return false
    const num = typeof value === 'number' ? value : Number(String(value || '').match(/(\d+)/)?.[1] || 0)
    return num === selectedChapterNo
  }, [selectedChapterNo])

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <Layers3 className="h-4 w-4 text-indigo-600" />
        <div className="font-medium">证据层与风险段</div>
        {selectedChapterNo !== null && selectedChapterNo !== undefined && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
            第{selectedChapterNo}章
          </span>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <EvidenceList
          title="高光章节"
          icon={<Sparkles className="h-4 w-4 text-green-600" />}
          items={highlights.map(item => ({
            text: `${item.chapter ? `第${item.chapter}章` : ''} ${item.reason || ''}`.trim(),
            active: isChapterMatched(item.chapter),
          }))}
          emptyText="暂无高光章节标注"
        />
        <EvidenceList
          title="疲劳章节"
          icon={<TriangleAlert className="h-4 w-4 text-amber-600" />}
          items={fatigue.map(item => ({
            text: `${item.chapterRange || ''} ${item.reason || ''}`.trim(),
            active: isChapterMatched(stringValue(item.chapterRange)),
          }))}
          emptyText="暂无疲劳章节标注"
        />
        <EvidenceList
          title="结构高点"
          icon={<Sparkles className="h-4 w-4 text-blue-600" />}
          items={peaks.map(item => ({
            text: `${stringValue(item.chapterRange)} ${stringValue(item.reason)}`.trim(),
            active: isChapterMatched(stringValue(item.chapterRange)),
          }))}
          emptyText="暂无结构高点"
        />
        <EvidenceList
          title="结构低谷"
          icon={<TriangleAlert className="h-4 w-4 text-red-600" />}
          items={slows.map(item => ({
            text: `${stringValue(item.chapterRange)} ${stringValue(item.reason)}`.trim(),
            active: isChapterMatched(stringValue(item.chapterRange)),
          }))}
          emptyText="暂无结构低谷"
        />
      </div>
    </div>
  )
}

function EvidenceList({
  title,
  icon,
  items,
  emptyText,
}: {
  title: string
  icon: ReactNode
  items: Array<{ text: string; active?: boolean }>
  emptyText: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">{emptyText}</div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className={`rounded-lg px-2 py-1 text-sm ${
                item.active
                  ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/20 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {item.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-800">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{value || '暂无'}</div>
    </div>
  )
}

function TagBlock({ title, items, tone }: { title: string; items: string[]; tone: 'green' | 'red' | 'blue' }) {
  const toneClass = tone === 'green'
    ? 'bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-300'
    : tone === 'red'
      ? 'bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-300'
      : 'bg-blue-50 text-blue-800 dark:bg-blue-950/20 dark:text-blue-300'

  return (
    <div className={`rounded-xl px-3 py-3 ${toneClass}`}>
      <div className="text-xs font-medium">{title}</div>
      <div className="mt-2 space-y-1 text-sm">
        {items.length === 0 ? <div>暂无</div> : items.map((item, index) => <div key={index}>{item}</div>)}
      </div>
    </div>
  )
}

function SummaryPill({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const classes = `rounded-xl border border-gray-200 bg-white px-3 py-3 text-left dark:border-gray-800 dark:bg-gray-900 ${
    onClick ? 'transition-colors hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/20' : ''
  }`
  if (!onClick) {
    return (
      <div className={classes}>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{value || '暂无'}</div>
      </div>
    )
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{value || '暂无'}</div>
    </button>
  )
}

function renderDimensionContent(
  dimension: AnalysisDimension,
  data: Record<string, unknown>,
  focusedAnchor?: string | null,
  onFocusAnchor?: (anchorId: string) => void,
  onFocusDimension?: (dimension: AnalysisDimension, volumeNumber?: number) => void,
  selectedChapterNo?: number | null,
  bookContext?: {
    plotLine?: Record<string, unknown>
    foreshadowing?: Record<string, unknown>
  }
) {
  switch (dimension) {
    case AnalysisDimension.STORY_OVERVIEW:
      return <StoryOverviewView data={data} focusedAnchor={focusedAnchor} onFocusAnchor={onFocusAnchor} selectedChapterNo={selectedChapterNo} />
    case AnalysisDimension.CHARACTER_RELATION:
      return <CharacterRelationView data={data} />
    case AnalysisDimension.CHARACTER_ARC:
      return <CharacterArcView data={data} />
    case AnalysisDimension.PLOT_LINE:
      return <PlotLineView data={data} onFocusDimension={onFocusDimension} />
    case AnalysisDimension.FORESHADOWING:
      return <ForeshadowingView data={data} focusedAnchor={focusedAnchor} onFocusAnchor={onFocusAnchor} selectedChapterNo={selectedChapterNo} />
    case AnalysisDimension.CHAPTER_STRUCTURE:
      return (
        <ChapterStructureView
          data={data}
          focusedAnchor={focusedAnchor}
          onFocusAnchor={onFocusAnchor}
          selectedChapterNo={selectedChapterNo}
          plotLine={bookContext?.plotLine}
          foreshadowing={bookContext?.foreshadowing}
        />
      )
    case AnalysisDimension.READING_EXPERIENCE:
      return <ReadingExperienceView data={data as ReadingExperienceData} selectedChapterNo={selectedChapterNo} />
    case AnalysisDimension.WORLD_SETTING:
      return <WorldSettingView data={data} />
    default:
      return <pre className="overflow-auto text-xs">{JSON.stringify(data, null, 2)}</pre>
  }
}

function StoryOverviewView({
  data,
  focusedAnchor,
  onFocusAnchor,
  selectedChapterNo,
}: {
  data: Record<string, unknown>
  focusedAnchor?: string | null
  onFocusAnchor?: (anchorId: string) => void
  selectedChapterNo?: number | null
}) {
  const summary = stringValue(data.summary)
  const outline = (data.outline || {}) as Record<string, unknown>
  const stageBreakdown = useMemo(
    () => (Array.isArray(outline.stageBreakdown) ? outline.stageBreakdown as Array<Record<string, unknown>> : []),
    [outline.stageBreakdown]
  )
  const [manualActiveStage, setManualActiveStage] = useState<number | null>(null)

  const focusedStageIndex = useMemo(() => {
    if (!focusedAnchor?.startsWith('timeline-stage-')) return null
    const index = Number(focusedAnchor.split('-').at(-1))
    return Number.isNaN(index) ? null : index
  }, [focusedAnchor])

  const selectedStageIndex = useMemo(() => {
    if (selectedChapterNo === null || selectedChapterNo === undefined) return null
    const matchedIndex = stageBreakdown.findIndex(stage => {
      const range = stringValue(stage.chapterRange)
      const start = rangeStart(range, 0)
      if (start === selectedChapterNo) return true
      const endMatch = range.match(/(\d+)\s*[-~]\s*(\d+)/)
      if (endMatch) {
        return selectedChapterNo >= Number(endMatch[1]) && selectedChapterNo <= Number(endMatch[2])
      }
      return false
    })
    return matchedIndex >= 0 ? matchedIndex : null
  }, [selectedChapterNo, stageBreakdown])

  const activeStage = focusedStageIndex ?? selectedStageIndex ?? manualActiveStage

  return (
    <div className="space-y-3 text-sm">
      {summary && <div className="rounded-xl bg-amber-50 px-3 py-3 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">{summary}</div>}
      {stringValue(outline.coreConflict) && <div>核心冲突：{stringValue(outline.coreConflict)}</div>}
      {stageBreakdown.length > 0 && (
        <div className="space-y-2">
          {stageBreakdown.map((stage, index) => (
            <button
              key={index}
              id={`timeline-stage-${index}`}
              type="button"
              onClick={() => {
                setManualActiveStage(index)
                onFocusAnchor?.(`timeline-stage-${index}`)
              }}
              className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                activeStage === index
                  ? 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              <div className="font-medium">{stringValue(stage.stage)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{stringValue(stage.chapterRange)}</div>
              <div className="mt-1">{stringValue(stage.summary)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CharacterRelationView({ data }: { data: Record<string, unknown> }) {
  const characters = Array.isArray(data.characters) ? data.characters as Array<Record<string, unknown>> : []
  if (characters.length === 0) return <EmptyHint text="暂无人物关系数据" />
  return (
    <div className="space-y-3">
      {characters.map((char, index) => (
        <div key={index} className="border-l-2 border-purple-500 pl-3">
          <div className="font-medium">{stringValue(char.name)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{stringValue(char.role)}</div>
          <div className="mt-1 text-sm">{stringValue(char.description)}</div>
          {Array.isArray(char.relationships) && char.relationships.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(char.relationships as Array<Record<string, unknown>>).map((rel, relIndex) => (
                <span key={relIndex} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">
                  {stringValue(rel.target)} ({stringValue(rel.type)})
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function CharacterArcView({ data }: { data: Record<string, unknown> }) {
  const protagonistArc = (data.protagonistArc || {}) as Record<string, unknown>
  const supportingArcs = Array.isArray(data.supportingArcs) ? data.supportingArcs as Array<Record<string, unknown>> : []
  return (
    <div className="space-y-3 text-sm">
      {stringValue(protagonistArc.startState) && (
        <div className="rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-800">
          <div className="font-medium">主角成长线</div>
          <div className="mt-2">起点：{stringValue(protagonistArc.startState)}</div>
          <div>终点：{stringValue(protagonistArc.endState)}</div>
          {Array.isArray(protagonistArc.growthStages) && protagonistArc.growthStages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(protagonistArc.growthStages as string[]).map((stage, index) => (
                <span key={index} className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{stage}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {supportingArcs.length > 0 && (
        <div className="space-y-2">
          {supportingArcs.map((item, index) => (
            <div key={index} className="rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-800">
              <div className="font-medium">{stringValue(item.name)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{stringValue(item.function)}</div>
              <div className="mt-1">{stringValue(item.arc)}</div>
            </div>
          ))}
        </div>
      )}
      {!stringValue(data.summary) && supportingArcs.length === 0 && !stringValue(protagonistArc.startState) && <EmptyHint text="暂无角色成长数据" />}
    </div>
  )
}

function PlotLineView({
  data,
  onFocusDimension,
}: {
  data: Record<string, unknown>
  onFocusDimension?: (dimension: AnalysisDimension, volumeNumber?: number) => void
}) {
  const mainPlot = Array.isArray(data.mainPlot) ? data.mainPlot as Array<Record<string, unknown>> : []
  const subPlots = Array.isArray(data.subPlots) ? data.subPlots as Array<Record<string, unknown>> : []
  const turningPoints = Array.isArray(data.turningPoints) ? data.turningPoints as Array<Record<string, unknown>> : []
  if (mainPlot.length === 0 && subPlots.length === 0 && turningPoints.length === 0) return <EmptyHint text="暂无剧情线数据" />
  return (
    <div className="space-y-4 text-sm">
      {mainPlot.length > 0 && (
        <div>
          <div className="mb-2 font-medium text-indigo-600 dark:text-indigo-300">主线</div>
          {mainPlot.map((plot, index) => (
            <div key={index} className="mb-3 rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-800">
              <div className="font-medium">{stringValue(plot.title)}</div>
              <ul className="ml-4 mt-2 list-disc space-y-1">
                {Array.isArray(plot.keyEvents) && (plot.keyEvents as string[]).map((event, eventIndex) => (
                  <li key={eventIndex}>{event}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {subPlots.length > 0 && (
        <div>
          <div className="mb-2 font-medium text-gray-700 dark:text-gray-300">副线</div>
          {subPlots.map((plot, index) => (
            <div key={index} className="mb-2">
              <div className="font-medium">{stringValue(plot.title)}</div>
              <div className="text-gray-600 dark:text-gray-400">{stringValue(plot.relationship)}</div>
            </div>
          ))}
        </div>
      )}
      {turningPoints.length > 0 && (
        <div>
          <div className="mb-2 font-medium text-amber-700 dark:text-amber-300">关键转折</div>
          <div className="space-y-2">
            {turningPoints.map((point, index) => (
              <button
                key={index}
                id={`plot-turning-${index}`}
                type="button"
                onClick={() => onFocusDimension?.(AnalysisDimension.PLOT_LINE)}
                className="w-full rounded-xl bg-amber-50 px-3 py-2 text-left dark:bg-amber-950/20"
              >
                第{String(point.chapter || '?')}章 · {stringValue(point.event)} · {stringValue(point.impact)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ForeshadowingView({
  data,
  focusedAnchor,
  onFocusAnchor,
  selectedChapterNo,
}: {
  data: Record<string, unknown>
  focusedAnchor?: string | null
  onFocusAnchor?: (anchorId: string) => void
  selectedChapterNo?: number | null
}) {
  const items = useMemo(
    () => (Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : []),
    [data.items]
  )
  const [manualActiveChapterNo, setManualActiveChapterNo] = useState<number | null>(null)
  const focusedChapterNo = useMemo(() => {
    if (!focusedAnchor?.startsWith('foreshadow-chapter-')) return null
    const chapterNo = Number(focusedAnchor.split('-').at(-1))
    return Number.isNaN(chapterNo) ? null : chapterNo
  }, [focusedAnchor])
  const matchedSelectedChapterNo = useMemo(() => {
    if (selectedChapterNo === null || selectedChapterNo === undefined) return null
    const matched = items.find(item => Number(item.chapter || 0) === selectedChapterNo)
    return matched ? selectedChapterNo : null
  }, [items, selectedChapterNo])
  const activeChapterNo = focusedChapterNo ?? matchedSelectedChapterNo ?? manualActiveChapterNo

  const activeItems = useMemo(() => {
    if (activeChapterNo === null) return []
    return items.filter(item => Number(item.chapter || 0) === activeChapterNo)
  }, [activeChapterNo, items])

  if (items.length === 0) return <EmptyHint text="暂无伏笔数据" />
  return (
    <div className="space-y-2 text-sm">
      {activeChapterNo !== null && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-amber-900 dark:text-amber-200">当前章节概览</div>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-amber-700 dark:bg-gray-900 dark:text-amber-300">
              第{activeChapterNo}章
            </span>
          </div>
          <div className="mt-2 text-sm text-amber-800 dark:text-amber-300">
            {activeItems.length > 0 ? `本章匹配到 ${activeItems.length} 条伏笔线索，先看上方列表后再展开具体条目。` : '本章暂无直接匹配伏笔。'}
          </div>
        </div>
      )}
      {items.map((item, index) => (
        <button
          key={index}
          id={`foreshadow-chapter-${String(item.chapter || index + 1)}`}
          type="button"
          onClick={() => {
            setManualActiveChapterNo(Number(item.chapter || index + 1))
            onFocusAnchor?.(`foreshadow-chapter-${String(item.chapter || index + 1)}`)
          }}
          className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
            activeChapterNo === Number(item.chapter || index + 1)
              ? 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20'
              : 'border-gray-200 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs ${
              item.importance === 'major'
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}>
              {item.importance === 'major' ? '重要' : '次要'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">第{String(item.chapter || '?')}章</span>
          </div>
          <div className="mt-2">埋：{stringValue(item.setup)}</div>
          <div className="mt-1 text-purple-700 dark:text-purple-300">收：{stringValue(item.payoff) || '待回收'}</div>
        </button>
      ))}
    </div>
  )
}

function ChapterStructureView({
  data,
  focusedAnchor,
  onFocusAnchor,
  selectedChapterNo,
  plotLine,
  foreshadowing,
}: {
  data: Record<string, unknown>
  focusedAnchor?: string | null
  onFocusAnchor?: (anchorId: string) => void
  selectedChapterNo?: number | null
  plotLine?: Record<string, unknown>
  foreshadowing?: Record<string, unknown>
}) {
  const chapters = useMemo(
    () => (Array.isArray(data.chapters) ? data.chapters as Array<Record<string, unknown>> : []),
    [data.chapters]
  )
  const arcAnalysis = stringValue(data.arcAnalysis)
  const pacingAssessment = stringValue(data.pacingAssessment)
  const [manualActiveChapterNo, setManualActiveChapterNo] = useState<number | null>(null)
  const focusedChapterNo = useMemo(() => {
    if (!focusedAnchor?.startsWith('chapter-no-')) return null
    const chapterNo = Number(focusedAnchor.split('-').at(-1))
    return Number.isNaN(chapterNo) ? null : chapterNo
  }, [focusedAnchor])
  const matchedSelectedChapterNo = useMemo(() => {
    if (selectedChapterNo === null || selectedChapterNo === undefined) return null
    const matched = chapters.find(chapter => Number(chapter.number || 0) === selectedChapterNo)
    return matched ? selectedChapterNo : null
  }, [chapters, selectedChapterNo])
  const activeChapterNo = focusedChapterNo ?? matchedSelectedChapterNo ?? manualActiveChapterNo

  const relatedItems = useMemo(() => {
    if (activeChapterNo === null) return { foreshadow: [], turning: [] as Array<Record<string, unknown>> }
    const foreshadowItems = Array.isArray(foreshadowing?.items)
      ? (foreshadowing?.items as Array<Record<string, unknown>>).filter(item => Number(item.chapter || 0) === activeChapterNo)
      : []
    const turningItems = Array.isArray(plotLine?.turningPoints)
      ? (plotLine?.turningPoints as Array<Record<string, unknown>>).filter(item => Number(item.chapter || 0) === activeChapterNo)
      : []
    return { foreshadow: foreshadowItems, turning: turningItems }
  }, [activeChapterNo, foreshadowing, plotLine])

  const activeChapter = useMemo(() => {
    if (activeChapterNo === null) return null
    return chapters.find(chapter => Number(chapter.number || 0) === activeChapterNo) || null
  }, [activeChapterNo, chapters])

  if (chapters.length === 0 && !arcAnalysis && !pacingAssessment) return <EmptyHint text="暂无章节结构数据" />
  return (
    <div className="space-y-3 text-sm">
      {activeChapterNo !== null && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-blue-900 dark:text-blue-200">当前章节概览</div>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-blue-700 dark:bg-gray-900 dark:text-blue-300">
              第{activeChapterNo}章
            </span>
          </div>
          <div className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-300">
            <div>章节功能：{activeChapter ? stringValue(activeChapter.function) || '暂无' : '暂无'}</div>
            <div>章节标题：{activeChapter ? stringValue(activeChapter.title) || '暂无' : '暂无'}</div>
            <div>关联伏笔：{relatedItems.foreshadow.length} 条</div>
            <div>关联转折：{relatedItems.turning.length} 条</div>
          </div>
        </div>
      )}
      {chapters.length > 0 && (
        <div className="space-y-2">
          {chapters.slice(0, 12).map((chapter, index) => (
            <button
              key={index}
              id={`chapter-no-${String(chapter.number || index + 1)}`}
              type="button"
              onClick={() => {
                setManualActiveChapterNo(Number(chapter.number || index + 1))
                onFocusAnchor?.(`chapter-no-${String(chapter.number || index + 1)}`)
              }}
              className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                activeChapterNo === Number(chapter.number || index + 1)
                  ? 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/20'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              <span className="min-w-[64px] font-medium">第{String(chapter.number)}章</span>
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {stringValue(chapter.function)}
              </span>
              <span>{stringValue(chapter.title)}</span>
            </button>
          ))}
        </div>
      )}
      {activeChapterNo !== null && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/20">
          <div className="mb-2 font-medium">本章关联内容</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-white p-3 dark:bg-gray-900">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">关联伏笔</div>
              <div className="mt-2 space-y-2">
                {relatedItems.foreshadow.length > 0 ? relatedItems.foreshadow.map((item, index) => (
                  <div key={index} className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
                    <div className="text-sm font-medium">{stringValue(item.setup) || '未命名伏笔'}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">收束：{stringValue(item.payoff) || '待回收'}</div>
                  </div>
                )) : <EmptyHint text="本章暂无关联伏笔" />}
              </div>
            </div>
            <div className="rounded-lg bg-white p-3 dark:bg-gray-900">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">关联转折</div>
              <div className="mt-2 space-y-2">
                {relatedItems.turning.length > 0 ? relatedItems.turning.map((item, index) => (
                  <div key={index} className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
                    <div className="text-sm font-medium">{stringValue(item.event) || '未命名转折'}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{stringValue(item.impact) || '暂无影响描述'}</div>
                  </div>
                )) : <EmptyHint text="本章暂无关联转折" />}
              </div>
            </div>
          </div>
        </div>
      )}
      {arcAnalysis && <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900">{arcAnalysis}</div>}
      {pacingAssessment && <div className="rounded-xl bg-blue-50 px-3 py-3 dark:bg-blue-950/20">{pacingAssessment}</div>}
    </div>
  )
}

function ReadingExperienceView({
  data,
  selectedChapterNo,
}: {
  data: ReadingExperienceData
  selectedChapterNo?: number | null
}) {
  const scores = data.scores || {}
  const entries = Object.entries(scores)
  const highlight = useMemo(() => {
    if (selectedChapterNo === null || selectedChapterNo === undefined) return null
    const chapterHighlight = Array.isArray(data.highlightChapters)
      ? data.highlightChapters.find(item => Number(item.chapter || 0) === selectedChapterNo)
      : undefined
    const fatigueMatch = Array.isArray(data.fatigueChapters)
      ? data.fatigueChapters.find(item => rangeStart(item.chapterRange || '', 0) === selectedChapterNo)
      : undefined
    return chapterHighlight || fatigueMatch || null
  }, [data, selectedChapterNo])
  return (
    <div className="space-y-3 text-sm">
      {entries.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {entries.map(([key, value]) => (
            <div key={key} className="rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-800">
              <div className="text-xs text-gray-500 dark:text-gray-400">{scoreLabels[key] || key}</div>
              <div className="mt-1 text-xl font-semibold">{Math.round(Number(value))}</div>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Metric label="开篇抓力" value={data.readingFeel?.hookSummary || '暂无'} />
        <Metric label="爽点设计" value={data.readingFeel?.wowPointSummary || '暂无'} />
        <Metric label="阅读疲劳" value={data.readingFeel?.fatigueSummary || '暂无'} />
        <Metric label="章尾钩子" value={data.readingFeel?.chapterEndingSummary || '暂无'} />
      </div>
      {highlight && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
          <div className="font-medium">当前章节关联阅读体验</div>
          <div className="mt-1">
            {selectedChapterNo !== null && selectedChapterNo !== undefined ? `第${selectedChapterNo}章：` : ''}
            {'reason' in highlight ? stringValue((highlight as { reason?: string }).reason) : ''}
          </div>
        </div>
      )}
    </div>
  )
}

function WorldSettingView({ data }: { data: Record<string, unknown> }) {
  const settings = Array.isArray(data.settings) ? data.settings as Array<Record<string, unknown>> : []
  const powerSystem = (data.powerSystem || {}) as Record<string, unknown>
  if (settings.length === 0 && !stringValue(powerSystem.name)) return <EmptyHint text="暂无世界观数据" />
  return (
    <div className="space-y-4 text-sm">
      {settings.map((setting, index) => (
        <div key={index} className="border-l-2 border-blue-500 pl-3">
          <div className="font-medium">{stringValue(setting.name)}</div>
          <div className="mt-1">{stringValue(setting.description)}</div>
        </div>
      ))}
      {stringValue(powerSystem.name) && (
        <div className="border-l-2 border-orange-500 pl-3">
          <div className="font-medium">{stringValue(powerSystem.name)}</div>
          {Array.isArray(powerSystem.levels) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(powerSystem.levels as string[]).map((level, index) => (
                <span key={index} className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                  {level}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-gray-500 dark:text-gray-400">{text}</p>
}

function volumeLabel(vol: number) {
  if (vol === -1) return '整书'
  if (vol === 0) return '全卷'
  return `第${vol}卷`
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function extractChapterNo(anchorId: string) {
  const match = anchorId.match(/^(?:chapter-no|foreshadow-chapter|timeline-stage|plot-turning)-(\d+)$/)
  return match ? Number(match[1]) : null
}

function chapterMatchesAnalysis(
  chapterNo: number,
  dimension: AnalysisDimension,
  data: Record<string, unknown>
) {
  switch (dimension) {
    case AnalysisDimension.CHAPTER_STRUCTURE: {
      const chapters = Array.isArray(data.chapters) ? data.chapters as Array<Record<string, unknown>> : []
      const current = chapters.some((chapter, index) => Number(chapter.number || index + 1) === chapterNo)
      const slow = Array.isArray(data.slowSections)
        ? (data.slowSections as Array<Record<string, unknown>>).some(item => rangeStart(stringValue(item.chapterRange || ''), 0) === chapterNo)
        : false
      const peak = Array.isArray(data.peakSections)
        ? (data.peakSections as Array<Record<string, unknown>>).some(item => rangeStart(stringValue(item.chapterRange || ''), 0) === chapterNo)
        : false
      return current || slow || peak || chapters.length === 0
    }
    case AnalysisDimension.FORESHADOWING: {
      const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : []
      return items.some(item => Number(item.chapter || 0) === chapterNo) || items.length === 0
    }
    case AnalysisDimension.PLOT_LINE: {
      const turningPoints = Array.isArray(data.turningPoints) ? data.turningPoints as Array<Record<string, unknown>> : []
      return turningPoints.some(item => Number(item.chapter || 0) === chapterNo) || turningPoints.length === 0
    }
    case AnalysisDimension.STORY_OVERVIEW: {
      const outline = (data.outline || {}) as Record<string, unknown>
      const stages = Array.isArray(outline.stageBreakdown) ? outline.stageBreakdown as Array<Record<string, unknown>> : []
      return stages.some(stage => {
        const range = stringValue(stage.chapterRange)
        const start = rangeStart(range, 0)
        if (start === chapterNo) return true
        const endMatch = range.match(/(\d+)\s*[-~]\s*(\d+)/)
        if (endMatch) {
          return chapterNo >= Number(endMatch[1]) && chapterNo <= Number(endMatch[2])
        }
        return false
      }) || stages.length === 0
    }
    case AnalysisDimension.READING_EXPERIENCE: {
      const highlights = Array.isArray(data.highlightChapters) ? data.highlightChapters as Array<{ chapter?: number }> : []
      const fatigue = Array.isArray(data.fatigueChapters) ? data.fatigueChapters as Array<{ chapterRange?: string }> : []
      return highlights.some(item => Number(item.chapter || 0) === chapterNo) ||
        fatigue.some(item => rangeStart(item.chapterRange || '', 0) === chapterNo) ||
        (!highlights.length && !fatigue.length)
    }
    case AnalysisDimension.CHARACTER_RELATION:
    case AnalysisDimension.CHARACTER_ARC:
    case AnalysisDimension.WORLD_SETTING:
    default:
      return true
  }
}

function parseChapterMark(value: string) {
  const match = value.match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

function rangeStart(value: string, fallback: number) {
  const match = value.match(/(\d+)/)
  return match ? Number(match[1]) : fallback
}

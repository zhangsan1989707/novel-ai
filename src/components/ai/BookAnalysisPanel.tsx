'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Gauge,
  Layers3,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import { AnalysisDimension, BookAnalysis } from '@/types'
import { ChapterRhythmHeatmap } from '@/components/ai/ChapterRhythmHeatmap'
import { ANALYSIS_DIMENSION_LABELS } from '@/lib/analysis/config'

interface BookAnalysisPanelProps {
  projectId: number
  refreshSeed?: number
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

export function BookAnalysisPanel({ projectId, refreshSeed = 0 }: BookAnalysisPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analyses, setAnalyses] = useState<BookAnalysis[]>([])
  const [expandedVolumes, setExpandedVolumes] = useState<Set<number>>(new Set([-1]))
  const [filterDimension, setFilterDimension] = useState<AnalysisDimension | 'all'>('all')

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
    loadAnalyses()
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

  const storyOverview = (analysisMap.get(`-1:${AnalysisDimension.STORY_OVERVIEW}`)?.analysisData || {}) as Record<string, unknown>
  const readingExperience = (analysisMap.get(`-1:${AnalysisDimension.READING_EXPERIENCE}`)?.analysisData || {}) as ReadingExperienceData
  const characterRelation = (analysisMap.get(`-1:${AnalysisDimension.CHARACTER_RELATION}`)?.analysisData || {}) as Record<string, unknown>
  const chapterStructure = (analysisMap.get(`-1:${AnalysisDimension.CHAPTER_STRUCTURE}`)?.analysisData || {}) as Record<string, unknown>
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
          <span className="font-medium">拆书分析工作台</span>
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
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <OverviewCard storyOverview={storyOverview} readingExperience={readingExperience} />
            <div className="space-y-4">
              <ScoreCard readingExperience={readingExperience} />
              <CharacterFocusCard characters={topCharacters} />
            </div>
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

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <EvidenceCard chapterStructure={chapterStructure} readingExperience={readingExperience} />
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-blue-600" />
                <div className="font-medium">章节节奏热力图</div>
              </div>
              <ChapterRhythmHeatmap projectId={projectId} />
            </div>
          </div>

          <div className="space-y-3">
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
                      {volAnalyses.map(analysis => (
                        <div key={analysis.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                          <div className="mb-3 flex items-center gap-2">
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              {ANALYSIS_DIMENSION_LABELS[analysis.dimension as AnalysisDimension]}
                            </span>
                          </div>
                          {renderDimensionContent(analysis.dimension as AnalysisDimension, analysis.analysisData as Record<string, unknown>)}
                        </div>
                      ))}
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

function EvidenceCard({
  chapterStructure,
  readingExperience,
}: {
  chapterStructure: Record<string, unknown>
  readingExperience: ReadingExperienceData
}) {
  const peaks = Array.isArray(chapterStructure.peakSections) ? chapterStructure.peakSections as Array<Record<string, unknown>> : []
  const slows = Array.isArray(chapterStructure.slowSections) ? chapterStructure.slowSections as Array<Record<string, unknown>> : []
  const highlights = readingExperience.highlightChapters || []
  const fatigue = readingExperience.fatigueChapters || []

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <Layers3 className="h-4 w-4 text-indigo-600" />
        <div className="font-medium">证据层与风险段</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <EvidenceList title="高光章节" icon={<Sparkles className="h-4 w-4 text-green-600" />} items={highlights.map(item => `${item.chapter ? `第${item.chapter}章` : ''} ${item.reason || ''}`.trim())} emptyText="暂无高光章节标注" />
        <EvidenceList title="疲劳章节" icon={<TriangleAlert className="h-4 w-4 text-amber-600" />} items={fatigue.map(item => `${item.chapterRange || ''} ${item.reason || ''}`.trim())} emptyText="暂无疲劳章节标注" />
        <EvidenceList title="结构高点" icon={<Sparkles className="h-4 w-4 text-blue-600" />} items={peaks.map(item => `${stringValue(item.chapterRange)} ${stringValue(item.reason)}`.trim())} emptyText="暂无结构高点" />
        <EvidenceList title="结构低谷" icon={<TriangleAlert className="h-4 w-4 text-red-600" />} items={slows.map(item => `${stringValue(item.chapterRange)} ${stringValue(item.reason)}`.trim())} emptyText="暂无结构低谷" />
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
  items: string[]
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
            <div key={index} className="text-sm text-gray-700 dark:text-gray-300">{item}</div>
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

function renderDimensionContent(dimension: AnalysisDimension, data: Record<string, unknown>) {
  switch (dimension) {
    case AnalysisDimension.STORY_OVERVIEW:
      return <StoryOverviewView data={data} />
    case AnalysisDimension.CHARACTER_RELATION:
      return <CharacterRelationView data={data} />
    case AnalysisDimension.CHARACTER_ARC:
      return <CharacterArcView data={data} />
    case AnalysisDimension.PLOT_LINE:
      return <PlotLineView data={data} />
    case AnalysisDimension.FORESHADOWING:
      return <ForeshadowingView data={data} />
    case AnalysisDimension.CHAPTER_STRUCTURE:
      return <ChapterStructureView data={data} />
    case AnalysisDimension.READING_EXPERIENCE:
      return <ReadingExperienceView data={data as ReadingExperienceData} />
    case AnalysisDimension.WORLD_SETTING:
      return <WorldSettingView data={data} />
    default:
      return <pre className="overflow-auto text-xs">{JSON.stringify(data, null, 2)}</pre>
  }
}

function StoryOverviewView({ data }: { data: Record<string, unknown> }) {
  const summary = stringValue(data.summary)
  const outline = (data.outline || {}) as Record<string, unknown>
  const stageBreakdown = Array.isArray(outline.stageBreakdown) ? outline.stageBreakdown as Array<Record<string, unknown>> : []
  return (
    <div className="space-y-3 text-sm">
      {summary && <div className="rounded-xl bg-amber-50 px-3 py-3 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">{summary}</div>}
      {stringValue(outline.coreConflict) && <div>核心冲突：{stringValue(outline.coreConflict)}</div>}
      {stageBreakdown.length > 0 && (
        <div className="space-y-2">
          {stageBreakdown.map((stage, index) => (
            <div key={index} className="rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800">
              <div className="font-medium">{stringValue(stage.stage)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{stringValue(stage.chapterRange)}</div>
              <div className="mt-1">{stringValue(stage.summary)}</div>
            </div>
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

function PlotLineView({ data }: { data: Record<string, unknown> }) {
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
              <div key={index} className="rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950/20">
                第{String(point.chapter || '?')}章 · {stringValue(point.event)} · {stringValue(point.impact)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ForeshadowingView({ data }: { data: Record<string, unknown> }) {
  const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : []
  if (items.length === 0) return <EmptyHint text="暂无伏笔数据" />
  return (
    <div className="space-y-2 text-sm">
      {items.map((item, index) => (
        <div key={index} className="rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-800">
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
        </div>
      ))}
    </div>
  )
}

function ChapterStructureView({ data }: { data: Record<string, unknown> }) {
  const chapters = Array.isArray(data.chapters) ? data.chapters as Array<Record<string, unknown>> : []
  const arcAnalysis = stringValue(data.arcAnalysis)
  const pacingAssessment = stringValue(data.pacingAssessment)
  if (chapters.length === 0 && !arcAnalysis && !pacingAssessment) return <EmptyHint text="暂无章节结构数据" />
  return (
    <div className="space-y-3 text-sm">
      {chapters.length > 0 && (
        <div className="space-y-2">
          {chapters.slice(0, 12).map((chapter, index) => (
            <div key={index} className="flex items-start gap-2 rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800">
              <span className="min-w-[64px] font-medium">第{String(chapter.number)}章</span>
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {stringValue(chapter.function)}
              </span>
              <span>{stringValue(chapter.title)}</span>
            </div>
          ))}
        </div>
      )}
      {arcAnalysis && <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900">{arcAnalysis}</div>}
      {pacingAssessment && <div className="rounded-xl bg-blue-50 px-3 py-3 dark:bg-blue-950/20">{pacingAssessment}</div>}
    </div>
  )
}

function ReadingExperienceView({ data }: { data: ReadingExperienceData }) {
  const scores = data.scores || {}
  const entries = Object.entries(scores)
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

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  Bookmark,
  ChevronRight,
  Clock,
  GitBranch,
  Globe,
  Layers,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import { AnalysisDimension, BookAnalysis } from '@/types'
import { DraggableTimeline, type TimelineEvent } from './DraggableTimeline'

interface BookAnalysisDashboardProps {
  projectId: number
  refreshSeed?: number
  onNavigateSection?: (sectionId: string) => void
  onNavigateRequest?: (request: {
    sectionId?: string
    dimension?: AnalysisDimension
    chapterNo?: number
    anchorId?: string
  }) => void
}

type DashboardTab = 'overview' | 'characters' | 'growth' | 'plot' | 'foreshadowing' | 'structure' | 'world'

const tabs: Array<{ id: DashboardTab; label: string; icon: typeof BookOpen; dimension: AnalysisDimension }> = [
  { id: 'overview', label: '总览', icon: BookOpen, dimension: AnalysisDimension.STORY_OVERVIEW },
  { id: 'characters', label: '人物关系', icon: Users, dimension: AnalysisDimension.CHARACTER_RELATION },
  { id: 'growth', label: '角色成长', icon: TrendingUp, dimension: AnalysisDimension.CHARACTER_ARC },
  { id: 'plot', label: '剧情线', icon: GitBranch, dimension: AnalysisDimension.PLOT_LINE },
  { id: 'foreshadowing', label: '伏笔悬念', icon: Bookmark, dimension: AnalysisDimension.FORESHADOWING },
  { id: 'structure', label: '章节结构', icon: Layers, dimension: AnalysisDimension.CHAPTER_STRUCTURE },
  { id: 'world', label: '世界观设定', icon: Globe, dimension: AnalysisDimension.WORLD_SETTING },
]

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

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function chapterNo(value: string): number {
  const match = value.match(/(\d+)/)
  return match ? Number(match[1]) : 1
}

const tabSectionMap: Record<DashboardTab, string> = {
  overview: 'overview-panel',
  characters: 'details-panel',
  growth: 'details-panel',
  plot: 'timeline-panel',
  foreshadowing: 'evidence-panel',
  structure: 'details-panel',
  world: 'overview-panel',
}

export function BookAnalysisDashboard({
  projectId,
  refreshSeed = 0,
  onNavigateSection,
  onNavigateRequest,
}: BookAnalysisDashboardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analyses, setAnalyses] = useState<BookAnalysis[]>([])
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')

  const loadAnalyses = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/book-analysis?dimension=all`)
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
  }, [projectId])

  useEffect(() => {
    loadAnalyses()
  }, [loadAnalyses, refreshSeed])

  const analysisMap = useMemo(() => {
    const map = new Map<string, BookAnalysis>()
    analyses.forEach(item => {
      map.set(`${item.volumeNumber}:${item.dimension}`, item)
    })
    return map
  }, [analyses])

  const getAnalysisData = (dimension: AnalysisDimension) => {
    return (analysisMap.get(`-1:${dimension}`)?.analysisData || {}) as Record<string, unknown>
  }

  const storyOverview = getAnalysisData(AnalysisDimension.STORY_OVERVIEW)
  const readingExperience = getAnalysisData(AnalysisDimension.READING_EXPERIENCE) as ReadingExperienceData
  const plotLine = getAnalysisData(AnalysisDimension.PLOT_LINE)
  const foreshadowing = getAnalysisData(AnalysisDimension.FORESHADOWING)
  const chapterStructure = getAnalysisData(AnalysisDimension.CHAPTER_STRUCTURE)
  const worldSetting = getAnalysisData(AnalysisDimension.WORLD_SETTING)
  const characterRelation = getAnalysisData(AnalysisDimension.CHARACTER_RELATION)
  const characterGrowth = getAnalysisData(AnalysisDimension.CHARACTER_ARC)

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = []

    const settings = Array.isArray(worldSetting.settings) ? worldSetting.settings as Array<Record<string, unknown>> : []
    settings.slice(0, 8).forEach((item, index) => {
      const chapter = chapterNo(stringValue(item.firstAppear))
      events.push({
        id: `setting-${index}`,
        chapter,
        title: stringValue(item.name) || `设定 ${index + 1}`,
        description: stringValue(item.description) || '世界观设定',
        type: 'setting',
        importance: 'minor',
      })
    })

    const characters = Array.isArray(characterRelation.characters) ? characterRelation.characters as Array<Record<string, unknown>> : []
    characters.slice(0, 5).forEach((item, index) => {
      const chapter = Number(item.firstChapter || index + 1)
      events.push({
        id: `character-${index}`,
        chapter,
        title: stringValue(item.name) || `角色 ${index + 1}`,
        description: stringValue(item.description) || stringValue(item.role),
        type: 'character',
        importance: index === 0 ? 'major' : 'minor',
      })
    })

    const turningPoints = Array.isArray(plotLine.turningPoints) ? plotLine.turningPoints as Array<Record<string, unknown>> : []
    turningPoints.slice(0, 8).forEach((item, index) => {
      events.push({
        id: `turn-${index}`,
        chapter: Number(item.chapter || index + 1),
        title: stringValue(item.event) || `转折 ${index + 1}`,
        description: stringValue(item.impact) || '剧情转折',
        type: 'event',
        importance: 'major',
      })
    })

    const highlights = Array.isArray(readingExperience.highlightChapters) ? readingExperience.highlightChapters : []
    highlights.slice(0, 5).forEach((item, index) => {
      if (!item.chapter) return
      events.push({
        id: `highlight-${index}`,
        chapter: Number(item.chapter),
        title: `高光章节`,
        description: item.reason || '阅读体验高点',
        type: 'power',
        importance: 'minor',
      })
    })

    return events.sort((a, b) => a.chapter - b.chapter)
  }, [characterRelation.characters, plotLine.turningPoints, readingExperience.highlightChapters, worldSetting.settings])

  const unresolvedCount = useMemo(() => {
    const items = Array.isArray(foreshadowing.items) ? foreshadowing.items as Array<Record<string, unknown>> : []
    return items.filter(item => !item.payoff || String(item.payoff).trim() === '' || String(item.payoff).trim() === '待回收').length
  }, [foreshadowing.items])

  const characters = Array.isArray(characterRelation.characters) ? characterRelation.characters as Array<Record<string, unknown>> : []
  const chapters = Array.isArray(chapterStructure.chapters) ? chapterStructure.chapters as Array<Record<string, unknown>> : []
  const scores = readingExperience.scores || {}
  const strengths = Array.isArray(storyOverview.strengths) ? storyOverview.strengths as string[] : []
  const risks = Array.isArray(storyOverview.risks) ? storyOverview.risks as string[] : []
  const stageBreakdown = Array.isArray((storyOverview.outline as Record<string, unknown>)?.stageBreakdown)
    ? (storyOverview.outline as Record<string, unknown>).stageBreakdown as Array<Record<string, unknown>>
    : []

  const jumpToPanel = useCallback((request: {
    sectionId?: string
    dimension?: AnalysisDimension
    chapterNo?: number
    anchorId?: string
  }) => {
    if (request.sectionId) {
      onNavigateSection?.(request.sectionId)
    }
    onNavigateRequest?.(request)
  }, [onNavigateRequest, onNavigateSection])

  if (loading && analyses.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        正在加载拆书分析结果...
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-amber-600" />
          <span className="font-medium">拆书总览</span>
        </div>
        <button
          onClick={loadAnalyses}
          className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard
          label="角色数量"
          value={characters.length}
          icon={Users}
          onClick={() => {
            setActiveTab('characters')
            jumpToPanel({
              sectionId: tabSectionMap.characters,
              dimension: AnalysisDimension.CHARACTER_RELATION,
            })
          }}
        />
        <StatCard
          label="待回收伏笔"
          value={unresolvedCount}
          icon={Bookmark}
          onClick={() => {
            setActiveTab('foreshadowing')
            jumpToPanel({
              sectionId: tabSectionMap.foreshadowing,
              dimension: AnalysisDimension.FORESHADOWING,
            })
          }}
        />
        <StatCard
          label="阶段划分"
          value={stageBreakdown.length}
          icon={Layers}
          onClick={() => {
            setActiveTab('plot')
            jumpToPanel({
              sectionId: tabSectionMap.plot,
              dimension: AnalysisDimension.STORY_OVERVIEW,
            })
          }}
        />
        <StatCard
          label="章节数"
          value={chapters.length}
          icon={Target}
          onClick={() => {
            setActiveTab('structure')
            jumpToPanel({
              sectionId: tabSectionMap.structure,
              dimension: AnalysisDimension.CHAPTER_STRUCTURE,
            })
          }}
        />
      </div>

      <details open className="rounded-xl border border-gray-200 bg-amber-50 p-5 dark:border-gray-800 dark:bg-amber-950/20">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
          <Sparkles className="h-4 w-4 text-amber-600" />
          核心摘要
        </summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <SummaryCard label="题材定位" value={stringValue((storyOverview.positioning as Record<string, unknown>)?.genreLabel) || '暂无'} />
          <SummaryCard label="目标读者" value={stringValue((storyOverview.positioning as Record<string, unknown>)?.targetReader) || '暂无'} />
          <SummaryCard label="核心钩子" value={stringValue((storyOverview.positioning as Record<string, unknown>)?.coreHook) || '暂无'} />
          <SummaryCard label="核心冲突" value={stringValue((storyOverview.outline as Record<string, unknown>)?.coreConflict) || '暂无'} />
        </div>
        {stringValue((storyOverview.outline as Record<string, unknown>)?.premise) && (
          <div className="mt-4 rounded-lg bg-white px-4 py-3 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {stringValue((storyOverview.outline as Record<string, unknown>)?.premise)}
          </div>
        )}
        {strengths.length > 0 || risks.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {strengths.length > 0 && (
              <SummaryListCard title="强项" tone="green" items={strengths} />
            )}
            {risks.length > 0 && (
              <SummaryListCard title="风险" tone="red" items={risks} />
            )}
          </div>
        ) : null}
      </details>

      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">章节时间轴</span>
        </div>
        <DraggableTimeline
          events={timelineEvents}
          className="h-[220px]"
          onEventClick={(event) => {
            const nextTab = event.type === 'setting' ? 'world' : event.type === 'character' ? 'characters' : 'plot'
            const nextDimension = event.type === 'setting'
              ? AnalysisDimension.WORLD_SETTING
              : event.type === 'character'
                ? AnalysisDimension.CHARACTER_RELATION
                : AnalysisDimension.PLOT_LINE
            const nextSection = event.type === 'setting'
              ? 'overview-panel'
              : event.type === 'character'
                ? 'details-panel'
                : 'timeline-panel'

            setActiveTab(nextTab)
            jumpToPanel({
              sectionId: nextSection,
              dimension: nextDimension,
              chapterNo: event.chapter,
            })
          }}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 p-2 dark:border-gray-800">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  jumpToPanel({
                    sectionId: tabSectionMap[tab.id],
                    dimension: tab.dimension,
                  })
                }}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="p-5">
          {activeTab === 'overview' && (
            <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {Object.entries(scores).map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-gray-100 p-3 text-center dark:border-gray-800">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(Number(value))}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{key}</div>
                  </div>
                ))}
              </div>
              {timelineEvents.length > 0 && (
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-950/20">
                  总览已提取 {timelineEvents.length} 个关键时间节点，可拖动时间轴查看章节分布。
                </div>
              )}
              <button
                type="button"
                onClick={() => jumpToPanel({
                  sectionId: 'overview-panel',
                  dimension: AnalysisDimension.STORY_OVERVIEW,
                })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
              >
                查看完整分析工作台
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {activeTab === 'characters' && <TextList items={characters.map(item => `${stringValue(item.name)} · ${stringValue(item.role)}`)} empty="暂无人物关系数据" />}
          {activeTab === 'growth' && <TextList items={extractGrowthSummary(characterGrowth)} empty="暂无角色成长数据" />}
          {activeTab === 'plot' && <TextList items={extractPlotSummary(plotLine)} empty="暂无剧情线数据" />}
          {activeTab === 'foreshadowing' && <TextList items={extractForeshadowingSummary(foreshadowing)} empty="暂无伏笔悬念数据" />}
          {activeTab === 'structure' && <TextList items={extractChapterSummary(chapterStructure, readingExperience)} empty="暂无章节结构数据" />}
          {activeTab === 'world' && <TextList items={extractWorldSummary(worldSetting)} empty="暂无世界观设定数据" />}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  onClick,
}: {
  label: string
  value: number
  icon: typeof BookOpen
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-600" />
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
    </button>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-3 dark:bg-gray-900">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  )
}

function SummaryListCard({ title, tone, items }: { title: string; tone: 'green' | 'red'; items: string[] }) {
  const toneClass =
    tone === 'green'
      ? 'border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20'
      : 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
  const textClass = tone === 'green' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className={`mb-2 text-sm font-medium ${tone === 'green' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>{title}</div>
      <ul className={`space-y-1 text-sm ${textClass}`}>
        {items.map((item, index) => <li key={index}>- {item}</li>)}
      </ul>
    </div>
  )
}

function TextList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        {empty}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  )
}

function extractGrowthSummary(data: Record<string, unknown>) {
  const summary: string[] = []
  const protagonist = (data.protagonistArc || {}) as Record<string, unknown>
  if (stringValue(protagonist.startState) || stringValue(protagonist.endState)) {
    summary.push(`主角：${stringValue(protagonist.startState)} → ${stringValue(protagonist.endState)}`)
  }
  const supporting = Array.isArray(data.supportingArcs) ? data.supportingArcs as Array<Record<string, unknown>> : []
  supporting.slice(0, 4).forEach(item => summary.push(`${stringValue(item.name)}：${stringValue(item.function)}`))
  const antagonist = (data.antagonistPressure || {}) as Record<string, unknown>
  if (stringValue(antagonist.effectiveness)) {
    summary.push(`反派压迫感：${stringValue(antagonist.effectiveness)}`)
  }
  return summary
}

function extractPlotSummary(data: Record<string, unknown>) {
  const summary: string[] = []
  const mainPlot = Array.isArray(data.mainPlot) ? data.mainPlot as Array<Record<string, unknown>> : []
  mainPlot.slice(0, 4).forEach(item => summary.push(`${stringValue(item.title)}：${stringValue(item.emotionalArc)}`))
  const turningPoints = Array.isArray(data.turningPoints) ? data.turningPoints as Array<Record<string, unknown>> : []
  turningPoints.slice(0, 6).forEach(item => summary.push(`第${String(item.chapter || '?')}章：${stringValue(item.event)}`))
  return summary
}

function extractForeshadowingSummary(data: Record<string, unknown>) {
  const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : []
  return items.slice(0, 8).map(item => `第${String(item.chapter || '?')}章：埋 ${stringValue(item.setup)} / 收 ${stringValue(item.payoff) || '待回收'}`)
}

function extractChapterSummary(data: Record<string, unknown>, reading: ReadingExperienceData) {
  const summary: string[] = []
  const chapters = Array.isArray(data.chapters) ? data.chapters as Array<Record<string, unknown>> : []
  chapters.slice(0, 8).forEach(item => summary.push(`第${String(item.number || '?')}章 · ${stringValue(item.function)} · ${stringValue(item.title)}`))
  if (reading.readingFeel?.hookSummary) summary.push(`开篇抓力：${reading.readingFeel.hookSummary}`)
  if (reading.readingFeel?.chapterEndingSummary) summary.push(`章尾钩子：${reading.readingFeel.chapterEndingSummary}`)
  return summary
}

function extractWorldSummary(data: Record<string, unknown>) {
  const summary: string[] = []
  const settings = Array.isArray(data.settings) ? data.settings as Array<Record<string, unknown>> : []
  settings.slice(0, 6).forEach(item => summary.push(`${stringValue(item.name)}：${stringValue(item.description)}`))
  const power = (data.powerSystem || {}) as Record<string, unknown>
  if (stringValue(power.name)) summary.push(`力量体系：${stringValue(power.name)}`)
  if (stringValue(data.consistency)) summary.push(`一致性：${stringValue(data.consistency)}`)
  return summary
}

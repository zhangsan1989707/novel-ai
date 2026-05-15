'use client'

import { useState, useEffect } from 'react'
import { BookOpen, RefreshCw, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { AnalysisDimension, BookAnalysis } from '@/types'

interface BookAnalysisPanelProps {
  projectId: number
  totalVolumes?: number
}

const dimensionLabels: Record<AnalysisDimension, string> = {
  [AnalysisDimension.CHARACTER_RELATION]: '人物关系',
  [AnalysisDimension.PLOT_LINE]: '剧情线',
  [AnalysisDimension.FORESHADOWING]: '伏笔悬念',
  [AnalysisDimension.CHAPTER_STRUCTURE]: '章节结构',
  [AnalysisDimension.WORLD_SETTING]: '世界观设定',
}

export function BookAnalysisPanel({ projectId, totalVolumes = 4 }: BookAnalysisPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analyses, setAnalyses] = useState<BookAnalysis[]>([])
  const [expandedVolumes, setExpandedVolumes] = useState<Set<number>>(new Set([-1]))
  const [filterDimension, setFilterDimension] = useState<AnalysisDimension | 'all'>('all')

  // 加载分析结果
  const loadAnalyses = async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      // 明确传递 dimension 参数，即使选择"全部"也传递，让后端处理
      params.set('dimension', filterDimension)

      const res = await fetch(`/api/novel/projects/${projectId}/book-analysis?${params}`)
      const data = await res.json()

      if (data.success) {
        setAnalyses(data.data)
      } else {
        setError(data.error?.message || '加载失败')
      }
    } catch (err) {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalyses()
  }, [projectId, filterDimension])

  // 按卷分组
  const groupedByVolume = analyses.reduce((acc, analysis) => {
    const vol = analysis.volumeNumber
    if (!acc[vol]) acc[vol] = []
    acc[vol].push(analysis)
    return acc
  }, {} as Record<number, BookAnalysis[]>)

  // 切换卷展开/折叠
  const toggleVolume = (vol: number) => {
    setExpandedVolumes(prev => {
      const next = new Set(prev)
      if (next.has(vol)) {
        next.delete(vol)
      } else {
        next.add(vol)
      }
      return next
    })
  }

  // 渲染特定维度的内容
  const renderDimensionContent = (dimension: AnalysisDimension, data: Record<string, unknown>) => {
    switch (dimension) {
      case AnalysisDimension.CHARACTER_RELATION:
        return <CharacterRelationView data={data} />
      case AnalysisDimension.PLOT_LINE:
        return <PlotLineView data={data} />
      case AnalysisDimension.FORESHADOWING:
        return <ForeshadowingView data={data} />
      case AnalysisDimension.CHAPTER_STRUCTURE:
        return <ChapterStructureView data={data} />
      case AnalysisDimension.WORLD_SETTING:
        return <WorldSettingView data={data} />
      default:
        return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>
    }
  }

  const volumeLabel = (vol: number) => {
    if (vol === -1) return '整书'
    if (vol === 0) return '全卷'
    return `第${vol}卷`
  }

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-purple-500" />
          <span className="font-medium">拆书分析结果</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterDimension}
            onChange={(e) => setFilterDimension(e.target.value as AnalysisDimension | 'all')}
            className="text-sm h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            <option value="all">全部维度</option>
            {Object.entries(dimensionLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button
            onClick={loadAnalyses}
            disabled={loading}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* 空状态 */}
      {analyses.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>暂无分析结果</p>
          <p className="text-sm">请先使用拆书功能生成分析</p>
        </div>
      )}

      {/* 分析结果列表 */}
      <div className="space-y-3">
        {Object.entries(groupedByVolume)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([vol, volAnalyses]) => (
            <div key={vol} className="border rounded-lg overflow-hidden">
              {/* 卷标题 */}
              <button
                onClick={() => toggleVolume(Number(vol))}
                className="w-full flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {expandedVolumes.has(Number(vol)) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="font-medium">{volumeLabel(Number(vol))}</span>
                <span className="text-sm text-muted-foreground">
                  ({volAnalyses.length} 个维度)
                </span>
              </button>

              {/* 展开的内容 */}
              {expandedVolumes.has(Number(vol)) && (
                <div className="p-3 space-y-3">
                  {volAnalyses.map(analysis => (
                    <div key={analysis.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                      <div className="font-medium text-sm mb-2 flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded text-xs">
                          {dimensionLabels[analysis.dimension as AnalysisDimension]}
                        </span>
                      </div>
                      <div className="text-sm">
                        {renderDimensionContent(
                          analysis.dimension as AnalysisDimension,
                          analysis.analysisData as Record<string, unknown>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}

// ============ 维度视图组件 ============

function CharacterRelationView({ data }: { data: Record<string, unknown> }) {
  const characters = (data.characters as Array<{
    name: string
    role: string
    description: string
    relationships: { target: string; type: string }[]
  }>) || []

  if (characters.length === 0) {
    return <p className="text-muted-foreground">暂无人物关系数据</p>
  }

  return (
    <div className="space-y-3">
      {characters.map((char, i) => (
        <div key={i} className="border-l-2 border-purple-500 pl-3">
          <div className="font-medium">{char.name}</div>
          <div className="text-xs text-muted-foreground capitalize">{char.role}</div>
          <div className="text-sm mt-1">{char.description}</div>
          {char.relationships && char.relationships.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {char.relationships.map((rel, j) => (
                <span key={j} className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                  {rel.target} ({rel.type})
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PlotLineView({ data }: { data: Record<string, unknown> }) {
  const mainPlot = (data.mainPlot as Array<{ title: string; keyEvents: string[] }>) || []
  const subPlots = (data.subPlots as Array<{ title: string; keyEvents: string[] }>) || []

  if (mainPlot.length === 0 && subPlots.length === 0) {
    return <p className="text-muted-foreground">暂无剧情线数据</p>
  }

  return (
    <div className="space-y-4">
      {mainPlot.length > 0 && (
        <div>
          <div className="font-medium text-sm mb-2 text-purple-600 dark:text-purple-400">主线</div>
          {mainPlot.map((plot, i) => (
            <div key={i} className="mb-2">
              <div className="font-medium">{plot.title}</div>
              <ul className="text-sm ml-4 list-disc">
                {plot.keyEvents?.map((event, j) => (
                  <li key={j}>{event}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {subPlots.length > 0 && (
        <div>
          <div className="font-medium text-sm mb-2 text-gray-600 dark:text-gray-400">副线</div>
          {subPlots.map((plot, i) => (
            <div key={i} className="mb-2">
              <div className="font-medium">{plot.title}</div>
              <ul className="text-sm ml-4 list-disc">
                {plot.keyEvents?.map((event, j) => (
                  <li key={j}>{event}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ForeshadowingView({ data }: { data: Record<string, unknown> }) {
  const items = (data.items as Array<{
    setup: string
    payoff?: string
    chapter?: number
    importance: string
  }>) || []

  if (items.length === 0) {
    return <p className="text-muted-foreground">暂无伏笔数据</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border rounded p-2">
          <div className="flex items-start gap-2">
            <span className={`px-1.5 py-0.5 text-xs rounded ${
              item.importance === 'major'
                ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}>
              {item.importance === 'major' ? '重要' : '次要'}
            </span>
            <div className="flex-1">
              <div className="text-sm">埋: {item.setup}</div>
              {item.payoff && (
                <div className="text-sm text-purple-600 dark:text-purple-400">
                  收: {item.payoff}
                  {item.chapter && <span className="text-muted-foreground"> (第{item.chapter}章)</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ChapterStructureView({ data }: { data: Record<string, unknown> }) {
  const chapters = (data.chapters as Array<{
    number: number
    title: string
    function: string
    keyEvents: string[]
  }>) || []
  const arcAnalysis = data.arcAnalysis as string

  const functionLabels: Record<string, string> = {
    setup: '开篇',
    development: '发展',
    climax: '高潮',
    resolution: '解决',
    transition: '过渡',
  }

  if (chapters.length === 0 && !arcAnalysis) {
    return <p className="text-muted-foreground">暂无章节结构数据</p>
  }

  return (
    <div className="space-y-3">
      {chapters.length > 0 && (
        <div className="space-y-1">
          {chapters.map((ch, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="font-medium min-w-[60px]">第{ch.number}章</span>
              <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                {functionLabels[ch.function] || ch.function}
              </span>
              <span>{ch.title}</span>
            </div>
          ))}
        </div>
      )}
      {arcAnalysis && (
        <div className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
          {arcAnalysis}
        </div>
      )}
    </div>
  )
}

function WorldSettingView({ data }: { data: Record<string, unknown> }) {
  const settings = (data.settings as Array<{
    name: string
    description: string
    rules?: string[]
  }>) || []
  const powerSystem = data.powerSystem as { name: string; levels: string[] } | undefined

  if (settings.length === 0 && !powerSystem) {
    return <p className="text-muted-foreground">暂无世界观数据</p>
  }

  return (
    <div className="space-y-4">
      {settings.length > 0 && (
        <div className="space-y-2">
          {settings.map((setting, i) => (
            <div key={i} className="border-l-2 border-blue-500 pl-3">
              <div className="font-medium">{setting.name}</div>
              <div className="text-sm">{setting.description}</div>
              {setting.rules && setting.rules.length > 0 && (
                <ul className="text-sm ml-4 list-disc mt-1">
                  {setting.rules.map((rule, j) => (
                    <li key={j}>{rule}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {powerSystem && (
        <div className="border-l-2 border-orange-500 pl-3">
          <div className="font-medium">{powerSystem.name}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {powerSystem.levels?.map((level, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded">
                {level}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

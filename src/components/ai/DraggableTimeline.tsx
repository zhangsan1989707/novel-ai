'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Filter, MapPin, Minus, Plus, Users, Zap } from 'lucide-react'

export interface TimelineEvent {
  id: string
  chapter: number
  title: string
  description: string
  type: 'setting' | 'character' | 'event' | 'power'
  importance: 'major' | 'minor'
}

interface DraggableTimelineProps {
  events: TimelineEvent[]
  onEventClick?: (event: TimelineEvent) => void
  className?: string
  totalChapters?: number
}

type TimelineFilter = 'all' | TimelineEvent['type']

interface TimelineCluster {
  id: string
  chapter: number
  items: TimelineEvent[]
}

const typeConfig: Record<TimelineEvent['type'], { icon: typeof Clock; color: string; label: string }> = {
  setting: {
    icon: MapPin,
    color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    label: '设定',
  },
  character: {
    icon: Users,
    color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 dark:border-fuchsia-800',
    label: '角色',
  },
  event: {
    icon: Zap,
    color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    label: '转折',
  },
  power: {
    icon: Clock,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
    label: '高光',
  },
}

const laneClassByType: Record<TimelineEvent['type'], string> = {
  setting: 'top-[14px]',
  character: 'top-[40px]',
  event: 'top-[66px]',
  power: 'top-[92px]',
}

function buildChapterTicks(totalChapters: number) {
  if (totalChapters <= 12) {
    return Array.from({ length: totalChapters }, (_, index) => index + 1)
  }

  const step = totalChapters <= 24 ? 2 : totalChapters <= 60 ? 5 : totalChapters <= 120 ? 10 : 20
  const ticks: number[] = [1]
  for (let chapter = step; chapter < totalChapters; chapter += step) {
    ticks.push(chapter)
  }
  if (ticks[ticks.length - 1] !== totalChapters) {
    ticks.push(totalChapters)
  }
  return ticks
}

function clampZoom(value: number) {
  return Math.max(0.75, Math.min(1.8, Number(value.toFixed(2))))
}

export function DraggableTimeline({
  events,
  onEventClick,
  className = '',
  totalChapters,
}: DraggableTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ startX: number; scrollLeft: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>('all')
  const [zoom, setZoom] = useState(1)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)

  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.chapter - b.chapter), [events])
  const filteredEvents = useMemo(
    () => sortedEvents.filter(event => activeFilter === 'all' || event.type === activeFilter),
    [activeFilter, sortedEvents]
  )

  const maxDetectedChapter = sortedEvents[sortedEvents.length - 1]?.chapter ?? 1
  const safeTotalChapters = Math.max(totalChapters || 0, maxDetectedChapter, 1)
  const chapterTicks = useMemo(() => buildChapterTicks(safeTotalChapters), [safeTotalChapters])
  const trackWidth = Math.max(safeTotalChapters * 32 * zoom, 960)

  const clusters = useMemo<TimelineCluster[]>(() => {
    const clusterMap = new Map<number, TimelineEvent[]>()
    filteredEvents.forEach(event => {
      const bucket = clusterMap.get(event.chapter) || []
      bucket.push(event)
      clusterMap.set(event.chapter, bucket)
    })
    return Array.from(clusterMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([chapter, items]) => ({
        id: `chapter-${chapter}-${activeFilter}`,
        chapter,
        items,
      }))
  }, [activeFilter, filteredEvents])

  const densityByChapter = useMemo(() => {
    const density = new Map<number, number>()
    filteredEvents.forEach(event => {
      density.set(event.chapter, (density.get(event.chapter) || 0) + (event.importance === 'major' ? 2 : 1))
    })
    return density
  }, [filteredEvents])

  const maxDensity = useMemo(() => {
    const values = Array.from(densityByChapter.values())
    return values.length > 0 ? Math.max(...values) : 1
  }, [densityByChapter])

  const selectedCluster = clusters.find(cluster => cluster.id === selectedId) || null

  const checkArrows = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setShowLeftArrow(scrollLeft > 10)
    setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10)
  }

  useEffect(() => {
    checkArrows()
  }, [trackWidth, clusters.length])

  useEffect(() => {
    const handleResize = () => checkArrows()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (selectedCluster) return
    setSelectedId(clusters[0]?.id ?? null)
  }, [clusters, selectedCluster])

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

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -360 : 360,
      behavior: 'smooth',
    })
  }

  const setZoomLevel = (nextZoom: number) => {
    setZoom(current => clampZoom(typeof nextZoom === 'number' ? nextZoom : current))
  }

  if (events.length === 0) {
    return (
      <div className={`rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400 ${className}`}>
        暂无时间轴事件
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
            <Filter className="h-3.5 w-3.5" />
            类型筛选
          </div>
          {(['all', 'setting', 'character', 'event', 'power'] as TimelineFilter[]).map(filter => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFilter === filter
                  ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              {filter === 'all' ? '全部' : typeConfig[filter].label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">缩放</span>
          <button
            type="button"
            onClick={() => setZoomLevel(zoom - 0.15)}
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:border-blue-200 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-[56px] text-center text-xs font-medium text-gray-700 dark:text-gray-200">{Math.round(zoom * 100)}%</div>
          <button
            type="button"
            onClick={() => setZoomLevel(zoom + 0.15)}
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:border-blue-200 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-4 dark:border-gray-800 dark:from-gray-900 dark:to-gray-950">
        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-3 top-[8.2rem] z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
        )}
        {showRightArrow && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-3 top-[8.2rem] z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="cursor-grab overflow-x-auto pb-2 active:cursor-grabbing scrollbar-thin"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onScroll={checkArrows}
        >
          <div className="relative pt-4" style={{ width: `${trackWidth}px` }}>
            <div className="mb-3 grid grid-cols-4 gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              <div className="rounded-lg bg-white/90 px-3 py-2 dark:bg-gray-900/80">章节范围 第1章 - 第{safeTotalChapters}章</div>
              <div className="rounded-lg bg-white/90 px-3 py-2 dark:bg-gray-900/80">当前节点 {clusters.length} 个</div>
              <div className="rounded-lg bg-white/90 px-3 py-2 dark:bg-gray-900/80">当前筛选 {activeFilter === 'all' ? '全部类型' : typeConfig[activeFilter].label}</div>
              <div className="rounded-lg bg-white/90 px-3 py-2 dark:bg-gray-900/80">拖动轨道或点击节点查看本章事件</div>
            </div>

            <div className="relative h-[170px] rounded-2xl border border-gray-200 bg-white/80 px-6 py-5 dark:border-gray-800 dark:bg-gray-900/80">
              <div className="absolute inset-x-6 top-[110px] h-1 rounded-full bg-gray-200 dark:bg-gray-700" />

              {Array.from({ length: safeTotalChapters }, (_, index) => {
                const chapter = index + 1
                const left = safeTotalChapters > 1 ? (index / (safeTotalChapters - 1)) * 100 : 0
                const density = densityByChapter.get(chapter) || 0
                const height = density > 0 ? Math.max(10, (density / maxDensity) * 42) : 6
                return (
                  <div
                    key={`density-${chapter}`}
                    className={`absolute bottom-[48px] w-[3px] -translate-x-1/2 rounded-full ${
                      density > 0 ? 'bg-blue-500/70 dark:bg-blue-400/70' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                    style={{ left: `${left}%`, height: `${height}px` }}
                  />
                )
              })}

              {chapterTicks.map(chapter => {
                const left = safeTotalChapters > 1 ? ((chapter - 1) / (safeTotalChapters - 1)) * 100 : 0
                return (
                  <div
                    key={`tick-${chapter}`}
                    className="absolute bottom-2 -translate-x-1/2 text-[10px] font-medium text-gray-500 dark:text-gray-400"
                    style={{ left: `${left}%` }}
                  >
                    第{chapter}章
                  </div>
                )
              })}

              {clusters.map(cluster => {
                const left = safeTotalChapters > 1 ? ((cluster.chapter - 1) / (safeTotalChapters - 1)) * 100 : 0
                const primaryType = cluster.items.find(item => item.importance === 'major')?.type || cluster.items[0].type
                const config = typeConfig[primaryType]
                const Icon = config.icon
                const importanceScore = cluster.items.some(item => item.importance === 'major')
                const densityScale = Math.min(1.25, 1 + (cluster.items.length - 1) * 0.08)
                return (
                  <div
                    key={cluster.id}
                    className={`absolute -translate-x-1/2 ${laneClassByType[primaryType]}`}
                    style={{ left: `${left}%` }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(cluster.id)}
                      className={`group flex flex-col items-center gap-1 ${selectedId === cluster.id ? 'z-20' : 'z-10'}`}
                    >
                      <div
                        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-left transition-all ${
                          selectedId === cluster.id ? 'scale-[1.03] ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900' : ''
                        } ${config.color}`}
                        style={{ transform: `scale(${densityScale})` }}
                      >
                        <div className={`flex items-center justify-center rounded-full border border-white/50 bg-white/70 ${importanceScore ? 'h-8 w-8' : 'h-7 w-7'}`}>
                          <Icon className={`text-current ${importanceScore ? 'h-4 w-4' : 'h-3.5 w-3.5'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold leading-none">第{cluster.chapter}章 · {cluster.items.length}项</div>
                          <div className="mt-1 max-w-[140px] text-[11px] leading-tight text-current/80">
                            {cluster.items[0].title}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          {selectedCluster ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">第{selectedCluster.chapter}章事件概览</div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">共 {selectedCluster.items.length} 项，点击下方条目可跳转到对应分析明细。</div>
                </div>
                <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                  当前筛选：{activeFilter === 'all' ? '全部类型' : typeConfig[activeFilter].label}
                </div>
              </div>

              <div className="grid gap-2">
                {selectedCluster.items.map(item => {
                  const config = typeConfig[item.type]
                  const Icon = config.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onEventClick?.(item)}
                      className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-800 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${config.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color}`}>{config.label}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              item.importance === 'major'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                              {item.importance === 'major' ? '重要' : '次要'}
                            </span>
                          </div>
                          <div className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{item.description}</div>
                        </div>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">点击时间轴节点查看当前章节事件。</div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
        {Object.entries(typeConfig).map(([key, config]) => {
          const Icon = config.icon
          return (
            <div key={key} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 dark:border-gray-700 dark:bg-gray-900">
              <div className={`flex h-5 w-5 items-center justify-center rounded-full ${config.color}`}>
                <Icon className="h-3 w-3" />
              </div>
              {config.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

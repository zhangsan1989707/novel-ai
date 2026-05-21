'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, MapPin, Users, Zap } from 'lucide-react'

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
}

const typeConfig: Record<TimelineEvent['type'], { icon: typeof Clock; color: string; label: string }> = {
  setting: {
    icon: MapPin,
    color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    label: '设定',
  },
  character: {
    icon: Users,
    color: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
    label: '角色',
  },
  event: {
    icon: Zap,
    color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    label: '事件',
  },
  power: {
    icon: Clock,
    color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    label: '力量',
  },
}

export function DraggableTimeline({ events, onEventClick, className = '' }: DraggableTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ startX: number; scrollLeft: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)

  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.chapter - b.chapter), [events])
  const minChapter = sortedEvents[0]?.chapter ?? 1
  const maxChapter = sortedEvents[sortedEvents.length - 1]?.chapter ?? 1
  const chapterRange = maxChapter - minChapter || 1
  const trackWidth = Math.max(chapterRange * 84, 720)

  const checkArrows = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setShowLeftArrow(scrollLeft > 10)
    setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10)
  }

  useEffect(() => {
    checkArrows()
  }, [trackWidth])

  useEffect(() => {
    const handleResize = () => checkArrows()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
      left: direction === 'left' ? -300 : 300,
      behavior: 'smooth',
    })
  }

  if (events.length === 0) {
    return (
      <div className={`rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400 ${className}`}>
        暂无时间轴事件
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {showLeftArrow && (
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-1.5 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
        >
          <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>
      )}
      {showRightArrow && (
        <button
          onClick={() => handleScroll('right')}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-1.5 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
        >
          <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>
      )}

      <div
        ref={scrollRef}
        className="cursor-grab overflow-x-auto pb-4 active:cursor-grabbing scrollbar-thin"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onScroll={checkArrows}
      >
        <div className="relative pt-8 pb-4" style={{ width: `${trackWidth}px` }}>
          <div className="absolute left-0 right-0 top-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="flex items-start gap-0">
            {sortedEvents.map((event) => {
              const config = typeConfig[event.type]
              const Icon = config.icon
              const position = chapterRange > 0 ? ((event.chapter - minChapter) / chapterRange) * 100 : 0

              return (
                <div
                  key={event.id}
                  className="relative flex flex-col items-center"
                  style={{ position: 'absolute', left: `${position}%`, transform: 'translateX(-50%)' }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(selectedId === event.id ? null : event.id)
                      onEventClick?.(event)
                    }}
                    onKeyDown={(keyboardEvent) => {
                      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                        keyboardEvent.preventDefault()
                        setSelectedId(selectedId === event.id ? null : event.id)
                        onEventClick?.(event)
                      }
                    }}
                    className={`group relative flex flex-col items-center gap-1 ${selectedId === event.id ? 'z-20' : 'z-10'}`}
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                        event.importance === 'major' ? 'h-10 w-10 shadow-md' : ''
                      } ${
                        selectedId === event.id ? 'scale-110 ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900' : ''
                      } ${config.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="whitespace-nowrap text-[10px] font-medium text-gray-500 dark:text-gray-400">
                      第{event.chapter}章
                    </span>
                    <span className="max-w-[80px] truncate text-xs font-medium text-gray-900 dark:text-gray-100">
                      {event.title}
                    </span>
                  </button>

                  {selectedId === event.id && (
                    <div className="absolute top-full z-30 mt-12 w-60 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          event.importance === 'major'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {event.importance === 'major' ? '重要' : '次要'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">{event.title}</div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">第 {event.chapter} 章</div>
                      <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">{event.description}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        {Object.entries(typeConfig).map(([key, config]) => {
          const Icon = config.icon
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`flex h-5 w-5 items-center justify-center rounded-full ${config.color}`}>
                <Icon className="h-3 w-3" />
              </div>
              {config.label}
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800">
          章节范围 第{minChapter}章 - 第{maxChapter}章
        </span>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800">
          拖动轨道或点击节点跳转工作台
        </span>
      </div>
    </div>
  )
}

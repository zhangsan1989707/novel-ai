'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { cn } from '@/lib/utils'

interface QualityScoreData {
  chapterNo: number
  completionScore: number
  actualWordCount: number
  targetWordCount: number
  issues: unknown
  flags: {
    chapterGoalCompleted: boolean
    mainConflictProgressed: boolean
    mainConflictResolved: boolean
    endingHookExists: boolean
    abruptTruncationDetected: boolean
  }
}

interface QualityTrendChartProps {
  projectId: number
  data?: QualityScoreData[]
  className?: string
}

export function QualityTrendChart({
  projectId,
  data: initialData,
  className,
}: QualityTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<QualityScoreData[]>(initialData || [])
  const [loading, setLoading] = useState(!initialData)

  useEffect(() => {
    if (initialData) return

    async function fetchData() {
      try {
        const res = await fetch(`/api/novel/projects/${projectId}/chapters/quality-scores`)
        const result = await res.json()
        if (result.success) {
          setData(result.data)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [projectId, initialData])

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    const container = containerRef.current

    function renderChart() {
      if (!container || container.clientWidth === 0) return

      d3.select(container).selectAll('*').remove()

      const width = container.clientWidth
      const height = 350
      const margin = { top: 30, right: 40, bottom: 60, left: 60 }
      const innerWidth = width - margin.left - margin.right
      const innerHeight = height - margin.top - margin.bottom

      if (innerWidth <= 0 || innerHeight <= 0) return

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const xScale = d3.scaleLinear()
      .domain([data[0].chapterNo, data[data.length - 1].chapterNo])
      .range([0, innerWidth])

    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([innerHeight, 0])

    // 色块背景
    const zones = [
      { y0: 80, y1: 100, fill: 'rgba(34, 197, 94, 0.08)' },
      { y0: 60, y1: 80, fill: 'rgba(234, 179, 8, 0.08)' },
      { y0: 0, y1: 60, fill: 'rgba(239, 68, 68, 0.08)' },
    ]

    for (const zone of zones) {
      g.append('rect')
        .attr('x', 0)
        .attr('y', yScale(zone.y1))
        .attr('width', innerWidth)
        .attr('height', yScale(zone.y0) - yScale(zone.y1))
        .attr('fill', zone.fill)
    }

    // 参考线
    for (const threshold of [60, 80]) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(threshold))
        .attr('y2', yScale(threshold))
        .attr('stroke', threshold === 80 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)')
        .attr('stroke-dasharray', '4,4')
    }

    // 折线
    const line = d3.line<QualityScoreData>()
      .x(d => xScale(d.chapterNo))
      .y(d => yScale(d.completionScore))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('d', line)

    // 数据点
    g.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.chapterNo))
      .attr('cy', d => yScale(d.completionScore))
      .attr('r', 4)
      .attr('fill', d => {
        if (d.completionScore >= 80) return '#22c55e'
        if (d.completionScore >= 60) return '#eab308'
        return '#ef4444'
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(tooltipRef.current)
          .style('opacity', 1)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`)
          .html(`
            <div class="font-medium">第${d.chapterNo}章 质量评分: ${d.completionScore}</div>
            <div class="text-xs mt-1">字数: ${d.actualWordCount}/${d.targetWordCount}</div>
            <div class="text-xs">目标完成: ${d.flags.chapterGoalCompleted ? '✓' : '✕'}</div>
            <div class="text-xs">冲突推进: ${d.flags.mainConflictProgressed ? '✓' : '✕'}</div>
            <div class="text-xs">冲突解决: ${d.flags.mainConflictResolved ? '✓' : '✕'}</div>
            <div class="text-xs">结尾钩子: ${d.flags.endingHookExists ? '✓' : '✕'}</div>
            ${d.flags.abruptTruncationDetected ? '<div class="text-xs text-red-500">⚠ 截断检测</div>' : ''}
          `)
      })
      .on('mouseout', function () {
        d3.select(tooltipRef.current).style('opacity', 0)
      })

    // X 轴
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(Math.min(data.length, 20)))
      .append('text')
      .attr('x', innerWidth / 2)
      .attr('y', 40)
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'middle')
      .text('章节')

    // Y 轴
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -innerHeight / 2)
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'middle')
      .text('质量评分')
    }

    renderChart()

    const resizeObserver = new ResizeObserver(() => renderChart())
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [data])

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-[350px]', className)}>
        <div className="text-muted-foreground">加载质量趋势...</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-[350px]', className)}>
        <div className="text-center text-muted-foreground">
          <p>暂无质量评分数据</p>
          <p className="text-xs mt-1">章节生成完成后将自动产生评分</p>
        </div>
      </div>
    )
  }

  const avgScore = Math.round(data.reduce((sum, d) => sum + d.completionScore, 0) / data.length)

  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          共 {data.length} 章 | 平均质量分{' '}
          <span className={cn(
            'font-medium',
            avgScore >= 80 ? 'text-green-600' : avgScore >= 60 ? 'text-yellow-600' : 'text-red-600'
          )}>
            {avgScore}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>&ge;80 优秀</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>60-80 良好</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>&lt;60 需改进</span>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="w-full" />

      <div
        ref={tooltipRef}
        className="absolute pointer-events-none opacity-0 bg-popover border rounded-lg shadow-lg p-3 text-sm z-50 transition-opacity"
      />
    </div>
  )
}

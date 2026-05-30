'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { cn, formatLargeNumber } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

interface ChapterRhythmData {
  chapterNo: number
  title: string
  wordCount: number
  emotionalIntensity: number
  keyEventCount: number
}

interface ChapterRhythmHeatmapProps {
  projectId: number
  initialData?: ChapterRhythmData[]
  className?: string
  selectedChapterNo?: number | null
}

export function ChapterRhythmHeatmap({
  projectId,
  initialData,
  className,
  selectedChapterNo,
}: ChapterRhythmHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<ChapterRhythmData[]>(initialData || [])
  const [loading, setLoading] = useState(!initialData)
  const [viewMode, setViewMode] = useState<'heatmap' | 'line'>('heatmap')

  useEffect(() => {
    if (initialData) return

    async function fetchData() {
      try {
        const res = await fetch(`/api/novel/ai/chapter-rhythm/${projectId}`)
        const result = await res.json()
        if (result.success) {
          setData(result.data.chapters)
        }
      } catch (error) {
        console.error('获取节奏数据失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [projectId, initialData])

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    // 清除之前的内容
    d3.select(containerRef.current).selectAll('*').remove()

    const container = containerRef.current
    const width = container.clientWidth
    const height = 350
    const margin = { top: 30, right: 40, bottom: 60, left: 60 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    if (viewMode === 'heatmap') {
      // 热力图模式
      const maxWordCount = Math.max(...data.map(d => d.wordCount), 1)
      const cellWidth = innerWidth / data.length
      const cellPadding = 2

      // 颜色比例尺（情绪强度：低=蓝，高=红）
      const colorScale = d3.scaleSequential(d3.interpolateRdYlBu)
        .domain([100, 0]) // 反转，因为低情绪用蓝色

      // X 轴：章节号
      const xScale = d3.scaleLinear()
        .domain([1, data.length])
        .range([0, innerWidth])

      // Y 轴：字数
      const yScale = d3.scaleLinear()
        .domain([0, maxWordCount])
        .range([innerHeight, 0])

      // 绘制热力矩形
      g.selectAll('rect.heatmap')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'heatmap')
        .attr('x', d => xScale(d.chapterNo) - cellWidth / 2 + cellPadding)
        .attr('y', d => yScale(d.wordCount))
        .attr('width', Math.max(cellWidth - cellPadding * 2, 4))
        .attr('height', d => innerHeight - yScale(d.wordCount))
        .attr('fill', d => colorScale(d.emotionalIntensity))
        .attr('stroke', d => selectedChapterNo === d.chapterNo ? '#2563eb' : 'transparent')
        .attr('stroke-width', d => selectedChapterNo === d.chapterNo ? 3 : 0)
        .attr('rx', 4)
        .attr('ry', 4)
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
          // 显示提示
          d3.select(tooltipRef.current)
            .style('opacity', 1)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`)
            .html(`
              <div class="font-medium">第${d.chapterNo}章 ${d.title}</div>
              <div class="text-xs mt-1">字数: ${formatLargeNumber(d.wordCount)}</div>
              <div class="text-xs">情绪强度: ${d.emotionalIntensity}</div>
              <div class="text-xs">关键事件: ${d.keyEventCount}个</div>
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
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${(d as number / 1000).toFixed(0)}k`))
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -45)
        .attr('x', -innerHeight / 2)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'middle')
        .text('字数')

    } else {
      // 折线图模式
      const maxWordCount = Math.max(...data.map(d => d.wordCount), 1)

      // X 轴
      const xScale = d3.scaleLinear()
        .domain([1, data.length])
        .range([0, innerWidth])

      // Y 轴
      const yScale = d3.scaleLinear()
        .domain([0, maxWordCount])
        .range([innerHeight, 0])

      // 字数折线
      const line = d3.line<ChapterRhythmData>()
        .x(d => xScale(d.chapterNo))
        .y(d => yScale(d.wordCount))
        .curve(d3.curveMonotoneX)

      // 绘制折线
      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2)
        .attr('d', line)

      // 绘制圆点
      g.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.chapterNo))
        .attr('cy', d => yScale(d.wordCount))
        .attr('r', d => 3 + d.emotionalIntensity / 30)
        .attr('fill', d => d3.interpolateRdYlBu(1 - d.emotionalIntensity / 100))
        .attr('stroke', d => selectedChapterNo === d.chapterNo ? '#2563eb' : '#fff')
        .attr('stroke-width', d => selectedChapterNo === d.chapterNo ? 3 : 1)
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
          d3.select(tooltipRef.current)
            .style('opacity', 1)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`)
            .html(`
              <div class="font-medium">第${d.chapterNo}章 ${d.title}</div>
              <div class="text-xs mt-1">字数: ${formatLargeNumber(d.wordCount)}</div>
              <div class="text-xs">情绪强度: ${d.emotionalIntensity}</div>
            `)
        })
        .on('mouseout', function () {
          d3.select(tooltipRef.current).style('opacity', 0)
        })

      // X 轴
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(Math.min(data.length, 15)))
        .append('text')
        .attr('x', innerWidth / 2)
        .attr('y', 40)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'middle')
        .text('章节')

      // Y 轴
      g.append('g')
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${(d as number / 1000).toFixed(0)}k`))
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -45)
        .attr('x', -innerHeight / 2)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'middle')
        .text('字数')
    }

    // 响应式调整
    const resizeObserver = new ResizeObserver(() => {
      d3.select(container).selectAll('*').remove()
      // 重新绘制（这里可以优化为只更新尺寸）
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [data, viewMode, selectedChapterNo])

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-[350px]', className)}>
        <div className="text-muted-foreground">加载节奏热力图...</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-[350px]', className)}>
        <div className="text-center text-muted-foreground">
          <p>暂无章节数据</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      {/* 控制栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          共 {data.length} 章 | 平均字数{' '}
          {formatLargeNumber(Math.round(data.reduce((sum, d) => sum + d.wordCount, 0) / data.length))} | 平均情绪{' '}
          {Math.round(data.reduce((sum, d) => sum + d.emotionalIntensity, 0) / data.length)}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={viewMode === 'heatmap' ? 'default' : 'outline'}
            onClick={() => setViewMode('heatmap')}
          >
            热力图
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'line' ? 'default' : 'outline'}
            onClick={() => setViewMode('line')}
          >
            折线图
          </Button>
        </div>
      </div>

      {/* 图表容器 */}
      <div ref={containerRef} className="w-full" />

      {/* 图例 */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: d3.interpolateRdYlBu(0) }} />
          <span>高情绪（高潮）</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: d3.interpolateRdYlBu(0.5) }} />
          <span>中情绪</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: d3.interpolateRdYlBu(1) }} />
          <span>低情绪（平缓）</span>
        </div>
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none opacity-0 bg-popover border rounded-lg shadow-lg p-3 text-sm z-50 transition-opacity"
      />
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { PlotlineData } from '@/lib/engine/types'

interface PlotlineTableItem extends PlotlineData {
  plantedChapterTitle: string
  resolvedChapterTitle: string | null
}

interface PlotlineTableProps {
  projectId: number
  initialPlotlines?: PlotlineTableItem[]
  className?: string
}

const typeLabels = {
  FORESHADOW: '伏笔',
  SUBPLOT: '支线',
  CONFLICT: '冲突',
}

function PlotlineCard({
  item,
  variant,
  onResolve,
  onAbandon,
}: {
  item: PlotlineTableItem
  variant: 'planted' | 'description' | 'resolved'
  onResolve?: () => void
  onAbandon?: () => void
}) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-colors',
        variant === 'planted' && 'border-l-4 border-l-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10',
        variant === 'description' && 'border-gray-200 dark:border-gray-700',
        variant === 'resolved' && 'border-l-4 border-l-green-400 bg-green-50/50 dark:bg-green-900/10'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              {typeLabels[item.type]}
            </Badge>
            {item.status === 'OPEN' && item.plannedAt && (
              <span className="text-xs text-muted-foreground">
                计划第{item.plannedAt}章回收
              </span>
            )}
          </div>
          <p className="text-sm text-foreground">{item.description}</p>
        </div>
        {variant === 'planted' && item.status === 'OPEN' && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onResolve} title="标记回收">
              ✓
            </Button>
            <Button size="sm" variant="ghost" onClick={onAbandon} title="标记放弃">
              ✗
            </Button>
          </div>
        )}
      </div>

      {/* 章节信息 */}
      <div className="mt-2 text-xs text-muted-foreground">
        {variant === 'planted' && (
          <span>埋于: {item.plantedChapterTitle}</span>
        )}
        {variant === 'resolved' && item.resolvedChapterTitle && (
          <span>收于: {item.resolvedChapterTitle}</span>
        )}
      </div>
    </div>
  )
}

export function PlotlineTracker({
  projectId,
  initialPlotlines,
  className,
}: PlotlineTableProps) {
  const [plotlines, setPlotlines] = useState<PlotlineTableItem[]>(initialPlotlines || [])
  const [loading, setLoading] = useState(!initialPlotlines)
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all')

  useEffect(() => {
    if (initialPlotlines) return

    async function fetchPlotlines() {
      try {
        const res = await fetch(`/api/novel/ai/plotline-table/${projectId}`)
        const data = await res.json()
        if (data.success) {
          setPlotlines(data.data.plotlines)
        }
      } catch (error) {
        console.error('获取伏笔数据失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPlotlines()
  }, [projectId, initialPlotlines])

  const handleResolve = async (plotlineId: string) => {
    // 获取当前章节号（假设是最新章节）
    const currentChapter = plotlines.find(p => p.id === plotlineId)?.plantedAt || 1

    try {
      const res = await fetch(`/api/novel/ai/plotline/${plotlineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RESOLVED',
          resolvedAt: currentChapter + 10, // 临时用 plantedAt + 10，实际应该让用户选择
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPlotlines(prev =>
          prev.map(p =>
            p.id === plotlineId
              ? { ...p, status: 'RESOLVED', resolvedAt: data.data.resolvedAt }
              : p
          )
        )
      }
    } catch (error) {
      console.error('更新伏笔失败:', error)
    }
  }

  const handleAbandon = async (plotlineId: string) => {
    try {
      const res = await fetch(`/api/novel/ai/plotline/${plotlineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ABANDONED' }),
      })
      const data = await res.json()
      if (data.success) {
        setPlotlines(prev =>
          prev.map(p => (p.id === plotlineId ? { ...p, status: 'ABANDONED' } : p))
        )
      }
    } catch (error) {
      console.error('更新伏笔失败:', error)
    }
  }

  const filteredPlotlines = plotlines.filter(p => {
    if (filter === 'open') return p.status === 'OPEN'
    if (filter === 'resolved') return p.status === 'RESOLVED'
    return true
  })

  const openPlotlines = plotlines.filter(p => p.status === 'OPEN')
  const resolvedPlotlines = plotlines.filter(p => p.status === 'RESOLVED')

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 统计概览 */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span>进行中: {openPlotlines.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-400" />
          <span>已回收: {resolvedPlotlines.length}</span>
        </div>
        <div className="flex-1" />
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            全部
          </Button>
          <Button
            size="sm"
            variant={filter === 'open' ? 'default' : 'outline'}
            onClick={() => setFilter('open')}
          >
            进行中
          </Button>
          <Button
            size="sm"
            variant={filter === 'resolved' ? 'default' : 'outline'}
            onClick={() => setFilter('resolved')}
          >
            已回收
          </Button>
        </div>
      </div>

      {/* 三列布局 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 埋点列 */}
        <div className="space-y-2">
          <div className="font-medium text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            埋点章节 ({openPlotlines.filter(p => p.type === 'FORESHADOW').length})
          </div>
          {filteredPlotlines
            .filter(p => p.status === 'OPEN' && p.type === 'FORESHADOW')
            .map(item => (
              <PlotlineCard
                key={item.id}
                item={item}
                variant="planted"
                onResolve={() => handleResolve(item.id)}
                onAbandon={() => handleAbandon(item.id)}
              />
            ))}
          {openPlotlines.filter(p => p.type === 'FORESHADOW').length === 0 && (
            <div className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
              暂无未回收的伏笔
            </div>
          )}
        </div>

        {/* 伏笔描述列 */}
        <div className="space-y-2">
          <div className="font-medium text-sm text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            伏笔内容 ({filteredPlotlines.length})
          </div>
          {filteredPlotlines.map(item => (
            <PlotlineCard key={item.id} item={item} variant="description" />
          ))}
        </div>

        {/* 回收状态列 */}
        <div className="space-y-2">
          <div className="font-medium text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            回收章节 ({resolvedPlotlines.length})
          </div>
          {filteredPlotlines
            .filter(p => p.status === 'RESOLVED')
            .map(item => (
              <PlotlineCard key={item.id} item={item} variant="resolved" />
            ))}
          {resolvedPlotlines.length === 0 && (
            <div className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
              暂无已回收的伏笔
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

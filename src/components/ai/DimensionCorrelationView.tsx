'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { CharacterProfile } from '@/lib/engine/types'

interface PlotlineInfo {
  id: string
  description: string
  plantedAt: number
  status: string
}

interface ChapterEmotion {
  chapterNo: number
  emotion: string
}

interface DimensionCorrelationViewProps {
  projectId: number
  className?: string
}

export function DimensionCorrelationView({
  projectId,
  className,
}: DimensionCorrelationViewProps) {
  const [correlationData, setCorrelationData] = useState<{
    characterPlotlineMap: Record<string, string[]>
    plotlineChapterMap: Record<string, number[]>
    chapterEmotionMap: Record<number, string>
    crossDimensionInsights: {
      type: string
      description: string
      data: unknown
    }[]
    stats: {
      totalCharacters: number
      totalPlotlines: number
      openPlotlines: number
      resolvedPlotlines: number
    }
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/novel/ai/dimension-correlation/${projectId}`)
        const data = await res.json()
        if (data.success) {
          setCorrelationData(data.data)
        }
      } catch (error) {
        console.error('获取多维度关联失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [projectId])

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="text-muted-foreground">加载关联分析...</div>
      </div>
    )
  }

  if (!correlationData) {
    return null
  }

  const { characterPlotlineMap, crossDimensionInsights, stats } = correlationData

  return (
    <div className={cn('space-y-6', className)}>
      {/* 统计概览 */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{stats.totalCharacters}</div>
          <div className="text-sm text-muted-foreground">角色数</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{stats.totalPlotlines}</div>
          <div className="text-sm text-muted-foreground">伏笔总数</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.openPlotlines}</div>
          <div className="text-sm text-muted-foreground">未回收</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.resolvedPlotlines}</div>
          <div className="text-sm text-muted-foreground">已回收</div>
        </Card>
      </div>

      {/* 跨维度洞察 */}
      <section>
        <h3 className="font-medium mb-3">跨维度洞察</h3>
        <div className="space-y-3">
          {crossDimensionInsights.map((insight, index) => (
            <div
              key={index}
              className={cn(
                'p-4 rounded-lg border-l-4 bg-card',
                insight.type === 'character_plotline' && 'border-l-blue-500',
                insight.type === 'plotline_chapter' && 'border-l-yellow-500',
                insight.type === 'emotion_trend' && 'border-l-purple-500'
              )}
            >
              <div className="font-medium text-sm mb-1">{insight.description}</div>
              {insight.type === 'character_plotline' && Array.isArray(insight.data) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {(insight.data as { character: string; plotlineCount: number }[]).slice(0, 5).map(item => (
                    <Badge key={item.character} variant="outline">
                      {item.character} ({item.plotlineCount})
                    </Badge>
                  ))}
                </div>
              )}
              {insight.type === 'emotion_trend' && insight.data && typeof insight.data === 'object' ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(insight.data as Record<string, number>).map(([emotion, count]) => (
                    <Badge key={emotion} variant="secondary">
                      {emotion}: {count}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {crossDimensionInsights.length === 0 && (
            <div className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
              暂无跨维度洞察
            </div>
          )}
        </div>
      </section>

      {/* 人物-伏笔关联矩阵 */}
      <section>
        <h3 className="font-medium mb-3">人物-伏笔关联</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3">角色</th>
                <th className="text-center py-2 px-3">关联伏笔数</th>
                <th className="text-left py-2 px-3">伏笔ID</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(characterPlotlineMap)
                .sort(([, a], [, b]) => b.length - a.length)
                .slice(0, 10)
                .map(([charName, plotlineIds]) => (
                  <tr key={charName} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">{charName}</td>
                    <td className="py-2 px-3 text-center">
                      <Badge variant={plotlineIds.length > 2 ? 'default' : 'secondary'}>
                        {plotlineIds.length}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground font-mono text-xs">
                      {plotlineIds.slice(0, 3).join(', ')}
                      {plotlineIds.length > 3 && '...'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {Object.keys(characterPlotlineMap).length === 0 && (
            <div className="text-sm text-muted-foreground p-4 text-center">
              暂无关联数据
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
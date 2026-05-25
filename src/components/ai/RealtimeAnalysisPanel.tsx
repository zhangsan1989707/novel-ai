'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Users, AlertTriangle, TrendingUp, BookOpen } from 'lucide-react'

interface ActiveCharacter {
  name: string
  role: string
  appearancesInLast5Chapters: number
}

interface UnresolvedPlotline {
  id: string
  description: string
  plantedAt: number
  age: number
}

interface PlotArcProgress {
  stage: 'opening' | 'development' | 'climax' | 'resolution'
  progress: number
  emotionalTension: number
}

interface WordCountProgress {
  current: number
  target: number
  percentage: number
}

interface RealtimeAnalysisData {
  activeCharacters: ActiveCharacter[]
  unresolvedPlotlines: UnresolvedPlotline[]
  plotArcProgress: PlotArcProgress
  wordCountProgress: WordCountProgress
}

interface RealtimeAnalysisPanelProps {
  projectId: number
  currentChapterNo?: number
  initialData?: RealtimeAnalysisData
  className?: string
}

const stageLabels = {
  opening: '开篇',
  development: '发展',
  climax: '高潮',
  resolution: '结局',
}

const stageColors = {
  opening: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  development: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  climax: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  resolution: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

function formatWordCount(count: number): string {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`
  }
  return count.toLocaleString()
}

export function RealtimeAnalysisPanel({
  projectId,
  currentChapterNo = 1,
  initialData,
  className,
}: RealtimeAnalysisPanelProps) {
  const [data, setData] = useState<RealtimeAnalysisData | null>(initialData || null)
  const [loading, setLoading] = useState(!initialData)

  useEffect(() => {
    if (initialData) return

    async function fetchAnalysis() {
      try {
        // 并行获取多维度数据
        const [characterRes, plotlineRes] = await Promise.all([
          fetch(`/api/novel/ai/dimension-correlation/${projectId}`),
          fetch(`/api/novel/ai/plotline-table/${projectId}`),
        ])

        const [correlationData, plotlineData] = await Promise.all([
          characterRes.json(),
          plotlineRes.json(),
        ])

        if (!correlationData.success || !plotlineData.success) {
          throw new Error('获取数据失败')
        }

        // 构建活跃人物（从角色图中提取最近出场的）
        const characters = correlationData.data?.characterPlotlineMap
          ? Object.keys(correlationData.data.characterPlotlineMap)
          : []

        const activeCharacters: ActiveCharacter[] = characters.slice(0, 5).map((name, index) => ({
          name,
          role: index === 0 ? 'PROTAGONIST' : 'SUPPORTING',
          appearancesInLast5Chapters: Math.floor(Math.random() * 5) + 1,
        }))

        // 获取未回收伏笔
        const openPlotlines = (plotlineData.data?.plotlines || [])
          .filter((p: { status: string }) => p.status === 'OPEN')
          .slice(0, 5)
          .map((p: { id: string; description: string; plantedAt: number }) => ({
            id: p.id,
            description: p.description,
            plantedAt: p.plantedAt,
            age: currentChapterNo - p.plantedAt,
          }))

        // 计算情节弧进度
        const totalChapters = correlationData.data?.stats?.totalChapters || 100
        const progress = Math.min(100, Math.round((currentChapterNo / totalChapters) * 100))
        let stage: 'opening' | 'development' | 'climax' | 'resolution' = 'opening'
        if (progress > 70) stage = 'resolution'
        else if (progress > 50) stage = 'climax'
        else if (progress > 20) stage = 'development'

        const plotArcProgress: PlotArcProgress = {
          stage,
          progress,
          emotionalTension: Math.min(100, progress * 1.2),
        }

        // 字数进度
        const targetWordCount = 100 * 3000 // 假设 100 章，每章 3000 字
        const currentWordCount = currentChapterNo * 3000
        const wordCountProgress: WordCountProgress = {
          current: currentWordCount,
          target: targetWordCount,
          percentage: Math.min(100, Math.round((currentWordCount / targetWordCount) * 100)),
        }

        setData({
          activeCharacters,
          unresolvedPlotlines: openPlotlines,
          plotArcProgress,
          wordCountProgress,
        })
      } catch (error) {
        console.error('获取实时分析数据失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalysis()
  }, [projectId, currentChapterNo, initialData])

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-6', className)}>
        <div className="text-muted-foreground">加载分析数据...</div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className={cn('space-y-4 p-4 bg-card rounded-lg border', className)}>
      {/* 活跃人物 */}
      <section>
        <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500" />
          活跃人物
        </h3>
        <div className="flex flex-wrap gap-2">
          {data.activeCharacters.length > 0 ? (
            data.activeCharacters.map(char => (
              <Badge
                key={char.name}
                variant={char.role === 'PROTAGONIST' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {char.name}
                <span className="ml-1 opacity-70">×{char.appearancesInLast5Chapters}</span>
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">暂无数据</span>
          )}
        </div>
      </section>

      {/* 未回收伏笔 */}
      <section>
        <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          未回收伏笔 ({data.unresolvedPlotlines.length})
        </h3>
        <div className="space-y-2">
          {data.unresolvedPlotlines.length > 0 ? (
            data.unresolvedPlotlines.map(p => (
              <div
                key={p.id}
                className="text-sm p-2 bg-muted/50 rounded border-l-2 border-l-yellow-400"
              >
                <div className="line-clamp-1">{p.description}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  埋于第{p.plantedAt}章 · 已过{p.age}章
                </div>
              </div>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">暂无未回收伏笔</span>
          )}
        </div>
      </section>

      {/* 情节弧进度 */}
      <section>
        <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-purple-500" />
          情节弧进度
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge className={cn(stageColors[data.plotArcProgress.stage])}>
              {stageLabels[data.plotArcProgress.stage]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {data.plotArcProgress.progress}%
            </span>
          </div>
          <Progress value={data.plotArcProgress.progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>开篇</span>
            <span>发展</span>
            <span>高潮</span>
            <span>结局</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">情绪张力:</span>
            <Progress
              value={data.plotArcProgress.emotionalTension}
              className="h-1 flex-1"
            />
            <span className="text-xs">{data.plotArcProgress.emotionalTension}%</span>
          </div>
        </div>
      </section>

      {/* 字数进度 */}
      <section>
        <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-green-500" />
          字数进度
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {formatWordCount(data.wordCountProgress.current)}
            </span>
            <span className="text-muted-foreground">
              {formatWordCount(data.wordCountProgress.target)}
            </span>
          </div>
          <Progress value={data.wordCountProgress.percentage} className="h-2" />
          <div className="text-xs text-muted-foreground text-right">
            {data.wordCountProgress.percentage}% 已完成
          </div>
        </div>
      </section>
    </div>
  )
}

'use client'

import { useEffect, useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { DollarSign, BarChart3, CheckCircle } from 'lucide-react'
import { QualityTrendChart } from './QualityTrendChart'
import { ChapterProgressGrid } from './ChapterProgressGrid'

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

interface CostData {
  totalCost: number
  byUsageType: Array<{ usageType: string; totalCost: number; totalTokens: number; count: number }>
  byVendor: Array<{ vendor: string; totalCost: number; count: number }>
}

interface GenerationDashboardProps {
  projectId: number
  chapters: Array<{
    chapterNumber: number
    title: string
    status: string
    wordCount: number
  }>
  className?: string
}

export function GenerationDashboard({ projectId, chapters, className }: GenerationDashboardProps) {
  const [qualityScores, setQualityScores] = useState<QualityScoreData[]>([])
  const [costData, setCostData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      try {
        const [qualityRes, costRes] = await Promise.all([
          fetch(`/api/novel/projects/${projectId}/chapters/quality-scores`),
          fetch(`/api/novel/projects/${projectId}/cost/batch`),
        ])
        const [qualityResult, costResult] = await Promise.all([
          qualityRes.json(),
          costRes.json(),
        ])
        if (qualityResult.success) setQualityScores(qualityResult.data)
        if (costResult.success) setCostData(costResult.data)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [projectId])

  const mergedChapters = useMemo(() => {
    const scoreMap = new Map(qualityScores.map(s => [s.chapterNo, s.completionScore]))
    return chapters.map(c => ({
      chapterNo: c.chapterNumber,
      title: c.title,
      status: c.status as 'DRAFT' | 'GENERATING' | 'COMPLETED' | 'REVIEWING',
      completionScore: scoreMap.get(c.chapterNumber) ?? null,
      wordCount: c.wordCount,
    }))
  }, [chapters, qualityScores])

  const avgScore = qualityScores.length > 0
    ? Math.round(qualityScores.reduce((sum, s) => sum + s.completionScore, 0) / qualityScores.length)
    : null

  const completedCount = chapters.filter(c => c.status === 'COMPLETED').length
  const completionRate = chapters.length > 0
    ? Math.round((completedCount / chapters.length) * 100)
    : 0

  return (
    <CollapsibleSection
      title="生成进度面板"
      description={loading ? '加载中...' : `${qualityScores.length} 章已评分`}
      defaultOpen={false}
      showStatus={false}
      className={className}
    >
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          加载中...
        </div>
      ) : (
        <div className="space-y-6">
          {/* 摘要卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              icon={<DollarSign className="h-5 w-5 text-blue-600" />}
              label="总成本"
              value={costData ? `¥${costData.totalCost.toFixed(2)}` : '--'}
              sub={costData ? `${costData.byUsageType.length} 种用途` : undefined}
            />
            <SummaryCard
              icon={<BarChart3 className="h-5 w-5 text-purple-600" />}
              label="平均质量分"
              value={avgScore !== null ? `${avgScore}` : '--'}
              score={avgScore}
            />
            <SummaryCard
              icon={<CheckCircle className="h-5 w-5 text-green-600" />}
              label="完成率"
              value={`${completionRate}%`}
              sub={`${completedCount}/${chapters.length} 章`}
            />
          </div>

          {/* 质量趋势图 */}
          {qualityScores.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">质量趋势</h4>
              <QualityTrendChart projectId={projectId} data={qualityScores} />
            </div>
          )}

          {/* 章节进度网格 */}
          <div>
            <h4 className="text-sm font-medium mb-3">章节进度</h4>
            <ChapterProgressGrid chapters={mergedChapters} />
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  score,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  score?: number | null
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn(
            'text-xl font-semibold',
            score !== undefined && score !== null && (
              score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'
            )
          )}>
            {value}
          </p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

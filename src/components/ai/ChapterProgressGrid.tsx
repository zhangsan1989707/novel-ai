'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'

interface ChapterProgressItem {
  chapterNo: number
  title: string
  status: 'DRAFT' | 'GENERATING' | 'COMPLETED' | 'REVIEWING'
  completionScore: number | null
  wordCount: number
}

interface ChapterProgressGridProps {
  chapters: ChapterProgressItem[]
  className?: string
}

const statusConfig: Record<ChapterProgressItem['status'], { label: string; variant: 'default' | 'primary' | 'success' | 'warning' }> = {
  DRAFT: { label: '草稿', variant: 'default' },
  GENERATING: { label: '生成中', variant: 'primary' },
  COMPLETED: { label: '已完成', variant: 'success' },
  REVIEWING: { label: '审稿中', variant: 'warning' },
}

function getScoreColor(score: number): 'success' | 'primary' | 'danger' {
  if (score >= 80) return 'success'
  if (score >= 60) return 'primary'
  return 'danger'
}

export function ChapterProgressGrid({ chapters, className }: ChapterProgressGridProps) {
  if (chapters.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-12 text-muted-foreground', className)}>
        暂无章节数据
      </div>
    )
  }

  return (
    <div className={cn('max-h-[500px] overflow-y-auto pr-1', className)}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {chapters.map(ch => {
          const config = statusConfig[ch.status]
          return (
            <div
              key={ch.chapterNo}
              className={cn(
                'rounded-lg border p-3 space-y-2 transition-colors hover:bg-muted/50',
                ch.status === 'GENERATING' && 'border-primary/40 bg-primary/5'
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-xs text-muted-foreground font-mono">
                  #{ch.chapterNo}
                </span>
                <Badge variant={config.variant} className="text-[10px] px-1.5 py-0">
                  {config.label}
                </Badge>
              </div>
              <p className="text-sm font-medium truncate" title={ch.title}>
                {ch.title}
              </p>
              {ch.completionScore !== null ? (
                <Progress
                  value={ch.completionScore}
                  max={100}
                  size="sm"
                  color={getScoreColor(ch.completionScore)}
                  showLabel
                />
              ) : (
                <p className="text-xs text-muted-foreground">未评分</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

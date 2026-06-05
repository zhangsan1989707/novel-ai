'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button, toast, Progress } from '@/components/ui'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { BookOpen, Loader2, RefreshCw } from 'lucide-react'

interface VolumeData {
  volumeNumber: number
  start: number
  end: number
  totalCount: number
  completedCount: number
  totalWordCount: number
  summary: string | null
  keyEvents: string[]
}

interface VolumeManagementPanelProps {
  projectId: number
  className?: string
}

export function VolumeManagementPanel({ projectId, className }: VolumeManagementPanelProps) {
  const [volumes, setVolumes] = useState<VolumeData[]>([])
  const [totalVolumes, setTotalVolumes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generatingVolume, setGeneratingVolume] = useState<number | null>(null)

  const fetchVolumes = useCallback(async () => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/volumes`)
      const result = await res.json()
      if (result.success) {
        setVolumes(result.data.volumes)
        setTotalVolumes(result.data.totalVolumes)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchVolumes()
  }, [fetchVolumes])

  const handleGenerateSummary = async (volumeNumber: number) => {
    setGeneratingVolume(volumeNumber)
    try {
      const res = await fetch('/api/novel/ai/generate-volume-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, volumeNumber }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success(`第${volumeNumber}卷摘要生成成功`)
        await fetchVolumes()
      } else {
        toast.error(result.error?.message || '生成失败')
      }
    } catch {
      toast.error('生成卷摘要失败')
    } finally {
      setGeneratingVolume(null)
    }
  }

  if (loading) {
    return (
      <CollapsibleSection
        title="卷结构"
        description="加载中..."
        defaultOpen={false}
        showStatus={false}
        className={className}
      >
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          加载卷数据...
        </div>
      </CollapsibleSection>
    )
  }

  const summaryCount = volumes.filter(v => v.summary).length

  return (
    <CollapsibleSection
      title="卷结构"
      description={`${summaryCount}/${totalVolumes} 卷已生成摘要`}
      defaultOpen={false}
      showStatus={false}
      className={className}
    >
      {volumes.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          暂无卷数据
        </div>
      ) : (
        <div className="space-y-3">
          {volumes.map(vol => {
            const progressPercent = vol.totalCount > 0
              ? Math.round((vol.completedCount / vol.totalCount) * 100)
              : 0

            return (
              <div
                key={vol.volumeNumber}
                className="rounded-lg border p-4 space-y-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm font-medium">
                      第{vol.volumeNumber}卷 · 第{vol.start}-{vol.end}章
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{vol.completedCount}/{vol.totalCount} 章</span>
                    {vol.totalWordCount > 0 && (
                      <span>· {(vol.totalWordCount / 10000).toFixed(1)}万字</span>
                    )}
                  </div>
                </div>

                <Progress value={progressPercent} max={100} size="sm" />

                {vol.summary ? (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {vol.summary}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">暂无摘要</p>
                )}

                {vol.keyEvents.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {vol.keyEvents.slice(0, 5).map((event, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                      >
                        {event}
                      </span>
                    ))}
                    {vol.keyEvents.length > 5 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{vol.keyEvents.length - 5}
                      </span>
                    )}
                  </div>
                )}

                {!vol.summary && vol.completedCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => handleGenerateSummary(vol.volumeNumber)}
                    disabled={generatingVolume !== null}
                  >
                    {generatingVolume === vol.volumeNumber ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3" />
                        生成摘要
                      </>
                    )}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </CollapsibleSection>
  )
}

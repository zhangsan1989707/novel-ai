'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react'

interface StyleConsistencyResult {
  overall: number
  vocabulary: number
  sentence: number
  tone: number
  deviations: {
    location: string
    type: 'vocabulary' | 'sentence' | 'tone'
    description: string
    severity: 'high' | 'medium' | 'low'
  }[]
  suggestions: string[]
}

interface StyleConsistencyPanelProps {
  projectId: number
  onCheck?: (content: string) => void
  className?: string
}

const severityConfig = {
  high: { color: 'text-red-600 bg-red-100 dark:bg-red-900/30', icon: AlertCircle },
  medium: { color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30', icon: AlertTriangle },
  low: { color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30', icon: CheckCircle },
}

function ScoreCircle({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'
  return (
    <div className="flex flex-col items-center">
      <div className={cn('text-2xl font-bold', color)}>{score}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

export function StyleConsistencyPanel({
  projectId,
  onCheck,
  className,
}: StyleConsistencyPanelProps) {
  const [result, setResult] = useState<StyleConsistencyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')

  const handleCheck = async () => {
    if (!content.trim() || content.length < 100) return

    setLoading(true)
    try {
      const res = await fetch(`/api/novel/ai/check-style-consistency/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (data.success) {
        setResult(data.data)
        onCheck?.(content)
      }
    } catch (error) {
      console.error('检查失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 输入区域 */}
      <div>
        <label className="text-sm font-medium mb-2 block">输入待检测文本</label>
        <textarea
          className="w-full h-32 p-3 rounded-lg border bg-background text-sm"
          placeholder="粘贴需要检测的文本内容（至少100字）..."
          value={content}
          onChange={e => setContent(e.target.value)}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">
            字数: {content.length}
          </span>
          <Button
            size="sm"
            onClick={handleCheck}
            disabled={loading || content.length < 100}
          >
            {loading ? '检测中...' : '检测文风一致性'}
          </Button>
        </div>
      </div>

      {/* 结果展示 */}
      {result && (
        <div className="space-y-4 p-4 bg-card rounded-lg border">
          {/* 分数概览 */}
          <div className="flex items-center justify-around py-4 border-b">
            <ScoreCircle score={result.overall} label="整体" />
            <ScoreCircle score={result.vocabulary} label="词汇" />
            <ScoreCircle score={result.sentence} label="句式" />
            <ScoreCircle score={result.tone} label="基调" />
          </div>

          {/* 偏差详情 */}
          {result.deviations.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">偏差详情</h4>
              <div className="space-y-2">
                {result.deviations.map((dev, index) => {
                  const config = severityConfig[dev.severity]
                  const Icon = config.icon
                  return (
                    <div
                      key={index}
                      className={cn('p-3 rounded-lg border-l-4', config.color)}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{dev.location}</div>
                          <div className="text-sm mt-1">{dev.description}</div>
                          <Badge variant="outline" className="mt-2 text-xs">
                            {dev.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 改进建议 */}
          {result.suggestions.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">改进建议</h4>
              <ul className="space-y-1 text-sm">
                {result.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 整体评估 */}
          <div className={cn(
            'p-4 rounded-lg text-center',
            result.overall >= 80
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : result.overall >= 60
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          )}>
            {result.overall >= 80
              ? '✓ 文风一致性良好'
              : result.overall >= 60
              ? '⚠ 文风存在一定偏差'
              : '✗ 文风偏差较大'}
          </div>
        </div>
      )}
    </div>
  )
}
'use client'

import { useState, useCallback } from 'react'
import { Button, Badge, toast } from '@/components/ui'
import { Sparkles, RefreshCw, Check, Copy } from 'lucide-react'
import type { ScoredTitleCandidate, TitleScoreBreakdown } from '@/lib/title-strategy'

interface TitleCandidatePanelProps {
  /** 当前已有的标题 */
  currentTitle?: string
  /** 小说核心卖点 */
  coreHook: string
  /** 题材 */
  genre?: string
  /** 目标平台 */
  platform?: string
  /** 频道 */
  channel?: 'male' | 'female'
  /** 目标风格 */
  targetStyle?: string
  /** 主角身份 */
  protagonistIdentity?: string
  /** 核心冲突 */
  conflict?: string
  /** 情绪承诺 */
  emotionalPromise?: string
  /** AI 模型 ID */
  aiModelId?: number
  /** 选择标题后的回调 */
  onSelectTitle: (title: string) => void
}

interface PanelState {
  loading: boolean
  candidates: ScoredTitleCandidate[]
  currentTitleScore: {
    title: string
    score: number
    breakdown: TitleScoreBreakdown
  } | null
}

const BREAKDOWN_LABELS: Record<keyof TitleScoreBreakdown, { label: string; max: number }> = {
  genreRecognition: { label: '题材识别', max: 20 },
  hookStrength: { label: '爽点强度', max: 25 },
  conflictDensity: { label: '冲突密度', max: 20 },
  emotionalStimulus: { label: '情绪刺激', max: 15 },
  platformFit: { label: '平台适配', max: 10 },
  readability: { label: '可读性', max: 10 },
}

function ScoreBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.round((value / max) * 100)
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-gray-600 dark:text-gray-300 shrink-0">{value}/{max}</span>
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger'
  return (
    <Badge variant={variant} className="text-sm font-bold tabular-nums">
      {score}分
    </Badge>
  )
}

export function TitleCandidatePanel({
  currentTitle,
  coreHook,
  genre,
  platform,
  channel,
  targetStyle,
  protagonistIdentity,
  conflict,
  emotionalPromise,
  aiModelId,
  onSelectTitle,
}: TitleCandidatePanelProps) {
  const [state, setState] = useState<PanelState>({
    loading: false,
    candidates: [],
    currentTitleScore: null,
  })

  const generate = useCallback(async () => {
    if (!coreHook.trim()) {
      toast.error('请先填写核心卖点')
      return
    }

    setState(prev => ({ ...prev, loading: true }))
    try {
      const res = await fetch('/api/novel/ai/generate-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          channel,
          genre,
          targetStyle,
          coreHook,
          protagonistIdentity,
          conflict,
          emotionalPromise,
          aiModelId,
          currentTitle,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error?.message || '生成失败')
      }
      setState({
        loading: false,
        candidates: data.data.candidates || [],
        currentTitleScore: data.data.currentTitleScore || null,
      })
    } catch (error) {
      setState(prev => ({ ...prev, loading: false }))
      toast.error(error instanceof Error ? error.message : '标题生成失败')
    }
  }, [coreHook, genre, platform, channel, targetStyle, protagonistIdentity, conflict, emotionalPromise, aiModelId, currentTitle])

  const hasCandidates = state.candidates.length > 0

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={generate}
          disabled={state.loading || !coreHook.trim()}
        >
          {state.loading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border border-blue-600 border-t-transparent mr-2" />
              标题生成中...
            </>
          ) : hasCandidates ? (
            <>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              重新生成标题
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-1.5" />
              智能生成标题
            </>
          )}
        </Button>
        {hasCandidates && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            已生成 {state.candidates.length} 个候选
          </span>
        )}
      </div>

      {/* 当前标题评分 */}
      {state.currentTitleScore && currentTitle && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">当前标题</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{currentTitle}</span>
            </div>
            <ScoreBadge score={state.currentTitleScore.score} />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(BREAKDOWN_LABELS).map(([key, { label, max }]) => (
              <ScoreBar
                key={key}
                value={state.currentTitleScore!.breakdown[key as keyof TitleScoreBreakdown]}
                max={max}
                label={label}
              />
            ))}
          </div>
        </div>
      )}

      {/* 候选标题列表 */}
      {hasCandidates && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">推荐标题</h4>
          {state.candidates.map((candidate, i) => (
            <div
              key={`${candidate.title}-${i}`}
              className="group flex items-start gap-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-3 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors cursor-pointer"
              onClick={() => onSelectTitle(candidate.title)}
            >
              {/* 排名 */}
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0 mt-0.5">
                {i + 1}
              </span>

              {/* 内容 */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{candidate.title}</span>
                  <ScoreBadge score={candidate.score} />
                  {candidate.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
                {candidate.reason && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{candidate.reason}</p>
                )}
                {/* 评分细项 */}
                <div className="grid grid-cols-3 gap-x-3 gap-y-0.5">
                  {Object.entries(BREAKDOWN_LABELS).map(([key, { label, max }]) => (
                    <ScoreBar
                      key={key}
                      value={candidate.breakdown[key as keyof TitleScoreBreakdown]}
                      max={max}
                      label={label}
                    />
                  ))}
                </div>
              </div>

              {/* 选择按钮 */}
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 shrink-0"
                onClick={e => {
                  e.stopPropagation()
                  onSelectTitle(candidate.title)
                }}
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Card, CardContent, Button, Badge, toast } from '@/components/ui'
import { Sliders, Save, Sparkles, ShieldAlert } from 'lucide-react'
import type { StorySteering } from '@/types'

const DIMENSIONS: { key: keyof StorySteering; label: string; minLabel: string; maxLabel: string }[] = [
  { key: 'pace', label: '节奏', minLabel: '慢', maxLabel: '快' },
  { key: 'darkness', label: '黑暗度', minLabel: '光明', maxLabel: '黑暗' },
  { key: 'humor', label: '幽默感', minLabel: '严肃', maxLabel: '诙谐' },
  { key: 'romance', label: '感情线', minLabel: '无', maxLabel: '丰富' },
  { key: 'powerGrowth', label: '成长速度', minLabel: '慢', maxLabel: '极速' },
  { key: 'conflictIntensity', label: '冲突强度', minLabel: '平和', maxLabel: '激烈' },
  { key: 'mysteryDensity', label: '悬念密度', minLabel: '直白', maxLabel: '悬疑' },
]

interface StorySteeringPanelProps {
  projectId: number
  initialValues?: Partial<StorySteering>
  onSave?: (steering: StorySteering) => void
  title?: string
  description?: string
  submitLabel?: string
  endpoint?: string
}

const DEFAULT_STEERING: StorySteering = {
  pace: 0.5,
  darkness: 0.3,
  humor: 0.3,
  romance: 0.2,
  powerGrowth: 0.5,
  conflictIntensity: 0.5,
  mysteryDensity: 0.3,
}

export function StorySteeringPanel({
  projectId,
  initialValues,
  onSave,
  title = '风格方向盘',
  description,
  submitLabel = '保存风格指令',
  endpoint,
}: StorySteeringPanelProps) {
  const [steering, setSteering] = useState<StorySteering>({ ...DEFAULT_STEERING, ...initialValues })
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const handleSliderChange = (key: keyof StorySteering, value: number) => {
    setDirty(true)
    setSteering(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(endpoint || `/api/novel/projects/${projectId}/steering`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(steering),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.success) {
        setDirty(false)
        toast.success('Story Steering 已保存，后续 AI 生成会按新方向偏转')
        onSave?.(steering)
      } else if (res.status === 404) {
        toast.error('独立 Story Steering 路由尚未就绪')
      } else {
        toast.error(data?.error?.message || '保存失败')
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const presetButtons = [
    { label: '爽文模式', values: { pace: 0.8, conflictIntensity: 0.8, darkness: 0.2, humor: 0.4, romance: 0.3, powerGrowth: 0.7, mysteryDensity: 0.3 } },
    { label: '烧脑模式', values: { pace: 0.4, conflictIntensity: 0.6, darkness: 0.5, humor: 0.2, romance: 0.2, powerGrowth: 0.4, mysteryDensity: 0.8 } },
    { label: '虐恋模式', values: { pace: 0.5, conflictIntensity: 0.6, darkness: 0.6, humor: 0.2, romance: 0.9, powerGrowth: 0.3, mysteryDensity: 0.4 } },
    { label: '悬疑模式', values: { pace: 0.5, conflictIntensity: 0.7, darkness: 0.5, humor: 0.1, romance: 0.1, powerGrowth: 0.4, mysteryDensity: 0.9 } },
    { label: '群像模式', values: { pace: 0.6, conflictIntensity: 0.6, darkness: 0.3, humor: 0.3, romance: 0.3, powerGrowth: 0.5, mysteryDensity: 0.5 } },
    { label: '慢热模式', values: { pace: 0.35, conflictIntensity: 0.45, darkness: 0.25, humor: 0.35, romance: 0.25, powerGrowth: 0.45, mysteryDensity: 0.45 } },
    { label: '恋爱模式', values: { pace: 0.55, conflictIntensity: 0.45, darkness: 0.2, humor: 0.35, romance: 0.95, powerGrowth: 0.35, mysteryDensity: 0.25 } },
    { label: '黑深残', values: { pace: 0.45, conflictIntensity: 0.85, darkness: 0.95, humor: 0.05, romance: 0.1, powerGrowth: 0.25, mysteryDensity: 0.7 } },
    { label: '极爽推进', values: { pace: 0.92, conflictIntensity: 0.9, darkness: 0.15, humor: 0.35, romance: 0.2, powerGrowth: 0.9, mysteryDensity: 0.25 } },
    { label: '默认', values: { pace: 0.5, conflictIntensity: 0.5, darkness: 0.3, humor: 0.3, romance: 0.2, powerGrowth: 0.5, mysteryDensity: 0.3 } },
  ]

  const steeringSummary = [
    steering.pace >= 0.75 ? '快节奏推进' : steering.pace <= 0.35 ? '慢热铺陈' : '稳步推进',
    steering.conflictIntensity >= 0.7 ? '高冲突' : '中等冲突',
    steering.mysteryDensity >= 0.65 ? '高悬念' : '悬念适中',
    steering.darkness >= 0.6 ? '黑暗底色' : '偏明亮',
  ].join(' / ')

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
            </div>
            {description && (
              <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">{description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">AI 控制卷数与章节结构</Badge>
            <Badge variant="outline">你只调方向，不改蓝图骨架</Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300">
              <Sparkles className="h-3.5 w-3.5" />
              AI 会读取这组方向
            </div>
            <p className="mt-2 text-xs leading-5 text-blue-700/90 dark:text-blue-200/90">
              NarrativeDirector、Writer、Polisher、Validator 会共同读取当前 Steering，并影响后续蓝图刷新、批次目录和章节风格。
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5" />
              不会被你直接改掉的内容
            </div>
            <p className="mt-2 text-xs leading-5 text-amber-700/90 dark:text-amber-200/90">
              卷数、章节数、高潮节点、伏笔回收时机仍由 AI 控制。这里的保存只影响后续生成，不会自动重写已完成章节。
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">当前方向摘要</div>
            <Badge variant={dirty ? 'warning' : 'secondary'}>
              {dirty ? '有未提交修改' : '已同步'}
            </Badge>
          </div>
          <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">{steeringSummary}</div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {presetButtons.map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setDirty(true)
                setSteering(prev => ({ ...prev, ...preset.values }))
              }}
              className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {DIMENSIONS.map(dim => (
            <div key={dim.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">{dim.label}</span>
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {Math.round(steering[dim.key] * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-6 text-right">{dim.minLabel}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(steering[dim.key] * 100)}
                  onChange={e => handleSliderChange(dim.key, parseInt(e.target.value) / 100)}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-gray-200 dark:bg-gray-600 cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:shadow-sm"
                />
                <span className="text-[10px] text-gray-400 w-6">{dim.maxLabel}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-dashed border-gray-200 px-3 py-2 text-[11px] leading-5 text-gray-500 dark:border-gray-800 dark:text-gray-400">
          提交目标：<code>/api/novel/projects/{projectId}/steering</code>。这条独立路由应只保存 Story Steering，不再复用项目基础信息更新接口。
        </div>

        <Button variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={!dirty || saving} className="w-full gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {submitLabel}
        </Button>
      </CardContent>
    </Card>
  )
}

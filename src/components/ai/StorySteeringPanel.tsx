'use client'

import { useState } from 'react'
import { Card, CardContent, Button, toast } from '@/components/ui'
import { Sliders, Save } from 'lucide-react'
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
  defaultValues?: Partial<StorySteering>
}

export function StorySteeringPanel({ projectId, initialValues, onSave }: StorySteeringPanelProps) {
  const [steering, setSteering] = useState<StorySteering>({
    pace: 0.5,
    darkness: 0.3,
    humor: 0.3,
    romance: 0.2,
    powerGrowth: 0.5,
    conflictIntensity: 0.5,
    mysteryDensity: 0.3,
    ...initialValues,
  })
  const [saving, setSaving] = useState(false)

  const handleSliderChange = (key: keyof StorySteering, value: number) => {
    setSteering(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(steering),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('风格指令已保存')
        onSave?.(steering)
      } else {
        toast.error(data.error?.message || '保存失败')
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

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">风格方向盘</h3>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {presetButtons.map(preset => (
            <button
              key={preset.label}
              onClick={() => setSteering(prev => ({ ...prev, ...preset.values }))}
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

        <Button variant="primary" size="sm" onClick={handleSave} loading={saving} className="w-full gap-1.5">
          <Save className="h-3.5 w-3.5" />
          保存风格指令
        </Button>
      </CardContent>
    </Card>
  )
}

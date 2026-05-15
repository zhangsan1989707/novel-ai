'use client'

import { useState } from 'react'
import { Button, Input, Select } from '@/components/ui'
import { Sparkles, Settings } from 'lucide-react'

// ============================================
// Types
// ============================================

export interface GenerateSettings {
  useContext: boolean
  contextChapterCount: number
  targetWordCount: number
  temperature: number
  stream: boolean
  virtualWriterId?: number
}

interface GeneratePanelProps {
  onGenerate: (settings: GenerateSettings) => void
  onCancel?: () => void
  loading?: boolean
  defaultSettings?: Partial<GenerateSettings>
}

// ============================================
// Component
// ============================================

export function GeneratePanel({
  onGenerate,
  onCancel,
  loading = false,
  defaultSettings,
}: GeneratePanelProps) {
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<GenerateSettings>({
    useContext: defaultSettings?.useContext ?? true,
    contextChapterCount: defaultSettings?.contextChapterCount ?? 3,
    targetWordCount: defaultSettings?.targetWordCount ?? 3000,
    temperature: defaultSettings?.temperature ?? 0.7,
    stream: defaultSettings?.stream ?? true,
    virtualWriterId: defaultSettings?.virtualWriterId,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onGenerate(settings)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 快速设置 */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="目标字数"
          type="number"
          value={settings.targetWordCount}
          onChange={(e) =>
            setSettings((s) => ({ ...s, targetWordCount: parseInt(e.target.value) || 3000 }))
          }
          min={1000}
          max={10000}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            温度参数
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={settings.temperature}
              onChange={(e) =>
                setSettings((s) => ({ ...s, temperature: parseFloat(e.target.value) }))
              }
              className="flex-1"
            />
            <span className="text-sm w-8">{settings.temperature}</span>
          </div>
        </div>
      </div>

      {/* 高级设置开关 */}
      <button
        type="button"
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        onClick={() => setShowSettings(!showSettings)}
      >
        <Settings className="h-4 w-4" />
        {showSettings ? '收起高级设置' : '展开高级设置'}
      </button>

      {/* 高级设置 */}
      {showSettings && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.useContext}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, useContext: e.target.checked }))
                }
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-sm">使用前文章节作为上下文</span>
            </label>
          </div>

          {settings.useContext && (
            <div className="flex items-center gap-4">
              <span className="text-sm">参考章节数：</span>
              <select
                className="h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                value={settings.contextChapterCount}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, contextChapterCount: parseInt(e.target.value) }))
                }
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} 章
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.stream}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, stream: e.target.checked }))
                }
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-sm">流式输出（实时显示生成内容）</span>
            </label>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" loading={loading} variant="primary">
          <Sparkles className="h-4 w-4 mr-2" />
          开始生成
        </Button>
      </div>
    </form>
  )
}

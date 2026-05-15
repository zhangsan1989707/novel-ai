'use client'

import { useState } from 'react'
import { Button, Textarea } from '@/components/ui'
import { Sparkles, Copy, Check } from 'lucide-react'

interface OutlineGeneratorProps {
  projectTitle: string
  genre?: string
  writingStyle?: string
  worldSetting?: string
  protagonistProfile?: string
  protagonistGoal?: string
  antagonistSetting?: string
  endingPlan?: string
  onApply?: (outline: string) => void
}

export function OutlineGenerator({
  projectTitle,
  genre,
  writingStyle,
  worldSetting,
  protagonistProfile,
  protagonistGoal,
  antagonistSetting,
  endingPlan,
  onApply,
}: OutlineGeneratorProps) {
  const [loading, setLoading] = useState(false)
  const [outline, setOutline] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!projectTitle.trim()) {
      setError('请先输入小说标题')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/novel/ai/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectTitle,
          genre,
          writingStyle,
          worldSetting,
          protagonistProfile,
          protagonistGoal,
          antagonistSetting,
          endingPlan,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setOutline(data.data.outline)
      } else {
        setError(data.error?.message || '生成失败')
      }
    } catch (err) {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(outline)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleApply = () => {
    onApply?.(outline)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-500" />
          <span className="font-medium">AI 大纲生成</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          loading={loading}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {outline ? '重新生成' : '生成大纲'}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
          {error}
        </div>
      )}

      {outline && (
        <div className="space-y-3">
          <Textarea
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            rows={12}
            placeholder="生成的大纲将显示在这里..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? '已复制' : '复制'}
            </Button>
            {onApply && (
              <Button size="sm" onClick={handleApply}>
                应用到项目设定
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

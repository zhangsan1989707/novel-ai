'use client'

import { useState } from 'react'
import { Button, Textarea } from '@/components/ui'
import { Sparkles, Copy, Check, X } from 'lucide-react'
import type { OutlineStages } from '@/types'

interface OutlineGeneratorProps {
  projectTitle: string
  genre?: string
  writingStyle?: string
  worldSetting?: string
  protagonistProfile?: string
  protagonistGoal?: string
  antagonistSetting?: string
  endingPlan?: string
  showIntro?: boolean
  onApply?: (outline: string, outlineStages?: OutlineStages) => void
  onClose?: () => void
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
  showIntro = true,
  onApply,
  onClose,
}: OutlineGeneratorProps) {
  const [loading, setLoading] = useState(false)
  const [outline, setOutline] = useState('')
  const [outlineStages, setOutlineStages] = useState<OutlineStages | undefined>()
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!projectTitle?.trim()) {
      setError('请先设置小说标题')
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
        setOutline(data.data.outline || '')
        setOutlineStages(data.data.outlineStages || undefined)
        if (!data.data.outline) {
          setError('生成的大纲为空，请重试')
        }
      } else {
        setError(data.error?.message || '生成失败')
      }
    } catch {
      setError('网络错误，请检查网络连接')
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
    if (outline && onApply) {
      onApply(outline, outlineStages)
    }
  }

  return (
    <div className="space-y-4">
      {showIntro && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <span className="font-semibold text-lg">AI 生成小说大纲</span>
            </div>
            <div className="flex items-center gap-2">
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            基于项目设定，AI 将为你生成一个完整的故事大纲，包括主线剧情、起承转合、核心冲突等。
          </p>
        </>
      )}

      {!showIntro && (
        <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            将根据当前项目的题材、风格、世界观、主角目标等信息生成故事大纲。
          </div>
        </div>
      )}

      <Button
        variant="primary"
        onClick={handleGenerate}
        loading={loading}
        disabled={loading}
        className="w-full"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        {loading ? '正在生成大纲...' : (outline ? '重新生成大纲' : '生成大纲')}
      </Button>

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
            rows={15}
            placeholder="生成的大纲将显示在这里..."
            className="font-mono text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
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

      {showIntro && !outline && !loading && !error && (
        <div className="text-center py-8 text-gray-400">
          <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>点击上方按钮开始生成大纲</p>
        </div>
      )}
    </div>
  )
}

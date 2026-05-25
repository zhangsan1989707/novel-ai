'use client'

import { useState, useRef, useEffect } from 'react'
import { Button, Modal, Textarea } from '@/components/ui'
import { Loader2, Sparkles, Save } from 'lucide-react'

interface ChapterSummaryEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chapterId: number
  chapterNumber: number
  title: string
  summary: string
  projectId: number
  onSave: (chapterId: number, summary: string) => void
}

export function ChapterSummaryEditor({
  open,
  onOpenChange,
  chapterId,
  chapterNumber,
  title,
  summary,
  projectId,
  onSave,
}: ChapterSummaryEditorProps) {
  const [summaryValue, setSummaryValue] = useState(summary || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) {
      setSummaryValue(summary || '')
    }
  }, [open, summary])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleAIEnhance = async () => {
    setIsGenerating(true)
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch(
        `/api/novel/projects/${projectId}/chapters/${chapterId}/enhance-summary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapterNumber,
            title,
            currentSummary: summaryValue,
          }),
          signal: abortControllerRef.current.signal,
        }
      )

      if (!response.ok) {
        throw new Error('AI增强失败')
      }

      const reader = response.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder('utf-8')
      let enhancedSummary = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        enhancedSummary += decoder.decode(value, { stream: true })
        setSummaryValue(enhancedSummary)
      }
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'The user aborted a request.') {
        console.error('AI enhance error:', error)
      }
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
    }
  }

  const handleSave = () => {
    onSave(chapterId, summaryValue)
    onOpenChange(false)
  }

  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    onOpenChange(false)
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`第${chapterNumber}章 · ${title || '无标题'}`}
      className="max-w-lg"
    >
      <div className="space-y-4 mt-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            章节概要
          </label>
          <Textarea
            value={summaryValue}
            onChange={(e) => setSummaryValue(e.target.value)}
            placeholder="请输入章节概要，简要描述本章内容..."
            className="min-h-[200px] resize-none"
            disabled={isGenerating}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAIEnhance}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI调整中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                AI调整
              </>
            )}
          </Button>
          <span className="text-xs text-gray-500">
            AI会根据章节标题和已有内容优化概要
          </span>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            保存
          </Button>
        </div>
      </div>
    </Modal>
  )
}
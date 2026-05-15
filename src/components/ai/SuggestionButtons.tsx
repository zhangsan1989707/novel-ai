'use client'

import { useState } from 'react'
import { Button, Modal } from '@/components/ui'
import { Sparkles, Lightbulb, ListOrdered, FileText } from 'lucide-react'

interface SuggestionButtonsProps {
  projectTitle: string
  genre?: string
  writingStyle?: string
  worldSetting?: string
  protagonistProfile?: string
  protagonistGoal?: string
  antagonistSetting?: string
  endingPlan?: string
  onIdeaGenerated?: (idea: string) => void
  onChapterListGenerated?: (list: string) => void
  onOutlineGenerated?: (outline: string) => void
}

type ModalType = 'idea' | 'chapters' | 'outline' | null

interface GenerationResult {
  type: 'idea' | 'chapters' | 'outline'
  content: string
  chapterList?: unknown
}

export function SuggestionButtons({
  projectTitle,
  genre,
  writingStyle,
  worldSetting,
  protagonistProfile,
  protagonistGoal,
  antagonistSetting,
  endingPlan,
  onIdeaGenerated,
  onChapterListGenerated,
  onOutlineGenerated,
}: SuggestionButtonsProps) {
  const [modalType, setModalType] = useState<ModalType>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState('')

  const generatePayload = () => ({
    projectTitle,
    genre,
    writingStyle,
    worldSetting,
    protagonistProfile,
    protagonistGoal,
    antagonistSetting,
    endingPlan,
  })

  const handleGenerateIdea = async () => {
    if (!projectTitle.trim()) {
      setError('请先输入小说标题')
      return
    }

    setLoading(true)
    setError('')
    setModalType('idea')

    try {
      const res = await fetch('/api/novel/ai/generate-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generatePayload()),
      })
      const data = await res.json()

      if (data.success) {
        setResult({ type: 'idea', content: data.data.content })
      } else {
        setError(data.error?.message || '生成失败')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateChapterList = async () => {
    if (!projectTitle.trim()) {
      setError('请先输入小说标题')
      return
    }

    setLoading(true)
    setError('')
    setModalType('chapters')

    try {
      const res = await fetch('/api/novel/ai/generate-chapter-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...generatePayload(), totalChapters: 50 }),
      })
      const data = await res.json()

      if (data.success) {
        setResult({ type: 'chapters', content: data.data.content, chapterList: data.data.chapterList })
      } else {
        setError(data.error?.message || '生成失败')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateOutline = async () => {
    if (!projectTitle.trim()) {
      setError('请先输入小说标题')
      return
    }

    setLoading(true)
    setError('')
    setModalType('outline')

    try {
      const res = await fetch('/api/novel/ai/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generatePayload()),
      })
      const data = await res.json()

      if (data.success) {
        setResult({ type: 'outline', content: data.data.outline })
      } else {
        setError(data.error?.message || '生成失败')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (!result) return

    switch (result.type) {
      case 'idea':
        onIdeaGenerated?.(result.content)
        break
      case 'chapters':
        onChapterListGenerated?.(result.content)
        break
      case 'outline':
        onOutlineGenerated?.(result.content)
        break
    }
    handleClose()
  }

  const handleClose = () => {
    setModalType(null)
    setResult(null)
    setError('')
  }

  const getModalTitle = () => {
    switch (modalType) {
      case 'idea':
        return 'AI 创意生成'
      case 'chapters':
        return 'AI 章节列表生成'
      case 'outline':
        return 'AI 大纲生成'
      default:
        return ''
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerateIdea}
        >
          <Lightbulb className="h-4 w-4 mr-2" />
          生成创意
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerateChapterList}
        >
          <ListOrdered className="h-4 w-4 mr-2" />
          生成章节列表
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerateOutline}
        >
          <FileText className="h-4 w-4 mr-2" />
          生成大纲
        </Button>
      </div>

      <Modal
        open={modalType !== null}
        onClose={handleClose}
        title={getModalTitle()}
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Sparkles className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-gray-500">AI 生成中...</span>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg whitespace-pre-wrap text-sm max-h-96 overflow-auto">
              {result.content}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                关闭
              </Button>
              {modalType !== 'chapters' && (
                <Button onClick={handleApply}>
                  应用
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}

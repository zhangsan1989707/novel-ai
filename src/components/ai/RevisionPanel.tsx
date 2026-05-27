'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button, Textarea } from '@/components/ui'
import { RefreshCw, ArrowRight, MessageSquare, Check, X, Wand2 } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

// ============================================
// Types
// ============================================

export type RevisionType = 'rewrite' | 'continue' | 'expand' | 'condense' | 'polish'

export type QuickSuggestion =
  | 'increase_details'
  | 'strengthen_psychology'
  | 'enhance_atmosphere'
  | 'accelerate_pace'
  | 'increase_dialogue'
  | 'reduce_redundancy'

interface RevisionPanelProps {
  projectId: number
  chapterId: number
  currentContent: string
  onApply: (newContent: string) => void
  onCancel?: () => void
  initialRevisionType?: RevisionType
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const revisionTypeOptions: { value: RevisionType; label: string; description: string }[] = [
  { value: 'rewrite', label: '重写', description: '根据建议完全重新生成' },
  { value: 'continue', label: '续写', description: '在原文基础上继续写作' },
  { value: 'expand', label: '扩写', description: '扩展内容，增加细节' },
  { value: 'condense', label: '缩写', description: '精简压缩内容' },
  { value: 'polish', label: '润色', description: '优化表达，提升文笔' },
]

const quickSuggestions: { key: QuickSuggestion; label: string; description: string }[] = [
  { key: 'increase_details', label: '增加细节描写', description: '丰富场景和人物的细节' },
  { key: 'strengthen_psychology', label: '加强心理刻画', description: '深化人物内心世界' },
  { key: 'enhance_atmosphere', label: '增强氛围', description: '营造更浓郁的意境' },
  { key: 'accelerate_pace', label: '加快节奏', description: '使剧情更加紧凑' },
  { key: 'increase_dialogue', label: '增加对话', description: '让人物互动更丰富' },
  { key: 'reduce_redundancy', label: '精简冗余', description: '去除重复内容' },
]

const suggestionMap: Record<QuickSuggestion, string> = {
  increase_details: '请增加更多细节描写，包括场景、人物外貌、动作等细节，使内容更加丰富生动。',
  strengthen_psychology: '请加强对人物的心理刻画，展现人物内心的矛盾、挣扎或情感变化。',
  enhance_atmosphere: '请增强环境氛围的渲染，描写天气、光影、声音等元素来烘托情绪。',
  accelerate_pace: '请加快剧情节奏，减少铺垫，直接推进核心剧情发展。',
  increase_dialogue: '请增加人物对话，通过对话展现人物性格和推动剧情。',
  reduce_redundancy: '请精简冗余的描述，去除重复的内容，使表达更加凝练。',
}

// ============================================
// Component
// ============================================

export function RevisionPanel({
  projectId,
  chapterId,
  currentContent,
  onApply,
  onCancel,
  initialRevisionType = 'rewrite',
}: RevisionPanelProps) {
  const [revisionType, setRevisionType] = useState<RevisionType>(initialRevisionType)
  const [customSuggestion, setCustomSuggestion] = useState('')
  const [selectedQuickSuggestions, setSelectedQuickSuggestions] = useState<QuickSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [userInput, setUserInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setRevisionType(initialRevisionType)
  }, [initialRevisionType])

  const handleQuickSuggestionToggle = (key: QuickSuggestion) => {
    setSelectedQuickSuggestions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const getFinalSuggestion = (): string => {
    const parts: string[] = []
    if (selectedQuickSuggestions.length > 0) {
      parts.push(...selectedQuickSuggestions.map((key) => suggestionMap[key]))
    }
    if (customSuggestion.trim()) {
      parts.push(customSuggestion.trim())
    }
    return parts.join('\n')
  }

  // 发送消息到 AI
  const sendToAI = useCallback(async (message: string, contextSuggestion?: string) => {
    if (!currentContent) {
      toast.error('请先生成章节内容')
      return
    }

    // 添加用户消息
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])

    setLoading(true)
    setGenerating(true)
    setPreviewContent('')

    // 创建 AbortController
    abortControllerRef.current = new AbortController()

    try {
      const res = await fetch('/api/novel/ai/revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          chapterId,
          revisionType,
          currentContent,
          suggestion: contextSuggestion || message,
          useContext: true,
          contextChapterCount: 3,
          temperature: 0.7,
          targetWordCount: 3000,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!res.ok) {
        throw new Error('请求失败')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('无响应体')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim()
            const dataLine = lines.shift()
            if (dataLine?.startsWith('data: ')) {
              const data = JSON.parse(dataLine.slice(6))
              if (eventType === 'token') {
                fullContent += data.content
                setPreviewContent(fullContent)
              } else if (eventType === 'done') {
                // AI 响应完成
                const aiMsg: Message = {
                  id: (Date.now() + 1).toString(),
                  role: 'assistant',
                  content: data.content || fullContent,
                  timestamp: new Date(),
                }
                setMessages((prev) => [...prev, aiMsg])
              }
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Generation aborted')
      } else {
        console.error('Revision error:', error)
        toast.error('改稿失败，请重试')
      }
    } finally {
      setLoading(false)
      setGenerating(false)
    }
  }, [projectId, chapterId, currentContent, revisionType])

  // 处理快捷建议
  const handleQuickRevision = async () => {
    const suggestion = getFinalSuggestion()
    if (!suggestion) {
      toast.error('请选择或输入修改建议')
      return
    }
    await sendToAI(suggestion, suggestion)
  }

  // 处理自定义提交
  const handleSubmit = async () => {
    if (customSuggestion.trim()) {
      await sendToAI(customSuggestion.trim())
    } else if (selectedQuickSuggestions.length > 0) {
      await handleQuickRevision()
    } else {
      toast.error('请选择或输入修改建议')
    }
  }

  // 停止生成
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setGenerating(false)
  }

  // 应用修改
  const handleApply = () => {
    if (previewContent) {
      onApply(previewContent)
      toast.success('已应用修改')
    }
  }

  // 发送对话消息
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userInput.trim() || loading) return
    await sendToAI(userInput.trim())
    setUserInput('')
  }

  // 滚动到底部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [messages, previewContent])

  return (
    <div className="flex flex-col h-full">
      {/* 改稿类型选择 */}
      <div className="space-y-3 p-4 border-b">
        <label className="block text-sm font-medium">改稿类型</label>
        <div className="flex flex-wrap gap-2">
          {revisionTypeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRevisionType(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                revisionType === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          {revisionTypeOptions.find((o) => o.value === revisionType)?.description}
        </p>
      </div>

      {/* 快捷建议 */}
      <div className="space-y-2 p-4 border-b">
        <label className="block text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          快捷建议
        </label>
        <div className="grid grid-cols-2 gap-2">
          {quickSuggestions.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => handleQuickSuggestionToggle(s.key)}
              className={`p-2.5 text-left rounded-lg border transition-all text-sm ${
                selectedQuickSuggestions.includes(s.key)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="font-medium text-xs">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 自定义建议 */}
      <div className="space-y-2 p-4 border-b">
        <label className="block text-sm font-medium">自定义建议</label>
        <Textarea
          placeholder="输入您的修改指令，或描述想要的修改方向..."
          rows={3}
          value={customSuggestion}
          onChange={(e) => setCustomSuggestion(e.target.value)}
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">
            {selectedQuickSuggestions.length + (customSuggestion ? 1 : 0)} 个建议
          </span>
          <div className="flex gap-2">
            {generating ? (
              <Button type="button" variant="danger" size="sm" onClick={handleStop}>
                <X className="h-4 w-4 mr-1" />
                停止
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={loading || (!customSuggestion.trim() && selectedQuickSuggestions.length === 0)}
                loading={loading}
              >
                <Wand2 className="h-4 w-4 mr-1" />
                开始改稿
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 对话历史 */}
      {messages.length > 0 && (
        <div className="border-b">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between"
          >
            <span>对话历史 ({messages.length} 条)</span>
            <span>{showHistory ? '收起' : '展开'}</span>
          </button>
          {showHistory && (
            <div ref={contentRef} className="max-h-48 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 实时预览 */}
      {(previewContent || generating) && (
        <div className="flex-1 p-4 space-y-3 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">生成预览</label>
            <span className="text-xs text-gray-500">
              {previewContent.length} 字
            </span>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {previewContent || '生成中...'}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleApply}
              disabled={!previewContent || generating}
            >
              <Check className="h-4 w-4 mr-1" />
              应用修改
            </Button>
          </div>
        </div>
      )}

      {/* 原始内容预览（无预览时显示） */}
      {!previewContent && !generating && (
        <div className="flex-1 p-4 space-y-3 overflow-hidden flex flex-col">
          <label className="block text-sm font-medium">当前内容预览</label>
          <div className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {currentContent.slice(-1000) || '暂无内容'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

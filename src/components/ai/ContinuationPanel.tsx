'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button, Textarea } from '@/components/ui'
import { Sparkles, Square, Play, ArrowRight, BookOpen, RefreshCw } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { ContinuationMode, EndingDirection } from '@/types'
import { countChineseWords, formatLargeNumber } from '@/lib/utils'

// ============================================
// Types
// ============================================

interface ContinuationPanelProps {
  projectId: number
  onApply?: (chapterId: number, content: string) => void
  onCancel?: () => void
}

interface ContinuationContext {
  mode: 'ending' | 'continue' | 'rewrite'
  unresolvedForeshadowing?: { setup: string; importance: string }[]
  openPlotlines?: { title: string; keyEvents: string[] }[]
  characterArcs?: { name: string; currentStatus: string }[]
  memoryPack?: {
    sectionCount: number
    sections: Array<{
      key: string
      title: string
      priority: number
      budget: number
      truncated: boolean
      content: string
    }>
    stats: {
      recentChapterCount: number
      openPlotlineCount: number
      characterCount: number
      researchCount: number
      hasBookSummary: boolean
      hasBlueprint: boolean
      hasStoryState: boolean
    }
  }
  contexts?: {
    planner: string
    writer: string
    validator: string
    summarizer: string
  }
  lastChapterNumber?: number
  nextChapterNumber?: number
  recentChapterSummaries?: { chapterNo: number; summary: string }[]
  totalChapters?: number
  completedChapters?: number
}

interface GenerationState {
  status: 'idle' | 'generating' | 'done' | 'error'
  content: string
  wordCount: number
  error?: string
}

// ============================================
// 常量
// ============================================

const modeOptions = [
  { value: 'ending', label: '续写结局', description: '根据分析结果续写故事结局，回收伏笔' },
  { value: 'continue', label: '继续创作', description: '在最后一章之后继续写新章节' },
  { value: 'rewrite', label: '全文重写', description: '基于新信息对全文进行改写' },
]

const endingDirectionOptions = [
  { value: 'happy', label: '幸福结局', description: '主要角色获得成长和幸福' },
  { value: 'tragic', label: '悲剧结局', description: '可以有牺牲和遗憾，但要有深度' },
  { value: 'open', label: '开放式结局', description: '保持悬念，可以留白让读者想象' },
]

// ============================================
// Component
// ============================================

export function ContinuationPanel({
  projectId,
  onApply,
  onCancel,
}: ContinuationPanelProps) {
  const [selectedMode, setSelectedMode] = useState<ContinuationMode>(ContinuationMode.CONTINUE)
  const [endingDirection, setEndingDirection] = useState<EndingDirection>(EndingDirection.HAPPY)
  const [userInput, setUserInput] = useState('')
  const [targetChapterCount, setTargetChapterCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<ContinuationContext | null>(null)
  const [generationState, setGenerationState] = useState<GenerationState>({
    status: 'idle',
    content: '',
    wordCount: 0,
  })
  const [generatedChapterId, setGeneratedChapterId] = useState<number | null>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 加载上下文
  const loadContext = useCallback(async (mode: ContinuationMode) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/continuation/context?mode=${mode}`)
      const data = await res.json()
      if (data.success) {
        setContext(data.data)
      } else {
        toast.error(data.error?.message || '加载上下文失败')
      }
    } catch {
      toast.error('加载上下文失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // 初始加载
  useEffect(() => {
    loadContext(selectedMode)
  }, [selectedMode, loadContext])

  // 开始生成
  const handleGenerate = useCallback(async () => {
    // 重置状态
    setGenerationState({ status: 'generating', content: '', wordCount: 0 })
    setGeneratedChapterId(null)

    // 创建 AbortController
    abortControllerRef.current = new AbortController()

    try {
      const body: Record<string, unknown> = {
        mode: selectedMode,
        useContext: true,
        contextChapterCount: 3,
        targetWordCount: 3000,
        temperature: 0.7,
      }

      if (selectedMode === ContinuationMode.ENDING) {
        body.targetChapterCount = targetChapterCount
        body.endingDirection = endingDirection
      } else if (selectedMode === ContinuationMode.REWRITE) {
        body.userInput = userInput
      }

      const res = await fetch(`/api/novel/projects/${projectId}/continuation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
            // 等待紧随其后的 data 行
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.chapterId) {
                setGeneratedChapterId(data.chapterId)
              }
              if (data.content) {
                fullContent += data.content
                const wordCount = countChineseWords(fullContent)
                setGenerationState(prev => ({
                  ...prev,
                  content: fullContent,
                  wordCount,
                }))
              }
              if (data.error) {
                setGenerationState(prev => ({
                  ...prev,
                  status: 'error',
                  error: data.message || '生成失败',
                }))
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 解析标题和内容
      let displayContent = fullContent
      const contentMatch = fullContent.match(/^内容：$\s*([\s\S]*)$/m)
      if (contentMatch) {
        displayContent = contentMatch[1].trim()
      }

      setGenerationState(prev => ({
        ...prev,
        status: 'done',
        content: displayContent,
        wordCount: countChineseWords(displayContent),
      }))
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setGenerationState(prev => ({ ...prev, status: 'idle' }))
      } else {
        setGenerationState(prev => ({
          ...prev,
          status: 'error',
          error: err instanceof Error ? err.message : '生成失败',
        }))
      }
    }
  }, [projectId, selectedMode, targetChapterCount, endingDirection, userInput])

  // 停止生成
  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  // 应用结果
  const handleApply = useCallback(() => {
    if (generatedChapterId && generationState.content) {
      onApply?.(generatedChapterId, generationState.content)
      toast.success('已应用生成结果')
    }
  }, [generatedChapterId, generationState.content, onApply])

  // 自动滚动
  useEffect(() => {
    if (contentRef.current && generationState.status === 'generating') {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [generationState.content, generationState.status])

  return (
    <div className="space-y-6">
      {/* 模式选择 */}
      <div className="space-y-3">
        <label className="text-sm font-medium">续写模式</label>
        <div className="grid grid-cols-3 gap-3">
          {modeOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setSelectedMode(option.value as ContinuationMode)}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedMode === option.value
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-gray-500 mt-1">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 模式特定参数 */}
      {selectedMode === ContinuationMode.ENDING && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">结局设置</span>
          </div>

          {context?.unresolvedForeshadowing && context.unresolvedForeshadowing.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500">未回收伏笔 ({context.unresolvedForeshadowing.length})</label>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {context.unresolvedForeshadowing.slice(0, 5).map((f, i) => (
                  <div key={`${f.setup?.slice(0, 10)}-${i}`} className="text-sm p-2 bg-white dark:bg-gray-800 rounded border">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      f.importance === 'major' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {f.importance === 'major' ? '重要' : '次要'}
                    </span>
                    <span className="ml-2">{f.setup}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs text-gray-500">结局方向</label>
            <div className="grid grid-cols-3 gap-2">
              {endingDirectionOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setEndingDirection(option.value as EndingDirection)}
                  className={`p-2 rounded border text-center text-sm ${
                    endingDirection === option.value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-500">结局章节数</label>
            <input
              type="number"
              min={1}
              max={5}
              value={targetChapterCount}
              onChange={e => setTargetChapterCount(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
          </div>
        </div>
      )}

      {selectedMode === ContinuationMode.CONTINUE && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">继续创作</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">最后一章</label>
              <div className="text-sm font-medium">
                {context?.lastChapterNumber ? `第${context.lastChapterNumber}章` : '暂无'}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">下一章</label>
              <div className="text-sm font-medium text-purple-600">
                第{context?.nextChapterNumber || 1}章
              </div>
            </div>
          </div>

          {context?.recentChapterSummaries && context.recentChapterSummaries.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500">最近章节摘要</label>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {context.recentChapterSummaries.map((s, i) => (
                  <div key={`${s.chapterNo}-${i}`} className="text-xs p-2 bg-white dark:bg-gray-800 rounded">
                    第{s.chapterNo}章: {s.summary?.slice(0, 50)}...
                  </div>
                ))}
              </div>
            </div>
          )}

          {context?.memoryPack && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500">记忆编排</label>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
                <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
                  <div className="text-gray-500">记忆块</div>
                  <div className="font-medium">{context.memoryPack.sectionCount} 个</div>
                </div>
                <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
                  <div className="text-gray-500">角色上下文</div>
                  <div className="font-medium">
                    P {context.contexts?.planner?.length || 0} / W {context.contexts?.writer?.length || 0}
                  </div>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {context.memoryPack.sections.slice(0, 3).map(section => (
                  <div key={section.key} className="text-xs p-2 bg-white dark:bg-gray-800 rounded border">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{section.title}</span>
                      {section.truncated && <span className="text-amber-600">截断</span>}
                    </div>
                    <div className="text-gray-500 mt-1 line-clamp-2">
                      {section.content.slice(0, 140)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedMode === ContinuationMode.REWRITE && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">全文重写</span>
          </div>

          {context?.memoryPack && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500">记忆编排</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
                  <div className="text-gray-500">记忆块</div>
                  <div className="font-medium">{context.memoryPack.sectionCount} 个</div>
                </div>
                <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
                  <div className="text-gray-500">角色上下文</div>
                  <div className="font-medium">
                    P {context.contexts?.planner?.length || 0} / W {context.contexts?.writer?.length || 0}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs text-gray-500">重写要求（可选）</label>
            <Textarea
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              placeholder="输入新的要求，如：改变主角性格、调整剧情走向、添加新角色等"
              rows={3}
              className="text-sm"
            />
          </div>
        </div>
      )}

      {/* 生成按钮和控制 */}
      <div className="flex items-center gap-3">
        {generationState.status === 'idle' && (
          <Button variant="primary" onClick={handleGenerate} disabled={loading}>
            <Play className="h-4 w-4 mr-2" />
            {loading ? '加载上下文中...' : '开始生成'}
          </Button>
        )}
        {generationState.status === 'generating' && (
          <Button variant="danger" onClick={handleStop}>
            <Square className="h-4 w-4 mr-2" />
            停止
          </Button>
        )}
        {generationState.status === 'done' && (
          <Button variant="primary" onClick={handleApply}>
            <ArrowRight className="h-4 w-4 mr-2" />
            应用结果
          </Button>
        )}
        {generationState.status === 'done' && (
          <Button variant="outline" onClick={handleGenerate}>
            <RefreshCw className="h-4 w-4 mr-2" />
            重新生成
          </Button>
        )}
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
        )}
        {generationState.wordCount > 0 && (
          <span className="text-sm text-gray-500">
            {formatLargeNumber(generationState.wordCount)} 字
          </span>
        )}
      </div>

      {/* 生成内容预览 */}
      {generationState.content && (
        <div className="space-y-2">
          <label className="text-sm font-medium">生成预览</label>
          <Textarea
            ref={contentRef}
            value={generationState.content}
            readOnly
            rows={15}
            className="text-sm"
          />
        </div>
      )}

      {/* 错误信息 */}
      {generationState.status === 'error' && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
          {generationState.error || '生成失败'}
        </div>
      )}
    </div>
  )
}

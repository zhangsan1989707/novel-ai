'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { countChineseWords } from '@/lib/utils'

export type ChapterGenerationStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'complete'
  | 'error'

export interface ChapterGenerationRequest {
  useContext: boolean
  contextChapterCount: number
  targetWordCount: number
  temperature: number
}

export interface ChapterGenerationResult {
  chapterId: number
  content: string
  wordCount: number
  title?: string
  warning?: string
  minimumWordCount?: number
  qualityStatus?: 'completed' | 'reviewing'
  status?: 'completed' | 'reviewing'
}

interface ChapterGenerationErrorPayload {
  message?: string
}

interface StartEventPayload {
  chapterId: number
  status?: string
}

interface TokenEventPayload {
  content?: string
}

interface WordCountEventPayload {
  count?: number
}

type ChapterGenerationEvent =
  | { event: 'start'; data: StartEventPayload }
  | { event: 'token'; data: TokenEventPayload }
  | { event: 'wordCount'; data: WordCountEventPayload }
  | { event: 'done'; data: ChapterGenerationResult }
  | { event: 'error'; data: ChapterGenerationErrorPayload }

export interface ChapterGenerationState {
  status: ChapterGenerationStatus
  progress: number
  message: string
  content: string
  wordCount: number
  targetWordCount: number
  error?: string
  isComplete: boolean
  warning?: string
  title?: string
}

export interface UseChapterGenerationOptions {
  projectId: number
  chapterId: number
  initialContent?: string
  initialWordCount?: number
  onStart?: () => void
  onToken?: (token: string, nextContent: string, nextWordCount: number) => void
  onProgress?: (progress: number, wordCount: number) => void
  onComplete?: (result: ChapterGenerationResult) => void
  onError?: (error: string) => void
}

interface ParsedSSEEvent {
  event: string
  data: string
}

export function parseSSEMessageBuffer(buffer: string): {
  events: ParsedSSEEvent[]
  remaining: string
} {
  const events: ParsedSSEEvent[] = []
  let remaining = buffer
  const delimiter = '\n\n'

  while (remaining.includes(delimiter)) {
    const index = remaining.indexOf(delimiter)
    const block = remaining.slice(0, index)
    remaining = remaining.slice(index + delimiter.length)

    let event = 'message'
    const dataLines: string[] = []

    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trim()
        continue
      }

      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart())
      }
    }

    if (dataLines.length > 0) {
      events.push({ event, data: dataLines.join('\n') })
    }
  }

  return { events, remaining }
}

export function useChapterGeneration(options: UseChapterGenerationOptions) {
  const {
    projectId,
    chapterId,
    initialContent = '',
    initialWordCount = initialContent ? countChineseWords(initialContent) : 0,
    onStart,
    onToken,
    onProgress,
    onComplete,
    onError,
  } = options

  const [state, setState] = useState<ChapterGenerationState>({
    status: 'idle',
    progress: 0,
    message: '待生成',
    content: initialContent,
    wordCount: initialWordCount,
    targetWordCount: 3000,
    isComplete: false,
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const contentBufferRef = useRef(initialContent)

  const applyProgress = useCallback(
    (wordCount: number, targetWordCount: number) => {
      const progress = Math.min(100, (wordCount / Math.max(targetWordCount, 1)) * 100)
      onProgress?.(progress, wordCount)
      return progress
    },
    [onProgress]
  )

  const reset = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    contentBufferRef.current = initialContent

    setState({
      status: 'idle',
      progress: 0,
      message: '待生成',
      content: initialContent,
      wordCount: initialWordCount,
      targetWordCount: 3000,
      isComplete: false,
    })
  }, [initialContent, initialWordCount])

  const stop = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setState((prev) => ({
      ...prev,
      status: 'idle',
      message: '已停止接收流式结果',
    }))
  }, [])

  const handleEvent = useCallback(
    (
      rawEvent: ParsedSSEEvent,
      targetWordCount: number
    ): { completed: boolean; failed: boolean } => {
      let parsedData: unknown

      try {
        parsedData = JSON.parse(rawEvent.data)
      } catch {
        return { completed: false, failed: false }
      }

      const event = {
        event: rawEvent.event,
        data: parsedData,
      } as ChapterGenerationEvent

      switch (event.event) {
        case 'start': {
          setState((prev) => ({
            ...prev,
            status: 'streaming',
            message: '生成中',
          }))
          return { completed: false, failed: false }
        }
        case 'token': {
          const token = event.data.content || ''
          if (!token) {
            return { completed: false, failed: false }
          }

          contentBufferRef.current += token
          const nextWordCount = countChineseWords(contentBufferRef.current)
          const progress = applyProgress(nextWordCount, targetWordCount)

          setState((prev) => ({
            ...prev,
            content: contentBufferRef.current,
            wordCount: nextWordCount,
            progress,
            message: '生成中',
          }))

          onToken?.(token, contentBufferRef.current, nextWordCount)
          return { completed: false, failed: false }
        }
        case 'wordCount': {
          const nextWordCount = event.data.count
          if (typeof nextWordCount !== 'number') {
            return { completed: false, failed: false }
          }

          const progress = applyProgress(nextWordCount, targetWordCount)
          setState((prev) => ({
            ...prev,
            wordCount: nextWordCount,
            progress,
          }))
          return { completed: false, failed: false }
        }
        case 'done': {
          const content = event.data.content || contentBufferRef.current
          const wordCount = event.data.wordCount || countChineseWords(content)
          contentBufferRef.current = content

          setState((prev) => ({
            ...prev,
            status: 'complete',
            progress: 100,
            message: event.data.warning ? '生成完成，待审稿' : '生成完成',
            content,
            wordCount,
            isComplete: true,
            warning: event.data.warning,
            title: event.data.title,
            error: undefined,
          }))

          onProgress?.(100, wordCount)
          onComplete?.({
            ...event.data,
            content,
            wordCount,
          })
          return { completed: true, failed: false }
        }
        case 'error': {
          const message = event.data.message || '生成失败'
          setState((prev) => ({
            ...prev,
            status: 'error',
            message: '生成失败',
            error: message,
          }))
          onError?.(message)
          return { completed: false, failed: true }
        }
        default:
          return { completed: false, failed: false }
      }
    },
    [applyProgress, onComplete, onError, onProgress, onToken]
  )

  const start = useCallback(
    async (request: ChapterGenerationRequest) => {
      abortControllerRef.current?.abort()

      const controller = new AbortController()
      abortControllerRef.current = controller
      contentBufferRef.current = ''

      setState({
        status: 'connecting',
        progress: 0,
        message: '连接中...',
        content: '',
        wordCount: 0,
        targetWordCount: request.targetWordCount,
        isComplete: false,
      })

      onStart?.()

      try {
        const response = await fetch(`/api/novel/projects/${projectId}/generate/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapterId,
            useContext: request.useContext,
            contextChapterCount: request.contextChapterCount,
            targetWordCount: request.targetWordCount,
            temperature: request.temperature,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          let message = '生成失败'

          try {
            const data = await response.json()
            message = data.error?.message || message
          } catch {}

          setState((prev) => ({
            ...prev,
            status: 'error',
            message: '生成失败',
            error: message,
          }))
          onError?.(message)
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
          const message = '无法读取流式响应'
          setState((prev) => ({
            ...prev,
            status: 'error',
            message: '生成失败',
            error: message,
          }))
          onError?.(message)
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''
        let completed = false
        let failed = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            buffer += decoder.decode()
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const parsed = parseSSEMessageBuffer(buffer)
          buffer = parsed.remaining

          for (const event of parsed.events) {
            const result = handleEvent(event, request.targetWordCount)
            completed = completed || result.completed
            failed = failed || result.failed
          }
        }

        if (buffer) {
          const parsed = parseSSEMessageBuffer(`${buffer}\n\n`)
          for (const event of parsed.events) {
            const result = handleEvent(event, request.targetWordCount)
            completed = completed || result.completed
            failed = failed || result.failed
          }
        }

        if (!completed && !failed && !controller.signal.aborted) {
          const message = '流式响应提前结束，未收到完成事件'
          setState((prev) => ({
            ...prev,
            status: 'error',
            message: '生成失败',
            error: message,
          }))
          onError?.(message)
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        const message = error instanceof Error ? error.message : '连接中断'
        setState((prev) => ({
          ...prev,
          status: 'error',
          message: '生成失败',
          error: message,
        }))
        onError?.(message)
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
      }
    },
    [chapterId, handleEvent, onError, onStart, projectId]
  )

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  return {
    state,
    start,
    stop,
    reset,
    isStreaming: state.status === 'connecting' || state.status === 'streaming',
  }
}

export interface GenerationQueueItem {
  taskId: string
  projectId: number
  chapterNo: number
  status: string
  progress: number
  message: string
}

export function useGenerationQueue() {
  const [queue, setQueue] = useState<GenerationQueueItem[]>([])
  const [isProcessing] = useState(false)

  const addToQueue = useCallback((item: GenerationQueueItem) => {
    setQueue((prev) => [...prev, item])
  }, [])

  const removeFromQueue = useCallback((taskId: string) => {
    setQueue((prev) => prev.filter((item) => item.taskId !== taskId))
  }, [])

  const updateItem = useCallback((taskId: string, updates: Partial<GenerationQueueItem>) => {
    setQueue((prev) =>
      prev.map((item) => (item.taskId === taskId ? { ...item, ...updates } : item))
    )
  }, [])

  return {
    queue,
    isProcessing,
    addToQueue,
    removeFromQueue,
    updateItem,
  }
}

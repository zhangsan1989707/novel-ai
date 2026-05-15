'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ================================
// SSE 状态类型
// ================================

export type SSEStatus = 
  | 'IDLE'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'DISCONNECTED'
  | 'ERROR'

export interface GenerationState {
  status: SSEStatus
  progress: number
  message: string
  content: string
  error?: string
  isComplete: boolean
}

// ================================
// 生成管理器 Hook
// ================================

export interface UseChapterGenerationOptions {
  projectId: number
  chapterNo: number
  autoReconnect?: boolean
  maxReconnectAttempts?: number
  onToken?: (token: string) => void
  onProgress?: (progress: number, message: string) => void
  onComplete?: (content: string) => void
  onError?: (error: string) => void
}

export function useChapterGeneration(options: UseChapterGenerationOptions) {
  const {
    projectId,
    chapterNo,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    onToken,
    onProgress,
    onComplete,
    onError
  } = options

  const [state, setState] = useState<GenerationState>({
    status: 'IDLE',
    progress: 0,
    message: 'Ready',
    content: '',
    isComplete: false
  })

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const contentBufferRef = useRef('')

  // ================================
  // 连接管理
  // ================================

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return
    }

    setState(prev => ({ ...prev, status: 'CONNECTING', message: 'Connecting...' }))

    try {
      const url = `/api/novel/projects/${projectId}/chapters/${chapterNo}/generate/stream`
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      // 连接成功
      eventSource.onopen = () => {
        setState(prev => ({ ...prev, status: 'CONNECTED', message: 'Connected' }))
        reconnectAttemptsRef.current = 0
      }

      // 消息处理
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleMessage(data)
        } catch (err) {
          console.warn('Failed to parse SSE message:', err)
        }
      }

      // 错误处理
      eventSource.onerror = (error) => {
        console.error('SSE error:', error)
        setState(prev => ({ 
          ...prev, 
          status: 'ERROR',
          error: 'Connection error'
        }))

        if (autoReconnect) {
          attemptReconnect()
        }
      }

      // 自定义事件
      eventSource.addEventListener('token', (event) => {
        const data = JSON.parse(event.data)
        handleToken(data)
      })

      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse(event.data)
        handleProgress(data)
      })

      eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data)
        handleComplete(data)
      })

      eventSource.addEventListener('heartbeat', () => {
        // 保持活跃，什么都不做
      })

    } catch (error) {
      console.error('Failed to create EventSource:', error)
      setState(prev => ({ 
        ...prev, 
        status: 'ERROR',
        error: 'Failed to connect'
      }))

      if (autoReconnect) {
        attemptReconnect()
      }
    }
  }, [projectId, chapterNo, autoReconnect])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    setState(prev => ({ ...prev, status: 'DISCONNECTED' }))
  }, [])

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setState(prev => ({
        ...prev,
        status: 'ERROR',
        error: `Max reconnect attempts (${maxReconnectAttempts}) exceeded`
      }))
      return
    }

    reconnectAttemptsRef.current++
    
    // 指数退避
    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttemptsRef.current),
      30000
    )

    setState(prev => ({
      ...prev,
      status: 'RECONNECTING',
      message: `Reconnecting in ${Math.round(delay / 1000)}s (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
    }))

    reconnectTimerRef.current = setTimeout(() => {
      connect()
    }, delay)
  }, [connect, maxReconnectAttempts])

  // ================================
  // 消息处理
  // ================================

  const handleMessage = useCallback((data: any) => {
    // 通用消息处理
    if (data.type === 'token') {
      handleToken(data)
    } else if (data.type === 'progress') {
      handleProgress(data)
    } else if (data.type === 'complete') {
      handleComplete(data)
    }
  }, [])

  const handleToken = useCallback((data: any) => {
    const token = data.content || data.text || ''
    if (token) {
      contentBufferRef.current += token
      setState(prev => ({
        ...prev,
        content: contentBufferRef.current
      }))
      onToken?.(token)
    }
  }, [onToken])

  const handleProgress = useCallback((data: any) => {
    const { progress, message } = data
    setState(prev => ({
      ...prev,
      progress: progress || prev.progress,
      message: message || prev.message
    }))
    onProgress?.(progress || 0, message || '')
  }, [onProgress])

  const handleComplete = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      status: 'IDLE',
      isComplete: true,
      progress: 100,
      message: 'Complete'
    }))
    onComplete?.(contentBufferRef.current)
    disconnect()
  }, [onComplete, disconnect])

  // ================================
  // 控制方法
  // ================================

  const start = useCallback(() => {
    contentBufferRef.current = ''
    setState({
      status: 'IDLE',
      progress: 0,
      message: 'Starting...',
      content: '',
      isComplete: false
    })
    connect()
  }, [connect])

  const stop = useCallback(() => {
    disconnect()
    setState(prev => ({
      ...prev,
      status: 'DISCONNECTED',
      message: 'Stopped'
    }))
  }, [disconnect])

  // ================================
  // 清理
  // ================================

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    state,
    start,
    stop,
    connect,
    disconnect
  }
}

// ================================
// 全局状态管理 Hook（示例）
// ================================

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
  const [isProcessing, setIsProcessing] = useState(false)

  const addToQueue = useCallback((item: GenerationQueueItem) => {
    setQueue(prev => [...prev, item])
  }, [])

  const removeFromQueue = useCallback((taskId: string) => {
    setQueue(prev => prev.filter(item => item.taskId !== taskId))
  }, [])

  const updateItem = useCallback((taskId: string, updates: Partial<GenerationQueueItem>) => {
    setQueue(prev => prev.map(item =>
      item.taskId === taskId ? { ...item, ...updates } : item
    ))
  }, [])

  return {
    queue,
    isProcessing,
    addToQueue,
    removeFromQueue,
    updateItem
  }
}

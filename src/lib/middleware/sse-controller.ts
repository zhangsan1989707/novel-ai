import { logger } from '@/lib/logger'

interface SSESSEOptions {
  timeout?: number
  heartbeatInterval?: number
}

const defaultOptions = {
  timeout: 30 * 60 * 1000,
  heartbeatInterval: 30 * 1000,
}

export function createSSEController(
  controller: ReadableStreamDefaultController,
  options: SSESSEOptions = {}
) {
  const opts = { ...defaultOptions, ...options }
  const encoder = new TextEncoder()

  let heartbeatTimer: NodeJS.Timeout | null = null
  let timeoutTimer: NodeJS.Timeout | null = null
  let lastActivityTime = Date.now()

  const sendEvent = (event: string, data: Record<string, unknown>) => {
    try {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
      controller.enqueue(encoder.encode(message))
      lastActivityTime = Date.now()
    } catch (error) {
      logger.error({ error, event }, 'Failed to send SSE event')
    }
  }

  const startHeartbeat = () => {
    if (heartbeatTimer) return

    heartbeatTimer = setInterval(() => {
      const now = Date.now()
      const idleTime = now - lastActivityTime

      if (idleTime > opts.timeout) {
        logger.warn({ idleTime, timeout: opts.timeout }, 'SSE connection timeout')
        close('timeout')
        return
      }

      sendEvent('heartbeat', {
        timestamp: now,
        idleTime,
        message: 'ping',
      })
    }, opts.heartbeatInterval)
  }

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    if (timeoutTimer) {
      clearTimeout(timeoutTimer)
      timeoutTimer = null
    }
  }

  const close = (reason?: string) => {
    stopHeartbeat()
    try {
      sendEvent('close', { reason: reason || 'normal' })
      controller.close()
    } catch (error) {
      logger.error({ error, reason }, 'Failed to close SSE controller')
    }
  }

  const sendToken = (token: string, metadata?: Record<string, unknown>) => {
    sendEvent('token', {
      content: token,
      timestamp: Date.now(),
      ...metadata,
    })
  }

  const sendProgress = (progress: number, message?: string) => {
    sendEvent('progress', {
      progress,
      message,
      timestamp: Date.now(),
    })
  }

  return {
    sendEvent,
    sendToken,
    sendProgress,
    close,
    startHeartbeat,
    stopHeartbeat,
    getLastActivityTime: () => lastActivityTime,
  }
}

export interface SSEController {
  sendEvent: (event: string, data: Record<string, unknown>) => void
  sendToken: (token: string, metadata?: Record<string, unknown>) => void
  sendProgress: (progress: number, message?: string) => void
  close: (reason?: string) => void
  startHeartbeat: () => void
  stopHeartbeat: () => void
  getLastActivityTime: () => number
}

import pino from 'pino'

const isDevelopment = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    env: process.env.NODE_ENV || 'development',
  },
})

export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context)
}

export const logAPIRequest = (
  method: string,
  path: string,
  params?: Record<string, unknown>
) => {
  logger.info({
    type: 'api_request',
    method,
    path,
    params,
  })
}

export const logAPIResponse = (
  method: string,
  path: string,
  statusCode: number,
  duration: number
) => {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
  logger[level]({
    type: 'api_response',
    method,
    path,
    statusCode,
    duration,
  })
}

export const logError = (
  error: Error,
  context?: Record<string, unknown>
) => {
  logger.error({
    type: 'error',
    error: {
      message: error.message,
      stack: isDevelopment ? error.stack : undefined,
      name: error.name,
    },
    ...context,
  })
}

export const logAIRequest = (
  vendor: string,
  modelId: string,
  promptLength: number
) => {
  logger.debug({
    type: 'ai_request',
    vendor,
    modelId,
    promptLength,
  })
}

export const logAIResponse = (
  vendor: string,
  modelId: string,
  duration: number,
  tokens?: number
) => {
  logger.info({
    type: 'ai_response',
    vendor,
    modelId,
    duration,
    tokens,
  })
}

export const logAIGeneration = (
  projectId: number,
  chapterNo: number,
  event: string,
  data?: Record<string, unknown>
) => {
  logger.info({
    type: 'generation',
    projectId,
    chapterNo,
    event,
    ...data,
  })
}

export default logger

/**
 * 统一错误处理模块
 * 
 * @example
 * throw new AppError('NOT_FOUND', '项目不存在', 404)
 * throw new ValidationError('参数错误', { field: 'title' })
 * throw new AIError('生成失败', AIVendor.DEEPSEEK)
 */

/**
 * 错误代码枚举
 */
export const ErrorCodes = {
  // 通用错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // 数据库错误
  DB_ERROR: 'DB_ERROR',
  DB_NOT_FOUND: 'DB_NOT_FOUND',
  
  // AI 错误
  AI_GENERATION_ERROR: 'AI_GENERATION_ERROR',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
  
  // 项目错误
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  PROJECT_LOCKED: 'PROJECT_LOCKED',
  
  // 章节错误
  CHAPTER_NOT_FOUND: 'CHAPTER_NOT_FOUND',
  CHAPTER_LOCKED: 'CHAPTER_LOCKED',
  CHAPTER_GENERATION_FAILED: 'CHAPTER_GENERATION_FAILED',
  
  // 角色错误
  CHARACTER_NOT_FOUND: 'CHARACTER_NOT_FOUND',
  
  // 伏笔错误
  PLOTLINE_NOT_FOUND: 'PLOTLINE_NOT_FOUND',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

/**
 * 应用错误基类
 */
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly details?: Record<string, unknown>
  public readonly timestamp: string

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.timestamp = new Date().toISOString()

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * 转换为 JSON 响应格式
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    }
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCodes.VALIDATION_ERROR, message, 400, details)
    this.name = 'ValidationError'
  }
}

/**
 * 资源未找到错误
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier !== undefined
      ? `${resource} ${identifier} 不存在`
      : `${resource} 不存在`
    super(ErrorCodes.NOT_FOUND, message, 404, { resource, identifier })
    this.name = 'NotFoundError'
  }
}

/**
 * 数据库错误
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCodes.DB_ERROR, message, 500, details)
    this.name = 'DatabaseError'
  }
}

/**
 * AI 生成错误
 */
export class AIGenerationError extends AppError {
  public readonly vendor?: string
  public readonly modelId?: string

  constructor(
    message: string,
    vendor?: string,
    modelId?: string,
    details?: Record<string, unknown>
  ) {
    super(ErrorCodes.AI_GENERATION_ERROR, message, 502, {
      vendor,
      modelId,
      ...details,
    })
    this.name = 'AIGenerationError'
    this.vendor = vendor
    this.modelId = modelId
  }
}

/**
 * AI 提供商错误
 */
export class AIProviderError extends AppError {
  public readonly provider: string

  constructor(provider: string, message: string, details?: Record<string, unknown>) {
    super(ErrorCodes.AI_PROVIDER_ERROR, message, 502, { provider, ...details })
    this.name = 'AIProviderError'
    this.provider = provider
  }
}

/**
 * AI 超时错误
 */
export class AITimeoutError extends AppError {
  public readonly timeout: number
  public readonly vendor?: string

  constructor(timeout: number, vendor?: string, details?: Record<string, unknown>) {
    super(ErrorCodes.AI_TIMEOUT, `AI 请求超时 (${timeout}ms)`, 504, { timeout, vendor, ...details })
    this.name = 'AITimeoutError'
    this.timeout = timeout
    this.vendor = vendor
  }
}

/**
 * AI 配额超限错误
 */
export class AIQuotaExceededError extends AppError {
  public readonly vendor?: string

  constructor(vendor?: string, message?: string, details?: Record<string, unknown>) {
    super(
      ErrorCodes.AI_QUOTA_EXCEEDED,
      message || 'AI 调用配额已超出',
      429,
      { vendor, ...details }
    )
    this.name = 'AIQuotaExceededError'
    this.vendor = vendor
  }
}

/**
 * 项目相关错误
 */
export class ProjectError extends AppError {
  constructor(code: ErrorCode, message: string, projectId?: number, details?: Record<string, unknown>) {
    super(code, message, 400, { projectId, ...details })
    this.name = 'ProjectError'
  }
}

/**
 * 章节相关错误
 */
export class ChapterError extends AppError {
  public readonly chapterId?: number
  public readonly chapterNumber?: number

  constructor(
    code: ErrorCode,
    message: string,
    chapterId?: number,
    chapterNumber?: number,
    details?: Record<string, unknown>
  ) {
    super(code, message, 400, { chapterId, chapterNumber, ...details })
    this.name = 'ChapterError'
    this.chapterId = chapterId
    this.chapterNumber = chapterNumber
  }
}

/**
 * 错误工厂函数
 */
export const errors = {
  notFound: (resource: string, identifier?: string | number) =>
    new NotFoundError(resource, identifier),
  
  validation: (message: string, details?: Record<string, unknown>) =>
    new ValidationError(message, details),
  
  database: (message: string, details?: Record<string, unknown>) =>
    new DatabaseError(message, details),
  
  aiGeneration: (message: string, vendor?: string, modelId?: string, details?: Record<string, unknown>) =>
    new AIGenerationError(message, vendor, modelId, details),
  
  aiTimeout: (timeout: number, vendor?: string) =>
    new AITimeoutError(timeout, vendor),
  
  aiQuotaExceeded: (vendor?: string, message?: string) =>
    new AIQuotaExceededError(vendor, message),
  
  project: (code: ErrorCode, message: string, projectId?: number) =>
    new ProjectError(code, message, projectId),
  
  chapter: (code: ErrorCode, message: string, chapterId?: number, chapterNumber?: number) =>
    new ChapterError(code, message, chapterId, chapterNumber),
}

/**
 * 检查是否为 AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

/**
 * 安全转换为 AppError
 */
export function toAppError(error: unknown, defaultMessage = '未知错误'): AppError {
  if (isAppError(error)) {
    return error
  }
  
  if (error instanceof Error) {
    return new AppError(
      ErrorCodes.INTERNAL_ERROR,
      error.message || defaultMessage,
      500,
      { originalError: error.name }
    )
  }
  
  return new AppError(ErrorCodes.INTERNAL_ERROR, defaultMessage, 500)
}

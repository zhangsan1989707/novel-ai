/**
 * API 响应处理工具
 * 
 * @example
 * // 方式1: 使用 tryCatch
 * export async function GET(req: Request) {
 *   return tryCatch(
 *     async () => {
 *       const data = await getData()
 *       return success(data)
 *     },
 *     { requestId: 'get-data' }
 *   )
 * }
 * 
 * // 方式2: 使用 handleApiError
 * export async function POST(req: Request) {
 *   try {
 *     const data = await createData()
 *     return success(data)
 *   } catch (error) {
 *     return handleApiError(error)
 *   }
 * }
 */

import { AppError, isAppError, toAppError, ErrorCodes } from './errors'
import { logger } from './logger'

/**
 * 成功响应
 */
export interface SuccessResponse<T = unknown> {
  success: true
  data: T
  timestamp: string
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  timestamp: string
}

/**
 * API 响应类型
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse

/**
 * 创建成功响应
 */
export function success<T>(data: T, message?: string): SuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  }
}

/**
 * 创建成功响应 (带消息)
 */
export function successWithMessage<T>(data: T, message: string): SuccessResponse<T> & { message: string } {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  }
}

/**
 * 创建错误响应
 */
export function error(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    success: false,
    error: { code, message, details },
    timestamp: new Date().toISOString(),
  }
}

/**
 * 处理 AppError 并返回标准化响应
 */
export function handleAppError(appError: AppError): Response {
  const statusCode = appError.statusCode
  
  // 根据状态码确定日志级别
  if (statusCode >= 500) {
    logger.error({
      code: appError.code,
      message: appError.message,
      details: appError.details,
      stack: appError.stack,
    }, 'Server error')
  } else if (statusCode >= 400) {
    logger.warn({
      code: appError.code,
      message: appError.message,
      details: appError.details,
    }, 'Client error')
  }
  
  return Response.json(
    error(appError.code, appError.message, appError.details),
    { status: statusCode }
  )
}

/**
 * 处理未知错误并返回标准化响应
 */
export function handleApiError(err: unknown): Response {
  // 如果是 AppError，使用标准处理
  if (isAppError(err)) {
    return handleAppError(err)
  }
  
  // 未知错误
  const appError = toAppError(err, '服务器内部错误')
  logger.error({
    code: appError.code,
    message: appError.message,
    stack: err instanceof Error ? err.stack : undefined,
  }, 'Unhandled error')
  
  return Response.json(
    error(appError.code, appError.message),
    { status: 500 }
  )
}

/**
 * tryCatch 包装器
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  options?: {
    onError?: (error: unknown) => void
    requestId?: string
  }
): Promise<Response> {
  try {
    const data = await fn()
    return Response.json(success(data))
  } catch (err) {
    options?.onError?.(err)
    return handleApiError(err)
  }
}

/**
 * 带分页的成功响应
 */
export function paginatedSuccess<T>(
  data: T[],
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
): SuccessResponse<T[]> & { pagination: typeof pagination } {
  return {
    success: true,
    data,
    pagination,
    timestamp: new Date().toISOString(),
  }
}

/**
 * 创建操作结果响应
 */
export function operationResult(
  success: boolean,
  message: string,
  details?: Record<string, unknown>
): SuccessResponse<{ success: boolean; message: string }> {
  return {
    success: true,
    data: {
      success,
      message,
      ...details,
    },
    timestamp: new Date().toISOString(),
  }
}

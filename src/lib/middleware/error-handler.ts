import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationException extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationException'
  }
}

export class NotFoundException extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404)
    this.name = 'NotFoundException'
  }
}

export class UnauthorizedException extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
    this.name = 'UnauthorizedException'
  }
}

export class ForbiddenException extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403)
    this.name = 'ForbiddenException'
  }
}

export class RateLimitException extends AppError {
  constructor(retryAfter?: number) {
    super('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429, { retryAfter })
    this.name = 'RateLimitException'
  }
}

interface ErrorHandlerOptions {
  includeStackTrace?: boolean
  logErrors?: boolean
}

export function handleError(
  error: unknown,
  options: ErrorHandlerOptions = {}
): NextResponse {
  const { includeStackTrace = false, logErrors = true } = options

  if (logErrors) {
    logger.error({
      error: error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: includeStackTrace ? error.stack : undefined,
      } : error,
    }, 'Request error')
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
        },
      },
      { status: error.statusCode }
    )
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message || 'Validation failed',
          issues: error.issues,
        },
      },
      { status: 400 }
    )
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: includeStackTrace ? error.message : 'An unexpected error occurred',
          ...(includeStackTrace && error.stack && { stack: error.stack }),
        },
      },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
      },
    },
    { status: 500 }
  )
}

export function withErrorHandler<T extends (...args: unknown[]) => Promise<NextResponse>>(
  handler: T,
  options?: ErrorHandlerOptions
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleError(error, options) as ReturnType<T>
    }
  }) as T
}

export function asyncHandler<T>(
  fn: (request: NextRequest, ...args: unknown[]) => Promise<T>
) {
  return async (request: NextRequest, ...args: unknown[]) => {
    try {
      return await fn(request, ...args)
    } catch (error) {
      throw error
    }
  }
}

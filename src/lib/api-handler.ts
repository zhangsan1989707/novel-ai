import { NextResponse } from 'next/server'
import { ErrorHandler, ErrorCategory } from './errors'

type ApiHandler<T = unknown> = (
  request: Request,
  context: T
) => Promise<NextResponse> | NextResponse

function getStatusCode(category: ErrorCategory): number {
  switch (category) {
    case ErrorCategory.VALIDATION:
      return 400;
    case ErrorCategory.AUTHENTICATION:
    case ErrorCategory.AUTHORIZATION:
      return 401;
    case ErrorCategory.NOT_FOUND:
      return 404;
    case ErrorCategory.AI_PROVIDER:
    case ErrorCategory.DATABASE:
    case ErrorCategory.PIPELINE:
    case ErrorCategory.INTERNAL:
    default:
      return 500;
  }
}

export function apiHandler<T = unknown>(handler: ApiHandler<T>): ApiHandler<T> {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      const rawError = error instanceof Error
        ? { message: error.message, stack: error.stack, code: (error as any).code }
        : { message: String(error) }

      const appError = ErrorHandler.normalize(rawError)
      const statusCode = getStatusCode(appError.category)

      const response: Record<string, unknown> = {
        success: false,
        error: {
          code: appError.code,
          message: appError.message,
        }
      }

      if (appError.suggestions && appError.suggestions.length > 0) {
        (response.error as any).suggestions = appError.suggestions
      }

      if (process.env.NODE_ENV === 'development' && appError.details) {
        (response.error as any).details = appError.details
      }

      return NextResponse.json(response, { status: statusCode })
    }
  }
}

export function createSuccessResponse<T>(data: T, status: number = 200) {
  return NextResponse.json({
    success: true,
    data
  }, { status })
}

export function createErrorResponse(
  code: string,
  message: string,
  suggestions?: string[],
  status: number = 400
) {
  const response: Record<string, unknown> = {
    success: false,
    error: { code, message }
  }

  if (suggestions) {
    (response.error as any).suggestions = suggestions
  }

  return NextResponse.json(response, { status })
}

import { NextResponse } from 'next/server'

type ApiHandler<T = unknown> = (
  request: Request,
  context: T
) => Promise<NextResponse> | NextResponse

export function apiHandler<T = unknown>(handler: ApiHandler<T>): ApiHandler<T> {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      const message = error instanceof Error ? error.message : '服务器内部错误'

      if (error instanceof Error && error.name === 'PrismaClientKnownRequestError') {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'DATABASE_ERROR', message },
          },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message },
        },
        { status: 500 }
      )
    }
  }
}
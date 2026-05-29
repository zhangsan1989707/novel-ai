import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_API_PREFIXES = [
  '/api/novel/',
  '/api/styles/',
  '/api/notifications/',
  '/api/agents/',
  '/api/hooks/',
  '/api/market/',
  '/api/pipeline/',
]

const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/health/',
]

function isDevelopmentEnv() {
  return process.env.NODE_ENV !== 'production' && process.env.AUTH_ENFORCE !== 'true'
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isDevelopmentEnv()) {
    return NextResponse.next()
  }

  const isProtected = PROTECTED_API_PREFIXES.some(prefix => pathname.startsWith(prefix))
  const isPublic = PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))

  if (isProtected && !isPublic) {
    const sessionCookie = request.cookies.get('authjs.session-token')
      || request.cookies.get('next-auth.session-token')
      || request.cookies.get('__Secure-authjs.session-token')
      || request.cookies.get('__Secure-next-auth.session-token')

    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
        { status: 401 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}

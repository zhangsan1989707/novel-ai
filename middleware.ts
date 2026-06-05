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

const PROTECTED_PAGE_PREFIXES = [
  '/projects',
  '/settings',
  '/notifications',
  '/market',
  '/virtual-writers',
  '/cost',
]

function isDevelopmentEnv() {
  return process.env.NODE_ENV !== 'production' && process.env.AUTH_ENFORCE !== 'true'
}

function getSessionCookie(request: NextRequest) {
  return request.cookies.get('authjs.session-token')
    || request.cookies.get('next-auth.session-token')
    || request.cookies.get('__Secure-authjs.session-token')
    || request.cookies.get('__Secure-next-auth.session-token')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isDevelopmentEnv()) {
    return NextResponse.next()
  }

  // API route protection
  const isProtectedApi = PROTECTED_API_PREFIXES.some(prefix => pathname.startsWith(prefix))
  const isPublicApi = PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))

  if (isProtectedApi && !isPublicApi) {
    if (!getSessionCookie(request)) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
        { status: 401 }
      )
    }
  }

  // Page route protection
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some(prefix => pathname.startsWith(prefix))
  if (isProtectedPage && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*', '/projects/:path*', '/settings/:path*', '/notifications/:path*', '/market/:path*', '/virtual-writers/:path*', '/cost/:path*'],
}

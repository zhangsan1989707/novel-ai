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

function isProtectedApi(pathname: string) {
  return PROTECTED_API_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

function isProtectedPage(pathname: string) {
  return PROTECTED_PAGE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isDevelopmentEnv() || isPublicApi(pathname)) {
    return NextResponse.next()
  }

  if (!isProtectedApi(pathname) && !isProtectedPage(pathname)) {
    return NextResponse.next()
  }

  if (getSessionCookie(request)) {
    return NextResponse.next()
  }

  if (isProtectedApi(pathname)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHENTICATED', message: '请先登录后再访问' } },
      { status: 401 }
    )
  }

  return NextResponse.redirect(new URL('/login', request.url))
}

export function proxy(request: NextRequest) {
  return middleware(request)
}

export const config = {
  matcher: ['/api/:path*', '/projects/:path*', '/settings/:path*', '/notifications/:path*', '/market/:path*', '/virtual-writers/:path*', '/cost/:path*'],
}

import 'server-only'

import { headers } from 'next/headers'

function resolveRequestOrigin(host: string, forwardedProto: string | null): string {
  const protocol = forwardedProto?.split(',')[0]?.trim()
    || (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')

  return `${protocol}://${host}`
}

export async function fetchInternalApi(pathname: string, init: RequestInit = {}) {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') || headerList.get('host') || '127.0.0.1:3200'
  const cookie = headerList.get('cookie')
  const authorization = headerList.get('authorization')
  const requestHeaders = new Headers(init.headers)

  if (cookie) {
    requestHeaders.set('cookie', cookie)
  }

  if (authorization) {
    requestHeaders.set('authorization', authorization)
  }

  return fetch(new URL(pathname, resolveRequestOrigin(host, headerList.get('x-forwarded-proto'))), {
    ...init,
    headers: requestHeaders,
  })
}

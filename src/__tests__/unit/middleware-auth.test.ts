import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../../../middleware'

describe('middleware auth boundary', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('blocks protected APIs without a session when auth is enforced', () => {
    vi.stubEnv('AUTH_ENFORCE', 'true')

    const response = middleware(new NextRequest('http://localhost/api/novel/projects'))

    expect(response.status).toBe(401)
  })

  it('redirects protected pages without a session when auth is enforced', () => {
    vi.stubEnv('AUTH_ENFORCE', 'true')

    const response = middleware(new NextRequest('http://localhost/projects'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/login')
  })

  it('allows protected routes with a session cookie when auth is enforced', () => {
    vi.stubEnv('AUTH_ENFORCE', 'true')

    const response = middleware(new NextRequest('http://localhost/api/novel/projects', {
      headers: { Cookie: 'authjs.session-token=session-1' },
    }))

    expect(response.status).toBe(200)
  })
})

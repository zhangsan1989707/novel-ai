import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  sessionFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userCreate: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    session: {
      findFirst: mocks.sessionFindFirst,
    },
    user: {
      findUnique: mocks.userFindUnique,
      findFirst: mocks.userFindFirst,
      create: mocks.userCreate,
    },
  },
}))

describe('auth production boundary', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset())
    vi.stubEnv('AUTH_ENFORCE', undefined)
    mocks.cookies.mockResolvedValue({ get: () => undefined })
    mocks.sessionFindFirst.mockResolvedValue(null)
    mocks.userFindFirst.mockResolvedValue({
      id: 1,
      name: '开发用户',
      email: 'dev@localhost',
      image: null,
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the dev user without a session in local mode', async () => {
    const { auth } = await import('@/lib/auth')

    await expect(auth()).resolves.toMatchObject({
      user: { id: '1', email: 'dev@localhost' },
    })
  })

  it('does not fallback to a dev user when auth is enforced', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true')
    const { auth, getCurrentUserId } = await import('@/lib/auth')

    await expect(auth()).resolves.toBeNull()
    await expect(getCurrentUserId()).rejects.toThrow('UNAUTHENTICATED')
    expect(mocks.userFindFirst).not.toHaveBeenCalled()
    expect(mocks.userCreate).not.toHaveBeenCalled()
  })
})

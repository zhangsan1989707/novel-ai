import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  findFirst: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    aIModelConfig: {
      findFirst: mocks.findFirst,
    },
  },
}))

describe('health route security', () => {
  beforeEach(() => {
    mocks.queryRaw.mockReset()
    mocks.findFirst.mockReset()
  })

  it('does not expose raw errors, vendor details, model details, or keys', async () => {
    const rawDatabaseError = 'password=secret database host db.internal.local refused connection'
    mocks.queryRaw.mockRejectedValue(new Error(rawDatabaseError))
    mocks.findFirst.mockResolvedValue({
      vendor: 'OPENAI',
      modelId: 'gpt-4.1-prod',
      apiKey: 'sk-health-secret',
    })

    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    const body = await response.json()
    const serialized = JSON.stringify(body)

    expect(response.status).toBe(503)
    expect(serialized).not.toContain(rawDatabaseError)
    expect(serialized).not.toContain('db.internal.local')
    expect(serialized).not.toContain('OPENAI')
    expect(serialized).not.toContain('gpt-4.1-prod')
    expect(serialized).not.toContain('sk-health-secret')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireProjectOwner: vi.fn(),
}))

vi.mock('@/lib/server/project-access', () => ({
  requireProjectOwner: mocks.requireProjectOwner,
  projectNotFoundResponse: () => Response.json(
    { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
    { status: 404 }
  ),
}))

describe('legacy engine generate route', () => {
  beforeEach(() => {
    mocks.requireProjectOwner.mockReset()
    mocks.requireProjectOwner.mockResolvedValue({ id: 42, creatorId: 7 })
  })

  it('does not return a fake runnable job id', async () => {
    const { POST } = await import('@/app/api/novel/engine/generate/route')
    const response = await POST(new NextRequest('http://localhost/api/novel/engine/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 42, chapterNo: 3 }),
    }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('LEGACY_ENDPOINT')
    expect(body.data).toMatchObject({
      projectId: 42,
      chapterNo: 3,
      replacement: '/api/novel/projects/42/pipeline/start',
    })
  })
})

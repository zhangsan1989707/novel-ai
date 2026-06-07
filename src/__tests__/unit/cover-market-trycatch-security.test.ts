import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireProjectOwner: vi.fn(),
  coverDesignFindUnique: vi.fn(),
  coverDesignDelete: vi.fn(),
  coverDesignUpdate: vi.fn(),
  coverDesignUpdateMany: vi.fn(),
  novelProjectUpdate: vi.fn(),
  getCoverCapability: vi.fn(),
  analyzeMarketTrend: vi.fn(),
}))

vi.mock('@/lib/server/project-access', () => ({
  requireProjectOwner: mocks.requireProjectOwner,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    coverDesign: {
      findUnique: mocks.coverDesignFindUnique,
      delete: mocks.coverDesignDelete,
      update: mocks.coverDesignUpdate,
      updateMany: mocks.coverDesignUpdateMany,
    },
    novelProject: {
      update: mocks.novelProjectUpdate,
    },
    $transaction: vi.fn(async (fn: Function) => fn({
      coverDesign: {
        updateMany: mocks.coverDesignUpdateMany,
        update: mocks.coverDesignUpdate,
      },
      novelProject: {
        update: mocks.novelProjectUpdate,
      },
    })),
  },
}))

vi.mock('@/lib/cover/service', () => ({
  getCoverCapability: mocks.getCoverCapability,
}))

vi.mock('@/lib/market/service', () => ({
  analyzeMarketTrend: mocks.analyzeMarketTrend,
}))

describe('cover and market route tryCatch compatibility', () => {
  describe('cover/[designId] GET', () => {
    beforeEach(() => {
      Object.values(mocks).forEach(mock => mock.mockReset())
      mocks.coverDesignFindUnique.mockResolvedValue({
        id: 'design-1',
        projectId: 42,
        imageUrl: 'https://example.com/cover.png',
      })
      mocks.requireProjectOwner.mockResolvedValue({ id: 42, creatorId: 7 })
    })

    it('should return access error when user does not own the project', async () => {
      mocks.requireProjectOwner.mockResolvedValue(null)

      const { GET } = await import('@/app/api/novel/cover/[designId]/route')
      const req = new NextRequest('http://localhost/api/novel/cover/design-1')
      const res = await GET(req, { params: Promise.resolve({ designId: 'design-1' }) })
      const body = await res.json()

      expect(body.success).toBe(false)
      expect(body.error).toBeDefined()
      expect(body.error.code).toBe('NOT_FOUND')
      expect(body.error.message).toBe('项目不存在')
    })
  })

  describe('cover/[designId] DELETE', () => {
    beforeEach(() => {
      Object.values(mocks).forEach(mock => mock.mockReset())
      mocks.coverDesignFindUnique.mockResolvedValue({
        id: 'design-1',
        projectId: 42,
      })
      mocks.requireProjectOwner.mockResolvedValue({ id: 42, creatorId: 7 })
    })

    it('should return access error when user does not own the project', async () => {
      mocks.requireProjectOwner.mockResolvedValue(null)

      const { DELETE } = await import('@/app/api/novel/cover/[designId]/route')
      const req = new NextRequest('http://localhost/api/novel/cover/design-1', { method: 'DELETE' })
      const res = await DELETE(req, { params: Promise.resolve({ designId: 'design-1' }) })
      const body = await res.json()

      expect(body.success).toBe(false)
      expect(body.error).toBeDefined()
      expect(body.error.code).toBe('NOT_FOUND')
      expect(mocks.coverDesignDelete).not.toHaveBeenCalled()
    })
  })

  describe('cover/[designId] PATCH', () => {
    beforeEach(() => {
      Object.values(mocks).forEach(mock => mock.mockReset())
      mocks.coverDesignFindUnique.mockResolvedValue({
        id: 'design-1',
        projectId: 42,
        imageUrl: 'https://example.com/cover.png',
      })
      mocks.requireProjectOwner.mockResolvedValue({ id: 42, creatorId: 7 })
    })

    it('should return access error when user does not own the project', async () => {
      mocks.requireProjectOwner.mockResolvedValue(null)

      const { PATCH } = await import('@/app/api/novel/cover/[designId]/route')
      const req = new NextRequest('http://localhost/api/novel/cover/design-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const res = await PATCH(req, { params: Promise.resolve({ designId: 'design-1' }) })
      const body = await res.json()

      expect(body.success).toBe(false)
      expect(body.error).toBeDefined()
      expect(body.error.code).toBe('NOT_FOUND')
    })
  })

  describe('cover/capability GET', () => {
    beforeEach(() => {
      Object.values(mocks).forEach(mock => mock.mockReset())
      mocks.requireProjectOwner.mockResolvedValue({ id: 42, creatorId: 7 })
      mocks.getCoverCapability.mockResolvedValue({ hasApiKey: true })
    })

    it('should return access error when user does not own the project', async () => {
      mocks.requireProjectOwner.mockResolvedValue(null)

      const { GET } = await import('@/app/api/novel/cover/capability/route')
      const req = new NextRequest('http://localhost/api/novel/cover/capability?projectId=42')
      const res = await GET(req)
      const body = await res.json()

      expect(body.success).toBe(false)
      expect(body.error).toBeDefined()
      expect(body.error.code).toBe('NOT_FOUND')
      expect(body.error.message).toBe('项目不存在')
    })
  })

  describe('market/analyze POST', () => {
    beforeEach(() => {
      Object.values(mocks).forEach(mock => mock.mockReset())
      mocks.requireProjectOwner.mockResolvedValue({ id: 42, creatorId: 7 })
      mocks.analyzeMarketTrend.mockResolvedValue({ trend: 'up' })
    })

    it('should return access error when user does not own the project', async () => {
      mocks.requireProjectOwner.mockResolvedValue(null)

      const { POST } = await import('@/app/api/market/analyze/route')
      const req = new NextRequest('http://localhost/api/market/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 42, genre: '玄幻', platform: '起点' }),
      })
      const res = await POST(req)
      const body = await res.json()

      expect(body.success).toBe(false)
      expect(body.error).toBeDefined()
      expect(body.error.code).toBe('NOT_FOUND')
      expect(body.error.message).toBe('项目不存在')
    })

    it('should allow access when projectId is not provided', async () => {
      mocks.analyzeMarketTrend.mockResolvedValue({ trend: 'up' })

      const { POST } = await import('@/app/api/market/analyze/route')
      const req = new NextRequest('http://localhost/api/market/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genre: '玄幻', platform: '起点' }),
      })
      const res = await POST(req)
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(mocks.requireProjectOwner).not.toHaveBeenCalled()
    })
  })
})
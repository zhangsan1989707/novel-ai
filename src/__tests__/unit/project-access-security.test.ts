import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  findFirst: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUserId: mocks.getCurrentUserId,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    novelProject: {
      findFirst: mocks.findFirst,
    },
  },
}))

describe('project access helper', () => {
  const ownedProject = { id: 42, creatorId: 7, title: 'Owned project' }

  beforeEach(() => {
    mocks.getCurrentUserId.mockReset()
    mocks.findFirst.mockReset()

    mocks.getCurrentUserId.mockResolvedValue(7)
    mocks.findFirst.mockImplementation(async (args?: { where?: { id?: number; creatorId?: number } }) => {
      return args?.where?.id === 42 && args.where.creatorId === 7 ? ownedProject : null
    })
  })

  it('returns the project when it belongs to the current user', async () => {
    const { requireProjectOwner } = await import('@/lib/server/project-access')

    await expect(requireProjectOwner(42)).resolves.toMatchObject({
      id: 42,
      creatorId: 7,
    })
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: 42, creatorId: 7 },
      select: { id: true, creatorId: true },
    })
  })

  it('rejects a non-owned project without revealing that it exists', async () => {
    mocks.getCurrentUserId.mockResolvedValue(8)
    const { requireProjectOwner } = await import('@/lib/server/project-access')

    await expect(requireProjectOwner(42)).resolves.toBeNull()
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: 42, creatorId: 8 },
      select: { id: true, creatorId: true },
    })
  })
})

import { describe, expect, it, vi } from 'vitest'

const prismaFindUnique = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  prisma: {
    novelProject: {
      findUnique: prismaFindUnique,
    },
  },
}))

describe('loadProjectForExport', () => {
  it('exports completed chapters only', async () => {
    const { loadProjectForExport } = await import('@/lib/export/service')

    await loadProjectForExport(7)

    expect(prismaFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          chapters: expect.objectContaining({
            where: expect.objectContaining({
              status: 'COMPLETED',
              content: { not: null },
            }),
          }),
        }),
      })
    )
  })
})

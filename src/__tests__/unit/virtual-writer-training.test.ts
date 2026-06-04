import { describe, expect, it } from 'vitest'

describe('virtual writer training', () => {
  it('module exports runVirtualWriterTraining', async () => {
    const mod = await import('@/lib/virtual-writer/training')
    expect(typeof mod.runVirtualWriterTraining).toBe('function')
  })
})

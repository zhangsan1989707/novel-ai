import { vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => {
      throw new Error('prisma.$transaction not implemented in test - use mockTransaction helper')
    }),
    novelProject: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    novelChapter: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    generationJob: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    storyState: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    worldState: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    chapterCommit: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    notification: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    aiModelConfig: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    modelPricing: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    userQuota: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    aiUsage: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}))
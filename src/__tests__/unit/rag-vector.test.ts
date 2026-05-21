import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AIVendor } from '@/types'

const mockState = vi.hoisted(() => ({
  txCalls: 0,
  executeCalls: 0,
  queryCalls: 0,
  embedCalls: 0,
}))

vi.mock('@/lib/prisma', () => {
  const queryRaw = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    mockState.queryCalls += 1
    const text = String.raw({ raw: Array.from(strings) }, ...values)

    if (text.includes("to_regclass('public.rag_documents')")) {
      return [{ table_name: 'rag_documents' }]
    }

    if (text.includes('information_schema.columns')) {
      return [{ data_type: 'jsonb', udt_name: null }]
    }

    if (text.includes('SELECT COUNT(*)::bigint AS count')) {
      return [{ count: BigInt(0) }]
    }

    return []
  }

  const executeRaw = async () => {
    mockState.executeCalls += 1
    return 1
  }

  const tx = {
    $queryRaw: vi.fn(queryRaw),
    $executeRaw: vi.fn(executeRaw),
  }

  return {
    prisma: {
      $queryRaw: vi.fn(queryRaw),
      $executeRaw: vi.fn(executeRaw),
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => {
        mockState.txCalls += 1
        return fn(tx)
      }),
      novelChapter: {
        findMany: vi.fn(async () => [
          { chapterNumber: 1, title: '第一章', content: '主角进入城市，遭遇第一次冲突。' },
        ]),
      },
      chapterSummary: {
        findMany: vi.fn(async () => []),
      },
      volumeSummary: {
        findMany: vi.fn(async () => []),
      },
      bookSummary: {
        findUnique: vi.fn(async () => null),
      },
      character: {
        findMany: vi.fn(async () => []),
      },
      plotline: {
        findMany: vi.fn(async () => []),
      },
      researchRef: {
        findMany: vi.fn(async () => []),
      },
    },
  }
})

vi.mock('@/lib/ai/service', () => ({
  AIService: {
    createEmbeddingProvider: vi.fn(async () => ({
      name: 'MockEmbeddingProvider',
      vendor: AIVendor.OPENAI,
      embedText: vi.fn(async () => {
        mockState.embedCalls += 1
        await new Promise(resolve => setTimeout(resolve, 25))
        return [0.12, 0.34, 0.56, 0.78]
      }),
    })),
  },
}))

describe('rag-vector runtime guards', () => {
  beforeEach(() => {
    mockState.txCalls = 0
    mockState.executeCalls = 0
    mockState.queryCalls = 0
    mockState.embedCalls = 0
    vi.resetModules()
  })

  it('keeps RAG rebuild single-flight and reports cooldown after rebuild', async () => {
    const { rebuildProjectRAGIndex, getRagRuntimeStatus } = await import('@/lib/engine/rag-vector')

    const first = rebuildProjectRAGIndex(17)
    const second = rebuildProjectRAGIndex(17)

    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(firstResult.indexedCount).toBeGreaterThan(0)
    expect(secondResult.indexedCount).toBeGreaterThanOrEqual(0)
    expect(mockState.txCalls).toBe(1)
    expect(mockState.executeCalls).toBeGreaterThan(0)
    expect(mockState.embedCalls).toBeGreaterThan(0)

    const status = getRagRuntimeStatus(17)
    expect(status.inFlight).toBe(false)
    expect(status.cooldownRemainingMs).toBeGreaterThan(0)
  })
})

import { describe, expect, it } from 'vitest'

describe('AI config redaction helper', () => {
  it('does not return plaintext apiKey or embeddingApiKey', async () => {
    const { redactAIConfig } = await import('@/lib/ai/config-redaction')
    const apiKey = 'sk-plaintext-primary-secret'
    const embeddingApiKey = 'emb-plaintext-secondary-secret'

    const redacted = redactAIConfig({
      id: 3,
      name: 'Production model',
      vendor: 'OPENAI',
      modelId: 'gpt-4.1',
      apiKey,
      apiEndpoint: 'https://api.example.com/v1',
      isDefault: true,
      sortOrder: 0,
      createdAt: new Date('2026-06-06T00:00:00.000Z'),
      updatedAt: new Date('2026-06-06T00:00:00.000Z'),
      embeddingVendor: 'OPENAI',
      embeddingModelId: 'text-embedding-3-large',
      embeddingDimensions: 3072,
      embeddingApiKey,
      embeddingApiEndpoint: 'https://api.example.com/embeddings',
    })

    const serialized = JSON.stringify(redacted)

    expect(redacted).toMatchObject({
      id: 3,
      name: 'Production model',
      vendor: 'OPENAI',
      modelId: 'gpt-4.1',
      isDefault: true,
      embeddingModelId: 'text-embedding-3-large',
      hasApiKey: true,
      hasEmbeddingApiKey: true,
    })
    expect(serialized).not.toContain(apiKey)
    expect(serialized).not.toContain(embeddingApiKey)
    expect((redacted as { apiKey?: string | null }).apiKey).not.toBe(apiKey)
    expect((redacted as { embeddingApiKey?: string | null }).embeddingApiKey).not.toBe(embeddingApiKey)
  })
})

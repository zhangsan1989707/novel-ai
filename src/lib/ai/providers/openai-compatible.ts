import { BaseAIProvider } from '../base'
import type { EmbeddingParams, GenerationParams, GenerationResult } from '../types'

const DEFAULT_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 120000)
const DEFAULT_EMBEDDING_DIMENSIONS = Number(process.env.AI_EMBEDDING_DIMENSIONS || 256)

/**
 * OpenAI 兼容 Provider 基类
 * DeepSeek、Alibaba、VolcEngine、MiniMax 等均使用 OpenAI 兼容 API
 * 子类只需指定 name、vendor、baseURL 和可选的端点路径覆盖
 */
export abstract class OpenAICompatibleProvider extends BaseAIProvider {
  protected abstract readonly defaultBaseURL: string

  /** 子类可覆盖：API 端点路径，默认 /chat/completions */
  protected chatPath = '/chat/completions'

  /** 子类可覆盖：是否支持 stream_options */
  protected supportsStreamOptions = false

  protected getBaseURL(): string {
    return (this.config?.apiEndpoint || this.defaultBaseURL).replace(/\/+$/, '')
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${this.name} API request timed out after ${Math.round(timeoutMs / 1000)}s`)
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  async generate(prompt: string, params?: GenerationParams): Promise<GenerationResult> {
    if (!this.config) {
      throw new Error('Provider not configured')
    }

    const response = await this.fetchWithTimeout(`${this.getBaseURL()}${this.chatPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: params?.temperature ?? 0.7,
        max_tokens: params?.maxTokens ?? this.estimateTargetTokens(3000),
        top_p: params?.topP,
        frequency_penalty: params?.frequencyPenalty,
        presence_penalty: params?.presencePenalty,
        stop: params?.stop,
        ...(params?.responseFormat ? { response_format: params.responseFormat } : {}),
      }),
    }, params?.timeoutMs)

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`${this.name} API error: ${response.status} - ${error}`)
    }

    const data = await response.json()

    return {
      content: data.choices?.[0]?.message?.content || '',
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
      finishReason: data.choices?.[0]?.finish_reason,
    }
  }

  private normalizeEmbeddingDimensions(embedding: number[], targetDimensions: number): number[] {
    if (!Number.isFinite(targetDimensions) || targetDimensions <= 0) {
      return embedding
    }
    if (embedding.length === targetDimensions) {
      return embedding
    }
    if (embedding.length === 0) {
      return new Array(targetDimensions).fill(0)
    }
    if (embedding.length > targetDimensions) {
      const resized = new Array(targetDimensions).fill(0)
      for (let i = 0; i < targetDimensions; i++) {
        const start = Math.floor((i * embedding.length) / targetDimensions)
        const end = Math.max(start + 1, Math.floor(((i + 1) * embedding.length) / targetDimensions))
        let sum = 0
        let count = 0
        for (let j = start; j < end && j < embedding.length; j++) {
          sum += embedding[j]
          count++
        }
        resized[i] = count > 0 ? sum / count : embedding[start] || 0
      }
      const magnitude = Math.sqrt(resized.reduce((sum, val) => sum + val * val, 0))
      return magnitude > 0 ? resized.map(val => val / magnitude) : resized
    }

    const padded = embedding.slice()
    while (padded.length < targetDimensions) {
      padded.push(0)
    }
    const magnitude = Math.sqrt(padded.reduce((sum, val) => sum + val * val, 0))
    return magnitude > 0 ? padded.map(val => val / magnitude) : padded
  }

  private resolveEmbeddingModelId(params?: EmbeddingParams): string {
    if (params?.modelId) return params.modelId
    if (this.config?.embeddingModelId) return this.config.embeddingModelId

    const vendorKey = `${String(this.vendor).toUpperCase()}_EMBEDDING_MODEL_ID`
    const vendorModel = process.env[vendorKey]
    if (vendorModel) return vendorModel

    const genericModel = process.env.EMBEDDING_MODEL_ID
    if (genericModel) return genericModel

    if (String(this.vendor).toUpperCase() === 'OPENAI') {
      return 'text-embedding-3-small'
    }

    if (this.config?.modelId && this.config.modelId.toLowerCase().includes('embedding')) {
      return this.config.modelId
    }

    throw new Error(`${this.name} embedding model is not configured. Set EMBEDDING_MODEL_ID or ${vendorKey}.`)
  }

  async embedText(text: string, params?: EmbeddingParams): Promise<number[]> {
    if (!this.config) {
      throw new Error('Provider not configured')
    }
    if (!text.trim()) {
      return new Array(this.config.embeddingDimensions || DEFAULT_EMBEDDING_DIMENSIONS).fill(0)
    }

    const model = this.resolveEmbeddingModelId(params)
    const dimensions = params?.dimensions || this.config.embeddingDimensions || DEFAULT_EMBEDDING_DIMENSIONS

    const response = await this.fetchWithTimeout(`${this.getBaseURL()}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
        encoding_format: 'float',
        ...(dimensions > 0 ? { dimensions } : {}),
        ...(params?.user ? { user: params.user } : {}),
      }),
    }, params?.timeoutMs)

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`${this.name} embedding API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const embedding = data.data?.[0]?.embedding
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error(`${this.name} embedding API returned empty vector`)
    }

    return this.normalizeEmbeddingDimensions(
      embedding.map((value: unknown) => Number(value) || 0),
      dimensions
    )
  }

  async *generateStream(prompt: string, params?: GenerationParams): AsyncGenerator<string> {
    if (!this.config) {
      throw new Error('Provider not configured')
    }

    const body: Record<string, unknown> = {
      model: this.config.modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: params?.temperature ?? 0.7,
      max_tokens: params?.maxTokens ?? this.estimateTargetTokens(3000),
      top_p: params?.topP,
      frequency_penalty: params?.frequencyPenalty,
      presence_penalty: params?.presencePenalty,
      stream: true,
    }

    if (this.supportsStreamOptions) {
      body.stream_options = { include_usage: true }
    }
    if (params?.responseFormat) {
      body.response_format = params.responseFormat
    }

    const response = await this.fetchWithTimeout(`${this.getBaseURL()}${this.chatPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    }, params?.timeoutMs)

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`${this.name} API error: ${response.status} - ${error}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              return
            }
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                yield content
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}

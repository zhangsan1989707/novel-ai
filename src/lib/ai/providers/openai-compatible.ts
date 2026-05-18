import { BaseAIProvider } from '../base'
import type { GenerationParams, GenerationResult } from '../types'

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

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 45000): Promise<Response> {
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

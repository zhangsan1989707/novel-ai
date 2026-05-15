import { BaseAIProvider } from '../base'
import type { AIConfig, GenerationParams, GenerationResult } from '../types'
import { AIVendor } from '@/types'

/**
 * Anthropic Provider (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku)
 */
export class AnthropicProvider extends BaseAIProvider {
  readonly name = 'Anthropic'
  readonly vendor = AIVendor.ANTHROPIC

  private readonly baseURL = 'https://api.anthropic.com/v1'

  async generate(prompt: string, params?: GenerationParams): Promise<GenerationResult> {
    if (!this.config) {
      throw new Error('Provider not configured')
    }

    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: params?.temperature ?? 0.7,
        max_tokens: params?.maxTokens ?? this.estimateTargetTokens(3000),
        top_p: params?.topP,
        stop_sequences: params?.stop,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${response.status} - ${error}`)
    }

    const data = await response.json()

    return {
      content: data.content[0]?.text || '',
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
      finishReason: data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason,
    }
  }

  async *generateStream(prompt: string, params?: GenerationParams): AsyncGenerator<string> {
    if (!this.config) {
      throw new Error('Provider not configured')
    }

    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: params?.temperature ?? 0.7,
        max_tokens: params?.maxTokens ?? this.estimateTargetTokens(3000),
        top_p: params?.topP,
        stop_sequences: params?.stop,
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${response.status} - ${error}`)
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
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta') {
                const content = parsed.delta?.text
                if (content) {
                  yield content
                }
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

import { BaseAIProvider } from '../base'
import type { AIConfig, GenerationParams, GenerationResult } from '../types'
import { AIVendor } from '@/types'

/**
 * DeepSeek Provider (DeepSeek Chat, DeepSeek Coder)
 */
export class DeepSeekProvider extends BaseAIProvider {
  readonly name = 'DeepSeek'
  readonly vendor = AIVendor.DEEPSEEK

  private readonly baseURL = 'https://api.deepseek.com/v1'

  async generate(prompt: string, params?: GenerationParams): Promise<GenerationResult> {
    if (!this.config) {
      throw new Error('Provider not configured')
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
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
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`)
    }

    const data = await response.json()

    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      finishReason: data.choices[0]?.finish_reason,
    }
  }

  async *generateStream(prompt: string, params?: GenerationParams): AsyncGenerator<string> {
    if (!this.config) {
      throw new Error('Provider not configured')
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
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
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`)
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

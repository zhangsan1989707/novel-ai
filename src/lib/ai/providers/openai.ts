import { OpenAICompatibleProvider } from './openai-compatible'
import type { ImageGenerationParams, ImageGenerationResult } from '../types'
import { AIVendor } from '@/types'

export class OpenAIProvider extends OpenAICompatibleProvider {
  readonly name = 'OpenAI'
  readonly vendor = AIVendor.OPENAI
  protected readonly defaultBaseURL = 'https://api.openai.com/v1'
  protected readonly supportsStreamOptions = true

  async generateImage(prompt: string, params?: ImageGenerationParams): Promise<ImageGenerationResult> {
    if (!this.config) {
      throw new Error('Provider not configured')
    }

    const response = await fetch(`${this.getBaseURL()}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        size: params?.size || '1024x1792',
        quality: params?.quality || 'standard',
        style: params?.style || 'vivid',
        n: params?.numImages || 1,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI DALL-E API error: ${response.status} - ${error}`)
    }

    const data = await response.json()

    return {
      imageUrls: data.data?.map((item: { url: string }) => item.url) || [],
      revisedPrompt: data.data?.[0]?.revised_prompt,
    }
  }
}

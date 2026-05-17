import { OpenAICompatibleProvider } from './openai-compatible'
import { AIVendor } from '@/types'

export class DeepSeekProvider extends OpenAICompatibleProvider {
  readonly name = 'DeepSeek'
  readonly vendor = AIVendor.DEEPSEEK
  protected readonly defaultBaseURL = 'https://api.deepseek.com/v1'
  protected readonly supportsStreamOptions = true
}

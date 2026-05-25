import { OpenAICompatibleProvider } from './openai-compatible'
import { AIVendor } from '@/types'

export class MiMoProvider extends OpenAICompatibleProvider {
  readonly name = 'Xiaomi MiMo'
  readonly vendor = AIVendor.MIMO
  protected readonly defaultBaseURL = 'https://token-plan-cn.xiaomimimo.com/v1'
  protected readonly supportsStreamOptions = true
}

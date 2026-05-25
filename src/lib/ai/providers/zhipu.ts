import { OpenAICompatibleProvider } from './openai-compatible'
import { AIVendor } from '@/types'

export class ZhipuProvider extends OpenAICompatibleProvider {
  readonly name = 'Zhipu AI (智谱)'
  readonly vendor = AIVendor.ZHIPU
  protected readonly defaultBaseURL = 'https://open.bigmodel.cn/api/paas/v4'
  protected readonly supportsStreamOptions = true
}

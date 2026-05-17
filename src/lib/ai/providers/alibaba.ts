import { OpenAICompatibleProvider } from './openai-compatible'
import { AIVendor } from '@/types'

export class AlibabaProvider extends OpenAICompatibleProvider {
  readonly name = 'Alibaba (DashScope)'
  readonly vendor = AIVendor.ALIBABA
  protected readonly defaultBaseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
}
